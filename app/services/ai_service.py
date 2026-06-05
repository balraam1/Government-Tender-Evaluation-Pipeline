"""
AI Service Layer
Primary: Gemma4 e2b via Ollama (local, on-prem)
Fallback: Gemini API
"""
import httpx
import json
import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self):
        self.ollama_url = settings.OLLAMA_BASE_URL
        self.ollama_model = settings.OLLAMA_MODEL
        self.gemini_key = settings.GEMINI_API_KEY
        self.gemini_model = settings.GEMINI_MODEL

    async def generate(self, prompt: str, system_prompt: str = "", max_tokens: int = 2048) -> str:
        """
        Main entry point. Tries Ollama (Gemma3) first, falls back to Gemini.
        """
        try:
            res = await self._ollama_generate(prompt, system_prompt, max_tokens)
            if not res or not res.strip():
                raise ValueError("Empty response from Ollama")
            return res
        except Exception as e:
            logger.warning(f"Ollama unavailable: {e}. Falling back to Gemini...")
            try:
                res = await self._gemini_generate(prompt, system_prompt, max_tokens)
                if not res or not res.strip():
                    raise ValueError("Empty response from Gemini")
                return res
            except Exception as ge:
                logger.error(f"Gemini also failed: {ge}")
                return self._mock_response(prompt)

    async def _ollama_generate(self, prompt: str, system_prompt: str, max_tokens: int) -> str:
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        payload = {
            "model": self.ollama_model,
            "prompt": full_prompt,
            "stream": False,
            "options": {"num_predict": max_tokens}
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"{self.ollama_url}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "")

    async def _gemini_generate(self, prompt: str, system_prompt: str, max_tokens: int) -> str:
        if not self.gemini_key:
            raise ValueError("GEMINI_API_KEY not configured")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent?key={self.gemini_key}"
        contents = []
        if system_prompt:
            contents.append({"role": "user", "parts": [{"text": system_prompt}]})
            contents.append({"role": "model", "parts": [{"text": "Understood. I will follow these instructions."}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})
        payload = {
            "contents": contents,
            "generationConfig": {"maxOutputTokens": max_tokens}
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

    def _mock_response(self, prompt: str) -> str:
        """Demo mock when no AI backend is available"""
        if "shortfall" in prompt.lower() or "clarification" in prompt.lower():
            return self._mock_shortfall_letter(prompt)
        if "financial" in prompt.lower():
            return self._mock_financial_report(prompt)
        if "recommendation" in prompt.lower() or "award" in prompt.lower():
            return self._mock_award_report(prompt)
        if "rfp" in prompt.lower() or "tender" in prompt.lower():
            return self._mock_rfp_content()
        if "pq" in prompt.lower() or "qualification" in prompt.lower():
            return json.dumps({"status": "PASS", "remarks": "All PQ criteria met", "score": 85})
        if "technical" in prompt.lower():
            return json.dumps({"score": 78, "compliance": "HIGH", "remarks": "Technical bid largely compliant"})
        return "AI response generated successfully (demo mode - connect Ollama/Gemini for live AI)"

    def _mock_financial_report(self, prompt: str) -> str:
        return """<div style="text-align: center; font-weight: bold; margin-bottom: 12px;">FINANCIAL EVALUATION REPORT</div>

Based on the commercial bid submissions received, the MPSEDC Evaluation Committee has completed the commercial bid normalization and L1 ranking assessment.

A total of three (3) bids were evaluated. The commercial normalization progress bars indicate the relative price variance among the qualified bidders.

**Summary of Findings:**
- Wipro Limited has emerged as the Lowest Bidder (L1) with a total normalized bid price of INR 4,200,000.
- Tata Consultancy Services is ranked L2 at INR 4,500,000.
- Infosys Limited is ranked L3 at INR 4,800,000.

The Evaluation Committee recommends proceeding with the award recommendation to the L1 bidder (Wipro Limited) subject to final committee sign-off."""

    def _mock_award_report(self, prompt: str) -> str:
        return """AWARD RECOMMENDATION REPORT

Madhya Pradesh State Electronics Development Corporation
RFP COE/2026/682 Final Evaluation Sign-Off

The MPSEDC Evaluation Committee, following a rigorous three-stage evaluation process, hereby presents the final award recommendation.

1. Pre-Qualification Stage: Tata Consultancy Services, Infosys Limited, and Wipro Limited successfully demonstrated all PQ criteria compliance.
2. Technical Stage: Wipro Limited successfully achieved the highest qualification rating (Technical Score: 70/100).
3. Commercial Stage: Wipro Limited emerged as the L1 bidder with a normalized quote of INR 4,200,000.

RECOMMENDATION:
The Evaluation Committee recommends the contract be awarded to Wipro Limited, being the L1 qualified bidder.

Chief General Manager (Procurement), MPSEDC"""

    def _mock_shortfall_letter(self, prompt: str) -> str:
        import re
        missing_docs = re.findall(r"Missing Documents:\s*(.*)", prompt)
        missing_clauses = re.findall(r"Missing Clauses:\s*(.*)", prompt)
        missing_certs = re.findall(r"Missing Certifications:\s*(.*)", prompt)
        
        docs_str = missing_docs[0] if missing_docs else "Certificate of Incorporation, CA Certificate"
        clauses_str = missing_clauses[0] if missing_clauses else "Scope of Work acceptance, SLA terms acceptance"
        certs_str = missing_certs[0] if missing_certs else "ISO 27001, VAPT Report"
        
        for char in ["[", "]", "'", '"']:
            docs_str = docs_str.replace(char, "")
            clauses_str = clauses_str.replace(char, "")
            certs_str = certs_str.replace(char, "")

        items = []
        if docs_str.strip() and docs_str.lower() != "[]":
            items.extend([d.strip() for d in docs_str.split(",") if d.strip()])
        if clauses_str.strip() and clauses_str.lower() != "[]":
            items.extend([c.strip() for c in clauses_str.split(",") if c.strip()])
        if certs_str.strip() and certs_str.lower() != "[]":
            items.extend([ct.strip() for ct in certs_str.split(",") if ct.strip()])

        if not items:
            items = ["Certificate of Incorporation", "CA Certificate with UDIN", "GST Registration Certificate"]

        items_formatted = "\n".join(f"  {idx+1}. {item}" for idx, item in enumerate(items))

        return f"""CLARIFICATION / SHORTFALL SUBMISSION REQUEST

Reference: MPSEDC Procurement Technical Bid Evaluation

Dear Bidder,

During the technical evaluation of your proposal, the MPSEDC Evaluation Committee identified certain deficiencies/shortfalls in your submission. 

You are requested to submit/clarify the following missing items within 48 hours to ensure compliance:

{items_formatted}

Please submit the required documents through the portal or via email within 48 hours. Failure to comply may lead to rejection of your bid.

Sincerely,
Evaluation Committee, MPSEDC"""

    def _mock_rfp_content(self) -> str:
        return """## NOTICE INVITING TENDER (NIT)

**Scope of Work:**
This tender covers supply, installation, commissioning and maintenance of the required solution as per technical specifications.

**Eligibility Criteria:**
1. The bidder shall be a legally registered entity in India with minimum 3 years of operation.
2. Annual turnover of at least ₹50 Lakhs in the last financial year.
3. At least one similar project of ₹25 Lakhs value in last 5 years.

**Technical Specifications:**
- Solution must be cloud-native and scalable
- 99.5% uptime SLA during business hours
- Response time ≤ 3 seconds for standard operations
- ISO 27001 certified organization

**SLA Requirements:**
- Critical issues resolved within 4 hours
- Major issues resolved within 8 hours
- Minor issues resolved within 24 hours

**Evaluation Criteria:**
| Parameter | Weightage |
|---|---|
| Technical Capability | 60% |
| Financial Proposal | 40% |

**Deliverables:**
1. Deployed solution within 30 days of Work Order
2. Complete documentation package
3. Training for all user groups
4. Go-live acceptance sign-off"""


ai_service = AIService()
