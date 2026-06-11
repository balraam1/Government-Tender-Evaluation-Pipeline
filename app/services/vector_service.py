"""
Vector Database Service using Qdrant
Collections: tender_documents, vendor_documents
"""
import logging
import hashlib
from typing import List, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class VectorService:
    def __init__(self):
        self._client = None
        self._available = None

    def _get_client(self):
        if self._client is None:
            try:
                from qdrant_client import QdrantClient
                from qdrant_client.http.models import Distance, VectorParams
                client = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT, timeout=5)
                client.get_collections()
                self._client = client
                self._available = True
                logger.info("✅ Qdrant connected")
                self._ensure_collections()
            except Exception as e:
                logger.warning(f"Qdrant unavailable: {e} - running without vector search")
                self._available = False
                self._client = False
        return self._client if self._available else None

    def _ensure_collections(self):
        from qdrant_client.http.models import Distance, VectorParams
        client = self._client
        collections = {c.name for c in client.get_collections().collections}
        for col in ["tender_documents", "vendor_documents"]:
            if col not in collections:
                client.create_collection(
                    collection_name=col,
                    vectors_config=VectorParams(size=3072, distance=Distance.COSINE)
                )
                logger.info(f"Created Qdrant collection: {col}")

    async def _get_embedding(self, text: str) -> List[float]:
        """
        Uses Gemini Text Embeddings API.
        """
        try:
            import httpx
            from app.core.config import settings
            if not settings.GEMINI_API_KEY:
                return [0.0] * 3072
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key={settings.GEMINI_API_KEY}"
            payload = {"model": "models/gemini-embedding-2", "content": {"parts": [{"text": text}]}}
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data["embedding"]["values"]
        except Exception as e:
            logger.error(f"Embedding failed: {e}")
            return [0.0] * 3072

    async def store_document(self, collection: str, doc_id: str, text: str, metadata: dict) -> bool:
        client = self._get_client()
        if not client:
            return False
        try:
            from qdrant_client.http.models import PointStruct
            # Chunk text for better retrieval
            chunks = self._chunk_text(text, chunk_size=500)
            points = []
            for i, chunk in enumerate(chunks):
                point_id = int(hashlib.md5(f"{doc_id}_{i}".encode()).hexdigest()[:8], 16)
                vector = await self._get_embedding(chunk)
                points.append(PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={**metadata, "doc_id": doc_id, "chunk_index": i, "text": chunk}
                ))
            client.upsert(collection_name=collection, points=points)
            logger.info(f"Stored {len(points)} chunks in {collection} for doc {doc_id}")
            return True
        except Exception as e:
            logger.error(f"Vector store failed: {e}")
            return False

    async def search(self, collection: str, query: str, top_k: int = 5, query_filter: dict = None) -> List[dict]:
        client = self._get_client()
        if not client:
            return []
        try:
            from qdrant_client.http import models
            vector = await self._get_embedding(query)
            
            qdrant_filter = None
            if query_filter:
                must_conditions = []
                for key, val in query_filter.items():
                    must_conditions.append(
                        models.FieldCondition(
                            key=key,
                            match=models.MatchValue(value=val)
                        )
                    )
                qdrant_filter = models.Filter(must=must_conditions)
                
            results = client.search(
                collection_name=collection, 
                query_vector=vector, 
                limit=top_k,
                query_filter=qdrant_filter
            )
            return [{"score": r.score, "payload": r.payload} for r in results]
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []

    def _chunk_text(self, text: str, chunk_size: int = 500) -> List[str]:
        import re
        sections = re.split(r'(?m)^## ', text)
        chunks = []
        for section in sections:
            section = section.strip()
            if not section:
                continue
            if not text.startswith("## ") and section == sections[0].strip():
                chunk = section
            else:
                chunk = "## " + section
            
            if len(chunk.split()) > chunk_size:
                words = chunk.split()
                for i in range(0, len(words), chunk_size):
                    chunks.append(" ".join(words[i:i + chunk_size]))
            else:
                chunks.append(chunk)
                
        return chunks if chunks else [text]


vector_service = VectorService()
