#input_type_name: ProcessDocumentInput
#output_type_name: ProcessDocumentResult
#function_name: process_document

from lemma_sdk import FunctionContext, Pod
from pydantic import BaseModel


class ProcessDocumentInput(BaseModel):
    document_id: str


class ProcessDocumentResult(BaseModel):
    document_id: str
    success: bool
    title: str
    file_path: str
    doc_type: str
    auto_approve: bool
    accuracy_score: float
    completeness_score: float


def _rec(item) -> dict:
    if isinstance(item, dict):
        return item
    if hasattr(item, "additional_properties"):
        return dict(item.additional_properties)
    if hasattr(item, "to_dict"):
        return item.to_dict()
    return {}


async def process_document(ctx: FunctionContext, data: ProcessDocumentInput) -> ProcessDocumentResult:
    pod = Pod.from_env()

    doc = _rec(pod.table("documents").get(data.document_id))
    file_path = doc.get("file_path", "")
    title = doc.get("title", "")
    doc_type = doc.get("doc_type", "other")

    pod.table("documents").update(data.document_id, {"status": "processing"})

    return ProcessDocumentResult(
        document_id=data.document_id,
        success=True,
        title=title,
        file_path=file_path,
        doc_type=doc_type,
        auto_approve=False,
        accuracy_score=0.0,
        completeness_score=0.0,
    )
