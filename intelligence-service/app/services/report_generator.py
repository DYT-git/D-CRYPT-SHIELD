"""
VASP Attribution Engine ?" Chain-of-Custody PDF Report Generator
================================================================
Generates professional, court-admissible PDF reports for LEA officers.
Upgraded for Phase 8A Core Investigation Report.
"""

import hashlib
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fpdf import FPDF, XPos, YPos


# Report Directory
REPORTS_DIR = Path(__file__).parent.parent.parent.parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)


class Colors:
    NAVY       = (10,  36,  99)
    WHITE      = (255, 255, 255)
    LIGHT_GRAY = (245, 245, 245)
    MID_GRAY   = (180, 180, 180)
    DARK_GRAY  = (60,  60,  60)
    BLACK      = (20,  20,  20)
    GREEN      = (22,  160, 133)
    RED        = (192, 57,  43)
    ORANGE     = (230, 126, 34)
    YELLOW_BG  = (255, 243, 205)
    BLUE_LIGHT = (52,  152, 219)
    SECTION_BG = (235, 241, 251)


class VASPReportPDF(FPDF):

    def __init__(self, case_data: Dict[str, Any]):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.case_data = case_data
        self.set_auto_page_break(auto=True, margin=20)
        self.set_margins(15, 15, 15)

    @staticmethod
    def safe(text: str) -> str:
        if not text:
            return ""
        text = str(text)
        replacements = {
            "\u2014": "-", "\u2013": "-", "\u2018": "'", "\u2019": "'",
            "\u201c": '"', "\u201d": '"', "\u2022": "*", "\u2026": "...",
            "\u00a9": "(c)", "\u2714": "v"
        }
        for k, v in replacements.items():
            text = text.replace(k, v)
        return text.encode('latin-1', 'replace').decode('latin-1')

    def header(self):
        self.set_fill_color(*Colors.NAVY)
        self.rect(0, 0, 210, 22, style="F")
        self.set_y(5)
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(*Colors.WHITE)
        self.cell(0, 8, "VASP ATTRIBUTION ENGINE", align="L", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_font("Helvetica", "", 7)
        self.cell(0, 4, "GOVERNMENT OF INDIA - MINISTRY OF HOME AFFAIRS", align="L", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*Colors.BLACK)
        self.set_y(25)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 7)
        self.set_text_color(*Colors.MID_GRAY)
        case_id = self.case_data.get("case_id", "")
        footer_text = f"CONFIDENTIAL - {case_id} | Page {self.page_no()} | Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
        self.cell(0, 10, self.safe(footer_text), align="C")

    def section_title(self, title: str):
        self.ln(4)
        self.set_fill_color(*Colors.SECTION_BG)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*Colors.NAVY)
        self.cell(0, 8, self.safe(f"  {title}"), fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(2)
        self.set_text_color(*Colors.BLACK)

    def key_value(self, key: str, value: str, bold_value: bool = False):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(100, 100, 100)
        self.cell(52, 6, self.safe(key + ":"), new_x=XPos.RIGHT)
        if bold_value:
            self.set_font("Helvetica", "B", 9)
        self.set_text_color(*Colors.BLACK)
        self.multi_cell(0, 6, self.safe(str(value)), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def risk_badge(self, level: str, score: float):
        level = level.upper()
        color_map = {
            "CRITICAL": Colors.RED,
            "HIGH":     Colors.ORANGE,
            "MEDIUM":   (180, 140, 0),
            "LOW":      Colors.GREEN,
        }
        color = color_map.get(level, Colors.MID_GRAY)
        self.set_fill_color(*color)
        self.set_text_color(*Colors.WHITE)
        self.set_font("Helvetica", "B", 10)
        self.cell(50, 8, f" RISK: {level} ({score:.1f}/100) ", fill=True, align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(2)
        self.set_text_color(*Colors.BLACK)


class ReportGenerator:

    def generate(self, case_data: Dict[str, Any]) -> Dict[str, str]:
        pdf = VASPReportPDF(case_data)
        pdf.add_page()

        self._write_case_header(pdf, case_data)
        self._write_suspect_details(pdf, case_data)
        self._write_vasp_result(pdf, case_data)
        self._write_risk_analysis(pdf, case_data)
        self._write_typologies(pdf, case_data)
        self._write_cross_chain(pdf, case_data)
        self._write_timeline(pdf, case_data)
        self._write_transaction_path(pdf, case_data)
        self._write_integrity_section(pdf, case_data)
        self._write_legal_disclaimer(pdf)

        case_id = case_data.get("case_id", f"UNKNOWN_{int(datetime.now().timestamp())}")
        filename = f"Report_{case_id}.pdf"
        filepath = REPORTS_DIR / filename
        pdf.output(str(filepath))

        sha256_hash = self._compute_sha256(str(filepath))
        return {
            "filepath": str(filepath),
            "filename": filename,
            "sha256_hash": sha256_hash,
            "generated_at": datetime.utcnow().isoformat() + "Z"
        }

    def _write_case_header(self, pdf: VASPReportPDF, data: Dict):
        pdf.set_font("Helvetica", "B", 16)
        pdf.set_text_color(*Colors.NAVY)
        pdf.cell(0, 10, "BLOCKCHAIN INTELLIGENCE REPORT", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 5, "VASP Attribution & Transaction Path Analysis", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(4)
        pdf.set_draw_color(*Colors.MID_GRAY)
        pdf.line(15, pdf.get_y(), 195, pdf.get_y())
        pdf.ln(4)
        pdf.key_value("Case ID", data.get("case_id", "N/A"), bold_value=True)
        pdf.key_value("Investigating Officer", data.get("submitted_by", "LEA Officer"))
        pdf.key_value("Report Date", datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"))

    def _write_suspect_details(self, pdf: VASPReportPDF, data: Dict):
        pdf.section_title("SUSPECT WALLET")
        pdf.key_value("Wallet Address", data.get("suspect_address", "N/A"), bold_value=True)
        pdf.key_value("Blockchain", data.get("chain", "N/A").upper())
        pdf.key_value("Hops Traced", str(data.get("hops_traced", 0)))
        pdf.key_value("Trace Status", data.get("status", "N/A").upper())

    def _write_vasp_result(self, pdf: VASPReportPDF, data: Dict):
        pdf.section_title("ATTRIBUTION RESULT")
        ranked = data.get("ranked_candidates", [])
        legacy = data.get("found_vasp")

        if ranked:
            for i, cand in enumerate(ranked):
                if i == 0:
                    pdf.set_fill_color(220, 255, 230)
                    pdf.set_font("Helvetica", "B", 10)
                    pdf.set_text_color(10, 100, 10)
                    pdf.cell(0, 8, pdf.safe("  PRIMARY VASP IDENTIFIED"), fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                else:
                    pdf.ln(2)
                    pdf.set_fill_color(240, 240, 240)
                    pdf.set_font("Helvetica", "B", 9)
                    pdf.set_text_color(50, 50, 50)
                    pdf.cell(0, 7, pdf.safe(f"  SUPPORTING CANDIDATE #{i}"), fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

                pdf.ln(2)
                pdf.set_text_color(*Colors.BLACK)
                pdf.key_value("VASP Name", cand.get("entity_name", "Unknown"), bold_value=True)
                pdf.key_value("Confidence", f"{cand.get('confidence', 0):.1f}% ({cand.get('confidence_level', 'Unknown')})")
                pdf.key_value("Attribution Type", cand.get("attribution_type", "Unknown"))
                
                ev = cand.get("primary_evidence")
                if ev:
                    pdf.key_value("Evidence Source", f"{ev.get('source', {}).get('source_name', 'OSINT')} (Match: {ev.get('match_type', 'N/A')})")
                    pdf.key_value("Explanation", ev.get("explanation", "N/A"))
        elif legacy:
            pdf.set_fill_color(220, 255, 230)
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(10, 100, 10)
            pdf.cell(0, 8, pdf.safe("  VASP IDENTIFIED (LEGACY)"), fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.ln(2)
            pdf.set_text_color(*Colors.BLACK)
            pdf.key_value("VASP Name", legacy.get("vasp_name", "Unknown"), bold_value=True)
            pdf.key_value("VASP Address", legacy.get("address", "N/A"))
            pdf.key_value("Confidence", f"{data.get('confidence', 0):.1f}%")
        else:
            pdf.set_fill_color(*Colors.YELLOW_BG)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(100, 80, 0)
            pdf.cell(0, 8, "  No VASP identified within trace depth.", fill=True, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_text_color(*Colors.BLACK)

    def _write_risk_analysis(self, pdf: VASPReportPDF, data: Dict):
        pdf.section_title("ML RISK ANALYSIS")
        risk_score = data.get("overall_risk_score") or data.get("risk_score") or 0
        risk_level = "CRITICAL" if risk_score > 80 else "HIGH" if risk_score > 60 else "MEDIUM" if risk_score > 30 else "LOW"
        pdf.risk_badge(risk_level, risk_score)

        contribs = data.get("risk_contributors", {})
        if contribs:
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(0, 6, "Risk Contributors:", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_font("Helvetica", "", 8)
            for k, v in contribs.items():
                pdf.set_text_color(*Colors.RED)
                pdf.cell(6, 5, ">>")
                pdf.set_text_color(*Colors.DARK_GRAY)
                pdf.cell(0, 5, f"{str(k).replace('_', ' ').title()}: +{v:.1f}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_text_color(*Colors.BLACK)

    def _write_typologies(self, pdf: VASPReportPDF, data: Dict):
        typologies = data.get("typologies", [])
        if not typologies:
            return
        pdf.section_title("DETECTED TYPOLOGIES")
        for t in typologies:
            # Handle both string (legacy) and dict (Phase 6)
            if isinstance(t, str):
                pdf.set_font("Helvetica", "B", 9)
                pdf.cell(0, 6, pdf.safe(f"- {t}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            else:
                name = t.get("typology_name", t.get("typology_id", "Unknown"))
                conf = t.get("confidence_score", 0)
                desc = t.get("description", "")
                hashes = t.get("transaction_hashes", [])
                
                pdf.set_font("Helvetica", "B", 9)
                pdf.cell(0, 6, pdf.safe(f"- {name} ({conf:.1f}%)"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                pdf.set_font("Helvetica", "", 8)
                pdf.set_text_color(*Colors.DARK_GRAY)
                if desc:
                    pdf.multi_cell(0, 5, pdf.safe(f"  Desc: {desc}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                if hashes:
                    pdf.multi_cell(0, 5, pdf.safe(f"  Tx Hashes: {', '.join(hashes)}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                pdf.set_text_color(*Colors.BLACK)

    def _write_cross_chain(self, pdf: VASPReportPDF, data: Dict):
        cce = data.get("cross_chain_evidence", [])
        if not cce:
            return
        pdf.section_title("CROSS-CHAIN EVIDENCE")
        for ev in cce:
            pdf.set_font("Helvetica", "B", 9)
            bridge = ev.get('bridge_protocol', 'Unknown Bridge')
            pdf.cell(0, 6, pdf.safe(f"- Bridged via {bridge}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*Colors.DARK_GRAY)
            src = f"{ev.get('source_chain')} -> {ev.get('dest_chain')}"
            pdf.multi_cell(0, 5, pdf.safe(f"  Route: {src}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.multi_cell(0, 5, pdf.safe(f"  Source Tx: {ev.get('source_tx_hash')}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.multi_cell(0, 5, pdf.safe(f"  Dest Tx: {ev.get('dest_tx_hash')}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_text_color(*Colors.BLACK)

    def _write_timeline(self, pdf: VASPReportPDF, data: Dict):
        timeline = data.get("timeline", [])
        if not timeline:
            return
        pdf.section_title("INVESTIGATION TIMELINE")
        pdf.set_font("Helvetica", "", 8)
        for event in timeline:
            ts = event.get("timestamp", "")
            desc = event.get("description", "")
            pdf.multi_cell(0, 5, pdf.safe(f"[{ts}] {desc}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def _write_transaction_path(self, pdf: VASPReportPDF, data: Dict):
        pdf.section_title("TRANSACTION PATH (BFS TRACE)")
        
        path = data.get("path", [])
        if not path and data.get("ranked_candidates"):
            path = data["ranked_candidates"][0].get("primary_evidence", {}).get("path", [])
            
        if not path:
            pdf.set_font("Helvetica", "I", 9)
            pdf.cell(0, 6, "No transaction path data available.", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            return

        col_widths = [12, 50, 50, 28, 30]
        pdf.set_fill_color(*Colors.NAVY)
        pdf.set_text_color(*Colors.WHITE)
        pdf.set_font("Helvetica", "B", 8)
        headers = ["Hop", "From Address", "To Address", "Value (USD)", "Tx Hash"]
        for i, header in enumerate(headers):
            pdf.cell(col_widths[i], 7, header, fill=True)
        pdf.ln(7)

        pdf.set_text_color(*Colors.BLACK)
        pdf.set_font("Helvetica", "", 7)
        for i, hop in enumerate(path):
            if i % 2 == 0:
                pdf.set_fill_color(*Colors.WHITE)
            else:
                pdf.set_fill_color(*Colors.LIGHT_GRAY)
                
            hop_num = str(hop.get("hop_number", i))
            from_a  = hop.get("from_address", "")[:20] + "..."
            to_a    = hop.get("to_address", "")[:20] + "..."
            val     = f"${hop.get('value_usd', 0):,.2f}"
            txh     = hop.get("tx_hash", "")[:12] + "..."

            pdf.cell(col_widths[0], 6, hop_num, fill=True)
            pdf.cell(col_widths[1], 6, pdf.safe(from_a), fill=True)
            pdf.cell(col_widths[2], 6, pdf.safe(to_a), fill=True)
            pdf.cell(col_widths[3], 6, val, fill=True)
            pdf.cell(col_widths[4], 6, pdf.safe(txh), fill=True)
            pdf.ln(6)

    def _write_integrity_section(self, pdf: VASPReportPDF, data: Dict):
        pdf.section_title("CHAIN OF CUSTODY - DIGITAL INTEGRITY CERTIFICATE")
        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(0, 5,
            "This report has been generated by the VASP Attribution Engine and its integrity "
            "is guaranteed by a SHA-256 cryptographic hash. Any modification to this document "
            "after generation will produce a different hash value, making evidence tampering "
            "immediately detectable. The hash below is stored in the central investigation "
            "database and can be independently verified at any time."
        )

    def _write_legal_disclaimer(self, pdf: VASPReportPDF):
        pdf.ln(6)
        pdf.set_font("Helvetica", "I", 7)
        pdf.set_text_color(130, 130, 130)
        pdf.multi_cell(0, 4,
            "DISCLAIMER: This report is generated by an automated blockchain intelligence system "
            "and is intended to assist law enforcement investigations. The findings in this report "
            "are based on publicly available blockchain data and OSINT sources. Attribution results "
            "should be verified by qualified investigators before being used as primary evidence. "
            "This document is RESTRICTED and intended solely for authorized law enforcement personnel."
        )

    def _compute_sha256(self, filepath: str) -> str:
        sha256 = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256.update(chunk)
        return sha256.hexdigest()
