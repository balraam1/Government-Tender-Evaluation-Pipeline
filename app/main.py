"""
MPSEDC Generative AI Procurement Platform
FastAPI Application Entry Point

Modules:
  1. AI RFP Generator          → /api/rfp/generate
  2. Pre-Bid Query Management  → /api/prebid/analyze
  3. Document Upload + OCR     → /api/document/upload
  4. Metadata Extraction       → /api/document/extract
  5. PQ Evaluation             → /api/pq/evaluate
  6. Technical Evaluation      → /api/technical/evaluate
  7. Shortfall Detection       → /api/shortfall/analyze
  8. Financial Evaluation      → /api/financial/evaluate
  9. Final Recommendation      → /api/recommendation/generate
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import init_db

# Import routers
from app.api.routes.rfp import router as rfp_router
from app.api.routes.prebid import router as prebid_router
from app.api.routes.document import router as document_router
from app.api.routes.pq import router as pq_router
from app.api.routes.technical import router as technical_router
from app.api.routes.evaluation import (
    shortfall_router, financial_router, recommendation_router
)
from app.api.routes.misc import audit_router, vendor_router, health_router

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title="MPSEDC GenAI Procurement Platform",
        description="""
## 🏛️ Madhya Pradesh State Electronics Development Corporation

**Generative AI–Enabled Procurement Solution for Bid Preparation and Evaluation**

RFP No: MPSEDC/COE/2026/682

### Modules
| Module | Endpoint | Description |
|--------|----------|-------------|
| 1 | `/api/rfp/generate` | AI-assisted RFP/Tender document generation |
| 2 | `/api/prebid/analyze` | Pre-bid query management & corrigendum |
| 3 | `/api/document/upload` | Document upload with OCR processing |
| 4 | `/api/document/extract` | Tender metadata extraction |
| 5 | `/api/pq/evaluate` | Pre-qualification evaluation |
| 6 | `/api/technical/evaluate` | Technical bid evaluation |
| 7 | `/api/shortfall/analyze` | Shortfall detection & clarification |
| 8 | `/api/financial/evaluate` | Financial evaluation & L1 ranking |
| 9 | `/api/recommendation/generate` | Final award recommendation |

### Tech Stack
- **AI**: Gemma3 (Ollama, local) → Gemini (fallback)
- **DB**: MySQL 8 / SQLite (dev)
- **Vector DB**: Qdrant
- **OCR**: PaddleOCR + pdfplumber
- **Deployment**: On-Premises @ State Data Centre
        """,
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    app.include_router(health_router)
    app.include_router(vendor_router)
    app.include_router(rfp_router)
    app.include_router(prebid_router)
    app.include_router(document_router)
    app.include_router(pq_router)
    app.include_router(technical_router)
    app.include_router(shortfall_router)
    app.include_router(financial_router)
    app.include_router(recommendation_router)
    app.include_router(audit_router)

    @app.on_event("startup")
    async def startup():
        logger.info("🚀 Starting MPSEDC GenAI Procurement Platform...")
        init_db()
        logger.info("✅ Platform ready")

    @app.get("/", include_in_schema=False)
    def root():
        return JSONResponse({
            "app": "MPSEDC GenAI Procurement Platform",
            "version": settings.APP_VERSION,
            "docs": "/docs",
            "health": "/api/health",
            "modules": {
                "rfp_generator": "/api/rfp/generate",
                "prebid_query": "/api/prebid/analyze",
                "document_upload": "/api/document/upload",
                "metadata_extract": "/api/document/extract",
                "pq_evaluation": "/api/pq/evaluate",
                "technical_evaluation": "/api/technical/evaluate",
                "shortfall_detection": "/api/shortfall/analyze",
                "financial_evaluation": "/api/financial/evaluate",
                "recommendation": "/api/recommendation/generate",
                "audit_logs": "/api/audit/logs",
            }
        })

    return app


app = create_app()
