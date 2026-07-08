# GenAI Procurement Platform

  
Generative AI–Enabled Procurement Solution for Bid Preparation and Evaluation

---

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Start server
bash start.sh
# OR
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**API Docs:** http://localhost:8000/docs  
**ReDoc:** http://localhost:8000/redoc

---

## Tech Stack

| Component | Technology |
|---|---|
| Backend | FastAPI + Uvicorn |
| ORM | SQLAlchemy |
| Database | MySQL 8 (SQLite fallback for dev) |
| Vector DB | Qdrant |
| AI Primary | Gemma3 via Ollama (local, on-prem) |
| AI Fallback | Gemini API |
| OCR | PaddleOCR + pdfplumber |
| Files | python-docx |

---

## AI Setup

### Option A: Ollama (Recommended - Local, On-Prem)
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull Gemma3
ollama pull gemma3

# Run
ollama serve
```

### Option B: Gemini API (Fallback)
```bash
# Set in .env
GEMINI_API_KEY=your-key-here
```

The platform auto-detects availability:  
`Ollama (Gemma3) → Gemini API → Demo Mock`

---

## Qdrant Setup
```bash
docker run -p 6333:6333 qdrant/qdrant
```

---

## MySQL Setup
```sql
CREATE DATABASE mpsedc_procurement;
CREATE USER 'mpsedc'@'localhost' IDENTIFIED BY 'password';
GRANT ALL ON mpsedc_procurement.* TO 'mpsedc'@'localhost';
```

Update `.env`:
```
DB_USER=mpsedc
DB_PASSWORD=password
```

---

## Demo Workflow (RFP_682 Requirements)

Follow this sequence for a complete demo:

### Step 1: Register a Vendor
```bash
curl -X POST http://localhost:8000/api/vendor/register \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_name": "TechCorp Solutions Pvt Ltd",
    "gst_number": "27AAPCT1234A1Z5",
    "pan_number": "AAPCT1234A",
    "email": "info@techcorp.com",
    "annual_turnover": 8500000,
    "years_of_experience": 6,
    "certifications": ["ISO 27001", "CMMI Level 3"]
  }'
```

### Step 2: Generate RFP (Module 1)
```bash
curl -X POST http://localhost:8000/api/rfp/generate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Supply of AI-enabled Procurement Platform",
    "category": "Services",
    "department": "MPSEDC - Department of Science & Technology",
    "description": "Deployment of GenAI procurement solution for bid preparation and evaluation",
    "budget": 2500000
  }'
```

### Step 3: Pre-Bid Query (Module 2)
```bash
curl -X POST http://localhost:8000/api/prebid/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "tender_id": 1,
    "vendor_name": "TechCorp Solutions",
    "query_text": "What is the minimum annual turnover required for eligibility?"
  }'
```

### Step 4: Upload Tender Document (Module 3 & 4)
```bash
curl -X POST http://localhost:8000/api/document/upload \
  -F "file=@tender_doc.pdf" \
  -F "tender_id=1" \
  -F "document_type=RFP"
```

### Step 5: PQ Evaluation (Module 5)
```bash
curl -X POST http://localhost:8000/api/pq/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "tender_id": 1,
    "vendor_id": 1,
    "annual_turnover": 8500000,
    "years_experience": 6,
    "has_gst": true,
    "has_pan": true,
    "certifications": ["ISO 27001"],
    "similar_project_value": 3500000
  }'
```

### Step 6: Technical Evaluation (Module 6)
```bash
curl -X POST http://localhost:8000/api/technical/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "tender_id": 1,
    "vendor_id": 1,
    "bid_text": "Our AI procurement platform offers 99.9% uptime, PaddleOCR with 97% accuracy, Gemma3 local LLM..."
  }'
```

### Step 7: Shortfall Detection (Module 7)
```bash
curl -X POST http://localhost:8000/api/shortfall/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "tender_id": 1,
    "vendor_id": 1,
    "submitted_documents": ["Certificate of Incorporation", "CA Certificate", "GST", "PAN"],
    "submitted_clauses": ["Scope of Work acceptance", "SLA terms acceptance"]
  }'
