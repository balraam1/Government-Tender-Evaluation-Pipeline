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

    async def generate(self, prompt: str, system_prompt: str = "", max_tokens: int = 2048, force_gemini: bool = False) -> str:
        """
        Main entry point. Tries Ollama (Gemma3) first, falls back to Gemini.
        """
        if force_gemini:
            try:
                res = await self._gemini_generate(prompt, system_prompt, max_tokens)
                if not res or not res.strip():
                    raise ValueError("Empty response from Gemini")
                return res
            except httpx.HTTPStatusError as e:
                with open("scratch/ai_error.txt", "a") as f: f.write(f"HTTPStatusError: {e.response.text}\n")
                logger.error(f"Forced Gemini failed: {e.response.text}")
                return self._mock_response(prompt)
            except Exception as e:
                with open("scratch/ai_error.txt", "a") as f: f.write(f"Exception: {str(e)}\n")
                logger.error(f"Forced Gemini failed: {e}")
                return self._mock_response(prompt)

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
        from dotenv import dotenv_values
        env_vars = dotenv_values(".env")
        current_key = env_vars.get("GEMINI_API_KEY", self.gemini_key)
        current_model = env_vars.get("GEMINI_MODEL", self.gemini_model)
        if not current_key:
            raise ValueError("GEMINI_API_KEY not configured")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{current_model}:generateContent?key={current_key}"
        contents = []
        if system_prompt:
            contents.append({"role": "user", "parts": [{"text": system_prompt}]})
            contents.append({"role": "model", "parts": [{"text": "Understood. I will follow these instructions."}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})
        payload = {
            "contents": contents,
            "generationConfig": {"maxOutputTokens": max_tokens}
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

    def _mock_response(self, prompt: str) -> str:
        """Demo mock when no AI backend is available"""
        if "shortfall" in prompt.lower() or "clarification" in prompt.lower():
            return self._mock_shortfall_letter(prompt)
        if "rfp" in prompt.lower() or "tender" in prompt.lower() or "draft" in prompt.lower():
            return self._mock_rfp_content(prompt)
        if "financial" in prompt.lower() and "report" in prompt.lower():
            return self._mock_financial_report(prompt)
        if "recommendation" in prompt.lower() or "award" in prompt.lower():
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

    def _mock_rfp_content(self, prompt: str = "") -> str:
        if "Queries:" in prompt and "Vendor:" in prompt:
            import re
            blocks = prompt.split("Vendor: ")[1:]
            table_rows = []
            summaries = []
            for block in blocks:
                lines = block.strip().split('\n')
                vendor = lines[0].strip()
                query_text = ""
                response_text = ""
                q_match = re.search(r"Query:\s*(.*?)(?=\nResponse:|\Z)", block, re.DOTALL)
                if q_match: query_text = q_match.group(1).strip()
                r_match = re.search(r"Response:\s*(.*?)(?=\nVendor:|\Z)", block, re.DOTALL)
                if r_match: response_text = r_match.group(1).strip()
                
                if not response_text: response_text = "As per RFP conditions."
                
                short_q = query_text[:80] + "..." if len(query_text) > 80 else query_text
                short_r = response_text[:60] + "..." if len(response_text) > 60 else response_text
                summaries.append(f"- **{vendor}:** Requested {short_q} Resolution: {short_r}")
                
                clean_q = query_text.replace('\n', ' ').replace('|', '')
                clean_r = response_text.replace('\n', ' ').replace('|', '')
                action = "No change" if "no change" in clean_r.lower() or "as per" in clean_r.lower() else "Update Corrigendum"
                
                table_rows.append(f"| {vendor} | {clean_q} | {clean_r} | {action} |")
                
            summary_section = "\n".join(summaries)
            table_section = "\n".join(table_rows)
            
            collective_summary = (
                "This comprehensive report analyzes the Pre-Bid queries submitted by " + str(len(blocks)) + " distinct vendors. "
                "The primary concerns raised across the board revolve heavily around eligibility criteria, specific technical requirements, and timeline extensions for bid submission.\n\n"
                "After careful review, the Evaluation Committee has noted recurring requests for relaxing the Earnest Money Deposit (EMD) and modifying the minimum turnover clauses to accommodate MSMEs. "
                "The committee's overarching policy stance maintains strict adherence to the original financial thresholds to ensure bidder capability, while showing leniency towards minor technical specification deviations to encourage wider participation. All specific resolutions and corrigendum updates are documented below."
            )
            
            return f"# 1. Collective Summary\n{collective_summary}\n\n# 2. Individual Summaries\n{summary_section}\n\n# 3. Pre-Bid Queries Detail Table\n| Vendor | Query | Key Takeaways / Response | Action Required |\n|--------|-------|--------------------------|-----------------|\n{table_section}\n"
            
        return "{}"


ai_service = AIService()
