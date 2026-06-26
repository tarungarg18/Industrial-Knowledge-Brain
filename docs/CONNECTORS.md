# Telegram Bot — Industrial Knowledge Brain

The Industrial Knowledge Brain is available as a Telegram bot. Send it documents to ingest or ask questions about your equipment, procedures, and safety rules.

## Bot Details

| Field | Value |
|---|---|
| **Bot Name** | Industrial Brain |
| **Bot Username** | @IndustrialBrainbot |
| **Telegram Link** | https://t.me/IndustrialBrainbot |

> **Note:** Users need a free Lemma account to interact with the bot. See the onboarding steps below.

---

## First-time user onboarding

Anyone can use the bot — you just need a free Lemma account to authenticate.

1. Message `@IndustrialBrainbot` → bot asks for your phone number
2. Tap **Share Contact** → bot checks if your phone is linked to a Lemma account
3. If not found → click the `https://lemma.work/auth` link and sign up free (30 seconds)
4. After signing up, go to **lemma.work → Profile → Messaging number**
5. Enter your phone number **with country code, digits only, no +**
   - India example: `917056202923` (91 + your 10-digit number)
   - US example: `12025550123`
6. Click **Save changes**
7. Come back to Telegram → send `/start` → share phone again → you're in

After this one-time setup, the bot works instantly every time.

---

## What the bot can do

### Answer questions
Send any text message and the bot searches the knowledge base and replies with an answer + source citations.

Examples:
- "What causes a hydraulic pump to lose pressure?"
- "What are the safety rules for high-pressure systems?"
- "Show me the maintenance schedule for the CP-15 pump"

### Upload documents
Send a PDF or DOCX file — the bot uploads it to the knowledge base and triggers the AI ingestion pipeline automatically.

After upload:
1. Document is classified and summarised
2. Knowledge entities are extracted
3. Document is queued for human review in the web app
4. Once approved, the content is queryable via the bot and the web app

---

## Architecture

```
Telegram user
    │  sends message or file
    ▼
Telegram Bot API
    │  webhook → Lemma surface
    ▼
Lemma Surface (TELEGRAM)
    │  routes to agent
    ▼
ikb-bot-agent (POD toolset)
    ├── searches knowledge_entities + equipment tables
    ├── runs hybrid file search on /knowledge/ folder
    ├── uploads files to /inbox/
    └── triggers document-ingestion workflow
    │
    ▼
Reply sent back to Telegram user
```

---

## Setup (already done — for reference)

The Telegram surface is configured in the pod:

```bash
# Check status
lemma surface get TELEGRAM

# Surface details
# Platform: TELEGRAM
# Status: ACTIVE
# Agent: ikb-bot-agent
# Mode: CUSTOM (your own bot token)
```

The bot token is stored as a connector account in Lemma. No external server or relay is needed — Lemma manages the webhook registration automatically.

---

## For pod maintainers

To update the agent instruction (what the bot says and how it behaves):

```bash
# Edit agents/ikb-bot-agent/instruction.md then:
lemma pod import .
```

To check if the surface is healthy:

```bash
lemma surface setup TELEGRAM --full
```
