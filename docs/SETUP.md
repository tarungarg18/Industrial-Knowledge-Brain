# Setup Guide

Complete step-by-step guide to run Industrial Knowledge Brain locally from scratch.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Lemma CLI | latest | `pip install lemma-terminal` |
| Lemma account | — | [lemma.work/start](https://lemma.work/start) |

---

## Step 1 — Install and authenticate the Lemma CLI

```bash
pip install lemma-terminal
lemma auth login
```

This opens a browser window. Sign in with your Lemma account. Your session is saved locally at `~/.lemma/config.json`.

Verify it worked:
```bash
lemma auth status
```

---

## Step 2 — Create a pod

A **pod** is Lemma's unit of deployment — it holds your tables, files, agents, functions, and workflows.

```bash
lemma pod create industrial-knowledge-brain \
  --description "AI-powered industrial knowledge management"
```

Note the pod ID from the output. You will need it in later steps.

```bash
# List your pods to confirm and get the ID
lemma pod list
```

---

## Step 3 — Import the pod bundle

This registers all tables, agents, functions, and workflows into your pod:

```bash
# Dry run first to verify nothing breaks
lemma pod import . --dry-run

# Then actually import
lemma pod import .
```

After import, verify:
```bash
lemma table list          # should show 6 tables
lemma agent list          # should show 4 agents
lemma function list       # should show 5 functions
lemma workflow list       # should show 1 workflow
```

---

## Step 4 — Set up the backend

```bash
cd backend
cp .env.example .env
```

Open `.env` and fill in:

```env
LEMMA_POD_ID=<your-pod-id-from-step-2>
LEMMA_TOKEN=<run: lemma auth print-token>
LEMMA_BASE_URL=https://api.lemma.work
```

> **Note on LEMMA_TOKEN:** This token expires in ~1 hour. For local development this is fine — just re-run `lemma auth print-token` and update `.env` when it expires. See [DEPLOYMENT.md](DEPLOYMENT.md) for production token handling.

Install dependencies and start:

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Test it works:
```bash
curl http://localhost:8000/api/stats
```

---

## Step 5 — Set up the frontend

```bash
cd frontend
cp .env.example .env.local
```

Open `.env.local` and fill in:

```env
VITE_LEMMA_API_URL=https://api.lemma.work
VITE_LEMMA_AUTH_URL=https://lemma.work/auth
VITE_LEMMA_POD_ID=<your-pod-id-from-step-2>
VITE_API_BASE=http://localhost:8000
```

Install and start:

```bash
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Step 6 — Upload a test document

1. Go to **Upload Doc** in the sidebar
2. Drag and drop any PDF (equipment manual, SOP, etc.)
3. Select the document type and click **Upload & Process**
4. Watch the progress tracker — the AI pipeline runs automatically:
   - Processing → Classification → Entity extraction → Quality review

If the document needs human review, go to **Approvals** and approve it.

Once approved, go to **Ask AI** and try:
> "What equipment is mentioned in this document?"

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `LEMMA_POD_ID` | Yes | Your pod ID from `lemma pod list` |
| `LEMMA_TOKEN` | Yes | Short-lived auth token from `lemma auth print-token` |
| `LEMMA_BASE_URL` | No | Defaults to `https://api.lemma.work` |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `VITE_LEMMA_POD_ID` | Yes | Same pod ID as backend |
| `VITE_LEMMA_API_URL` | Yes | `https://api.lemma.work` |
| `VITE_LEMMA_AUTH_URL` | Yes | `https://lemma.work/auth` |
| `VITE_API_BASE` | Yes (local dev) | URL of the running backend, e.g. `http://localhost:8000` |

---

## Common Errors

**`LEMMA_POD_ID environment variable is not set`**
→ You forgot to fill in `.env`. Run `cp .env.example .env` and add your values.

**`LemmaAuthError: Missing Lemma token`**
→ Your token expired. Run `lemma auth print-token` and update `LEMMA_TOKEN` in `.env`.

**`0 results from search`**
→ Documents need to be fully `approved` before they appear in search. Check the Approvals queue.

**`CORS error in browser console`**
→ Make sure the backend is running on port 8000. Check `VITE_API_BASE` in `frontend/.env.local`.

**`lemma pod import` fails with schema errors**
→ Run `lemma --version` and make sure `lemma-terminal` is up to date: `pip install -U lemma-terminal`.
