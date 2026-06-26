import hashlib
import io
import os
import re
import time
import uuid
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from lemma_sdk import Pod
from lemma_sdk.errors import LemmaAuthError, LemmaServerError
from pydantic import BaseModel

_active_runs: dict[str, str] = {}

if not os.environ.get("LEMMA_POD_ID"):
    raise RuntimeError("LEMMA_POD_ID environment variable is not set. Add it to your .env file.")

FOLDER_MAP = {
    "manual": "/manuals",
    "procedure": "/procedures",
    "specification": "/specifications",
    "safety_document": "/safety",
    "inspection_report": "/reports",
    "engineering_drawing": "/drawings",
    "work_instruction": "/procedures",
    "other": "/inbox",
}


def get_pod() -> Pod:
    return Pod.from_env()


def rec(item) -> dict:
    if isinstance(item, dict):
        return item
    if hasattr(item, "additional_properties"):
        return dict(item.additional_properties)
    if hasattr(item, "to_dict"):
        return item.to_dict()
    return {}


def recs(items) -> list:
    return [rec(i) for i in (items or [])]


def clean_chunk(text: str, max_len: int = 450) -> str:
    text = re.sub(r"#{1,6}\s*", "", text)
    text = re.sub(r"\*{1,2}([^*]+)\*{1,2}", r"\1", text)
    text = re.sub(r"(\b[A-Z]\b[\s\-]*){4,}", " ", text)
    text = re.sub(r"TROUBLE\s+POSSIBLE\s+CAUSE\s+CORRECTIVE\s+REPAIR\s+INSTRUCTIONS\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > max_len:
        text = text[:max_len].rsplit(" ", 1)[0] + "…"
    return text


def is_garbage_chunk(text: str) -> bool:
    words = text.split()
    if not words:
        return True
    single = sum(1 for w in words if len(w) <= 1)
    return single / len(words) > 0.35


def clean_filename(path: str) -> str:
    name = path.split("/")[-1]
    name = re.sub(r"\.[^.]+$", "", name)
    name = re.sub(r"[_\-]\d{6,}", "", name)
    name = re.sub(r"[_\-][0-9a-f]{8,}", "", name, flags=re.IGNORECASE)
    name = re.sub(r"[_\-]?[0-9a-f]{8}[_\-][0-9a-f]{4}[_\-][0-9a-f]{4}[_\-][0-9a-f]{4}[_\-][0-9a-f]{12}", "", name, flags=re.IGNORECASE)
    name = re.sub(r"[_\-]", " ", name).strip()
    name = re.sub(r"\s+", " ", name)
    words = name.split()
    deduped = [words[0]] if words else []
    for w in words[1:]:
        if w.lower() != deduped[-1].lower():
            deduped.append(w)
    return " ".join(deduped).title()


app = FastAPI(title="Industrial Knowledge Brain API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Graceful handling of Lemma platform outages ─────────────────────────────────
# These return clean responses instead of 500 stack traces when Lemma's servers
# are temporarily down (503) or the session expires (401). The frontend shows an
# empty/error state rather than crashing, and the terminal stays clean.

@app.exception_handler(LemmaServerError)
async def lemma_server_error_handler(request: Request, exc: LemmaServerError):
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Lemma service is temporarily unavailable (their servers returned 503). Please retry in a minute.",
            "items": [], "total": 0, "lemma_down": True,
        },
    )


@app.exception_handler(LemmaAuthError)
async def lemma_auth_error_handler(request: Request, exc: LemmaAuthError):
    return JSONResponse(
        status_code=401,
        content={
            "detail": "Lemma session expired. Run `lemma auth login` and restart the backend.",
            "items": [], "total": 0, "auth_expired": True,
        },
    )


# ── Stats ──────────────────────────────────────────────────────────────────────

@app.get("/api/stats")
def get_stats():
    pod = get_pod()
    docs = recs(pod.table("documents").list(limit=500).items)
    entities_res = pod.table("knowledge_entities").list(limit=1)
    equipment_res = pod.table("equipment").list(limit=1)

    status_counts: dict = {}
    for d in docs:
        s = d.get("status", "unknown")
        status_counts[s] = status_counts.get(s, 0) + 1

    return {
        "total_documents": len(docs),
        "approved": status_counts.get("approved", 0),
        "pending_review": status_counts.get("quality_review", 0),
        "processing": status_counts.get("processing", 0) + status_counts.get("indexed", 0),
        "total_entities": getattr(entities_res, "total", 0) or 0,
        "total_equipment": getattr(equipment_res, "total", 0) or 0,
    }


# ── Documents ──────────────────────────────────────────────────────────────────

