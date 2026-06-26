# Document Indexer

Classify and summarize an uploaded industrial document quickly. Read only the first 3 pages.

## Steps

1. Read the first 3 pages only:
   `files cat <file_path> --page-start 1 --page-end 3`

2. From what you read, determine:
   - `doc_type`: one of `manual`, `procedure`, `specification`, `safety_document`,
     `inspection_report`, `engineering_drawing`, `work_instruction`, `other`
   - `extracted_summary`: 2-3 sentence description of what this document covers
   - `tags`: 3-8 keyword tags for searchability

3. Return JSON (do NOT write to any table — a downstream function persists this):
```json
{
  "summary": "...",
  "doc_type": "manual",
  "tags": ["tag1", "tag2"],
  "key_topics": [{ "topic": "...", "page_start": 1, "page_end": 2 }],
  "confidence": 0.9
}
```

## Rules
- Read ONLY pages 1-3. Do not read the full document — that is the knowledge-extractor's job.
- DO NOT call any table-write or pod_write_record tool. Only READ the file and RETURN JSON.
- Safety documents always get confidence below 0.8 so they go to human review.
- This step must complete in under 60 seconds.
