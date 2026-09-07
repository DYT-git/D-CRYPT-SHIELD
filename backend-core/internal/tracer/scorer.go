package tracer

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"vasp-engine/internal/models"
)

// ============================================================
// ATTRIBUTION SCORER — Phase 4 VASP Attribution Engine
//
// Responsibilities:
//   1. RawCandidate → grouped by entity
//   2. Evidence computation per path
//   3. Deduplication of multiple addresses to single entity candidate
//   4. Ranking by attribution confidence
//   5. Explanation generation
//
// What this is NOT:
//   - Not a criminal risk scorer (Python handles that separately)
//   - Not a legal determination
//   - Not an ML model (fully deterministic and auditable)
// ============================================================

// RawCandidate is produced by the BFS engine each time a known entity address
// is encountered. Multiple RawCandidates for the same entity will be
// deduplicated into one AttributionCandidate.
type RawCandidate struct {
	EntityAddr    models.EntityAddress
	Path          []models.TraceHop
	HopDistance   int
}

// ScorerConfig holds reference values for calculating value continuity.
type ScorerConfig struct {
	// If > 0, use this as the denominator for value continuity.
	// If == 0, use the first hop's value instead.
	KnownStolenAmountUSD float64
}

// addressTypeWeight returns the attribution strength weight (0–1) for a given address type.
// Ordered from strongest to weakest evidence:
//
//	deposit_address     → 1.00 (per-user; most specific possible match)
//	hot_wallet          → 0.90 (VASP infrastructure, high confidence)
//	cold_wallet         → 0.85 (VASP controlled, but infrequent use)
//	exchange_controlled → 0.75
//	service_wallet      → 0.70
//	entity_associated   → 0.55 (association confirmed but role unclear)
//	cluster_associated  → 0.25 (WCC-derived; NOT treated as ownership proof)
//	unknown             → 0.10 (fallback)
func addressTypeWeight(addrType string) float64 {
	weights := map[string]float64{
		"deposit_address":    1.00,
		"hot_wallet":         0.90,
		"cold_wallet":        0.85,
		"exchange_controlled": 0.75,
		"service_wallet":     0.70,
		"entity_associated":  0.55,
		"cluster_associated": 0.25,
		"unknown":            0.10,
	}
	if w, ok := weights[addrType]; ok {
		return w
	}
	return 0.10
}

// sourceWeight converts source reliability (0–1) to a scoring weight,
// with an additional freshness penalty for stale labels (>180 days).
func sourceWeight(reliability float64, lastVerified time.Time) float64 {
	// Freshness penalty: labels not verified in >180 days lose weight
	daysSince := time.Since(lastVerified).Hours() / 24
	freshnessFactor := 1.0
	if daysSince > 180 {
		// Linear decay: 0.5 weight at 1 year, minimum 0.3
		freshnessFactor = math.Max(0.3, 1.0-(daysSince-180)/(365.0))
	}
	return reliability * freshnessFactor
}

// pathDecayMultiplier applies a controlled decay based on hop distance
// and value continuity. Both signals must support the attribution.
//
// Hop decay formula: 1 / (1 + 0.3 * (hops - 1))
// This produces: 1 hop→1.0, 2 hops→0.77, 4 hops→0.53, 8 hops→0.32
//
// Value continuity multiplier: linear, 0% continuity = 0.05 floor, 100% = 1.0
//
// Final = hopDecay * continuityMultiplier
func pathDecayMultiplier(hops int, valueContinuityPct float64) float64 {
	if hops <= 0 {
		hops = 1
	}
	hopDecay := 1.0 / (1.0 + 0.3*float64(hops-1))

	// Continuity below 5% severely penalises: near-zero transfer is likely
	// unrelated (e.g. gas payment, test transaction) — not money laundering path.
	continuityMult := math.Max(0.05, valueContinuityPct/100.0)

	return hopDecay * continuityMult
}

// confidenceLevel converts a numeric confidence (0–100) to the
// LEA-friendly verbal description. These MUST NOT be described as
// "legal certainty" or "definitive proof" in any UI or report.
func confidenceLevel(score float64) string {
	switch {
	case score >= 90:
		return "Very Strong"
	case score >= 75:
		return "Strong"
	case score >= 50:
		return "Moderate"
	default:
		return "Weak"
	}
}