@app.get("/api/documents")
def list_documents(status: Optional[str] = None, limit: int = 50):
    pod = get_pod()
    filter_ = [{"field": "status", "op": "eq", "value": status}] if status else None
    result = pod.table("documents").list(filter=filter_, limit=limit)
    items = recs(result.items)
    return {"items": items, "total": len(items)}


@app.get("/api/documents/{document_id}")
def get_document(document_id: str):
    pod = get_pod()
    try:
        doc = rec(pod.table("documents").get(document_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Document not found")
    entities = recs(
        pod.table("knowledge_entities").list(
            filter=[{"field": "document_id", "op": "eq", "value": document_id}],
            limit=200,
        ).items
    )
    return {"document": doc, "entities": entities}


@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    doc_type: str = Form(...),
    department: str = Form(None),
    description: str = Form(None),
):

    pod = get_pod()
    content = await file.read()

    # Content fingerprint — identifies the file regardless of filename or title
    content_hash = hashlib.sha256(content).hexdigest()

    # Check if this exact file content has been uploaded before
    existing = pod.table("documents").list(
        filter=[{"field": "content_hash", "op": "eq", "value": content_hash}], limit=1
    )
    existing_items = recs(existing.items)

    if existing_items:
        ex = existing_items[0]
        ex_status = ex.get("status", "")
        doc_id = ex.get("id")

        # Already fully processed — nothing to do
        if ex_status == "approved":
            raise HTTPException(
                status_code=409,
                detail=f"This document is already in the knowledge base (status: {ex_status}).",
            )

        # Incomplete (uploaded/processing/indexed/quality_review/failed) —
        # wipe partial data and re-run the workflow on the same record
        _wipe_document_entities(pod, doc_id)
        pod.table("documents").update(doc_id, {
            "status": "uploaded",
            "title": title,
            "doc_type": doc_type,
            "department": department or "",
            "description": description or "",
            "error_message": "",
        })
        run_id = _trigger_workflow(pod, doc_id)
        return {"id": doc_id, "file_path": ex.get("file_path", ""), "status": "uploaded", "run_id": run_id, "reprocessed": True}

    # New file — upload to storage
    folder = FOLDER_MAP.get(doc_type, "/inbox")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "pdf"
    slug = re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_")[:40]
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_name = f"{slug}_{ts}_{doc_type}.{ext}"
    file_path = f"{folder}/{unique_name}"

    try:
        pod.files.upload_file(
            io.BytesIO(content),
            path=file_path,
            filename=unique_name,
            directory_path=folder,
            search_enabled=True,
        )
    except LemmaServerError as e:
        if "503" in str(e):
            time.sleep(3)
            try:
                pod.files.upload_file(
                    io.BytesIO(content),
                    path=file_path,
                    filename=unique_name,
                    directory_path=folder,
                    search_enabled=True,
                )
            except LemmaServerError:
                raise HTTPException(status_code=503, detail="Lemma file storage is temporarily unavailable. Please try again in a minute.")
        else:
            raise HTTPException(status_code=500, detail=f"File upload failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {e}")

    doc = rec(pod.table("documents").create({
        "title": title,
        "file_path": file_path,
        "doc_type": doc_type,
        "status": "uploaded",
        "department": department or "",
        "description": description or "",
        "content_hash": content_hash,
    }))

    doc_id = doc.get("id")
    run_id = _trigger_workflow(pod, doc_id)
    return {"id": doc_id, "file_path": file_path, "status": "uploaded", "run_id": run_id}


def _wipe_document_entities(pod: Pod, document_id: str):
    """Delete all previously extracted entities/procedures for a document before a re-run."""
    for table in ("knowledge_entities", "procedures", "equipment"):
        try:
            rows = pod.table(table).list(
                filter=[{"field": "document_id", "op": "eq", "value": document_id}],
                limit=500,
            )
            for row in (rows.items or []):
                r = rec(row)
                rid = r.get("id")
                if rid:
                    try:
                        pod.table(table).delete(rid)
                    except Exception:
                        pass
        except Exception:
            pass


def _trigger_workflow(pod: Pod, doc_id: str) -> Optional[str]:
    """Start a fresh document-ingestion run and submit the form."""
    run_id = None
    try:
        _cancel_stale_runs(pod)
        run = pod.workflows.run("document-ingestion")
        run_id = getattr(run, "id", None)
        if run_id is None and hasattr(run, "to_dict"):
            run_id = run.to_dict().get("id")
        if run_id:
            pod.workflows.submit_form(
                str(run_id),
                node_id="start_form",
                inputs={"document_id": doc_id},
            )
            _active_runs[doc_id] = str(run_id)
    except Exception as e:
        print(f"Workflow trigger warning: {e}")
    return str(run_id) if run_id else None


def _cancel_stale_runs(pod: Pod):
    """Cancel workflow runs stuck waiting for form input."""
    try:
        runs = pod.workflows.runs("document-ingestion", limit=10)
        for run in (getattr(runs, "items", None) or []):
            r = rec(run)
            status = r.get("status", "")
            if status == "WAITING":
                rid = r.get("id")
                if rid:
                    try:
                        pod.workflows.cancel_run(str(rid))
                        print(f"Cancelled stale run {rid}")
                    except Exception:
                        pass
    except Exception:
        pass


# ── Entities ───────────────────────────────────────────────────────────────────

@app.get("/api/entities")
def list_entities(entity_type: Optional[str] = None, verified: Optional[bool] = None, limit: int = 100):
    pod = get_pod()
    filter_: list = []
    if entity_type:
        filter_.append({"field": "entity_type", "op": "eq", "value": entity_type})
    if verified is not None:
        filter_.append({"field": "verified", "op": "eq", "value": verified})
    result = pod.table("knowledge_entities").list(filter=filter_ or None, limit=limit)
    items = recs(result.items)
    return {"items": items, "total": len(items)}


@app.get("/api/equipment")
def list_equipment(limit: int = 100):
    pod = get_pod()
    result = pod.table("equipment").list(limit=limit)
    items = recs(result.items)
    return {"items": items, "total": len(items)}


# ── Query / QA ─────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str


@app.post("/api/search")
def search_quick(req: QueryRequest):
    """Returns relevant documents with page numbers and Lemma app URLs. No LLM, pure vector search."""
    pod = get_pod()
    doc_map: dict[str, dict] = {}  # path → {title, pages: [{page, score}], app_url, max_score}

    try:
        file_hits = pod.files.search(req.question, search_method="HYBRID")
        all_hits = getattr(file_hits, "items", None) or []

        # Normalize scores so best match = 1.0
        raw_scores = [float(getattr(h, "score", 0) or 0) for h in all_hits]
        max_raw = max(raw_scores, default=1) or 1

        for hit, raw in zip(all_hits, raw_scores):
            path = getattr(hit, "path", "") or ""
            page = getattr(hit, "page_number", None)
            content = getattr(hit, "content", "") or ""
            score = round(raw / max_raw, 2)

            if not path or is_garbage_chunk(content):
                continue

            title = clean_filename(path)
            # Deduplicate by title — same document uploaded multiple times merges into one card
            key = title.lower().strip()

            if key not in doc_map:
                app_url = None
                try:
                    url_res = pod.files.get_url(path)
                    app_url = getattr(url_res, "app_url", None) or getattr(url_res, "url", None)
                    if not app_url and hasattr(url_res, "additional_properties"):
                        app_url = url_res.additional_properties.get("app_url") or url_res.additional_properties.get("url")
                except Exception:
                    pass
                doc_map[key] = {
                    "title": title,
                    "path": path,   # keep first path for signed URL generation
                    "app_url": app_url,
                    "pages": [],
                    "max_score": score,
                }

            doc = doc_map[key]
            if score > doc["max_score"]:
                doc["max_score"] = score
                doc["path"] = path  # use path of best-scoring version
            if page and not any(p["page"] == page for p in doc["pages"]):
                doc["pages"].append({"page": page, "score": score, "path": path})

    except (LemmaAuthError, LemmaServerError):
        raise
    except Exception as e:
        print(f"File search error: {e}")

    # Sort by relevance, pages by page number
    docs = sorted(doc_map.values(), key=lambda d: d["max_score"], reverse=True)
    for d in docs:
        d["pages"].sort(key=lambda p: p["page"])

    return {
        "documents": docs,
        "total": len(docs),
        "query": req.question,
    }


@app.get("/api/file/page")
def open_file_page(path: str, page: int = 1):
    """Generate a public signed URL and redirect to the specific page.
    Validates path against the documents table before issuing a signed URL."""
    pod = get_pod()
    try:
        # Security: only serve paths that exist in our documents table
        docs = pod.table("documents").list(
            filter=[{"field": "file_path", "op": "eq", "value": path}], limit=1
        )
        if not (docs.items and len(docs.items) > 0):
            raise HTTPException(status_code=404, detail="File not found in knowledge base")
        res = pod.files.create_signed_url(path, expires_seconds=3600)
        signed_url = getattr(res, "signed_url", None)
        if not signed_url:
            raise HTTPException(status_code=404, detail="Could not generate file URL")
        return RedirectResponse(url=f"{signed_url}#page={page}", status_code=302)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/query")
def query_knowledge(req: QueryRequest):
    pod = get_pod()

    conv = pod.conversations.create_for_agent("knowledge-qa-agent", title=req.question[:80])
    conv_id = str(conv.id)

    pod.conversations.send(conv_id, req.question)

    delay = 2
    elapsed = 0
    while elapsed < 90:
        time.sleep(delay)
        elapsed += delay
        messages = pod.conversations.messages(conv_id, limit=50)
        for msg in reversed(messages.items or []):
            # MessageResponse uses .role and .text (not .content)
            role = getattr(msg, "role", None) or rec(msg).get("role")
            text = getattr(msg, "text", None) or rec(msg).get("text") or rec(msg).get("content")
            if role == "assistant" and text and str(text).strip():
                return {"answer": str(text), "conversation_id": conv_id, "sources": []}
        delay = min(delay * 2, 30)

    return {"answer": "Still processing. Please try again in a moment.", "conversation_id": conv_id, "sources": []}


# ── Approvals ──────────────────────────────────────────────────────────────────

@app.get("/api/approvals")
def list_pending_approvals():
    pod = get_pod()
    result = pod.table("documents").list(
        filter=[{"field": "status", "op": "eq", "value": "quality_review"}],
        limit=50,
    )
    items = recs(result.items)
    return {"items": items, "total": len(items)}


class ApprovalRequest(BaseModel):
    approved: bool
    accuracy_score: Optional[float] = None
    completeness_score: Optional[float] = None
    comments: Optional[str] = None


@app.post("/api/approvals/{document_id}")
def approve_document(document_id: str, req: ApprovalRequest):
    pod = get_pod()
    new_status = "approved" if req.approved else "indexed"

    pod.table("documents").update(document_id, {"status": new_status})

    review = rec(pod.table("quality_reviews").create({
        "document_id": document_id,
        "status": "accepted" if req.approved else "rejected",
        "accuracy_score": req.accuracy_score,
        "completeness_score": req.completeness_score,
        "comments": req.comments or "",
    }))

    if req.approved:
        entities = recs(
            pod.table("knowledge_entities").list(
                filter=[{"field": "document_id", "op": "eq", "value": document_id}],
                limit=500,
            ).items
        )
        for entity in entities:
            eid = entity.get("id")
            if eid:
                pod.table("knowledge_entities").update(eid, {"verified": True})

    return {"document_id": document_id, "new_status": new_status, "review_id": review.get("id", "")}


# ── Workflow status ─────────────────────────────────────────────────────────────

STEP_LABELS = {
    1: "Initializing",
    2: "Classifying document",
    3: "Extracting knowledge",
    4: "Quality review",
    5: "Finalizing",
}


@app.get("/api/workflow/status/{document_id}")
def get_workflow_status(document_id: str):
    """Poll the processing status of a document by checking its record."""
    pod = get_pod()
    try:
        doc = rec(pod.table("documents").get(document_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Document not found")

    status = doc.get("status", "uploaded")

    # Map document status to a user-friendly progress indicator
    progress_map = {
        "uploaded":       {"step": 1, "total": 5, "label": "Queued for processing", "done": False},
        "processing":     {"step": 2, "total": 5, "label": "Classifying & summarizing", "done": False},
        "indexed":        {"step": 3, "total": 5, "label": "Extracting knowledge entities", "done": False},
        "quality_review": {"step": 4, "total": 5, "label": "Waiting for human review", "done": False},
        "approved":       {"step": 5, "total": 5, "label": "Approved & in knowledge base", "done": True},
        "archived":       {"step": 1, "total": 5, "label": "Archived / failed — re-upload to reprocess", "done": False},
    }

    progress = progress_map.get(status, {"step": 1, "total": 5, "label": status, "done": False})
    return {
        "document_id": document_id,
        "status": status,
        "title": doc.get("title", ""),
        **progress,
    }


@app.get("/api/workflow/runs")
def list_workflow_runs():
    """List recent document-ingestion workflow runs with their status."""
    pod = get_pod()
    try:
        runs = pod.workflows.runs("document-ingestion", limit=10)
        items = recs(getattr(runs, "items", None) or [])
        return {"runs": items}
    except Exception as e:
        return {"runs": [], "error": str(e)}


@app.delete("/api/workflow/runs/{run_id}")
def cancel_workflow_run(run_id: str):
    """Cancel a stuck or stale workflow run."""
    pod = get_pod()
    try:
        pod.workflows.cancel_run(run_id)
        return {"cancelled": True, "run_id": run_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
