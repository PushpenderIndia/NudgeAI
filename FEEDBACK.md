# Feedback for Nebius Token Factory & NVIDIA Nemotron

Honest notes from building **Nudge** on Nebius Token Factory with NVIDIA Nemotron models.
This template is here for the team to fill in as the build and demo progress.

## Summary

- **What we built:** a private AI office buddy that runs every task through Nemotron on
  Nebius Token Factory, with an approval gate so nothing is sent without the user's OK.
- **Models used:** `MODEL_HEAVY` = `nvidia/nemotron-3-super-120b-a12b` (reasoning:
  minutes, email drafts, weekly report); `MODEL_FAST` = a smaller Nemotron (triage,
  classification, reminders).

## What worked well

- _OpenAI-compatible API_ — dropping the OpenAI SDK onto `NEBIUS_BASE_URL` meant no
  special client code. <!-- add specifics -->
- _Structured output_ — <!-- how reliably did Nemotron return valid JSON for our Zod schemas? -->
- _Reasoning quality (heavy model)_ — <!-- MoM / weekly / email draft quality notes -->
- _Latency / throughput (fast model)_ — <!-- triage of ~12 emails, reminders -->

## Friction / papercuts

- _Model discovery_ — the exact Nemotron model IDs weren't obvious from the docs; we had
  to query `GET /v1/models`. A clearly linked, copy-pasteable model table per region
  would help. <!-- confirm -->
- _JSON mode / response_format_ — <!-- did response_format json work, or did we rely on prompt + parsing? -->
- _Reasoning traces_ — <!-- did the model emit <think> blocks we had to strip? -->
- _Docs_ — base URL appears as both the global and a region-specific host; a single
  canonical example would reduce guesswork.

## Model quality notes (Nemotron)

| Task | Model | Quality (1-5) | Notes |
|------|-------|---------------|-------|
| Meeting → minutes | heavy | | |
| Email reply draft (tone) | heavy | | |
| Inbox triage | fast | | |
| Weekly update | heavy | | |
| Reminder copy | fast | | |

## API / docs experience

- Onboarding time to first successful call: <!-- fill -->
- Error messages clarity: <!-- fill -->
- Rate limits encountered: <!-- fill -->

## Requests / wishlist

- <!-- e.g. a hosted JSON-schema-constrained decoding mode -->
- <!-- e.g. clearer model naming + a stable "latest nano/super" alias -->
- <!-- e.g. streaming examples for the OpenAI SDK against Token Factory -->

---

*Contact: Pushpender Singh · built with Nudge 🦉*
