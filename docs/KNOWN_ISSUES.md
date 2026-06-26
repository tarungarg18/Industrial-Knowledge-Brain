# Known Issues & Limitations

Issues with the Lemma AI platform encountered during this project. Raised as GitHub issues where noted.

---

## 1. No permanent API keys

**Severity:** High (production blocker)

`LEMMA_TOKEN` (obtained via `lemma auth print-token`) is a short-lived JWT that expires in ~1 hour. There is no way to generate a long-lived service account token or API key for server-to-server use.

**Impact:** Any backend deployed on Render/Railway needs the token manually refreshed every hour, or needs a workaround using the CLI inside the server.

**Workaround:** Run the Lemma CLI inside the backend container and call `lemma auth print-token` on a cron job to refresh `LEMMA_TOKEN`.

**Requested feature:** Permanent API keys or service account tokens for production deployments.

---

## 2. No vector embedding storage for table records

**Severity:** Medium

`pod.files.search()` uses hybrid BM25 + semantic search on uploaded files — this works well. However, there is no equivalent for records in Lemma tables. `pod.table("knowledge_entities").list()` only supports exact/ILIKE filtering.

**Impact:** Searching knowledge entities requires keyword matching (`ILIKE "%pump%"`). This misses semantic synonyms ("hydraulic actuator" vs "pump") and complex natural language queries.

**Workaround:** Extract a keyword from the query and use ILIKE. For deep semantic search, fall back to the `knowledge-qa-agent` which can reason over the data.

**Requested feature:** Vector embedding + cosine similarity search on table columns (similar to `pgvector` for PostgreSQL).

---

## 3. `FileSearchResultSchema` field naming inconsistency

**Severity:** Low (developer experience)

The Python SDK's `FileSearchResultSchema` exposes the chunk text as `.content`, but some versions of the SDK documentation refer to it as `.excerpt`. This caused silent empty results when using the wrong field name.

**Workaround:** Always use `getattr(hit, "content", "")` when reading file search results.

---

## 4. Lemma CLI subprocess fails on Windows with `[WinError 2]`

**Severity:** Medium (Windows developer experience)

`lemma apps deploy` with a Vite `SOURCE` argument fails on Windows with `[WinError 2] The system cannot find the file specified`. The CLI attempts to invoke `npm` as a subprocess but cannot find it despite Node.js being installed and on `PATH`.

**Workaround:** Build the frontend manually (`npm run build`) and use `--dist-dir dist` to point at the prebuilt output:

```bash
cd frontend
npm run build
lemma apps deploy knowledge-brain-app --dist-dir dist -y
```

---

## 5. `pod.files.create_signed_url()` — no direct page navigation for non-PDF files

**Severity:** Low

`create_signed_url()` returns a public URL with 1-hour expiry. Adding `#page=N` to the URL works for PDFs in the browser's native PDF viewer, but does not work for other file types (DOCX, etc.).

**Impact:** Page-level navigation only works for PDF files.

**Workaround:** Only show page badges for PDF uploads. For other file types, link to the document root.

---

## 6. Workflow FORM nodes block until manually submitted

**Severity:** Low (by design, but worth knowing)

When the `quality_review_form` FORM node is reached in the `document-ingestion` workflow, the workflow pauses indefinitely waiting for a human to submit the form via the Lemma UI or API. If no reviewer acts, the document stays in `quality_review` status forever.

**Impact:** Documents requiring human review will remain stuck if the approval queue is not monitored.

**Workaround:** The app's Approval Queue page surfaces these documents. The backend `/api/approvals` endpoint allows programmatic approve/reject.

**Future improvement:** Add a timeout edge to auto-reject after N days of inactivity.

---

## 7. Short-lived `LEMMA_TOKEN` causes 401 errors that silently fail

**Severity:** Medium

When `LEMMA_TOKEN` expires, Lemma SDK raises `LemmaAuthError`. If this is caught by a generic `except Exception` block (which was the case in an earlier version of this codebase), the error is silently swallowed and the API returns empty results instead of a 401 error.

**Fix applied in this project:** `LemmaAuthError` and `LemmaServerError` are now explicitly re-raised before the generic handler, so the frontend receives a proper HTTP 500 with an error message.
