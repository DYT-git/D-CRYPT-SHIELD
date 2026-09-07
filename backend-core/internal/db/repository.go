package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"vasp-engine/internal/models"
)

// Repository handles all PostgreSQL queries for the VASP engine.
type Repository struct {
	db *sql.DB
}

// NewRepository creates a new repository with the given DB pool.
func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// -----------------------------------------------------------
// VASP LABEL QUERIES
// -----------------------------------------------------------

// LookupVASP checks if an address is a known VASP in the attribution database.
// Returns nil if the address is not found (not a known VASP).
// Preserved for Phase 3 backward compatibility.
func (r *Repository) LookupVASP(ctx context.Context, address, chain string) (*models.VASPHit, error) {
	query := `
		SELECT address, chain, vasp_name, vasp_type, confidence, risk_level, source
		FROM vasp_labels
		WHERE LOWER(address) = LOWER($1) AND LOWER(chain) = LOWER($2)
		LIMIT 1
	`
	row := r.db.QueryRowContext(ctx, query, address, chain)

	hit := &models.VASPHit{}
	err := row.Scan(
		&hit.Address,
		&hit.Chain,
		&hit.VASPName,
		&hit.VASPType,
		&hit.Confidence,
		&hit.RiskLevel,
		&hit.Source,
	)
	if err == sql.ErrNoRows {
		return nil, nil // Not a known VASP
	}
	if err != nil {
		return nil, fmt.Errorf("vasp lookup failed: %w", err)
	}
	return hit, nil
}

// LookupEntityAddress is the Phase 4 entity-aware attribution lookup.
// Primary: queries entity_addresses JOIN entities for normalized attribution data.
// Fallback: if entity_addresses table is empty or address is not found there,
//           falls back to vasp_labels so existing attribution continues to work.
func (r *Repository) LookupEntityAddress(ctx context.Context, address, chain string) (*models.EntityAddress, error) {
	// ── Primary: normalized entity_addresses table ────────────────────────────
	query := `
		SELECT
			ea.entity_id,
			e.name         AS entity_name,
			e.entity_type,
			ea.address,
			ea.chain,
			ea.address_type,
			COALESCE(ea.source, '')      AS source,
			COALESCE(ea.source_type, '') AS source_type,
			COALESCE(ea.reliability, 0.8) AS reliability,
			COALESCE(ea.last_verified, NOW()) AS last_verified
		FROM entity_addresses ea
		JOIN entities e ON e.id = ea.entity_id
		WHERE LOWER(ea.address) = LOWER($1)
		  AND LOWER(ea.chain)   = LOWER($2)
		LIMIT 1
	`
	row := r.db.QueryRowContext(ctx, query, address, chain)

	ea := &models.EntityAddress{}
	err := row.Scan(
		&ea.EntityID,
		&ea.EntityName,
		&ea.EntityType,
		&ea.Address,
		&ea.Chain,
		&ea.AddressType,
		&ea.Source,
		&ea.SourceType,
		&ea.Reliability,
		&ea.LastVerified,
	)
	if err == nil {
		return ea, nil
	}
	if err != sql.ErrNoRows {
		// Real DB error — log and fall through to vasp_labels fallback
		_ = fmt.Errorf("entity_addresses lookup error (will fallback): %w", err)
	}

	// ── Fallback: vasp_labels (Phase 3 backward compatibility) ───────────────
	vl := &models.VASPHit{}
	fallbackQuery := `
		SELECT address, chain, vasp_name, vasp_type, confidence, risk_level, source
		FROM vasp_labels
		WHERE LOWER(address) = LOWER($1) AND LOWER(chain) = LOWER($2)
		LIMIT 1
	`
	row2 := r.db.QueryRowContext(ctx, fallbackQuery, address, chain)
	err2 := row2.Scan(&vl.Address, &vl.Chain, &vl.VASPName, &vl.VASPType, &vl.Confidence, &vl.RiskLevel, &vl.Source)
	if err2 == sql.ErrNoRows {
		return nil, nil // Not found in either table
	}
	if err2 != nil {
		return nil, fmt.Errorf("vasp_labels fallback lookup failed: %w", err2)
	}

	// Synthesize an EntityAddress from vasp_labels row
	// entity_id 0 signals "migrated from vasp_labels — no entity record yet"
	return &models.EntityAddress{
		EntityID:    0,
		EntityName:  vl.VASPName,
		EntityType:  vl.VASPType,
		Address:     vl.Address,
		Chain:       vl.Chain,
		AddressType: "entity_associated", // Conservative default for unmigrated data
		Source:      vl.Source,
		SourceType:  "osint",
		Reliability: vl.Confidence / 100.0,
		LastVerified: time.Now(), // vasp_labels has no last_verified; use now as conservative estimate
	}, nil
}


