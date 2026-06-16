"""
Module 2: Pre-Bid Query Management
POST /api/prebid/analyze
GET  /api/prebid/{tender_id}/queries
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import logging

from app.core.database import get_db
from app.schemas import PreBidQueryRequest, PreBidQueryResponse
from app.models import PreBidQuery, Tender, AuditLog, PreBidReport
from app.services.ai_service import ai_service, AIUnavailableError
from app.services.vector_service import vector_service

router = APIRouter(prefix="/api/prebid", tags=["Module 2 - Pre-Bid Query Management"])
logger = logging.getLogger(__name__)


@router.post("/analyze", response_model=PreBidQueryResponse, summary="Analyze and respond to pre-bid query")
async def analyze_prebid_query(req: PreBidQueryRequest, db: Session = Depends(get_db)):
    """
    **Module 2: Pre-Bid Query Management**
    
    - Analyzes vendor query against tender document
    - Identifies relevant clause
    - Drafts AI-assisted response
    - Generates corrigendum draft if needed
    """
    tender = db.query(Tender).filter(Tender.id == req.tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    search_results = await vector_service.search(
        collection="tender_documents",
        query=req.query_text,
        top_k=3,
        query_filter={"tender_id": req.tender_id}
    )
    
    if search_results:
        rfp_context = "\n\n...\n\n".join([res["payload"].get("text", "") for res in search_results])
    else:
        rfp_context = tender.generated_rfp[:3000] if tender.generated_rfp else f"Tender: {tender.title}\nCategory: {tender.category}"

    system = """You are a senior procurement officer at MPSEDC. 
Respond to pre-bid queries professionally, citing specific tender clauses.
Always provide clear, unambiguous responses compliant with procurement rules.
CRITICAL: Do not use any placeholders (like [Insert clause] or [Date]). You must read the context and formulate a final, complete, and fully populated response. If a specific clause is missing, simply state the general policy without leaving blanks."""

    prompt = f"""Relevant Tender RFP Clauses (retrieved via Vector DB):
---
{rfp_context}
---

Vendor: {req.vendor_name}
Query: {req.query_text}

Respond in JSON:
{{
  "relevant_clause": "Exact clause or section from the RFP that addresses this query",
  "draft_response": "Official response to the vendor query (2-3 paragraphs, professional tone)",
  "requires_corrigendum": true/false,
  "corrigendum_draft": "Draft corrigendum text if clarification changes the tender (null if not needed)"
}}"""

    try:
        ai_response = await ai_service.generate(prompt, system, max_tokens=1500)
    except AIUnavailableError as e:
        raise HTTPException(status_code=503, detail=f"AI service unavailable. Cannot analyze pre-bid query. {e}")
    parsed = _parse_prebid_response(ai_response, req)

    query_obj = PreBidQuery(
        tender_id=req.tender_id,
        vendor_name=req.vendor_name,
        query_text=req.query_text,
        relevant_clause=parsed["relevant_clause"],
        draft_response=parsed["draft_response"],
        corrigendum_draft=parsed.get("corrigendum_draft"),
        status="ANSWERED",
    )
    db.add(query_obj)

    db.add(AuditLog(
        tender_id=req.tender_id,
        user_id="system",
        action="PREBID_QUERY_ANALYZED",
        module="prebid",
        details={"vendor": req.vendor_name, "query_preview": req.query_text[:100]},
    ))
    db.commit()
    db.refresh(query_obj)

    return PreBidQueryResponse(
        query_id=query_obj.id,
        tender_id=req.tender_id,
        vendor_name=req.vendor_name,
        query_text=req.query_text,
        relevant_clause=query_obj.relevant_clause,
        draft_response=query_obj.draft_response,
        corrigendum_draft=query_obj.corrigendum_draft,
        analyzed_at=query_obj.created_at,
    )


@router.get("/{tender_id}/queries", summary="Get all pre-bid queries for a tender")
def get_prebid_queries(tender_id: int, db: Session = Depends(get_db)):
    queries = db.query(PreBidQuery).filter(PreBidQuery.tender_id == tender_id).all()
    return [
        {
            "id": q.id,
            "vendor_name": q.vendor_name,
            "query_text": q.query_text,
            "relevant_clause": q.relevant_clause,
            "draft_response": q.draft_response,
            "corrigendum_draft": q.corrigendum_draft,
            "status": q.status,
            "created_at": q.created_at,
        }
        for q in queries
    ]


@router.put("/{query_id}", summary="Update a pre-bid query (human-in-the-loop edit)")
def update_prebid_query(query_id: int, payload: dict, db: Session = Depends(get_db)):
    query = db.query(PreBidQuery).filter(PreBidQuery.id == query_id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")
        
    if "relevant_clause" in payload:
        query.relevant_clause = payload["relevant_clause"]
    if "draft_response" in payload:
        query.draft_response = payload["draft_response"]
        
    db.add(AuditLog(
        tender_id=query.tender_id,
        user_id="system",
        action="PREBID_QUERY_EDITED",
        module="prebid",
        details={"query_id": query_id, "vendor": query.vendor_name},
    ))
    db.commit()
    return {"status": "success", "message": "Query updated successfully"}


def _parse_prebid_response(ai_response: str, req: PreBidQueryRequest) -> dict:
    import json
    try:
        start = ai_response.find("{")
        end = ai_response.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(ai_response[start:end])
    except Exception:
        pass
    
    return {
        "relevant_clause": "AI Generation parsing failed, displaying raw response below:",
        "draft_response": ai_response,
        "corrigendum_draft": None,
    }

@router.post("/{tender_id}/export_report", summary="Generate a comprehensive AI report of all pre-bid queries")
async def generate_prebid_report(tender_id: int, db: Session = Depends(get_db)):
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
        
    queries = db.query(PreBidQuery).filter(PreBidQuery.tender_id == tender_id).all()
    if not queries:
        return {"report": "No queries found for this tender."}
        
    queries_text = "\n\n".join([f"Vendor: {q.vendor_name}\nQuery: {q.query_text}\nResponse: {q.draft_response}" for q in queries])
    
    system = """You are an expert AI document summarizer for procurement and tender processes.
