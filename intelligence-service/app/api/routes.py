from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from app.services.risk_scorer import RiskScorer
from app.services.typology_detector import TypologyDetector
from app.services.report_generator import ReportGenerator
import os

router = APIRouter()
scorer = RiskScorer()
detector = TypologyDetector()
report_gen = ReportGenerator()

# ── Request / Response Models ──────────────────────────────

class CrossChainEvidence(BaseModel):
    source_chain: str
    source_tx_hash: str
    dest_chain: str
    dest_tx_hash: str
    bridge_protocol: str
    correlation_level: str
    message_id: Optional[str] = None
    time_delta_seconds: int

class TraceHop(BaseModel):
    hop_number: int
    from_address: str
    to_address: str
    tx_hash: str
    amount: float
    token_symbol: str
    price_fetched: Optional[float] = 1.0
    timestamp: Optional[str] = None
    entity_name: Optional[str] = None
    is_vasp: bool = False
    cross_chain: Optional[CrossChainEvidence] = None

class ScoreRequest(BaseModel):
    address: str
    chain: str
    hops: Optional[List[TraceHop]] = []
    vasp_name: Optional[str] = None

class ScoreResponse(BaseModel):
    address: str
    chain: str
    risk_score: float        # 0-100
    risk_level: str          # low / medium / high / critical
    typologies: List[str]    # detected laundering patterns
    flags: List[str]         # specific risk flags
    contributors: Optional[Dict[str, float]] = None
    confidence: float
    features: Optional[Dict[str, Any]] = None  # ML feature breakdown

class VASPInfo(BaseModel):
    address: Optional[str] = None
    vasp_name: Optional[str] = None
    vasp_type: Optional[str] = None
    risk_level: Optional[str] = None
    confidence: Optional[float] = None
    source: Optional[str] = None

class ReportRequest(BaseModel):
    case_id: str
    submitted_by: Optional[str] = "LEA Officer"
    created_at: Optional[str] = None
    suspect_address: str
    chain: str
    status: Optional[str] = "completed"
    hops_traced: Optional[int] = 0
    path: Optional[List[TraceHop]] = []
    found_vasp: Optional[VASPInfo] = None
    risk_score: Optional[float] = 0.0
    risk_level: Optional[str] = "low"
    risk_flags: Optional[List[str]] = []
    typologies: Optional[List[str]] = []
    confidence: Optional[float] = 0.0

class TimelineEvent(BaseModel):
    timestamp: str
    description: str
    transaction_hashes: List[str]
    is_cross_chain: bool = False

class TypologyResultOut(BaseModel):
    name: str
    confidence: float
    description: str
    evidence: List[str]
    transaction_hashes: List[str]

class CaseIntelligenceResponse(BaseModel):
    case_id: str
    overall_risk_score: float
    risk_contributors: Dict[str, float]
    risk_level: str
    major_findings: List[str]
    typologies: List[TypologyResultOut]
    timeline: List[TimelineEvent]
    important_wallets: List[str]
    important_entities: List[str]
    cross_chain_activity: bool
    provenance: Dict[str, str]

class CaseIntelligenceRequest(BaseModel):
    case_id: str
    suspect_address: str
    chain: str
    path: List[TraceHop]


# ── Endpoints ─────────────────────────────────────────────

@router.post("/score", response_model=ScoreResponse)
def score_wallet(req: ScoreRequest):
    """
    Calculate a risk score for a wallet based on its transaction path.
    Called by the Go backend after a BFS trace completes.
    Returns the full feature breakdown for explainability.
    """
    result = scorer.score_with_features(req.address, req.chain, req.hops)
    typologies = detector.detect(req.hops)

    return ScoreResponse(
        address=req.address,
        chain=req.chain,
        risk_score=result["risk_score"],
        risk_level=result["risk_level"],
        typologies=typologies,
        flags=result["flags"],
        contributors=result.get("contributors", {}),
        confidence=85.0,
        features=result["features"],
    )

@router.post("/typology")
def detect_typology(hops: List[TraceHop]):
    """
    Detect laundering typologies from a transaction path.
    Returns typology codes + detailed descriptions for LEA reports.
    """
    detector_full = TypologyDetector()
    detailed = detector_full.detect_detailed(hops)
    simple = [r.name for r in detailed]
    descriptions = {r.name: r.description for r in detailed}
    evidence = {r.name: r.evidence for r in detailed}

    return {
        "typologies": simple,
        "count": len(simple),
        "descriptions": descriptions,
        "evidence": evidence,
    }

