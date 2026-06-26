# Setup Guide

Complete step-by-step guide to run Industrial Knowledge Brain locally from scratch.

There is **no backend server** — the React app talks directly to Lemma's API using `lemma-sdk`.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Python | 3.11+ | [python.org](https://python.org) (for Lemma CLI only) |
| Lemma CLI | latest | `pip install lemma-terminal` |
| Lemma account | — | [lemma.work/start](https://lemma.work/start) |

---

## Step 1 — Install and authenticate the Lemma CLI

```bash
pip install lemma-terminal
lemma auth login
```

This opens a browser window. Sign in with your Lemma account. Your session is saved at `~/.lemma/config.json`.

Verify:
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

Get your pod ID:
```bash
lemma pod list
```

---

## Step 3 — Import the pod bundle

This registers all tables, agents, functions, and workflows into your pod:

```bash
# Dry run first to verify
lemma pod import . --dry-run

# Then actually import
lemma pod import .
```

Verify:
```bash
lemma table list          # should show 6 tables
lemma agent list          # should show 4 agents
lemma function list       # should show 5 functions
lemma workflow list       # should show 1 workflow
```

---

## Step 4 — Set up the frontend

```bash
cd frontend
cp .env.example .env.local
```

Open `.env.local` and fill in:

```env
VITE_LEMMA_API_URL=https://api.lemma.work
VITE_LEMMA_AUTH_URL=https://lemma.work/auth
VITE_LEMMA_POD_ID=<your-pod-id-from-step-2>
```

Install and start:

```bash
npm install
npm run dev
```

Open **http://localhost:5173** in your browser. You will be prompted to log in via Lemma's AuthGuard.

---

## Step 5 — Upload a test document

1. Go to **Upload Doc** in the sidebar
2. Drag and drop any PDF (equipment manual, SOP, etc.)
3. Select the document type and click **Upload & Process**
4. Watch the progress tracker — the AI pipeline runs:
   - Queued → Classification → Entity extraction → Quality review

If the document needs human review, go to **Approvals** and approve it.

Once approved, go to **Ask AI** and try:
> "What equipment is mentioned in this document?"

---

## Environment Variables Reference

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `VITE_LEMMA_POD_ID` | Yes | Your pod ID from `lemma pod list` |
| `VITE_LEMMA_API_URL` | Yes | `https://api.lemma.work` |
| `VITE_LEMMA_AUTH_URL` | Yes | `https://lemma.work/auth` |

---

## Common Errors

**`0 results from search`**
→ Documents need to be fully `approved` before they appear in search. Check the Approvals queue.

**Login loop / AuthGuard keeps redirecting**
→ Make sure `VITE_LEMMA_AUTH_URL` and `VITE_LEMMA_POD_ID` are set correctly in `.env.local`.

**`lemma pod import` fails with schema errors**
→ Run `lemma --version` and update: `pip install -U lemma-terminal`.

**Workflow doesn't start after upload**
→ Confirm the `document-ingestion` workflow was imported: `lemma workflow list`. If not, re-run `lemma pod import .`.
