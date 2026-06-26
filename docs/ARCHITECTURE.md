# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                    Browser                          │
│         React + Vite (Lemma Apps hosting)           │
└────────────────────┬────────────────────────────────┘
                     │ HTTP (axios, VITE_API_BASE)
┌────────────────────▼────────────────────────────────┐
│                FastAPI Backend                      │
│              (Render / local)                       │
│   Thin bridge — no business logic, no DB            │
└────────────────────┬────────────────────────────────┘
                     │ lemma_sdk (Python)
┌────────────────────▼────────────────────────────────┐
│                 Lemma Platform                      │
│  Tables │ File Storage │ Agents │ Functions │ Workflows│
└─────────────────────────────────────────────────────┘
```

---

## Data Model

### `documents` table

Central registry. Every uploaded file gets one row.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `title` | text | Human-readable name |
| `file_path` | text | Path in Lemma file storage |
| `doc_type` | text | `manual`, `procedure`, `specification`, `safety_document`, `inspection_report`, `engineering_drawing`, `work_instruction`, `other` |
| `status` | text | Lifecycle: `uploaded → processing → indexed → quality_review → approved / rejected` |
| `department` | text | Optional team/department tag |
| `extracted_summary` | text | AI-generated summary |
| `tags` | text[] | AI-generated keyword tags |
| `confidence` | float | AI classification confidence (0–1) |

### `knowledge_entities` table

Structured facts extracted from documents by the `knowledge-extractor` agent.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `document_id` | uuid | FK → documents |
| `entity_type` | text | `equipment`, `part`, `procedure_step`, `specification`, `safety_rule`, `parameter`, `chemical`, `tool`, `warning` |
| `name` | text | Entity name |
| `description` | text | Extracted description |
| `source_page` | int | Page number in source document |
| `confidence` | float | Extraction confidence |
| `verified` | bool | Set to `true` after human approval |

### `equipment` table

Dedicated catalog for equipment/assets (a subset of knowledge_entities with richer fields).

### `procedures` table

Standard operating procedures linked to documents and equipment.

### `quality_reviews` table

One row per approve/reject decision.

| Column | Description |
|---|---|
| `document_id` | Which document was reviewed |
| `status` | `accepted` or `rejected` |
| `accuracy_score` | 0–100 |
| `completeness_score` | 0–100 |
| `comments` | Reviewer notes |

### `queries` table

Audit trail of every Q&A interaction.

---

## File Storage Layout

```
/knowledge/
  /inbox/          Upload landing zone (all new files land here first)
  /manuals/        Equipment manuals
  /procedures/     SOPs and work instructions
  /specifications/ Engineering specs and datasheets
  /safety/         Safety data sheets, JSA documents
  /reports/        Inspection and maintenance reports
  /drawings/       Engineering drawings and schematics
  /training/       Training materials
  /archive/        Superseded and obsolete versions
```

Files are indexed automatically on upload (`search_enabled=True`). Lemma uses hybrid BM25 + semantic indexing — no separate vector DB needed.

---

## Agent Design

### `document-indexer`

**Input:** `document_id`, `file_path`
**Does:** Reads the file, classifies document type, generates a summary and keyword tags, assigns a confidence score.
**Writes:** Updates `documents` table with `doc_type`, `extracted_summary`, `tags`, `confidence`.

### `knowledge-extractor`

**Input:** `document_id`, `file_path`
**Does:** Reads the full document text, extracts structured entities (equipment, specs, procedures, warnings etc.).
**Writes:** Returns a list of entity objects for `persist_entities` function to save.

### `knowledge-qa-agent`

**Input:** Natural language question
**Does:** Searches knowledge_entities table + file index, synthesizes a cited answer in markdown.
**Used by:** `/api/query` endpoint — runs as a streaming conversation.

### `quality-reviewer`

**Input:** Scheduled weekly
**Does:** Audits recently approved entities for accuracy and completeness, flags suspicious extractions.

---

## Workflow: `document-ingestion`

```
start_form (FORM)
    ↓ document_id
process_document (FUNCTION)
    ↓ file_path, document_id
document-indexer (AGENT)
    ↓ doc_type, confidence, summary, tags
knowledge-extractor (AGENT)
    ↓ entities[]
persist_entities (FUNCTION)
    ↓
quality_gate (DECISION)
    ├── confidence ≥ 0.8 AND not safety_document
    │       ↓
    │   auto_approve (FUNCTION: approve_knowledge, approved=true)
    │       ↓ end
    └── default (needs human review)
            ↓
        quality_review_form (FORM — blocks until reviewer submits)
            ↓
        review_decision (DECISION)
            ├── approved=true → human_approve (FUNCTION: approve_knowledge)
            └── default      → human_reject  (FUNCTION: approve_knowledge, approved=false)
                                    ↓ end
```

---

## API Endpoints (FastAPI Backend)

| Method | Path | Description |
|---|---|---|
| GET | `/api/stats` | Dashboard counters (documents by status, entity count) |
| GET | `/api/documents` | List documents, filterable by status |
| POST | `/api/documents/upload` | Upload file + create documents record + start workflow |
| GET | `/api/workflow/status/{doc_id}` | Poll ingestion workflow progress |
| GET | `/api/approvals` | List documents in `quality_review` status |
| POST | `/api/approvals/{doc_id}` | Approve or reject a document |
| GET | `/api/entities` | List knowledge_entities, filterable by type |
| GET | `/api/equipment` | List equipment records |
| POST | `/api/search` | Hybrid file search — returns deduplicated document cards with page links |
| POST | `/api/query` | Run knowledge-qa-agent conversation, return markdown answer |
| GET | `/api/file/page` | Generate signed URL and redirect to specific PDF page |

---

## Search Strategy

**Quick Search** (`/api/search`) uses `pod.files.search(query, search_method="HYBRID")`:
- BM25 keyword matching + semantic similarity in one call
- Results deduplicated by document title (same file uploaded multiple times → one card)
- Scores normalized to 0–1 (raw BM25 scores divided by max score)
- Each document card shows clickable page number badges

**Deep Analysis** (`/api/query`) runs the `knowledge-qa-agent`:
- Agent reads knowledge_entities + file chunks
- Returns a full markdown answer with citations
- Takes ~30–60s but gives synthesized, comprehensive answers

---

## Text Cleaning

Raw PDF text extracted by Lemma often contains artifacts. The backend cleans these before displaying:

- `clean_filename()` — removes timestamps (`_20260626`), hex hashes (`_b4b570b8`), UUIDs, consecutive duplicate words → title case
- `clean_chunk()` — strips markdown headers (`###`), bold markers (`**`), diagram letter sequences (`A A B C D`), table column headers
- `is_garbage_chunk()` — filters chunks where >35% of words are single characters (diagram labels)