// LookupBridge queries the bridges registry, falling back to a hardcoded map if not found or DB fails.
func (r *Repository) LookupBridge(ctx context.Context, address string) (string, string, bool) {
	// 1. Try PostgreSQL
	var name, protocol string
	err := r.db.QueryRowContext(ctx, "SELECT name, protocol FROM bridges WHERE address = $1", address).Scan(&name, &protocol)
	if err == nil {
		return name, protocol, true
	}

	// 2. Fallback to hardcoded known bridges
	knownBridges := map[string]struct{ Name, Protocol string }{
		"0xa0c68c638235ee32657e8f720a23cec1bfc77c77": {"Polygon Bridge", "Polygon PoS"},
		"0x99c9fc46f92e8a1c0de1b1f3f31af08a58f00000": {"Optimism Bridge", "Optimism Gateway"},
		"0x401F6c983eA34274ec46f84D70b31C151321188b": {"Arbitrum Bridge", "Arbitrum Inbox"},
		"0x3ee18B2214AFF97000D974cf647E7C347E8fa585": {"Wormhole Bridge", "Wormhole"},
	}

	if b, found := knownBridges[address]; found {
		return b.Name, b.Protocol, true
	}

	return "", "", false
}

// -----------------------------------------------------------
// INVESTIGATION CASE QUERIES
// -----------------------------------------------------------

// CreateCase inserts a new investigation case and returns its ID.
func (r *Repository) CreateCase(ctx context.Context, req models.TraceRequest) error {
	query := `
		INSERT INTO investigation_cases (case_id, suspect_address, chain, status, submitted_by)
		VALUES ($1, $2, $3, 'pending', $4)
		ON CONFLICT (case_id) DO NOTHING
	`
	_, err := r.db.ExecContext(ctx, query,
		req.CaseID,
		req.SuspectAddress,
		req.Chain,
		req.SubmittedBy,
	)
	if err != nil {
		return fmt.Errorf("create case failed: %w", err)
	}
	return nil
}

