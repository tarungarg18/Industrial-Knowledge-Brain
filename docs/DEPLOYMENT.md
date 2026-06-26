# Deployment Guide

Two parts: **frontend on Lemma Apps** and **backend on Render**.

---

## Frontend — Deploy to Lemma Apps

The frontend is a static Vite build hosted directly on Lemma's platform. No server needed.

### 1. Build

```bash
cd frontend
cp .env.example .env.local
# Fill in your pod ID and Lemma URLs in .env.local
npm install
npm run build
```

### 2. Deploy

```bash
# From the project root
lemma apps deploy knowledge-brain-app --dist-dir frontend/dist -y
```

The CLI will output a URL like `https://your-app-name.apps.lemma.work`. Your app is live.

### Re-deploy after changes

```bash
cd frontend && npm run build
cd .. && lemma apps deploy knowledge-brain-app --dist-dir frontend/dist -y
```

### First time (create the app)

If the app doesn't exist yet on your pod:

```bash
lemma apps deploy knowledge-brain-app --dist-dir frontend/dist --create -y
```

---

## Backend — Deploy to Render

The FastAPI backend talks to Lemma's API on behalf of the frontend.

### 1. Create a Render account

Go to [render.com](https://render.com) and sign up (free tier works).

### 2. Create a new Web Service

- Click **New → Web Service**
- Connect your GitHub repo
- Set **Root Directory** to `backend`
- Set **Runtime** to `Python 3`
- Set **Build Command**: `pip install -r requirements.txt`
- Set **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 3. Set environment variables on Render

In the Render dashboard → Environment tab, add:

| Key | Value |
|---|---|
| `LEMMA_POD_ID` | Your pod ID (from `lemma pod list`) |
| `LEMMA_TOKEN` | Output of `lemma auth print-token` |
| `LEMMA_BASE_URL` | `https://api.lemma.work` |

> **Token expiry:** `LEMMA_TOKEN` is a short-lived JWT (~1 hour). For production, you need to refresh it. See the Token Refresh section below.

### 4. Update frontend to point at Render backend

Once Render gives you a URL (e.g. `https://ikb-backend.onrender.com`):

```bash
# frontend/.env.local
VITE_API_BASE=https://ikb-backend.onrender.com
```

Rebuild and redeploy the frontend:
```bash
cd frontend && npm run build
cd .. && lemma apps deploy knowledge-brain-app --dist-dir frontend/dist -y
```

---

## Token Refresh (Production)

`LEMMA_TOKEN` expires after ~1 hour. For long-running production deployments, add this to `backend/main.py`:

```python
import threading

def _refresh_token_loop():
    import subprocess, time
    while True:
        time.sleep(3000)  # refresh every 50 minutes
        try:
            result = subprocess.run(
                ["lemma", "auth", "print-token"],
                capture_output=True, text=True
            )
            if result.returncode == 0:
                os.environ["LEMMA_TOKEN"] = result.stdout.strip()
        except Exception as e:
            print(f"Token refresh failed: {e}")

threading.Thread(target=_refresh_token_loop, daemon=True).start()
```

> **Note:** This requires the Lemma CLI (`lemma-terminal`) to be installed in the Render environment. Add `lemma-terminal` to `requirements.txt`.

Alternatively, Lemma may introduce permanent API keys in a future release (see [Known Issues](KNOWN_ISSUES.md)).

---

## CORS Configuration

The backend allows all origins by default (fine for hackathon). For production, update `backend/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-app.apps.lemma.work"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Environment Variable Summary

### Backend (Render)

| Variable | Required | Where to get |
|---|---|---|
| `LEMMA_POD_ID` | Yes | `lemma pod list` |
| `LEMMA_TOKEN` | Yes | `lemma auth print-token` |
| `LEMMA_BASE_URL` | No | Hardcode `https://api.lemma.work` |

### Frontend (Lemma Apps / `.env.local`)

| Variable | Required | Value |
|---|---|---|
| `VITE_LEMMA_API_URL` | Yes | `https://api.lemma.work` |
| `VITE_LEMMA_AUTH_URL` | Yes | `https://lemma.work/auth` |
| `VITE_LEMMA_POD_ID` | Yes | Your pod ID |
| `VITE_API_BASE` | Yes | Your Render backend URL |