// attributionType derives a summary label for the investigator describing
// the strongest relationship between the path and the entity.
func attributionType(addrType string) string {
	switch addrType {
	case "deposit_address":
		return "Direct Deposit"
	case "hot_wallet", "cold_wallet":
		return "Infrastructure"
	case "exchange_controlled", "service_wallet":
		return "Exchange-Controlled"
	case "entity_associated":
		return "Entity Association"
	case "cluster_associated":
		return "Cluster Inference"
	default:
		return "Unknown Interaction"
	}
}

// computePathMetrics extracts quantitative evidence from a trace path.
// denominator (known stolen amount or first-hop value) is passed in explicitly
// so the scorer never invents a stolen amount.
func computePathMetrics(path []models.TraceHop, denominator float64, methodology string) models.PathMetrics {
	if len(path) == 0 {
		return models.PathMetrics{
			ContinuityMethodology: methodology,
			TimestampsMonotonic:   true,
		}
	}

	lastHop := path[len(path)-1]
	valueAtCandidate := lastHop.Amount // native token; best available without a second USD lookup

	var continuityPct float64
	if denominator > 0 && valueAtCandidate > 0 {
		continuityPct = math.Min(100.0, (valueAtCandidate/denominator)*100.0)
	}

	// Temporal span
	firstHop := path[0]
	var spanHours float64
	if !firstHop.Timestamp.IsZero() && !lastHop.Timestamp.IsZero() {
		spanHours = lastHop.Timestamp.Sub(firstHop.Timestamp).Hours()
	}

	// Check monotonicity
	monotonic := true
	for i := 1; i < len(path); i++ {
		if path[i].Timestamp.Before(path[i-1].Timestamp) {
			monotonic = false
			break
		}
	}

	return models.PathMetrics{
		HopDistance:           len(path),
		ValueAtCandidate:      valueAtCandidate,
		InitialTracedValue:    denominator,
		ValueContinuityPct:    continuityPct,
		ContinuityMethodology: methodology,
		TemporalSpanHours:     spanHours,
		TimestampsMonotonic:   monotonic,
	}
}

// buildExplanation produces a plain-English justification string for the investigator.
// This makes confidence auditable without requiring technical knowledge.
func buildExplanation(
	entityName, addrType string,
	addrWeight, srcWeight, decay, finalScore float64,
	pm models.PathMetrics,
	limitations []string,
) string {
	b := strings.Builder{}
	fmt.Fprintf(&b, "%s identified as candidate. ", entityName)
	fmt.Fprintf(&b, "Address type: '%s' (weight %.2f). ", addrType, addrWeight)
	fmt.Fprintf(&b, "Source reliability weight: %.2f. ", srcWeight)
	fmt.Fprintf(&b, "Path: %d hop(s), value continuity %.1f%% (%s). ",
		pm.HopDistance, pm.ValueContinuityPct, pm.ContinuityMethodology)
	fmt.Fprintf(&b, "Path decay factor: %.2f. ", decay)
	fmt.Fprintf(&b, "Attribution confidence: %.1f/100.", finalScore)
	if len(limitations) > 0 {
		fmt.Fprintf(&b, " Limitations: %s.", strings.Join(limitations, "; "))
	}
	return b.String()
}

