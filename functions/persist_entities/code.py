#input_type_name: PersistEntitiesInput
#output_type_name: PersistEntitiesResult
#function_name: persist_entities

import asyncio
from typing import Any, Optional

from lemma_sdk import FunctionContext, Pod
from pydantic import BaseModel

VALID_ENTITY_TYPES = {
    "equipment", "part", "procedure_step", "specification",
    "safety_rule", "parameter", "chemical", "tool", "warning",
}

VALID_CATEGORIES = {
    "mechanical", "electrical", "hydraulic", "pneumatic",
    "instrumentation", "structural", "safety_system",
}

VALID_PROCEDURE_TYPES = {
    "operation", "maintenance", "safety", "inspection", "emergency",
}

VALID_RISK_LEVELS = {"low", "medium", "high", "critical"}


class EntityItem(BaseModel):
    type: Optional[str] = None
    entity_type: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    attributes: Optional[dict] = None
    source_page: Optional[int] = None
    confidence: Optional[float] = None


class EquipmentItem(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    description: Optional[str] = None
    specifications: Optional[dict] = None


class ProcedureItem(BaseModel):
    title: Optional[str] = None
    procedure_type: Optional[str] = None
    steps: Optional[list[Any]] = None
    risk_level: Optional[str] = None


class PersistEntitiesInput(BaseModel):
    document_id: str
    entities: Optional[list[EntityItem]] = None
    equipment_found: Optional[list[EquipmentItem]] = None
    procedures_found: Optional[list[ProcedureItem]] = None
    summary: Optional[str] = None
    doc_type: Optional[str] = None
    tags: Optional[list[str]] = None


class PersistEntitiesResult(BaseModel):
    document_id: str
    entities_written: int
    equipment_written: int
    procedures_written: int


async def _write(pod: Pod, table: str, payload: dict) -> bool:
    """Write one record in a thread so parallel gather() works with sync SDK."""
    try:
        await asyncio.to_thread(pod.table(table).create, payload)
        return True
    except Exception as exc:
        print(f"Skipped {table} row: {exc}")
        return False


async def persist_entities(ctx: FunctionContext, data: PersistEntitiesInput) -> PersistEntitiesResult:
    pod = Pod.from_env()

    # Update document metadata (fast — single call)
    doc_update: dict[str, Any] = {}
    if data.summary:
        doc_update["extracted_summary"] = data.summary
    if data.doc_type:
        doc_update["doc_type"] = data.doc_type
    if data.tags:
        doc_update["tags"] = data.tags
    if doc_update:
        try:
            await asyncio.to_thread(pod.table("documents").update, data.document_id, doc_update)
        except Exception as exc:
            print(f"Document metadata update skipped: {exc}")

    # Build all payloads first (pure CPU, no I/O)
    entity_payloads = []
    for e in (data.entities or []):
        etype = (e.entity_type or e.type or "").strip()
        if etype not in VALID_ENTITY_TYPES or not e.name:
            continue
        entity_payloads.append({
            "document_id": data.document_id,
            "entity_type": etype,
            "name": e.name[:300],
            "description": (e.description or "")[:2000],
            "attributes": e.attributes or {},
            "source_page": e.source_page,
            "confidence": e.confidence if e.confidence is not None else 0.8,
            "verified": False,
        })

    equipment_payloads = []
    for eq in (data.equipment_found or []):
        if not eq.name:
            continue
        category = (eq.category or "mechanical").strip().lower()
        if category not in VALID_CATEGORIES:
            category = "mechanical"
        equipment_payloads.append({
            "document_id": data.document_id,
            "name": eq.name[:300],
            "category": category,
            "manufacturer": eq.manufacturer or "",
            "model": eq.model or "",
            "description": (eq.description or "")[:2000],
            "specifications": eq.specifications or {},
        })

    procedure_payloads = []
    for proc in (data.procedures_found or []):
        if not proc.title:
            continue
        ptype = (proc.procedure_type or "maintenance").strip().lower()
        if ptype not in VALID_PROCEDURE_TYPES:
            ptype = "maintenance"
        risk = (proc.risk_level or "low").strip().lower()
        if risk not in VALID_RISK_LEVELS:
            risk = "low"
        procedure_payloads.append({
            "title": proc.title[:400],
            "document_id": data.document_id,
            "procedure_type": ptype,
            "steps": proc.steps or [],
            "risk_level": risk,
        })

    # Fire all writes in parallel — total time ≈ one single write regardless of count
    all_tasks = (
        [_write(pod, "knowledge_entities", p) for p in entity_payloads] +
        [_write(pod, "equipment", p) for p in equipment_payloads] +
        [_write(pod, "procedures", p) for p in procedure_payloads]
    )
    results = await asyncio.gather(*all_tasks, return_exceptions=True)

    ne = len(entity_payloads)
    nq = len(equipment_payloads)

    entities_written  = sum(1 for r in results[:ne] if r is True)
    equipment_written = sum(1 for r in results[ne:ne+nq] if r is True)
    procedures_written = sum(1 for r in results[ne+nq:] if r is True)

    return PersistEntitiesResult(
        document_id=data.document_id,
        entities_written=entities_written,
        equipment_written=equipment_written,
        procedures_written=procedures_written,
    )
