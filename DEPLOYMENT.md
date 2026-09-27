# Frozen hackathon deployment

Baseline: 5921436e0fb6d8bf78d852d2f0ee7707cf533838.

Run on Railway as exactly one service replica in one region using one `next start` process. The checked-in railway.json disables sleeping and deployment overlap. Confirm the effective service has no multi-region overrides or extra replicas before releasing it. Do not use Vercel/serverless, Node cluster mode, or horizontal scaling with this build.

Verification tickets remain server-only, randomly issued UUIDs. The complete mandate, evidence, decision (including decision ID), and wallet are cloned into the server map, expire after 15 minutes, and are synchronously marked used before the first awaited operation. Failed attempts remain consumed. HOLD and ESCALATE cannot obtain tickets or reach transaction construction. The action gate is unchanged.

A process restart, crash, or deployment discards tickets and fails closed; users must evaluate again. Avoid redeploying during the demo. No cross-instance ticket availability is claimed. Supporting multiple instances requires a shared atomic store; signed tokens alone would not preserve single-use semantics.

Set OPENSERV_KEY only in the service's server environment. Never prefix it NEXT_PUBLIC_, commit .env.local, or upload ignored files. Keep RUN_LIVE_SERV unset. Railway CLI uploads must respect .gitignore (never use --no-gitignore). Use existing trial credits only; do not upgrade or buy credits without approval.

Free checks:
- `node node_modules/vitest/vitest.mjs run src/lib/__tests__ --exclude "**/*live.test.ts"`
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`
- `npm run build`

Production smoke: load the page and evaluate Permitted (EXECUTE, 7/7), Limit breach (HOLD), and Evidence gap (ESCALATE, counterfactual) using live IXS evidence. Verify HOLD/ESCALATE expose no construction data. Never click VERIFY WITH SERV during free validation.