```

### Step 8: Financial Evaluation (Module 8)
```bash
curl -X POST http://localhost:8000/api/financial/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "tender_id": 1,
    "bids": [
      {"vendor_id": 1, "vendor_name": "TechCorp", "total_amount": 450000},
      {"vendor_id": 2, "vendor_name": "DataSoft", "total_amount": 520000},
      {"vendor_id": 3, "vendor_name": "AIVentures", "total_amount": 480000}
    ]
  }'
```

### Step 9: Final Recommendation (Module 9)
```bash
curl -X POST http://localhost:8000/api/recommendation/generate \
  -H "Content-Type: application/json" \
  -d '{"tender_id": 1}'
```

### Audit Trail
```bash
curl http://localhost:8000/api/audit/logs?tender_id=1
curl http://localhost:8000/api/audit/summary
```

---

## All API Endpoints

| Module | Method | Endpoint | Description |
|---|---|---|---|
| Health | GET | `/api/health` | System health check |
| Vendor | POST | `/api/vendor/register` | Register vendor |
| Vendor | GET | `/api/vendor/list` | List all vendors |
| 1 | POST | `/api/rfp/generate` | Generate RFP |
| 1 | GET | `/api/rfp/list` | List tenders |
| 1 | GET | `/api/rfp/{id}` | Get tender |
| 2 | POST | `/api/prebid/analyze` | Analyze pre-bid query |
| 2 | GET | `/api/prebid/{tender_id}/queries` | List queries |
| 3&4 | POST | `/api/document/upload` | Upload + OCR |
| 4 | POST | `/api/document/extract` | Extract metadata |
| 4 | GET | `/api/document/{id}` | Get document |
| 5 | POST | `/api/pq/evaluate` | PQ evaluation |
| 5 | GET | `/api/pq/{tender_id}/results` | PQ results |
| 6 | POST | `/api/technical/evaluate` | Technical evaluation |
| 6 | GET | `/api/technical/{tender_id}/results` | Tech results |
| 7 | POST | `/api/shortfall/analyze` | Shortfall detection |
| 8 | POST | `/api/financial/evaluate` | Financial evaluation |
| 8 | GET | `/api/financial/{tender_id}/results` | Financial results |
| 9 | POST | `/api/recommendation/generate` | Final recommendation |
| Audit | GET | `/api/audit/logs` | Audit logs |
| Audit | GET | `/api/audit/summary` | Audit dashboard |

---

## Project Structure

```
mpsedc_procurement/
├── app/
│   ├── main.py                    # FastAPI app entry
│   ├── core/
│   │   ├── config.py              # Settings
│   │   └── database.py            # SQLAlchemy setup
│   ├── models/
│   │   └── __init__.py            # All DB models
│   ├── schemas/
│   │   └── __init__.py            # Pydantic schemas
│   ├── services/
│   │   ├── ai_service.py          # Ollama + Gemini AI
│   │   ├── ocr_service.py         # PaddleOCR + pdfplumber
│   │   └── vector_service.py      # Qdrant vector DB
│   └── api/routes/
│       ├── rfp.py                 # Module 1
│       ├── prebid.py              # Module 2
│       ├── document.py            # Module 3 & 4
│       ├── pq.py                  # Module 5
│       ├── technical.py           # Module 6
│       ├── evaluation.py          # Module 7, 8, 9
│       └── misc.py                # Vendor, Audit, Health
├── uploads/                       # Uploaded documents
├── .env                           # Configuration
├── requirements.txt
├── start.sh
└── README.md
```

---

## SLA & Evaluation Parameters (per RFP_682)

| Parameter | Threshold |
|---|---|
| Platform Uptime | ≥ 99.5% during business hours |
| Response Time | ≤ 3 seconds |
| OCR Accuracy | ≥ 95% |
| AI Output Acceptance | ≥ 90% |
| Critical Issue Resolution | ≤ 4 hours |
| Deployment Timeline | 30 days from Work Order |

---

## Data Governance (RFP_682 Section 6.3)

- ✅ All data stored/processed within State Data Centre (on-prem)
- ✅ No external API calls without approval (Gemini is optional fallback)
- ✅ Gemma3 runs locally via Ollama — no data leaves the server
- ✅ RBAC enforced across all modules
- ✅ Complete audit trail for all AI-generated outputs
- ✅ Human-in-the-loop for all evaluation decisions
- ✅ ISO 27001 compliance architecture
