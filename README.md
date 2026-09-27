# Terms

### Capital that knows its terms.

**Terms** is a pre-execution authorization layer for autonomous capital.

AI agents are increasingly capable of discovering opportunities, constructing transactions, and moving funds. But being technically capable of moving capital is not the same as being authorized to move it.

Terms establishes that authorization **before capital moves**.

Built for the **IXS RWA Vaults track** of the OpenServ SERV Hackathon — Edition 01.

**Live app:** https://terms-production-13ce.up.railway.app

---

## The problem

Most agentic finance systems focus on execution:

> Can the agent perform this transaction?

Terms asks a different question first:

> Is the agent currently permitted to perform this transaction?

A treasury may have rules around:

- minimum cash reserves
- maximum vault concentration
- approved products
- approved chains
- vault status
- supported actions
- wallet eligibility

Those rules should not live only in a prompt or depend on an agent remembering them.

They should form an explicit authorization boundary.

---

## How Terms works

A capital allocation moves through six stages:

```text
Treasury Mandate
      ↓
IXS Evidence
      ↓
Policy Engine
      ↓
SERV Verification
      ↓
IXS Preflight
      ↓
Action Gate
```

### 1. Treasury Mandate

The operator defines machine-readable operating terms, including treasury size, proposed allocation, reserve floor, concentration ceiling, permitted products and chains, and evidence requirements.

### 2. IXS Evidence

Terms retrieves vault evidence from IXS, including vault status, product, chain, supported actions, wallet eligibility and current exposure.

### 3. Deterministic Policy Engine

Hard constraints are evaluated deterministically.

The result is one of three authorization states:

| State | Meaning |
| --- | --- |
| **EXECUTE** | Every required constraint is established and satisfied. |
| **HOLD** | Known evidence proves at least one mandate violation. |
| **ESCALATE** | A required fact is missing, ambiguous or unsupported. |

The core rule is simple:

> **Missing evidence is not permission.**

### 4. SERV Verification

An EXECUTE decision can be sent to OpenServ's SERV Reasoning for bounded verification.

SERV does not replace the deterministic policy engine or freely choose a different action. It verifies whether the supplied evidence supports the exact authorization decision.

The verification response is constrained to a strict structured-output contract and bound to the current decision.

### 5. IXS Preflight

Authorization still does not guarantee that an external action is currently executable.

Terms asks IXS to construct the deposit request.

IXS can still reject the operation because of live execution conditions.

### 6. Action Gate

Transaction data is released only when every required stage permits it.

Otherwise, the gate remains closed.

---

## Authorization is not execution feasibility

The strongest example in the current demo is a real end-to-end result:

```text
Policy Engine     EXECUTE
SERV Verification VERIFIED
IXS Preflight     BLOCKED
Action Gate       WITHHELD
```

The mandate permitted the proposed allocation and SERV verified the authorization.

But IXS reported:

```text
Deposit amount exceeds the current vault limit of 0 USDC.
```

Terms therefore withheld transaction data.

That is intentional.

> **An action can be authorized without being executable.**

Terms keeps those two questions separate.

---

## Counterfactual decisions

The demo also shows how changing a single fact changes authorization.

### EXECUTE

A $10,000 allocation from a $100,000 treasury satisfies the configured mandate.

All seven required constraints pass.

```text
EXECUTE — 7/7 constraints pass
```

### HOLD

Reduce the maximum single-vault exposure to 5%.

The proposed allocation produces 10% exposure.

```text
HOLD

Post-allocation exposure is 10.00%,
above the 5% ceiling.
```

### ESCALATE

Withhold a required wallet-eligibility fact in the counterfactual evidence-gap scenario.

```text
ESCALATE

Wallet eligibility has not been established.
```

Terms refuses to turn uncertainty into permission.

---

## Why SERV?

Terms deliberately separates deterministic authorization from AI reasoning.

The policy engine handles hard constraints.

SERV is used where reasoning adds value: verifying that the evidence actually supports the resulting authorization.

The SERV integration uses:

