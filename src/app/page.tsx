"use client";

import { VERIFICATION_FAILURE_MESSAGE } from "@/lib/serv/errors";

import { useEffect, useMemo, useRef, useState } from "react";

import { AuthorizationOutcome } from "./components/authorization-outcome";
import type { DecisionReceipt } from "@/lib/receipts/decision-receipt";
import type { TreasuryMandate } from "@/lib/terms/schemas";
import type { ServVerification } from "@/lib/serv/client";
import type { ActionGateResult } from "@/lib/terms/action-gate";

type Preset = "permitted" | "breach" | "gap";
type Verdict = "EXECUTE" | "HOLD" | "ESCALATE";
type CheckStatus = "PASS" | "FAIL" | "UNKNOWN";

type Constraint = {
  constraint: string;
  status: CheckStatus;
  reason: string;
};

type Evidence = {
  vaultId: string;
  name: string;
  productId: string;
  chainId: number;
  chainName: string;
  network: string;
  contractAddress: string;
  underlyingAssetSymbol: string;
  status: string;
  requiresWhitelist: boolean;
  walletEligible: boolean | null;
  ttm: number | null;
  actions: string[];
  currentExposureUsd: number | null;
  evidenceTimestamp: string;
  source: "IXS";
};

type Decision = {
  decisionId: string;
  mandateId: string;
  vaultId: string;
  verdict: Verdict;
  constraints: Constraint[];
  summary: string;
  decidedAt: string;
  servUsed: boolean;
  transactionConstructionAllowed: boolean;
};

type EvaluationResult = {
  ok: true;
  mode: string;
  verificationTicket: { token: string; expiresAt: number } | null;
  mandate: TreasuryMandate;
  evidence: Evidence;
  decision: Decision;
};

type VerificationResult = {
  ok: true;
  verification: ServVerification;
  preflight: { ok: boolean; reason?: string };
  action: ActionGateResult;
  receipt: DecisionReceipt;
  transactionRequest: string | null;
};

const VAULT_ID =
  "6a952683732c2b84b55ce89b";

const ZERO_WALLET =
  "0x0000000000000000000000000000000000000000";

