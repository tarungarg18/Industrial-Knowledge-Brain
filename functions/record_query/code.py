#input_type_name: RecordQueryInput
#output_type_name: RecordQueryResult
#function_name: record_query

import uuid
from typing import Optional

from lemma_sdk import FunctionContext, Pod
from pydantic import BaseModel


class RecordQueryInput(BaseModel):
    query_text: str
    answer_text: str
    source_document_ids: Optional[list[str]] = None
    source_entity_ids: Optional[list[str]] = None
    execution_time_ms: Optional[int] = None


class RecordQueryResult(BaseModel):
    query_id: str


def _rec(item) -> dict:
    if isinstance(item, dict):
        return item
    if hasattr(item, "additional_properties"):
        return dict(item.additional_properties)
    if hasattr(item, "to_dict"):
        return item.to_dict()
    return {}


async def record_query(ctx: FunctionContext, data: RecordQueryInput) -> RecordQueryResult:
    pod = Pod.from_env()

    row = _rec(pod.table("queries").create({
        "query_text": data.query_text,
        "answer_text": data.answer_text,
        "source_document_ids": data.source_document_ids or [],
        "source_entity_ids": data.source_entity_ids or [],
        "execution_time_ms": data.execution_time_ms or 0,
    }))

    return RecordQueryResult(query_id=str(row.get("id", str(uuid.uuid4()))))