// ScoreCandidates takes raw BFS candidates, deduplicates by entity,
// scores each entity's evidence, and returns a ranked attribution result.
//
// Evidence deduplication rule: multiple paths to the same entity are preserved
// as SupportingPaths but do NOT inflate confidence when they share the same
// underlying OSINT source (correlated evidence is not double-counted).
func ScoreCandidates(
	rawCandidates []RawCandidate,
	cfg ScorerConfig,
) []models.AttributionCandidate {

	if len(rawCandidates) == 0 {
		return nil
	}

	// ── Group raw candidates by EntityID ─────────────────────────────────────
	byEntity := make(map[int64][]RawCandidate)
	for _, rc := range rawCandidates {
		byEntity[rc.EntityAddr.EntityID] = append(byEntity[rc.EntityAddr.EntityID], rc)
	}

	// Determine the baseline denominator for value continuity
	baselineDenominator := cfg.KnownStolenAmountUSD
	methodology := "case_amount"
	if baselineDenominator <= 0 {
		methodology = "first_hop_value"
		// Will be filled per-candidate from the first hop
	}

	var results []models.AttributionCandidate

	for _, candidates := range byEntity {
		if len(candidates) == 0 {
			continue
		}

		entity := candidates[0].EntityAddr

		// ── Score each path for this entity ──────────────────────────────────
		type scoredEvidence struct {
			evidence models.AttributionEvidence
			score    float64
			source   string // used to detect correlated evidence
		}
		var scored []scoredEvidence
		var limitations []string

		for _, rc := range candidates {
			denom := baselineDenominator
			meth := methodology
			if denom <= 0 && len(rc.Path) > 0 {
				denom = rc.Path[0].Amount
			}

			pm := computePathMetrics(rc.Path, denom, meth)

			// Freshness tracking
			daysSince := time.Since(rc.EntityAddr.LastVerified).Hours() / 24
			isStale := daysSince > 180

			prov := models.SourceProvenance{
				Name:          rc.EntityAddr.Source,
				SourceType:    rc.EntityAddr.SourceType,
				Reliability:   rc.EntityAddr.Reliability,
				LastVerified:  rc.EntityAddr.LastVerified,
				FreshnessDays: int(daysSince),
				IsStale:       isStale,
			}

			addrW := addressTypeWeight(rc.EntityAddr.AddressType)
			srcW := sourceWeight(rc.EntityAddr.Reliability, rc.EntityAddr.LastVerified)
			decay := pathDecayMultiplier(pm.HopDistance, pm.ValueContinuityPct)

			// Score: base 100 × address type × source quality × path decay
			score := 100.0 * addrW * srcW * decay

			// Collect limitations
			var pathLimitations []string
			if isStale {
				msg := fmt.Sprintf("Label for '%s' not verified in >%.0f days — verify before use in legal proceedings",
					entity.EntityName, daysSince)
				pathLimitations = append(pathLimitations, msg)
			}
			if pm.ValueContinuityPct < 5 && pm.ValueContinuityPct > 0 {
				pathLimitations = append(pathLimitations, "Value continuity <5% — this may be an unrelated interaction, not the laundering path")
			}
			if !pm.TimestampsMonotonic {
				pathLimitations = append(pathLimitations, "Non-monotonic timestamps detected in path — verify blockchain data integrity")
			}
			if rc.EntityAddr.AddressType == "cluster_associated" {
				pathLimitations = append(pathLimitations, "Cluster-associated address: derived from WCC graph inference, NOT source-confirmed ownership")
			}

			ev := models.AttributionEvidence{
				MatchType:           "entity_lookup",
				MatchedAddress:      rc.EntityAddr.Address,
				AddressType:         rc.EntityAddr.AddressType,
				Source:              prov,
				Path:                rc.Path,
				PathMetrics:         pm,
				AddressTypeWeight:   addrW,
				SourceWeight:        srcW,
				PathDecayMultiplier: decay,
				Explanation:         buildExplanation(entity.EntityName, rc.EntityAddr.AddressType, addrW, srcW, decay, score, pm, pathLimitations),
			}

			scored = append(scored, scoredEvidence{
				evidence: ev,
				score:    score,
				source:   rc.EntityAddr.Source,
			})

			for _, l := range pathLimitations {
				limitations = append(limitations, l)
			}
		}

		if len(scored) == 0 {
			continue
		}

		// Sort by score descending
		sort.Slice(scored, func(i, j int) bool {
			return scored[i].score > scored[j].score
		})

		// Primary evidence = highest-scoring path
		primary := scored[0]

		// Supporting paths = remaining paths
		// Deduplication: if multiple paths share the same source string,
		// they are correlated — we keep them as supporting evidence but
		// their score is NOT added to build a higher composite confidence.
		// Final confidence = primary path score only (no double counting).
		var supporting []models.AttributionEvidence
		for i := 1; i < len(scored); i++ {
			supporting = append(supporting, scored[i].evidence)
		}

		// Deduplicate limitation strings
		seen := make(map[string]bool)
		var dedupedLimitations []string
		for _, l := range limitations {
			if !seen[l] {
				dedupedLimitations = append(dedupedLimitations, l)
				seen[l] = true
			}
		}

		finalScore := math.Min(100.0, primary.score)
		candidate := models.AttributionCandidate{
			EntityID:        entity.EntityID,
			EntityName:      entity.EntityName,
			EntityType:      entity.EntityType,
			Confidence:      finalScore,
			ConfidenceLevel: confidenceLevel(finalScore),
			AttributionType: attributionType(primary.evidence.AddressType),
			PrimaryEvidence: primary.evidence,
			SupportingPaths: supporting,
			Limitations:     dedupedLimitations,
		}
		results = append(results, candidate)
	}

	// ── Rank candidates by confidence descending ──────────────────────────────
	sort.Slice(results, func(i, j int) bool {
		return results[i].Confidence > results[j].Confidence
	})

	return results
}
