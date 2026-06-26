# Industrial Knowledge Brain (IKB)

> AI-powered knowledge management system for industrial organizations — built on [Lemma AI](https://lemma.work) .

Upload equipment manuals, SOPs, inspection reports, and safety documents. AI agents automatically extract structured knowledge (equipment specs, procedures, safety rules) and make everything queryable in plain English with cited page references.

---

## Live Demo

Deployed at: **[knowledge-brain.apps.lemma.work](https://knowledge-brain.apps.lemma.work/dashboard)**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| UI Components | Lucide React icons, react-markdown |
| Backend API | FastAPI (Python 3.11+) |
| AI Platform | [Lemma AI](https://lemma.work) — agents, functions, workflows, tables, file storage |
| AI Models | Claude (via Lemma agents) |
| Vector Search | Lemma hybrid file search (BM25 + semantic) |
| File Storage | Lemma pod file storage with signed URLs |
| Deployment | Lemma Apps (frontend) + Render (backend) |

---

## How It Works

```
Upload PDF
    ↓
Lemma Workflow: document-ingestion
    ↓
AI Agent: document-indexer       → classifies type, generates summary + tags
    ↓
AI Agent: knowledge-extractor    → extracts equipment, specs, procedures, safety rules
    ↓
Quality Gate (auto or human review)
    ↓
Knowledge Base (searchable via Quick Search or Deep Analysis AI chat)
```

---

## Project Structure

```
industrial-knowledge-brain/
├── frontend/                   # React + Vite operator dashboard
│   ├── src/
│   │   ├── pages/              # Dashboard, Upload, Documents, Query, Approvals, KnowledgeBase
│   │   ├── components/         # Sidebar, StatusBadge
│   │   └── api.js              # Axios instance with configurable base URL
│   └── .env.example            # Frontend env var template
│
├── backend/                    # FastAPI bridge to Lemma SDK
│   ├── main.py                 # All API endpoints
│   ├── requirements.txt
│   └── .env.example            # Backend env var template
│
├── functions/                  # Lemma serverless functions (Python)
│   ├── approve_knowledge/      # Update document status, write quality review
│   ├── persist_entities/       # Save extracted entities to tables
│   ├── process_document/       # Initialize document processing
│   ├── record_query/           # Log Q&A pairs for audit trail
│   └── search_knowledge/       # Multi-source search (tables + file index)
│
├── agents/                     # Lemma AI agents
│   ├── document-indexer/       # Classify + summarize uploaded documents
│   ├── knowledge-extractor/    # Extract structured entities from text
│   ├── knowledge-qa-agent/     # Answer natural-language questions
│   └── quality-reviewer/       # Audit knowledge accuracy
│
├── workflows/
│   └── document-ingestion/     # Full ingestion pipeline orchestration
│
├── tables/                     # Lemma table schemas
│   ├── documents.json
│   ├── knowledge_entities.json
│   ├── equipment.json
│   ├── procedures.json
│   ├── quality_reviews.json
│   └── queries.json
│
└── docs/                       # Detailed documentation
    ├── SETUP.md                # Step-by-step local setup
    ├── ARCHITECTURE.md         # System design deep-dive
    ├── DEPLOYMENT.md           # Deployment guide (Lemma + Render)
    └── KNOWN_ISSUES.md         # Known Lemma platform limitations
```

---

## Quick Start

See **[docs/SETUP.md](docs/SETUP.md)** for the complete setup guide.

**Short version:**

```bash
# 1. Install Lemma CLI
pip install lemma-terminal

# 2. Login
lemma auth login

# 3. Create a pod
lemma pod create industrial-knowledge-brain

# 4. Import everything (tables, agents, functions, workflows)
lemma pod import .

# 5. Set up backend
cd backend
cp .env.example .env
# Fill in LEMMA_POD_ID and LEMMA_TOKEN in .env
pip install -r requirements.txt
uvicorn main:app --reload

# 6. Set up frontend
cd ../frontend
cp .env.example .env.local
# Fill in VITE_LEMMA_POD_ID in .env.local
npm install
npm run dev
```

---

## Features

- **Document Upload** — drag & drop PDFs with real-time processing progress
- **Quick Search** — vector + BM25 hybrid search returning document cards with clickable page numbers that open the PDF at the exact page
- **Deep Analysis** — full AI agent chat with markdown-formatted answers and citations
- **Approval Queue** — human review workflow for quality control before knowledge enters the base
- **Knowledge Base** — browse all extracted entities (equipment, specs, procedures, safety rules) with confidence scores
- **Session Persistence** — chat history survives tab navigation (sessionStorage)

---

## Documentation

| Doc | What it covers |
|---|---|
| [Setup Guide](docs/SETUP.md) | Prerequisites, creating a pod, env vars, running locally |
| [Architecture](docs/ARCHITECTURE.md) | Data model, agent design, workflow graph, API endpoints |
| [Deployment](docs/DEPLOYMENT.md) | Deploying to Lemma Apps + Render |
| [Known Issues](docs/KNOWN_ISSUES.md) | Current Lemma platform limitations and workarounds |

---

## Built for Lemma AI Hackathon

This project demonstrates Lemma AI's capabilities for enterprise knowledge management:
- Multi-agent document processing pipelines
- Human-in-the-loop quality workflows
- Hybrid vector + keyword search on uploaded documents
- Structured knowledge extraction into queryable tables