@router.post("/report")
def generate_report(req: ReportRequest):
    """
    Generate a court-admissible PDF report with SHA-256 chain-of-custody hash.
    Returns the filename and integrity hash. Download via GET /report/{filename}.
    """
    try:
        case_dict = req.model_dump()

        # Convert found_vasp to dict if present
        if case_dict.get("found_vasp"):
            case_dict["found_vasp"] = dict(case_dict["found_vasp"]) if case_dict["found_vasp"] else None

        result = report_gen.generate(case_dict)
        return {
            "success": True,
            "filename": result["filename"],
            "sha256_hash": result["sha256_hash"],
            "generated_at": result["generated_at"],
            "download_url": f"/report/{result['filename']}",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

@router.get("/report/{filename}")
def download_report(filename: str):
    """
    Download a previously generated PDF report by filename.
    """
    from app.services.report_generator import REPORTS_DIR
    filepath = REPORTS_DIR / filename

    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Report not found")

    # Security: prevent path traversal attacks
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    return FileResponse(
        path=str(filepath),
        media_type="application/pdf",
        filename=filename,
    )

# ── Mock SAHYOG Receiver ────────────────────────────────────────

@router.post("/sahyog-mock")
def mock_sahyog_receiver(payload: Dict[str, Any]):
    """
    MOCK ENDPOINT FOR SIH DEMO.
    Simulates the Government of India SAHYOG portal receiving the case result.
    """
    print("\n" + "="*60)
    print("🚨 [MOCK SAHYOG PORTAL] WEBHOOK RECEIVED 🚨")
    print("="*60)
    print(f"Case ID      : {payload.get('case_id')}")
    print(f"Suspect      : {payload.get('suspect_address')}")
    print(f"Chain        : {payload.get('chain').upper()}")
    print(f"Status       : {payload.get('status').upper()}")
    print(f"Found VASP   : {payload.get('found_vasp_name')} (Confidence: {payload.get('confidence')}%)")
    print(f"Hops Traced  : {payload.get('hops_traced')}")
    print("="*60 + "\n")

    return {"status": "success", "message": "SAHYOG Mock received the data"}


@router.post('/case-intelligence', response_model=CaseIntelligenceResponse)
def get_case_intelligence(req: CaseIntelligenceRequest):
    """
    Aggregates Phase 3/4/5 evidence into a complete Case Intelligence summary.
    """
    result = scorer.score_with_features(req.suspect_address, req.chain, req.path)
    
    detailed_typologies = detector.detect_detailed(req.path)
    typologies_out = []
    major_findings = []
    for r in detailed_typologies:
        typologies_out.append(TypologyResultOut(
            name=r.name,
            confidence=r.confidence,
            description=r.description,
            evidence=r.evidence,
            transaction_hashes=r.transaction_hashes
        ))
        major_findings.append(f'Detected {r.name} pattern with {r.confidence*100:.0f}% confidence.')
        
    important_wallets = list(set([h.from_address for h in req.path] + [h.to_address for h in req.path]))
    important_entities = list(set([h.entity_name for h in req.path if h.entity_name]))
    
    timeline = []
    has_cross_chain = False
    
    def get_ts(h):
        return h.timestamp if h.timestamp else '1970-01-01'
        
    sorted_hops = sorted(req.path, key=get_ts)
    
    for hop in sorted_hops:
        ts = hop.timestamp or 'Unknown Time'
        if hop.cross_chain:
            has_cross_chain = True
            desc = f'Verified Cross-Chain jump via {hop.cross_chain.bridge_protocol} from {hop.cross_chain.source_chain} to {hop.cross_chain.dest_chain}.'
            timeline.append(TimelineEvent(
                timestamp=ts,
                description=desc,
                transaction_hashes=[hop.cross_chain.source_tx_hash, hop.cross_chain.dest_tx_hash],
                is_cross_chain=True
            ))
        else:
            entity_str = f' ({hop.entity_name})' if hop.entity_name else ''
            desc = f'Transferred {hop.amount} {hop.token_symbol} to {hop.to_address}{entity_str}.'
            timeline.append(TimelineEvent(
                timestamp=ts,
                description=desc,
                transaction_hashes=[hop.tx_hash],
                is_cross_chain=False
            ))
            
    if not major_findings:
        major_findings.append('No specific money laundering typologies detected.')

    return CaseIntelligenceResponse(
        case_id=req.case_id,
        overall_risk_score=result['risk_score'],
        risk_contributors=result.get('contributors', {}),
        risk_level=result['risk_level'],
        major_findings=major_findings,
        typologies=typologies_out,
        timeline=timeline,
        important_wallets=important_wallets,
        important_entities=important_entities,
        cross_chain_activity=has_cross_chain,
        provenance={
            'scorer_version': '1.0',
            'rules_version': '1.2',
            'generated_by': 'VASP Intelligence Service Phase 6'
        }
    )