// UpdateCaseStatus updates a case status during tracing.
func (r *Repository) UpdateCaseStatus(ctx context.Context, caseID, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE investigation_cases SET status = $1, updated_at = NOW() WHERE case_id = $2`,
		status, caseID,
	)
	return err
}

// UpdateCaseResult writes the final attribution result to the case record.
func (r *Repository) UpdateCaseResult(ctx context.Context, caseID string, vaspName string, confidence float64, hops int, rankedCandidates []models.AttributionCandidate) error {
	var candidatesJSON []byte
	var err error
	if rankedCandidates != nil {
		candidatesJSON, err = json.Marshal(rankedCandidates)
		if err != nil {
			log.Printf("[WARN] Failed to marshal ranked_candidates for case %s: %v", caseID, err)
			candidatesJSON = nil
		}
	}

	query := `
		UPDATE investigation_cases
		SET status = 'completed',
		    result_vasp = $2,
		    confidence = $3,
		    hops_traced = $4,
		    attribution_result = $5,
		    updated_at = NOW()
		WHERE case_id = $1
	`
	_, err = r.db.ExecContext(ctx, query, caseID, vaspName, confidence, hops, candidatesJSON)
	return err
}

// GetCase retrieves a single case by ID.
func (r *Repository) GetCase(ctx context.Context, caseID string) (*models.CaseResult, error) {
	query := `
		SELECT case_id, suspect_address, chain, status,
		       COALESCE(result_vasp, ''), COALESCE(confidence, 0),
		       COALESCE(hops_traced, 0), COALESCE(submitted_by, ''),
		       created_at, updated_at, attribution_result, COALESCE(report_hash, '')
		FROM investigation_cases
		WHERE case_id = $1
	`
	row := r.db.QueryRowContext(ctx, query, caseID)

	c := &models.CaseResult{}
	var createdAt, updatedAt time.Time
	var resultVASP string
	var attrJSON []byte
	err := row.Scan(
		&c.CaseID, &c.SuspectAddress, &c.Chain, &c.Status,
		&resultVASP, &c.Confidence,
		&c.HopsTraced, &c.SubmittedBy,
		&createdAt, &updatedAt,
		&attrJSON,
		&c.ReportHash,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get case failed: %w", err)
	}

	c.CreatedAt = createdAt.Format(time.RFC3339)
	c.CompletedAt = updatedAt.Format(time.RFC3339)
	if resultVASP != "" {
		c.FoundVASP = &models.VASPHit{VASPName: resultVASP}
	}

	if len(attrJSON) > 0 {
		if err := json.Unmarshal(attrJSON, &c.RankedCandidates); err != nil {
			log.Printf("[WARN] Failed to unmarshal attribution_result for case %s: %v", caseID, err)
		}
	}

	// Fetch transaction hops
	hopQuery := `
		SELECT hop_number, from_address, to_address, COALESCE(tx_hash, ''), COALESCE(amount, 0), COALESCE(token_symbol, '')
		FROM transaction_traces
		WHERE case_id = $1
		ORDER BY hop_number ASC
	`
	rows, err := r.db.QueryContext(ctx, hopQuery, caseID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var hop models.TraceHop
			if err := rows.Scan(&hop.HopNumber, &hop.FromAddress, &hop.ToAddress, &hop.TxHash, &hop.Amount, &hop.TokenSymbol); err == nil {
				c.Path = append(c.Path, hop)
			}
		}
	}

	return c, nil
}

// ListCases retrieves all cases with optional status filter.
func (r *Repository) ListCases(ctx context.Context, status string) ([]models.CaseResult, error) {
	query := `
		SELECT case_id, suspect_address, chain, status,
		       COALESCE(result_vasp, ''), COALESCE(confidence, 0),
		       COALESCE(hops_traced, 0), COALESCE(submitted_by, ''),
		       created_at
		FROM investigation_cases
	`
	args := []interface{}{}
	if status != "" {
		query += " WHERE status = $1"
		args = append(args, status)
	}
	query += " ORDER BY created_at DESC LIMIT 100"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cases []models.CaseResult
	for rows.Next() {
		var c models.CaseResult
		var createdAt time.Time
		var resultVASP string
		if err := rows.Scan(
			&c.CaseID, &c.SuspectAddress, &c.Chain, &c.Status,
			&resultVASP, &c.Confidence,
			&c.HopsTraced, &c.SubmittedBy,
			&createdAt,
		); err != nil {
			continue
		}
		c.CreatedAt = createdAt.Format(time.RFC3339)
		if resultVASP != "" {
			c.FoundVASP = &models.VASPHit{VASPName: resultVASP}
		}
		cases = append(cases, c)
	}
	return cases, nil
}

// SaveTraceHop persists each hop of the BFS path to the DB for audit trail.
func (r *Repository) SaveTraceHop(ctx context.Context, caseID string, hop models.TraceHop, isVASP bool) error {
	query := `
		INSERT INTO transaction_traces
		(case_id, hop_number, from_address, to_address, tx_hash, amount, token_symbol, chain, timestamp, is_vasp_hit)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := r.db.ExecContext(ctx, query,
		caseID, hop.HopNumber, hop.FromAddress, hop.ToAddress,
		hop.TxHash, hop.Amount, hop.TokenSymbol, "ethereum",
		hop.Timestamp, isVASP,
	)
	return err
}

// UpdateReportHash updates the report hash for a case.
func (r *Repository) UpdateReportHash(ctx context.Context, caseID string, hash string) error {
	query := `
		UPDATE investigation_cases
		SET report_hash = $1, updated_at = NOW()
		WHERE case_id = $2
	`
	_, err := r.db.ExecContext(ctx, query, hash, caseID)
	return err
}

// SaveIntegrationOutboxRecord preserves a generated integration payload.
func (r *Repository) SaveIntegrationOutboxRecord(ctx context.Context, caseID, reqType, transport, payloadJSON, payloadHash, status string) error {
	query := `
		INSERT INTO integration_outbox (case_id, request_type, transport_method, payload_json, payload_hash, status)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err := r.db.ExecContext(ctx, query, caseID, reqType, transport, payloadJSON, payloadHash, status)
	return err
}