You will be given a list of pre-bid queries and their corresponding responses.
Your task is to generate a comprehensive markdown report structuring these queries EXACTLY as requested.

CRITICAL INSTRUCTIONS:
- You MUST process and include EVERY SINGLE query provided in the input. DO NOT omit, summarize, combine, or skip any queries.
- If there are N queries provided, there MUST be exactly N individual summaries and exactly N rows in the detail table.

Format required:
# 1. Collective Summary
[Provide an extensive, detailed, and analytical collective summary. You must deeply analyze all major themes, summarize the overarching concerns raised across the queries, highlight recurring patterns, and detail the general stance or policy decisions taken by the committee in response. This section should be at least 2-3 substantial paragraphs to provide excellent executive-level context.]

# 2. Individual Summaries
[Provide a highly condensed individual summary for EVERY SINGLE pre-bid query provided. Do not skip any vendor.]
- **[Vendor Name]:** [EXTREMELY brief summary. Strictly 1 concise sentence identifying the core request, and 1 short phrase for the resolution. Keep it as short and punchy as possible.]

# 3. Pre-Bid Queries Detail Table
[Provide a tabular form of details for EVERY SINGLE pre-bid query provided.]
CRITICAL: Do NOT use newline characters or pipe characters `|` inside the actual table cells, as this will corrupt the Markdown table rendering!
| Vendor | Query | Key Takeaways / Response | Action Required |
|--------|-------|--------------------------|-----------------|
| [Vendor 1] | ... | ... | ... |
| [Vendor 2] | ... | ... | ... |

Ensure the output is well-structured and uses markdown formatting for headers, bold text, and tables."""

    prompt = f"Tender Title: {tender.title}\n\nQueries:\n{queries_text}\n\nPlease generate the comprehensive pre-bid queries report. Remember to include ALL {len(queries)} queries without skipping any."
    
    try:
        report_markdown = await ai_service.generate(prompt, system, max_tokens=8192, force_gemini=True)
        report_result = {
            "report": report_markdown,
            "tender": {
                "tender_number": tender.tender_number,
                "title": tender.title,
                "category": tender.category,
                "department": tender.department,
                "status": tender.status.value if hasattr(tender.status, "value") else str(tender.status),
                "budget": tender.budget,
                "description": tender.description,
                "created_at": tender.created_at.isoformat() if tender.created_at else None
            }
        }
        # Persist the full AI report to DB
        db.add(PreBidReport(
            tender_id=tender_id,
            report_markdown=report_markdown,
            query_count=len(queries),
        ))
        db.add(AuditLog(
            tender_id=tender_id,
            user_id="system",
            action="PREBID_REPORT_EXPORTED",
            module="prebid",
            details={"tender_number": tender.tender_number, "query_count": len(queries)},
        ))
        db.commit()
        return report_result
    except AIUnavailableError as e:
        raise HTTPException(status_code=503, detail=f"AI service unavailable. Cannot generate pre-bid report. {e}")
    except Exception as e:
        logger.error(f"Failed to generate pre-bid report: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate AI report")
