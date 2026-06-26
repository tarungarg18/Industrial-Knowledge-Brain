#input_type_name: ApproveKnowledgeInput
#output_type_name: ApproveKnowledgeResult
#function_name: approve_knowledge

import asyncio
import uuid
from typing import Optional

from lemma_sdk import FunctionContext, Pod
from pydantic import BaseModel


class ApproveKnowledgeInput(BaseModel):
    document_id: str
    approved: bool
    accuracy_score: Optional[float] = None
    completeness_score: Optional[float] = None
    comments: Optional[str] = None


class ApproveKnowledgeResult(BaseModel):
    document_id: str
    new_status: str
    review_id: str


def _rec(item) -> dict:
    if isinstance(item, dict):
        return item
    if hasattr(item, "additional_properties"):
        return dict(item.additional_properties)
    if hasattr(item, "to_dict"):
        return item.to_dict()
    return {}


async def approve_knowledge(ctx: FunctionContext, data: ApproveKnowledgeInput) -> ApproveKnowledgeResult:
    pod = Pod.from_env()

    new_status = "approved" if data.approved else "indexed"
    review_id = str(uuid.uuid4())

    # Step 1: quality_reviews + documents.update in parallel
    review_payload: dict = {
        "document_id": data.document_id,
        "status": "accepted" if data.approved else "rejected",
        "comments": data.comments or "",
    }
    if data.accuracy_score is not None:
        review_payload["accuracy_score"] = data.accuracy_score
    if data.completeness_score is not None:
        review_payload["completeness_score"] = data.completeness_score

    async def write_review():
        try:
            review = _rec(await asyncio.to_thread(pod.table("quality_reviews").create, review_payload))
            return review.get("id", review_id)
        except Exception as exc:
            print(f"quality_reviews write skipped: {exc}")
            return review_id

    async def update_status():
        await asyncio.to_thread(pod.table("documents").update, data.document_id, {"status": new_status})

    results = await asyncio.gather(write_review(), update_status(), return_exceptions=True)
    if isinstance(results[0], str):
        review_id = results[0]
    if isinstance(results[1], Exception):
        raise RuntimeError(f"Failed to update document status to '{new_status}': {results[1]}")

    # Step 2: mark all entities verified in parallel (best effort)
    if data.approved:
        try:
            entities_res = await asyncio.to_thread(
                pod.table("knowledge_entities").list,
                filter=[{"field": "document_id", "op": "eq", "value": data.document_id}],
                limit=500,
            )
            entity_ids = [
                _rec(e).get("id")
                for e in (entities_res.items or [])
                if _rec(e).get("id")
            ]
            if entity_ids:
                await asyncio.gather(*[
                    asyncio.to_thread(
                        pod.table("knowledge_entities").update, eid, {"verified": True}
                    )
                    for eid in entity_ids
                ], return_exceptions=True)
        except Exception as exc:
            print(f"Entity verification skipped: {exc}")

    return ApproveKnowledgeResult(
        document_id=data.document_id,
        new_status=new_status,
        review_id=review_id,
    )
