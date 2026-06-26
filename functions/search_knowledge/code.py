#input_type_name: SearchKnowledgeInput
#output_type_name: SearchKnowledgeResult
#function_name: search_knowledge

import re
from typing import Optional

from lemma_sdk import FunctionContext, Pod
from pydantic import BaseModel


class SearchKnowledgeInput(BaseModel):
    query: str
    entity_type: Optional[str] = None
    department: Optional[str] = None
    limit: int = 20


class SearchResultItem(BaseModel):
    entity_type: str
    name: str
    excerpt: str
    document_title: str
    page_number: Optional[int] = None
    score: float


class SearchKnowledgeResult(BaseModel):
    results: list[SearchResultItem]
    total: int


def _rec(item) -> dict:
    if isinstance(item, dict):
        return item
    if hasattr(item, "additional_properties"):
        return dict(item.additional_properties)
    if hasattr(item, "to_dict"):
        return item.to_dict()
    return {}


async def search_knowledge(ctx: FunctionContext, data: SearchKnowledgeInput) -> SearchKnowledgeResult:
    pod = Pod.from_env()
    results: list[SearchResultItem] = []

    # Extract meaningful keywords (words > 3 chars, skip stop words) for ILIKE
    STOP = {"what", "causes", "cause", "does", "from", "this", "that", "with", "have",
            "will", "when", "where", "which", "should", "could", "would", "about",
            "than", "then", "them", "they", "their", "there", "these", "those"}
    keywords = [w for w in re.sub(r"[^a-zA-Z0-9 ]", " ", data.query).lower().split()
                if len(w) > 3 and w not in STOP]
    keyword = keywords[0] if keywords else data.query

    entity_filter = [{"field": "name", "op": "ilike", "value": f"%{keyword}%"}]
    if data.entity_type:
        entity_filter.append({"field": "entity_type", "op": "eq", "value": data.entity_type})

    entities = pod.table("knowledge_entities").list(filter=entity_filter, limit=data.limit)
    doc_cache: dict[str, str] = {}

    for entity_raw in (entities.items or []):
        entity = _rec(entity_raw)
        doc_id = entity.get("document_id", "")
        if doc_id and doc_id not in doc_cache:
            try:
                doc = _rec(pod.table("documents").get(doc_id))
                doc_cache[doc_id] = doc.get("title", "Unknown")
            except Exception:
                doc_cache[doc_id] = "Unknown"

        results.append(SearchResultItem(
            entity_type=entity.get("entity_type", "unknown"),
            name=entity.get("name", ""),
            excerpt=entity.get("description", ""),
            document_title=doc_cache.get(doc_id, "Unknown"),
            page_number=entity.get("source_page"),
            score=entity.get("confidence", 0.5),
        ))

    try:
        file_results = pod.files.search(data.query, search_method="HYBRID")
        for hit in (getattr(file_results, "items", None) or [])[:5]:
            results.append(SearchResultItem(
                entity_type="document",
                name=getattr(hit, "path", ""),
                excerpt=getattr(hit, "content", "") or "",
                document_title=getattr(hit, "path", "").split("/")[-1],
                page_number=getattr(hit, "page_number", None),
                score=float(getattr(hit, "score", 0.5) or 0.5),
            ))
    except Exception as exc:
        print(f"File search failed: {exc}")

    results.sort(key=lambda r: r.score, reverse=True)

    return SearchKnowledgeResult(results=results[:data.limit], total=len(results))
