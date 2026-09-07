"""
VASP Attribution Engine — Advanced Typology Detector
======================================================
Detects 8 known FATF/FinCEN money laundering typologies from transaction paths.
All logic is pure Python — no external dependencies.

Reference: FATF "Virtual Assets Red Flag Indicators" (2020)
          FinCEN "Guidance on Virtual Currency" (2019)
"""

from typing import List, Dict, Any
from dataclasses import dataclass, field


@dataclass
class TypologyResult:
    name: str               # e.g. "PEEL_CHAIN"
    confidence: float       # 0.0 - 1.0
    description: str        # Human-readable explanation for LEA
    evidence: List[str]
    transaction_hashes: List[str] = field(default_factory=list)     # Specific data points that triggered detection


class TypologyDetector:
    """
    Detects known money laundering typologies from a BFS transaction path.
    Returns both the typology name and a human-readable explanation for LEA reports.
    """

    def detect(self, hops: list) -> List[str]:
        """Simple interface — returns list of typology code names."""
        results = self.detect_detailed(hops)
        return [r.name for r in results]

    def detect_detailed(self, hops: list) -> List[TypologyResult]:
        """Full interface — returns TypologyResult objects with evidence."""
        if not hops:
            return []

        found = []

        # Run all detectors
        detectors = [
            self._detect_peel_chain,
            self._detect_fan_out_layering,
            self._detect_round_trip,
            self._detect_structuring_smurfing,
            self._detect_layering,
            self._detect_rapid_fire,
            self._detect_consolidation,
            self._detect_u_turn,
        ]

        for detector in detectors:
            result = detector(hops)
            if result and result.confidence >= 0.5:
                found.append(result)

        # Sort by confidence (highest first)
        found.sort(key=lambda r: r.confidence, reverse=True)
        return found

    # ──────────────────────────────────────────────────────────────────────────
    # Typology 1: PEEL CHAIN
    # ──────────────────────────────────────────────────────────────────────────
    def _detect_peel_chain(self, hops: list) -> TypologyResult:
        """
        Peel chain: funds are reduced progressively hop-by-hop.
        Criminal sends 10 BTC → 9.5 → 9.0 → 8.5, keeping small 'change' at each step.
        Very common in Bitcoin and ETH-based laundering.
        """
        amounts = [h.amount for h in hops if h.amount > 0]
        if len(amounts) < 4:
            return TypologyResult("PEEL_CHAIN", 0.0, "", [])

        peel_hops = 0
        peel_ratios = []
        for i in range(1, len(amounts)):
            if amounts[i-1] > 0:
                ratio = amounts[i] / amounts[i-1]
                if 0.70 <= ratio <= 0.97:
                    peel_hops += 1
                    peel_ratios.append(ratio)

        confidence = peel_hops / (len(amounts) - 1)
        if confidence < 0.5:
            return TypologyResult("PEEL_CHAIN", 0.0, "", [])

        avg_reduction = (1 - sum(peel_ratios)/len(peel_ratios)) * 100 if peel_ratios else 0
        return TypologyResult(
            name="PEEL_CHAIN",
            confidence=confidence,
            description=(
                f"Peel chain pattern identified. Funds were progressively reduced "
                f"by an average of {avg_reduction:.1f}% per hop across {peel_hops} "
                f"consecutive transfers, consistent with systematic layering to "
                f"obscure the origin of funds."
            ),
            evidence=[
                f"Consistent amount reduction across {peel_hops}/{len(amounts)-1} hops",
                f"Average amount retained per hop: {100-avg_reduction:.1f}%",
                f"Pattern confidence: {confidence:.0%}",
            ],
            transaction_hashes=[h.tx_hash for h in hops]
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Typology 2: FAN-OUT LAYERING
    # ──────────────────────────────────────────────────────────────────────────
    def _detect_fan_out_layering(self, hops: list) -> TypologyResult:
        from_counts = {}
        tx_hashes = []
        for h in hops:
            if getattr(h, 'is_vasp', False):
                continue
            addr = h.from_address
            from_counts[addr] = from_counts.get(addr, 0) + 1
            if from_counts[addr] >= 3:
                tx_hashes.append(h.tx_hash)

        max_out = max(from_counts.values()) if from_counts else 0

        if max_out < 3:
            return TypologyResult("FAN_OUT", 0.0, "", [])

        confidence = min(1.0, (max_out - 2) / 5.0)

        return TypologyResult(
            name="FAN_OUT",
            confidence=confidence,
            description=f"Fan-out layering detected. A single non-VASP wallet split funds into {max_out} separate downstream wallets.",
            evidence=[f"Split into {max_out} addresses"],
            transaction_hashes=tx_hashes
        )

        confidence = min(1.0, (max_fan - 2) / 5.0)  # Scales 3→0.2, 7→1.0
        short_addr = max_addr[:10] + "..." if len(max_addr) > 10 else max_addr

        return TypologyResult(
            name="FAN_OUT_LAYERING",
            confidence=confidence,
            description=(
                f"Fan-out layering pattern detected. A single wallet ({short_addr}) "
                f"distributed funds to {max_fan} different addresses simultaneously. "
                f"This is a classic technique to split funds and overwhelm investigators "
                f"with multiple transaction threads."
            ),
            evidence=[
                f"Single source address sent to {max_fan} distinct destinations",
                f"Source wallet: {max_addr}",
                f"Fan-out confidence: {confidence:.0%}",
            ],
            transaction_hashes=[h.tx_hash for h in hops]
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Typology 3: ROUND TRIP (Boomerang)
    # ──────────────────────────────────────────────────────────────────────────
    def _detect_round_trip(self, hops: list) -> TypologyResult:
        """
        Round-trip: funds eventually return to a wallet seen earlier in the path.
        Used to simulate 'legitimate' business transactions and inflate volume.
        """
        seen = set()
        revisited = set()
        for h in hops:
            if h.from_address in seen:
                revisited.add(h.from_address)
            if h.to_address in seen:
                revisited.add(h.to_address)
            seen.add(h.from_address)
            seen.add(h.to_address)

        if not revisited:
            return TypologyResult("ROUND_TRIP", 0.0, "", [])

        confidence = min(1.0, len(revisited) / 3.0)
        return TypologyResult(
            name="ROUND_TRIP",
            confidence=confidence,
            description=(
                f"{len(revisited)} wallet(s) in the transaction path appear "
                f"multiple times, indicating funds were cycled back through "
                f"previously-used addresses. This 'boomerang' pattern is used "
                f"to simulate legitimate business activity and inflate reported volume."
            ),
            evidence=[
                f"{len(revisited)} addresses reused in transaction path",
                f"Reused addresses: {list(revisited)[:3]}",
            ]
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Typology 4: STRUCTURING / SMURFING
    # ──────────────────────────────────────────────────────────────────────────
    def _detect_structuring_smurfing(self, hops: list) -> TypologyResult:
        """
        Structuring: multiple transactions just below reporting thresholds ($10K).
        Named 'smurfing' when multiple people (smurfs) carry out the small transactions.
        """
        # Check multiple USD thresholds used globally
        thresholds = [
            (8000, 9999, "$10K USD"),      # USA, EU threshold
            (45000, 49999, "₹50K INR"),    # India threshold (PMLA)
        ]

        total_suspicious = 0
        triggered_threshold = None

        for h in hops:
            amount_usd = getattr(h, 'value_usd', 0) or h.amount
            for low, high, label in thresholds:
                if low <= amount_usd <= high:
                    total_suspicious += 1
                    triggered_threshold = label
                    break

        if total_suspicious < 2:
            return TypologyResult("STRUCTURING_SMURFING", 0.0, "", [])

        confidence = min(1.0, total_suspicious / 5.0)
        return TypologyResult(
            name="STRUCTURING_SMURFING",
            confidence=confidence,
            description=(
                f"Structuring (Smurfing) pattern detected. {total_suspicious} "
                f"transactions were identified just below the {triggered_threshold} "
                f"reporting threshold. This is a deliberate tactic to avoid "
                f"mandatory CTR (Currency Transaction Report) filings."
            ),
            evidence=[
                f"{total_suspicious} transactions clustered near reporting threshold",
                f"Targeted threshold: {triggered_threshold}",
            ],
            transaction_hashes=[h.tx_hash for h in hops]
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Typology 5: LAYERING
    # ──────────────────────────────────────────────────────────────────────────
    def _detect_layering(self, hops: list) -> TypologyResult:
        """
        Classic three-stage laundering: Placement → Layering → Integration.
        Layering stage: funds moved through 5+ intermediaries with unique addresses.
        """
        unique_to = len(set(h.to_address for h in hops))
        if len(hops) < 5 or unique_to < 4:
            return TypologyResult("LAYERING", 0.0, "", [])

        confidence = min(1.0, (len(hops) - 4) / 6.0)
        return TypologyResult(
            name="LAYERING",
            confidence=confidence,
            description=(
                f"Classic layering pattern identified. Funds were moved through "
                f"{len(hops)} hops involving {unique_to} unique intermediary "
                f"addresses. This corresponds to the 'Layering' stage of the "
                f"standard three-stage AML model (Placement → Layering → Integration), "
                f"designed to distance funds from their criminal origin."
            ),
            evidence=[
                f"{len(hops)} total hops in the trace path",
                f"{unique_to} unique destination addresses",
                f"Layering confidence: {confidence:.0%}",
            ],
            transaction_hashes=[h.tx_hash for h in hops]
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Typology 6: RAPID-FIRE TRANSFERS
    # ──────────────────────────────────────────────────────────────────────────
    def _detect_rapid_fire(self, hops: list) -> TypologyResult:
        """
        Funds hop between wallets within seconds/minutes of arriving.
        This 'hot potato' pattern is a strong automated bot indicator.
        """
        rapid_count = 0
        timestamps = []
        for h in hops:
            ts = getattr(h, 'timestamp', None)
            if ts:
                try:
                    timestamps.append(ts.timestamp())
                except Exception:
                    pass

        if len(timestamps) < 3:
            return TypologyResult("RAPID_FIRE", 0.0, "", [])

        timestamps.sort()
        for i in range(1, len(timestamps)):
            gap = timestamps[i] - timestamps[i-1]
            if gap < 300:  # Less than 5 minutes
                rapid_count += 1

        ratio = rapid_count / (len(timestamps) - 1)
        if ratio < 0.4:
            return TypologyResult("RAPID_FIRE", 0.0, "", [])

        return TypologyResult(
            name="RAPID_FIRE",
            confidence=ratio,
            description=(
                f"{rapid_count} of {len(timestamps)-1} transaction hops occurred "
                f"within 5 minutes of the previous one. This 'hot potato' velocity "
                f"strongly suggests automated bot activity designed to rapidly "
                f"move funds before investigators can track them."
            ),
            evidence=[
                f"{rapid_count}/{len(timestamps)-1} hops under 5-minute intervals",
                f"Rapid-hop ratio: {ratio:.0%}",
            ],
            transaction_hashes=[h.tx_hash for h in hops]
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Typology 7: CONSOLIDATION (Aggregation)
    # ──────────────────────────────────────────────────────────────────────────
    def _detect_consolidation(self, hops: list) -> TypologyResult:
        to_counts = {}
        tx_hashes = []
        for h in hops:
            if getattr(h, 'is_vasp', False):
                continue
            addr = h.to_address
            to_counts[addr] = to_counts.get(addr, 0) + 1
            if to_counts[addr] >= 4:
                tx_hashes.append(h.tx_hash)

        max_in = max(to_counts.values()) if to_counts else 0
        
        if max_in < 4:
            return TypologyResult("CONSOLIDATION", 0.0, "", [])

        confidence = min(1.0, (max_in - 3) / 5.0)

        return TypologyResult(
            name="CONSOLIDATION",
            confidence=confidence,
            description=f"Consolidation pattern detected. {max_in} separate non-VASP wallets sent funds to a single destination.",
            evidence=[f"{max_in} inputs to one address"],
            transaction_hashes=tx_hashes
        )

        confidence = min(1.0, (max_in - 3) / 5.0)
        short_addr = max_addr[:10] + "..." if len(max_addr) > 10 else max_addr

        return TypologyResult(
            name="CONSOLIDATION",
            confidence=confidence,
            description=(
                f"Consolidation (aggregation) pattern detected. {max_in} separate "
                f"wallets all sent funds to a single destination wallet ({short_addr}). "
                f"This is typically the final step before depositing to an exchange "
                f"(integration stage of money laundering)."
            ),
            evidence=[
                f"{max_in} wallets converging to a single destination",
                f"Aggregation wallet: {max_addr}",
            ],
            transaction_hashes=[h.tx_hash for h in hops]
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Typology 8: U-TURN (Apparent Contradiction)
    # ──────────────────────────────────────────────────────────────────────────
    def _detect_u_turn(self, hops: list) -> TypologyResult:
        """
        Funds go A → B → C → ... → A. A near-complete loop back to the origin.
        Used to simulate 'self-payment' and confuse investigators.
        """
        if len(hops) < 4:
            return TypologyResult("U_TURN", 0.0, "", [])

        origin = hops[0].from_address if hops else ""
        destinations = [h.to_address for h in hops]

        if origin in destinations[2:]:  # Loop back after at least 3 hops
            loop_position = destinations.index(origin, 2)
            return TypologyResult(
                name="U_TURN",
                confidence=0.85,
                description=(
                    f"U-Turn pattern detected. Funds originated from wallet "
                    f"{origin[:10]}... and returned to the same wallet after "
                    f"{loop_position + 1} hops. This circular pattern is used "
                    f"to simulate legitimate transactions and inflate reported volume."
                ),
                evidence=[
                    f"Origin wallet reappears as destination after {loop_position+1} hops",
                    f"Origin: {origin}",
                ],
            transaction_hashes=[h.tx_hash for h in hops]
        )

        return TypologyResult("U_TURN", 0.0, "", [])
