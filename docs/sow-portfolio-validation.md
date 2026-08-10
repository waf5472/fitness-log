# SOW: Fitness Log — Portfolio Piece with Passive Validation

**Decision trail:**
- External audit (2026-08-10): the differentiation claim ("no incumbent does parse-then-deterministic") is false — MacroFactor Describe and similar features exist — and there is no evidence for acquisition cost, paid conversion, retention, or a preferring segment. Verdict: bounded validation with the existing app, no further productization.
- Owner decision (2026-08-10): no paid validation run either. Fitness Log stays a **portfolio piece** on the daily-quiz operating model — anonymous visitors, no user accounts, hard token-cost caps, low traffic assumed unless Cloudflare analytics says otherwise. Validation is passive: instrument, cap, watch.

**Objective:** Make the existing app safe to leave running unattended as a public demo, and instrument it well enough that *if* organic interest ever materializes, the evidence is already collected. Zero ad spend, zero payment infrastructure, zero feature work.

**Positioning constraint (from the audit):** No "first/only" architecture claims. The honest pitch: *"Log food and training in one sentence. Numbers from USDA data and published equations — never model guesses — and every entry shows its work."*

## In scope (est. ~1 week part-time, then passive)

**1. Cost guards matched to daily-quiz (1–2 days).** The Worker already rate-limits anonymous visitors per IP via KV; bring it to full parity with daily-quiz's model and add the missing global backstop:
- Forced cheap model + hard `max_tokens` cap server-side regardless of client input (verify current `worker/models.js` settings; pin them).
- Per-IP daily parse limit (exists — confirm the ceiling is sensible for a demo user, e.g. ~20 parses/day).
- **Global daily spend cap:** KV-backed counter of parse calls across all visitors; past the cap, `/api/parse` returns a friendly "demo budget spent — back tomorrow" and the owner path stays unaffected. Target ceiling ≈ $5–10/month worst case.
- Anthropic console budget alert as the out-of-band alarm.

**2. Funnel instrumentation (2–3 days).** Privacy-respecting counters in the Worker (KV/D1 tallies; no third-party trackers, no cookies): demo first parse → preview accepted / edited / rejected → entry saved → return visit (day 2+). Also record per-parse edit-rate — it doubles as parse-quality evidence. Cloudflare Web Analytics (already on the site) remains the traffic source of truth.

**3. Landing polish (1 day).** Front-load the live demo and the honest positioning line above. No pricing page, no waitlist, no email capture — it's a portfolio piece and says so.

**4. Passive watch (ongoing, ~10 min/month).** A monthly glance at Cloudflare analytics + the KV tallies. No scheduled work beyond that.

## Out of scope (explicitly)

Payments, subscriptions, or seat provisioning of any kind; user accounts / multi-user auth (visitor localStorage + owner token stay exactly as built); ad spend; mobile/PWA work; food-table expansion; new parse features; B2B API; responding to feature requests with code (file them, don't build them).

## Deliverables

Cost-cap parity with daily-quiz incl. global daily cap · funnel tallies queryable in one place · polished landing copy · this doc's gates recorded.

## Escalation gates (passive — checked at the monthly glance, no other trigger)

- **Interest gate:** Cloudflare shows sustained non-trivial organic traffic (order of ≥500 unique visitors/month without promotion) **or** funnel shows ≥100 demo users/month with day-2 return ≥20% → *then* write the bounded paid-validation SOW (Stripe seats, capped ads, CAC/retention gates — the previously drafted version is the template).
- **Cost gate:** global cap being hit regularly is itself a signal — investigate before raising it; abuse and interest look identical at the counter.
- **Default posture:** neither gate trips → it remains a portfolio piece indefinitely. Pre-agreed as a fine outcome; it's the author's daily log either way.

## Risks

Global cap too low frustrates a genuinely interested visitor (acceptable at portfolio stakes; the message says why); KV tally counters are best-effort, not bookkeeping (fine — decisions here need magnitudes, not decimals); the main risk is scope creep back toward productization without a gate tripping — the out-of-scope list is the contract.
