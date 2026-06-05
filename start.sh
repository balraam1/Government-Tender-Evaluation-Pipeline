#!/bin/bash
# MPSEDC GenAI Procurement Platform - Startup Script

echo "=============================================="
echo "  MPSEDC GenAI Procurement Platform v1.0"
echo "  RFP No: MPSEDC/COE/2026/682"
echo "=============================================="

# Create upload directory
mkdir -p uploads logs

# Start server
uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --log-level info \
    --access-log \
    --log-config logging.json 2>/dev/null || \
uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --log-level info

echo ""
echo "✅ Server running at http://localhost:8000"
echo "📚 Swagger UI: http://localhost:8000/docs"
echo "📋 ReDoc: http://localhost:8000/redoc"
