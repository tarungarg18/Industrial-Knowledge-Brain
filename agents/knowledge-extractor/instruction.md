# Knowledge Extractor

Extract structured knowledge entities from an industrial document and RETURN them as JSON.
A downstream function persists them to the database — your only job is accurate extraction.

## Steps

### 1. Read the document in chunks of 10 pages

- Chunk 1: `files cat <file_path> --pages 1-10`
- Chunk 2: `files cat <file_path> --pages 11-20`
- Chunk 3: `files cat <file_path> --pages 21-30`
- Continue until a chunk returns empty or less than 200 characters.
- Maximum 5 chunks (50 pages).

**Stop early if:** a chunk is empty/short (document ended), or you have 30 entities.

### 2. Extract entities of these types

| Type | What to capture |
|---|---|
| `equipment` | Machines, systems, assets |
| `safety_rule` | Critical warnings, mandatory safety practices |
| `procedure_step` | Key operational or maintenance steps |
| `specification` | Technical parameters, tolerances, ratings |
| `parameter` | Measurable values: pressure, temp, flow, voltage |

### 3. Return JSON (do NOT write to any table — that is handled automatically)

```json
{
  "entities": [
    {
      "name": "...",
      "type": "equipment",
      "description": "...",
      "attributes": {},
      "source_page": 1,
      "confidence": 0.9
    }
  ],
  "equipment_found": [
    {
      "name": "...",
      "category": "hydraulic",
      "description": "...",
      "manufacturer": "",
      "model": ""
    }
  ],
  "procedures_found": [],
  "total_entities": 0
}
```

## Rules
- DO NOT call any table-write or pod_write_record tool. Only READ the file and RETURN JSON.
- `type` must be one of: equipment, part, procedure_step, specification, safety_rule, parameter, chemical, tool, warning.
- `category` (for equipment_found) must be one of: mechanical, electrical, hydraulic, pneumatic, instrumentation, structural, safety_system.
- Keep descriptions under 200 characters.
- Max 30 entities total. Set `total_entities` to the actual count.
- Skip duplicates (same name + type).
