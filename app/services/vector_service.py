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
                    vectors_config=VectorParams(size=384, distance=Distance.COSINE)
                )
                logger.info(f"Created Qdrant collection: {col}")

    def _simple_embed(self, text: str) -> List[float]:
        """
        Simple hash-based embedding for demo when no embedding model is available.
        Replace with sentence-transformers for production.
        """
        try:
            import hashlib
            import math
            # 384-dim pseudo-embedding from text hash
            words = text.lower().split()[:100]
            vector = [0.0] * 384
            for i, word in enumerate(words):
                h = int(hashlib.md5(word.encode()).hexdigest(), 16)
                for j in range(min(4, 384 - i * 4)):
                    vector[i * 4 + j] = ((h >> (j * 8)) & 0xFF) / 255.0 - 0.5
            # Normalize
            mag = math.sqrt(sum(x * x for x in vector)) or 1.0
            return [x / mag for x in vector]
        except Exception:
            return [0.0] * 384

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
                vector = self._simple_embed(chunk)
                points.append(PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={**metadata, "doc_id": doc_id, "chunk_index": i, "text": chunk[:500]}
                ))
            client.upsert(collection_name=collection, points=points)
            logger.info(f"Stored {len(points)} chunks in {collection} for doc {doc_id}")
            return True
        except Exception as e:
            logger.error(f"Vector store failed: {e}")
            return False

    async def search(self, collection: str, query: str, top_k: int = 5) -> List[dict]:
        client = self._get_client()
        if not client:
            return []
        try:
            vector = self._simple_embed(query)
            results = client.search(collection_name=collection, query_vector=vector, limit=top_k)
            return [{"score": r.score, "payload": r.payload} for r in results]
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []

    def _chunk_text(self, text: str, chunk_size: int = 500) -> List[str]:
        words = text.split()
        chunks = []
        for i in range(0, len(words), chunk_size):
            chunks.append(" ".join(words[i:i + chunk_size]))
        return chunks if chunks else [text]


vector_service = VectorService()
