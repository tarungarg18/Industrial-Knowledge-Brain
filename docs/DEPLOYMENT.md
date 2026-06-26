# Deployment Guide

The entire app deploys to **Lemma Apps** — no backend server, no Render, no Docker.

---

## Deploy to Lemma Apps

### 1. Configure env vars

```bash
cd frontend
cp .env.example .env.local
```

Fill in `.env.local`:

```env
VITE_LEMMA_API_URL=https://api.lemma.work
VITE_LEMMA_AUTH_URL=https://lemma.work/auth
VITE_LEMMA_POD_ID=<your-pod-id>
```

### 2. Build

```bash
npm run build
```

### 3. Deploy

```bash
# From the project root
lemma apps deploy knowledge-brain-app --dist-dir frontend/dist -y
```

The CLI outputs a URL: `https://knowledge-brain-app.apps.lemma.work`. Done.

---

## Re-deploy after changes

```bash
cd frontend && npm run build
cd .. && lemma apps deploy knowledge-brain-app --dist-dir frontend/dist -y
```

---

## First-time (create the app)

If the app doesn't exist yet on your pod:

```bash
lemma apps deploy knowledge-brain-app --dist-dir frontend/dist --create -y
```

---

## Windows note

The Lemma CLI may fail on Windows with `[WinError 2]` if it tries to run npm internally. Always pre-build manually:

```powershell
cd frontend
npm run build
cd ..
lemma apps deploy knowledge-brain-app --dist-dir frontend/dist -y
```

---

## Environment Variable Summary

### Frontend (`.env.local` / Lemma Apps)

| Variable | Required | Value |
|---|---|---|
| `VITE_LEMMA_API_URL` | Yes | `https://api.lemma.work` |
| `VITE_LEMMA_AUTH_URL` | Yes | `https://lemma.work/auth` |
| `VITE_LEMMA_POD_ID` | Yes | Your pod ID from `lemma pod list` |

---

## Auth

The app uses `AuthGuard` from `lemma-sdk/react`. Users are redirected to Lemma's login page if not authenticated. No separate auth setup needed — it's handled by the SDK.

---

## Pod requirements

Before deploying the app, your pod must have:

- All tables imported (`lemma pod import .`)
- All agents active
- The `document-ingestion` workflow imported

See [SETUP.md](SETUP.md) for pod setup instructions.