const constraintNames: Record<string, string> = {
  minimum_cash_reserve: "Minimum cash reserve",
  allowed_product: "Allowed product",
  allowed_chain: "Allowed chain",
  active_vault: "Active vault",
  deposit_supported: "Deposit support",
  wallet_eligibility: "Wallet eligibility",
  single_vault_exposure: "Single-vault exposure",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function shortId(value?: string) {
  if (!value) return "NOT EVALUATED";
  return value.slice(0, 8).toUpperCase();
}

function verdictCopy(verdict: Verdict) {
  if (verdict === "EXECUTE") {
    return {
      eyebrow: "AUTHORIZED",
      headline: "Capital is within terms.",
      description:
        "Every required mandate constraint is established and satisfied.",
    };
  }

  if (verdict === "HOLD") {
    return {
      eyebrow: "POLICY VIOLATION",
      headline: "Capital is outside its terms.",
      description:
        "At least one established fact violates the treasury mandate.",
    };
  }

  return {
    eyebrow: "EVIDENCE GAP",
    headline: "Permission cannot be established.",
    description:
      "A required authorization fact is unresolved. Missing evidence is not treated as permission.",
  };
}

export default function Home() {
  const [preset, setPreset] =
    useState<Preset>("permitted");

  const [treasuryUsd, setTreasuryUsd] =
    useState(100000);
  const [allocationUsd, setAllocationUsd] =
    useState(10000);
  const [reserveFloor, setReserveFloor] =
    useState(50000);
  const [maxExposure, setMaxExposure] =
    useState(25);

  const [result, setResult] =
    useState<EvaluationResult | null>(null);

  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const revision = useRef(0);
  const evaluationBusy = useRef(false);
  const verificationBusy = useRef(false);

  function resetVerification() {
    revision.current += 1;
    setVerificationResult(null);
    setVerificationError(null);
  }

  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] =
    useState<string | null>(null);

  const [evidenceOpen, setEvidenceOpen] =
    useState(true);

  function markChanged() {
    resetVerification();
    if (result) setStale(true);
  }

  function applyPreset(next: Preset) {
    resetVerification();
    setPreset(next);
    setError(null);

    if (next === "permitted") {
      setTreasuryUsd(100000);
      setAllocationUsd(10000);
      setReserveFloor(50000);
      setMaxExposure(25);
    }

    if (next === "breach") {
      setTreasuryUsd(100000);
      setAllocationUsd(10000);
      setReserveFloor(50000);
      setMaxExposure(5);
    }

    if (next === "gap") {
      setTreasuryUsd(100000);
      setAllocationUsd(10000);
      setReserveFloor(50000);
      setMaxExposure(25);
    }

    if (result) setStale(true);
  }

  async function evaluateProposal() {
    if (evaluationBusy.current || verificationBusy.current) return;
    evaluationBusy.current = true;
    resetVerification();
    const version = revision.current;
    setResult(null);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mandate: {
            mandateId: `terms-ui-${Date.now()}`,
            treasuryUsd, proposedAllocationUsd: allocationUsd,
            minimumCashReserveUsd: reserveFloor,
            maxSingleVaultExposurePct: maxExposure,
            allowedProductIds: ["ixhyb"], allowedChainIds: [43113],
            requireActiveVault: true, requireDepositSupport: true,
            requireWalletEligibility: true,
          },
          vaultId: VAULT_ID, walletAddress: ZERO_WALLET,
          evidenceMode: preset === "gap" ? "COUNTERFACTUAL_EVIDENCE_GAP" : "LIVE",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Terms evaluation failed.");
      if (version !== revision.current) return;
      setResult(data);
      setStale(false);
    } catch (caught) {
      if (version === revision.current) setError(caught instanceof Error ? caught.message : "Terms evaluation failed.");
    } finally {
      evaluationBusy.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!result?.verificationTicket || verificationResult || verifying) return;
    const timer = setTimeout(() => { resetVerification(); setStale(true); }, Math.max(0, result.verificationTicket.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [result, verificationResult, verifying]);

  const attemptedDecisions = useRef(new Set<string>());

  async function verifyProposal() {
    if (!result || stale || evaluationBusy.current || verificationBusy.current || verificationResult ||
        result.mode === "COUNTERFACTUAL_EVIDENCE_GAP" || result.decision.verdict !== "EXECUTE") return;
    if (!result.verificationTicket || result.verificationTicket.expiresAt <= Date.now() || attemptedDecisions.current.has(result.decision.decisionId)) return;
    attemptedDecisions.current.add(result.decision.decisionId);
    verificationBusy.current = true;
    const version = revision.current;
    setVerifying(true);
    setVerificationError(null);
    try {
      const response = await fetch("/api/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationToken: result.verificationTicket.token, mandate: result.mandate, evidence: result.evidence,
          decision: result.decision, walletAddress: ZERO_WALLET }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "SERV verification failed.");
      if (version !== revision.current) return;
      if (data.verification.decisionId !== result.decision.decisionId ||
          data.verification.authorizationState !== result.decision.verdict ||
          data.action.decisionId !== result.decision.decisionId) throw new Error("Verification does not match this decision.");
      setVerificationResult(data);
    } catch {
      if (version === revision.current) setVerificationError(VERIFICATION_FAILURE_MESSAGE);
    } finally {
      verificationBusy.current = false;
      setVerifying(false);
    }
  }

  const servStatus = verifying ? "VERIFYING" : verificationError ? "ERROR" :
    verificationResult ? (verificationResult.verification.evidenceSufficient ? "VERIFIED" : "INSUFFICIENT EVIDENCE") :
    stale ? "RE-EVALUATE" : result ? "NOT YET VERIFIED" : "READY";

  const verdict =
    result?.decision.verdict ?? null;

  const visualState =
    verdict === "HOLD"
      ? "hold"
      : verdict === "ESCALATE"
        ? "escalate"
        : "execute";

  const copy = verdict
    ? verdictCopy(verdict)
    : null;

  const constraints =
    result?.decision.constraints ?? [];

  const passCount = useMemo(
    () =>
      constraints.filter(
        (item) => item.status === "PASS",
      ).length,
    [constraints],
  );

  const exceptionCount =
    constraints.length - passCount;

  const evidence = result?.evidence;

  const isCounterfactual =
    result?.mode ===
    "COUNTERFACTUAL_EVIDENCE_GAP";

  return (
    <main
      className={`app-shell state-${visualState}`}
    >
      <nav className="topbar">
        <div className="brand">
          <div className="brand-mark">T</div>
          <div>
            <div className="brand-name">
              TERMS
            </div>
            <div className="brand-sub">
              CAPITAL CONTROL
            </div>
          </div>
        </div>

        <div className="nav-meta">
          <span className="live-dot" />
          IXS EVIDENCE
          <span className="nav-divider" />
          PRE-EXECUTION CONTROL
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="kicker">
            MACHINE-EXECUTABLE CAPITAL MANDATES
          </div>

          <h1>
            Capital that
            <br />
            knows its <em>terms.</em>
          </h1>

          <p>
            Terms establishes whether a treasury
            action is permitted{" "}
            <strong>before</strong> capital moves
            — from mandate, to evidence, to
            authorization, to execution.
          </p>
        </div>

        <div className="hero-index">
          <span>PROPOSED ALLOCATION</span>
          <strong>{formatMoney(allocationUsd)}</strong>
          <span>
            DECISION /{" "}
            {shortId(
              result?.decision.decisionId,
            )}
          </span>
          <span>
            {evidence
              ? `${evidence.productId.toUpperCase()} / ${evidence.chainName.toUpperCase()}`
              : "IXHYB / AVALANCHE"}
          </span>
        </div>
      </section>

      <section className="decision-workspace">
        <div className="pipeline-heading"><span className="micro-label">THE AUTHORIZATION PIPELINE</span><span>Permission, established one stage at a time.</span></div>
        <ol className="process-rail" aria-label="Authorization pipeline">
          {[
            { label: "Mandate", status: stale ? "CHANGED" : "DEFINED", tone: stale ? "attention" : "complete" },
            { label: "IXS Evidence", status: loading ? "GATHERING" : evidence ? (isCounterfactual ? "COUNTERFACTUAL" : "CAPTURED") : "AWAITING", tone: evidence && !stale ? "complete" : "pending" },
            { label: "Policy Engine", status: stale ? "STALE" : loading ? "EVALUATING" : verdict ?? "AWAITING", tone: !stale && verdict ? (verdict === "EXECUTE" ? "complete" : "attention") : "pending" },
            { label: "SERV Verification", status: stale ? "AWAITING" : verificationResult ? (verificationResult.verification.evidenceSufficient ? "VERIFIED" : "UNRESOLVED") : verifying ? "VERIFYING" : verificationError ? "ERROR" : verdict === "EXECUTE" && !isCounterfactual ? "YOUR NEXT STEP" : "AWAITING", tone: verificationResult?.verification.evidenceSufficient ? "complete" : !stale && verdict === "EXECUTE" ? "current" : "pending" },
            { label: "IXS Preflight", status: verificationResult ? (verificationResult.preflight.ok ? "PASSED" : verificationResult.action.executionState === "BLOCKED" ? "BLOCKED" : "NOT ATTEMPTED") : "AWAITING", tone: verificationResult?.preflight.ok ? "complete" : verificationResult?.action.executionState === "BLOCKED" ? "stopped" : "pending" },
            { label: "Action Gate", status: verificationResult?.action.calldataReleased ? "RELEASED" : "WITHHELD", tone: verificationResult?.action.calldataReleased ? "complete" : verificationResult ? "stopped" : "pending" },
          ].map((step, index) => (
            <li className={`rail-step ${step.tone}`} key={step.label}>
              <span className="rail-number">0{index + 1}<span aria-hidden="true">{index < 5 ? "→" : "■"}</span></span>
              <strong>{step.label}</strong><small>{step.status}</small>
            </li>
          ))}
        </ol>

        <div className="scenario-bar">
          <div>
            <span className="micro-label">
              EXAMPLE MANDATES
            </span>
            <strong>
              Change one fact. Re-evaluate
              permission.
            </strong>
          </div>

          <div className="scenario-switcher">
            {(
              [
                [
                  "permitted",
                  "Permitted",
                ],
                [
                  "breach",
                  "Limit breach",
                ],
                [
                  "gap",
                  "Evidence gap",
                ],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                aria-pressed={preset === key}
                className={
                  preset === key
                    ? "active"
                    : ""
                }
                onClick={() =>
                  applyPreset(key)
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="workspace-grid">
          <aside className="mandate-panel panel">
            <div className="panel-heading">
              <span className="step-number">
                01
              </span>
              <div>
                <span className="micro-label">
                  TREASURY MANDATE
                </span>
                <h2>Operating terms</h2>
              </div>
            </div>

            <label className="mandate-field mandate-hero-field">
              <span>TREASURY</span>
              <div>
                <b>$</b>
                <input
                  type="number"
                  value={treasuryUsd}
                  onChange={(event) => {
                    setTreasuryUsd(
                      Number(
                        event.target.value,
                      ),
                    );
                    markChanged();
                  }}
                />
              </div>
              <small>USDC equivalent</small>
            </label>

            <label className="editable-row">
              <span>
                Proposed allocation
              </span>
              <div>
                <b>$</b>
                <input
                  type="number"
                  value={allocationUsd}
                  onChange={(event) => {
                    setAllocationUsd(
                      Number(
                        event.target.value,
                      ),
                    );
                    markChanged();
                  }}
                />
              </div>
            </label>

            <div className="term-list editable-terms">
              <label>
                <span>Reserve floor</span>
                <div>
                  <b>$</b>
                  <input
                    type="number"
                    value={reserveFloor}
                    onChange={(event) => {
                      setReserveFloor(
                        Number(
                          event.target.value,
                        ),
                      );
                      markChanged();
                    }}
                  />
                </div>
              </label>

              <label>
                <span>
                  Max vault exposure
                </span>
                <div>
                  <input
                    type="number"
                    value={maxExposure}
                    onChange={(event) => {
                      setMaxExposure(
                        Number(
                          event.target.value,
                        ),
                      );
                      markChanged();
                    }}
                  />
                  <b>%</b>
                </div>
              </label>

              <div>
                <span>Allowed product</span>
                <strong>IXHYB</strong>
              </div>

              <div>
                <span>Allowed network</span>
                <strong>43113</strong>
              </div>
            </div>

            <button
              className="evaluate-button"
              onClick={evaluateProposal}
              disabled={loading || verifying}
            >
              <span>
                {loading
                  ? "EVALUATING"
                  : stale
                    ? "RE-EVALUATE PROPOSAL"
                    : "EVALUATE PROPOSAL"}
              </span>
              <b>
                {loading ? "..." : "->"}
              </b>
            </button>

            {preset === "gap" && (
              <div className="counterfactual-note">
                COUNTERFACTUAL / wallet
                eligibility evidence will be
                withheld server-side before policy evaluation. This is not live eligibility evidence.
              </div>
            )}

            <div className="mandate-footer">
              <span className="lock-icon">
                #
              </span>
              Hard constraints / deterministic
            </div>
          </aside>

          <section className="decision-panel panel">
            <div className="decision-topline">
              <span className="micro-label">
                03 / POLICY ENGINE
              </span>

              <span className="decision-id">
                {shortId(
                  result?.decision
                    .decisionId,
                )}
              </span>
            </div>

            <div className="verdict-wrap" aria-live="polite" aria-atomic="true">
              {loading ? (
                <>

                  <span className="verdict-eyebrow">
                    {preset === "gap" ? "COUNTERFACTUAL EVALUATION" : "LIVE EVIDENCE / POLICY EVALUATION"}
                  </span>

                  <h2 className="pending-verdict">
                    CHECKING
                  </h2>

                  <h3>
                    Establishing permission.
                  </h3>

                  <p>
                    Gathering IXS evidence and
                    evaluating the treasury
                    mandate.
                  </p>
                </>
              ) : error ? (
                <>

                  <span className="verdict-eyebrow">
                    EVALUATION ERROR
                  </span>

                  <h2 className="pending-verdict">
                    ERROR
                  </h2>

                  <h3>
                    Evaluation could not
                    complete.
                  </h3>

                  <p>{error}</p>
                </>
              ) : verdict && copy ? (
                <>

                  <span className="verdict-eyebrow">
                    {copy.eyebrow}
                  </span>

                  <h2 key={verdict}>
                    {verdict}
                  </h2>

                  <h3>{copy.headline}</h3>

                  <p>
                    {copy.description}
                  </p>

                  {stale && (
                    <span className="stale-badge">
                      MANDATE CHANGED /
                      RE-EVALUATION REQUIRED
                    </span>
                  )}
                </>
              ) : (
                <>

                  <span className="verdict-eyebrow">
                    AWAITING EVALUATION
                  </span>

                  <h2 className="pending-verdict">
                    READY
                  </h2>

                  <h3>
                    Define the mandate.
                  </h3>

                  <p>
                    Terms will gather IXS
                    evidence and establish
                    whether the proposed
                    allocation is permitted.
                  </p>
                </>
              )}
            </div>

            <div className="decision-reasons">
              <span className="micro-label">{result ? "WHY THIS VERDICT" : "THE DECISION STANDARD"}</span>
              {result ? <>
                <p>{result.decision.summary}</p>
                <ul>{(verdict === "EXECUTE" ? constraints.filter(item => ["minimum_cash_reserve", "single_vault_exposure"].includes(item.constraint)) : constraints.filter(item => item.status !== "PASS")).map(item => (
                  <li key={item.constraint}><span className={item.status.toLowerCase()}>{item.status === "PASS" ? "✓" : item.status === "FAIL" ? "×" : "?"}</span>{item.reason}</li>
                ))}</ul>
              </> : <p>Every required constraint must pass. A known breach means HOLD; an unresolved fact means ESCALATE.</p>}
            </div>
            <div className="verification-strip">
              <div>
                <span className="verification-icon">
                  {result ? "○" : "·"}
                </span>
                <span>
                  <small>SERV</small>
                  {servStatus}
                </span>
              </div>

              <div>
                <strong>
                  {result
                    ? `${passCount}/${constraints.length}`
                    : "--/--"}
                </strong>
                <span>
                  CONSTRAINTS PASS
                </span>
              </div>

              <div>
                <strong>IXS</strong>
                <span>
                  {result
                    ? isCounterfactual
                      ? "COUNTERFACTUAL"
                      : "LIVE EVIDENCE"
                    : "AWAITING"}
                </span>
              </div>
            </div>
          </section>


        </div>

        <section className="evidence-section">
          <button
            className="evidence-toggle"
            aria-expanded={evidenceOpen}
            aria-controls="evidence-record"
            onClick={() =>
              setEvidenceOpen(
                !evidenceOpen,
              )
            }
          >
            <div>
              <span className="step-number">
                02
              </span>
              <div>
                <span className="micro-label">
                  EVIDENCE RECORD
                </span>
                <strong>
                  {evidence
                    ? `${evidence.name} / ${evidence.chainName}`
                    : "Awaiting evaluation"}
                </strong>
              </div>
            </div>

            <div className="evidence-summary">
              <span>
                {isCounterfactual
                  ? "IXS + COUNTERFACTUAL"
                  : "IXS"}
              </span>
              <span>
                {constraints.length
                  ? `${constraints.length} CHECKS`
                  : "NO CHECKS"}
              </span>
              <span>
                {evidenceOpen
                  ? "COLLAPSE -"
                  : "INSPECT +"}
              </span>
            </div>
          </button>

          {evidenceOpen && (
            <div className="evidence-body" id="evidence-record">
              <div className="evidence-provenance">
                <div className="provenance-head">
                  <span className="micro-label">
                    SOURCE /{" "}
                    {isCounterfactual
                      ? "IXS + COUNTERFACTUAL"
                      : "IXS"}
                  </span>

                  <span className="source-live">
                    <i />
                    {evidence
                      ? "EVIDENCE CAPTURED"
                      : "AWAITING"}
                  </span>
                </div>

                {evidence ? (
                  <>
                    <dl>
                      <div>
                        <dt>Vault</dt>
                        <dd>
                          {evidence.name}
                        </dd>
                      </div>
                      <div>
                        <dt>Product</dt>
                        <dd>
                          {
                            evidence.productId
                          }
                        </dd>
                      </div>
                      <div>
                        <dt>Chain ID</dt>
                        <dd>
                          {evidence.chainId}
                        </dd>
                      </div>
                      <div>
                        <dt>Underlying</dt>
                        <dd>
                          {
                            evidence.underlyingAssetSymbol
                          }
                        </dd>
                      </div>
                      <div>
                        <dt>
                          Vault status
                        </dt>
                        <dd>
                          {evidence.status.toUpperCase()}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          Wallet eligible
                        </dt>
                        <dd>
                          {evidence.walletEligible ===
                          null
                            ? "UNKNOWN"
                            : evidence.walletEligible
                              ? "TRUE"
                              : "FALSE"}
                        </dd>
                      </div>
                    </dl>

                    <div className="provenance-address">
                      <span>CONTRACT</span>
                      <code>
                        {evidence.contractAddress}
                      </code>
                    </div>

                    <div className="evidence-time">
                      CAPTURED{" "}
                      {new Date(
                        evidence.evidenceTimestamp,
                      ).toLocaleString()}
                    </div>
                  </>
                ) : (
                  <div className="empty-evidence">
                    Run an evaluation to
                    capture current IXS
                    evidence.
                  </div>
                )}
              </div>

              <div className="constraint-list">
                <div className="constraint-head">
                  <span className="micro-label">
                    03 / CONSTRAINT RECORD
                  </span>

                  <span>
                    {constraints.length
                      ? `${passCount} PASS / ${exceptionCount} EXCEPTION`
                      : "AWAITING"}
                  </span>
                </div>

                {constraints.length ? (
                  constraints.map(
                    ({
                      constraint,
                      status,
                      reason,
                    }) => (
                      <div
                        className="constraint-row"
                        key={constraint}
                      >
                        <span
                          className={`status-mark ${status.toLowerCase()}`}
                        >
                          {status === "PASS"
                            ? "✓"
                            : status ===
                                "FAIL"
                              ? "×"
                              : "?"}
                        </span>

                        <div>
                          <strong>
                            {constraintNames[
                              constraint
                            ] ??
                              constraint}
                          </strong>
                          <span>
                            {reason}
                          </span>
                        </div>

                        <b
                          className={`status-text ${status.toLowerCase()}`}
                        >
                          {status}
                        </b>
                      </div>
                    ),
                  )
                ) : (
                  <div className="empty-evidence">
                    No policy evaluation
                    yet.
                  </div>
                )}
              </div>

              <div className="serv-record">
                <div className="serv-head">
                  <div className="serv-symbol">
                    S
                  </div>

                  <div>
                    <span className="micro-label">
                      04 / BOUNDED VERIFIER
                    </span>
                    <strong>SERV</strong>
                  </div>

                  <span className={verificationResult?.verification.evidenceSufficient ? "verified-pill" : "pending-pill"}>
                    {servStatus}
                  </span>
                </div>

                <blockquote>
                  {verificationResult ? verificationResult.verification.authorizationRationale : isCounterfactual ? "Counterfactual evidence evaluated by the server policy engine. Live SERV verification is unavailable for this scenario." : result
                    ? "SERV verification has not yet been requested for this deterministic decision."
                    : "Evaluate a proposal before requesting bounded SERV verification."}
                </blockquote>

                {verificationResult && <div className="serv-facts" aria-live="polite">
                  <span className="micro-label">DECISIVE FACTS</span>
                  <ul>{verificationResult.verification.decisiveFacts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
                  {!!verificationResult.verification.unresolvedFacts.length && <>
                    <span className="micro-label">UNRESOLVED FACTS</span>
                    <ul>{verificationResult.verification.unresolvedFacts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
                  </>}
                </div>}
                <div className="serv-principle">
                  <span>
                    TERMS PRINCIPLE
                  </span>
                  <strong>
                    Missing evidence is not
                    permission.
                  </strong>
                </div>
              </div>
            </div>
          )}
        </section>
        <AuthorizationOutcome key={result?.decision.decisionId ?? "awaiting"}
          verdict={verdict} stale={stale} loading={loading} verifying={verifying}
          counterfactual={isCounterfactual} verificationError={verificationError}
          verification={verificationResult} onVerify={verifyProposal} />
      </section>

      <footer>
        <div>
          <strong>TERMS / V1</strong>
          <span>
            PRE-EXECUTION CAPITAL
            AUTHORIZATION
          </span>
        </div>

        <div className="footer-statement">
          <span>MANDATE</span>
          <i>-&gt;</i>
          <span>EVIDENCE</span>
          <i>-&gt;</i>
          <span>DECISION</span>
          <i>-&gt;</i>
          <span>ACTION</span>
        </div>
      </footer>
    </main>
  );
}
