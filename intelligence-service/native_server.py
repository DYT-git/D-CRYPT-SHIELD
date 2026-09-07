import http.server
import json
from dataclasses import dataclass
from typing import List, Optional, Any, Dict
import sys
import os
import joblib
import numpy as np

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.risk_scorer import RiskScorer
from app.services.typology_detector import TypologyDetector

# Load ML Model
try:
    risk_model = joblib.load(os.path.join(os.path.dirname(__file__), 'models', 'risk_model.pkl'))
    print("Successfully loaded Random Forest ML model.")
except Exception as e:
    print(f"Warning: Could not load ML model: {e}")
    risk_model = None



# Dataclass to simulate the Pydantic models from FastAPI
@dataclass
class TraceHop:
    hop_number: int
    from_address: str
    to_address: str
    tx_hash: str
    amount: float
    token_symbol: str
    price_fetched: Optional[float] = 1.0
    timestamp: Optional[str] = None

class MLServiceHandler(http.server.BaseHTTPRequestHandler):
    def _send_response(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    
    def do_GET(self):
        if self.path.startswith('/report/'):
            filename = self.path.split('/')[-1]
            filepath = os.path.join(os.path.dirname(__file__), '..', 'reports', filename)
            if os.path.exists(filepath):
                self.send_response(200)
                self.send_header('Content-Type', 'application/pdf')
                self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
                self.end_headers()
                with open(filepath, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_error(404, "File not found")
            return
        self.send_error(404, "Not Found")

    def do_POST(self):

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            return self._send_response({"error": "Invalid JSON"}, 400)

        if self.path == '/intelligence/score':
            try:
                address = payload.get("address", "")
                chain = payload.get("chain", "")
                raw_hops = payload.get("hops", [])
                
                # Convert dict hops to TraceHop dataclass instances
                hops = [TraceHop(**hop) for hop in raw_hops]

                scorer = RiskScorer()
                detector = TypologyDetector()

                result = scorer.score_with_features(address, chain, hops)
                typologies = detector.detect(hops)

                response = {
                    "address": address,
                    "chain": chain,
                    "risk_score": result["risk_score"],
                    "risk_level": result["risk_level"],
                    "typologies": typologies,
                    "flags": result["flags"],
                    "confidence": 85.0,
                    "features": result["features"],
                }
                return self._send_response(response)
            except Exception as e:
                import traceback
                traceback.print_exc()
                return self._send_response({"error": str(e)}, 500)

        
        elif self.path == '/case-intelligence':
            case_id = payload.get("case_id", "TEST")
            suspect_address = payload.get("suspect_address", "")
            chain = payload.get("chain", "ethereum")
            path = payload.get("path", [])
            ranked_candidates = payload.get("ranked_candidates", [])
            
            # --- FEATURE EXTRACTION ---
            temporal_span = 72.0
            value_continuity = 0.50
            degree_centrality = len(path) if path else 1
            
            if len(path) > 1:
                temporal_span = max(1.0, 72.0 / len(path))
                value_continuity = 0.95
                
            # --- ML PREDICTION ---
            overall_risk_score = 0.0
            risk_level = "Unknown"
            if risk_model is not None:
                features = np.array([[temporal_span, value_continuity, degree_centrality]])
                proba = risk_model.predict_proba(features)[0]
                overall_risk_score = float(proba[1]) * 100
                
            if overall_risk_score > 75:
                risk_level = "critical"
            elif overall_risk_score > 40:
                risk_level = "high"
            elif overall_risk_score > 20:
                risk_level = "medium"
            else:
                risk_level = "low"
                
            # --- Typology detection ---
            detector = TypologyDetector()
            raw_hops = payload.get("path", [])
            hops = [TraceHop(
                hop_number=i, 
                from_address=h.get("from_address", ""), 
                to_address=h.get("to_address", ""), 
                tx_hash=h.get("tx_hash", ""), 
                amount=h.get("amount", 0.0), 
                token_symbol=h.get("token_symbol", "ETH")
            ) for i, h in enumerate(raw_hops)]
            
            typologies = detector.detect(hops)
            
            formatted_typs = []
            for idx, t in enumerate(typologies):
                formatted_typs.append({
                    "name": t.get("name", f"Typology-{idx}"),
                    "confidence": t.get("confidence", 0.0),
                    "description": t.get("description", ""),
                    "evidence": t.get("evidence", []),
                    "transaction_hashes": t.get("transaction_hashes", [])
                })
                
            if overall_risk_score > 75 and len(formatted_typs) == 0:
                formatted_typs.append({
                    "name": "ML Model: Illicit Flow Detected",
                    "confidence": overall_risk_score / 100.0,
                    "description": "The trained Random Forest model flagged this path based on temporal span and value continuity.",
                    "evidence": [],
                    "transaction_hashes": []
                })

            # --- Build timeline from actual hop data ---
            timeline = []
            if path:
                first_hop = path[0]
                timeline.append({
                    "timestamp": first_hop.get("timestamp", ""),
                    "description": f"Trace started from {suspect_address[:12]}..." if suspect_address else "Trace started",
                    "transaction_hashes": [first_hop.get("tx_hash")] if first_hop.get("tx_hash") else [],
                    "is_cross_chain": False
                })
                for hop in path:
                    if hop.get("cross_chain"):
                        timeline.append({
                            "timestamp": hop.get("timestamp", ""),
                            "description": f"Cross-chain bridge detected at hop {hop.get('hop_number', '?')}",
                            "transaction_hashes": [hop.get("tx_hash")] if hop.get("tx_hash") else [],
                            "is_cross_chain": True
                        })
                vasp_hops = [h for h in path if h.get("is_vasp")]
                for vh in vasp_hops:
                    timeline.append({
                        "timestamp": vh.get("timestamp", ""),
                        "description": f"VASP identified: {vh.get('entity_name', 'Unknown')} at hop {vh.get('hop_number', '?')}",
                        "transaction_hashes": [vh.get("tx_hash")] if vh.get("tx_hash") else [],
                        "is_cross_chain": False
                    })
                if not vasp_hops and len(path) > 1:
                    last_hop = path[-1]
                    timeline.append({
                        "timestamp": last_hop.get("timestamp", ""),
                        "description": f"Trace ended at max depth ({len(path)} hops) — VASP not yet identified",
                        "transaction_hashes": [last_hop.get("tx_hash")] if last_hop.get("tx_hash") else [],
                        "is_cross_chain": False
                    })

            # --- Risk contributors ---
            risk_contributors = {
                "ML Model Score": round(overall_risk_score, 1),
                "Hop Count": round(min(degree_centrality * 8, 30), 1),
                "Value Continuity": round((1 - value_continuity) * 20, 1),
            }
            if ranked_candidates:
                top_conf = ranked_candidates[0].get("confidence", 0)
                risk_contributors["Attribution Confidence"] = round(top_conf * 0.3, 1)
            if any(h.get("cross_chain") for h in path):
                risk_contributors["Cross-Chain Movement"] = 15.0

            # --- Major findings ---
            major_findings = []
            if len(path) >= 5:
                major_findings.append(f"Deep trace path: {len(path)} hops traversed")
            if any(h.get("cross_chain") for h in path):
                major_findings.append("Cross-chain bridge activity detected — increased obfuscation risk")
            if ranked_candidates:
                top = ranked_candidates[0]
                major_findings.append(f"Primary VASP: {top.get('entity_name', 'Unknown')} ({top.get('confidence', 0):.0f}% confidence)")
            if len(ranked_candidates) > 1:
                major_findings.append(f"{len(ranked_candidates)} VASP candidates found — investigate all paths")
            if formatted_typs:
                major_findings.append(f"{len(formatted_typs)} suspicious typology pattern(s) detected")

            return self._send_response({
                "case_id": case_id,
                "suspect_address": suspect_address,
                "overall_risk_score": round(overall_risk_score, 1),
                "risk_level": risk_level,
                "risk_contributors": risk_contributors,
                "major_findings": major_findings,
                "typologies": formatted_typs,
                "timeline": timeline,
                "ranked_candidates": ranked_candidates,
            }, 200)

        
        elif self.path == '/report':
            from app.services.report_generator import ReportGenerator
            rg = ReportGenerator()
            res = rg.generate(payload)
            return self._send_response({
                "success": True,
                "filename": res["filename"],
                "sha256_hash": res["sha256_hash"],
                "generated_at": res["generated_at"]
            })

        elif self.path == '/sahyog-mock':

            print("\n" + "="*60)
            print("[MOCK SAHYOG PORTAL] WEBHOOK RECEIVED")
            print("="*60)
            print(f"Case ID      : {payload.get('case_id')}")
            print(f"Suspect      : {payload.get('suspect_address')}")
            print(f"Chain        : {payload.get('chain', '').upper()}")
            print(f"Status       : {payload.get('status', '').upper()}")
            print(f"Found VASP   : {payload.get('found_vasp_name')} (Confidence: {payload.get('confidence')}%)")
            print(f"Hops Traced  : {payload.get('hops_traced')}")
            print("="*60 + "\n")
            return self._send_response({"status": "success", "message": "SAHYOG Mock received the data"})

        else:
            return self._send_response({"error": "Not Found"}, 404)
            
    def log_message(self, format, *args):
        pass # Suppress standard HTTP logging

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    print(f'Starting Native Python ML Service on port {port} (Bypassing FastAPI/Pydantic)...')
    http.server.HTTPServer(('0.0.0.0', port), MLServiceHandler).serve_forever()