- bounded verification
- strict structured output
- decision binding
- evidence sufficiency checks
- explicit decisive and unresolved facts
- fail-closed parsing
- no fallback execution on malformed verification

A malformed, incomplete or mismatched SERV response does not become authorization.

---

## Why IXS?

IXS is not used as a decorative API integration.

It participates at two different trust boundaries:

**Evidence layer** — Terms obtains live RWA vault information used during authorization.

**Execution layer** — after authorization and SERV verification, IXS preflight determines whether the requested operation can actually be constructed under current vault conditions.

This separation is what allows Terms to demonstrate:

```text
AUTHORIZED ≠ EXECUTABLE
```

---

## Decision receipts

Completed verification attempts generate a structured decision receipt containing:

- mandate information
- IXS evidence provenance
- deterministic constraints
- authorization state
- SERV verification
- decisive facts
- unresolved facts
- execution state
- final disposition

The receipt creates an auditable record of **why capital was allowed, stopped or escalated**.

---

## Safety model

Terms is designed to fail closed.

Key properties include:

- deterministic hard constraints
- no permission from missing evidence
- SERV output validated against a strict schema
- SERV verification bound to the deterministic decision
- transaction construction attempted only after verified authorization
- no calldata released when the Action Gate is closed
- single-use verification tickets
- 15-minute ticket expiry
- tickets bound server-side to the mandate, evidence, decision and wallet
- server restarts invalidate outstanding tickets
- no automatic transaction broadcast

Terms constructs transaction data when permitted.

It does **not** sign or broadcast transactions on behalf of the wallet.

---

## Architecture

```text
                    ┌──────────────────────┐
                    │   Treasury Mandate   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │     IXS Evidence     │
                    │ vault / position /   │
                    │ whitelist evidence   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Deterministic Policy │
                    │       Engine         │
                    └──────────┬───────────┘
                               │
                    EXECUTE / HOLD / ESCALATE
                               │
                         EXECUTE only
                               ▼
                    ┌──────────────────────┐
                    │   SERV Verification  │
                    │ bounded + structured │
                    └──────────┬───────────┘
                               │
                          verified only
                               ▼
                    ┌──────────────────────┐
                    │     IXS Preflight    │
                    │ transaction request  │
                    │     construction     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │     Action Gate      │
                    │ READY / BLOCKED /    │
                    │   NOT_AUTHORIZED     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Decision Receipt   │
                    └──────────────────────┘
```

---

## Technology

- Next.js 16
- TypeScript
- Zod
- Vitest
- OpenServ SERV Reasoning
- IXS RWA Vault API + MCP
- Railway

---

## Running locally

### Install dependencies

```bash
npm install
```

### Configure SERV

Create `.env.local`:

```env
OPENSERV_KEY=your_server_side_key
```

`OPENSERV_KEY` must remain server-side.

Do not expose it through a `NEXT_PUBLIC_*` environment variable.

### Start development

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Validation

Run the offline validation suite:

```bash
npx tsc --noEmit
npx vitest run src/lib/__tests__ --exclude "**/terms-serv-live.test.ts"
npm run build
```

Live SERV verification should only be triggered intentionally because it consumes inference credit.

---

## Deployment note

The current hackathon deployment intentionally runs as a **single persistent Railway service instance**.

Verification tickets are stored in the server process to preserve single-use semantics for the hackathon build.

A production horizontally scaled deployment would replace this process-local ticket store with a shared atomic store before enabling multiple application instances.

Restarts discard outstanding tickets and therefore fail closed: the user must evaluate the proposal again.

---

## What Terms is not

Terms is not:

- an autonomous portfolio manager
- another trading bot
- a prompt-only compliance agent
- a wallet custodian
- a transaction broadcaster

It is the authorization boundary between **an agent's ability to act** and **its permission to act**.

---

## Built for OpenServ SERV Hackathon — Edition 01

**Track:** IXS RWA Vaults

**Project:** Terms

**Tagline:** *Capital that knows its terms.*

The thesis behind Terms is simple:

> Autonomous capital needs more than execution capability.  
> It needs permission that can be established, verified and audited before capital moves.