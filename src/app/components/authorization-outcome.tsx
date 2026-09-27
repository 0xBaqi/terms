"use client";

import { useState } from "react";
import type { ServVerification } from "@/lib/serv/client";
import type { ActionGateResult } from "@/lib/terms/action-gate";
import type { DecisionReceipt } from "@/lib/receipts/decision-receipt";

type Props = {
  verdict: "EXECUTE" | "HOLD" | "ESCALATE" | null;
  stale: boolean;
  loading: boolean;
  verifying: boolean;
  counterfactual: boolean;
  verificationError: string | null;
  verification: {
    verification: ServVerification;
    preflight: { ok: boolean; reason?: string };
    action: ActionGateResult;
    receipt: DecisionReceipt;
    transactionRequest: string | null;
  } | null;
  onVerify: () => void;
};

export function AuthorizationOutcome({ verdict, stale, loading, verifying, counterfactual, verificationError, verification, onVerify }: Props) {
  // A previous evaluation must never look like current execution permission.
  const current = !stale && !loading ? verification : null;
  const released = current?.action.calldataReleased === true;
  const verified = current?.verification.evidenceSufficient === true;
  const blocked = current?.action.executionState === "BLOCKED";
  const eligible = verdict === "EXECUTE" && !counterfactual && !stale && !loading;
  const servLabel = current ? (verified ? "VERIFIED" : "UNRESOLVED") : verifying ? "VERIFYING" : verificationError ? "REQUEST FAILED" : "NOT VERIFIED";
  const preflightLabel = current ? (current.preflight.ok ? "PASSED" : blocked ? "BLOCKED" : "NOT ATTEMPTED") : "NOT ATTEMPTED";
  const nextStep = stale ? "Mandate changed. Re-evaluate to establish a new decision." : loading ? "Gathering evidence and checking the mandate." : current ? current.action.reason :
    verdict === "EXECUTE" ? "Policy permits the allocation. Verify with SERV to check the evidence, then IXS execution feasibility." :
    verdict === "HOLD" ? "Resolve the failed mandate constraint, then re-evaluate. The execution path remains closed." :
    verdict === "ESCALATE" ? "Resolve the missing evidence, then re-evaluate. Unknown facts cannot authorize capital." :
    "Evaluate the mandate first. Verification and transaction construction follow only when policy permits.";

  return <section className="outcome-section" aria-labelledby="outcome-heading">
    <div className="section-heading">
      <div><span className="micro-label">04 — 06 / THE EXECUTION BOUNDARY</span><h2 id="outcome-heading">Permission is only the beginning.</h2></div>
      <p>{nextStep}</p>
    </div>
    <div className="outcome-grid" aria-live="polite" aria-busy={verifying}>
      <div className={`outcome-stage ${verified ? "stage-pass" : ""}`}>
        <div className="stage-heading"><span className="step-number">04</span><h3>SERV Verification</h3><span aria-hidden="true">→</span></div>
        <strong className="stage-status" key={servLabel}>{servLabel}</strong>
        <p>{current ? current.verification.authorizationRationale : counterfactual ? "Counterfactual scenario. Live verification is unavailable for intentionally withheld evidence." : "A bounded verifier checks whether the evidence supports this exact policy decision."}</p>
        {verdict === "EXECUTE" && !counterfactual && !current && <>
          <button className="evaluate-button verify-button" onClick={onVerify} disabled={!eligible || verifying || !!verificationError}>
            <span>{verifying ? "VERIFYING WITH SERV" : verificationError ? "RE-EVALUATE BEFORE RETRY" : "VERIFY WITH SERV"}</span><b aria-hidden="true">→</b>
          </button>
          <small className="safety-note">Uses SERV credit · only on your click.{verificationError ? " Re-evaluate before another paid attempt." : ""}</small>
        </>}
        {verificationError && <p className="verification-error" role="alert">{verificationError}</p>}
        {current && <small className="stage-footnote">BOUND TO DECISION <code>{current.verification.decisionId}</code></small>}
      </div>
      <div className={`outcome-stage ${blocked ? "stage-blocked" : current?.preflight.ok ? "stage-pass" : ""}`}>
        <div className="stage-heading"><span className="step-number">05</span><h3>IXS Preflight</h3><span aria-hidden="true">→</span></div>
        <strong className="stage-status" key={preflightLabel}>{preflightLabel}</strong>
        <p>{current?.preflight.reason ?? (current?.preflight.ok ? "IXS transaction construction passed. The final action gate determines whether data may be released." : "Execution feasibility is checked only after SERV establishes sufficient evidence for EXECUTE.")}</p>
        <small className="stage-footnote">{blocked ? "POLICY AUTHORIZED · EXECUTION BLOCKED" : "VAULT LIMITS / EXECUTION FEASIBILITY"}</small>
      </div>
      <div className={`outcome-stage transaction-boundary ${released ? "is-released" : "is-withheld"}`}>
        <div className="stage-heading"><span className="step-number">06</span><h3>Action Gate</h3><span aria-hidden="true">{released ? "↗" : "■"}</span></div>
        <span className="boundary-label">TRANSACTION DATA</span>
        <strong className="boundary-status" key={released ? "released" : "withheld"}>{released ? "RELEASED" : "WITHHELD"}</strong>
        <p>{current ? current.action.reason : "No transaction data leaves Terms until every required stage permits release."}</p>
        <div className="boundary-rule"><span>Execution state</span><strong>{current?.action.executionState ?? (stale ? "RE-EVALUATE" : verdict && verdict !== "EXECUTE" ? "NOT AUTHORIZED" : "LOCKED")}</strong></div>
        <small className="stage-footnote">{released ? "DATA RELEASE IS NOT A BROADCAST" : "NO CALLDATA RELEASED"}</small>
        {released && current?.transactionRequest && <details className="transaction-record"><summary>Inspect transaction data</summary><pre>{current.transactionRequest}</pre></details>}
      </div>
    </div>
    {current ? <AuditReceipt receipt={current.receipt} /> : <div className="receipt-placeholder"><span className="receipt-mark" aria-hidden="true">T / R</span><div><strong>A decision, with a record.</strong><p>The verification response creates an audit receipt binding the mandate, evidence, decision and action gate.</p></div><span className="micro-label">RECEIPT PENDING</span></div>}
  </section>;
}

function AuditReceipt({ receipt }: { receipt: DecisionReceipt }) {
  const [copyStatus, setCopyStatus] = useState("");
  const json = JSON.stringify(receipt, null, 2);
  async function copyReceipt() {
    try {
      await navigator.clipboard.writeText(json);
      setCopyStatus("Receipt copied.");
    } catch {
      setCopyStatus("Copy unavailable. Use Download JSON.");
    }
  }
  return <article className="audit-receipt" aria-labelledby="receipt-heading">
    <div className="receipt-title"><span className="receipt-mark" aria-hidden="true">T / R</span><div><span className="micro-label">TERMS / AUDIT RECORD / {receipt.receiptVersion}</span><h3 id="receipt-heading">Decision receipt</h3></div><span className="receipt-stamp">{receipt.execution.calldataReleased ? "RELEASED" : "WITHHELD"}</span></div>
    <div className="receipt-identity"><span className="micro-label">RECEIPT ID</span><code>{receipt.receiptId}</code><time dateTime={receipt.createdAt}>{receipt.createdAt.replace("T", " · ").replace("Z", " UTC")}</time></div>
    <dl className="receipt-fields">
      <div><dt>01 / Mandate</dt><dd><code>{receipt.mandate.mandateId}</code></dd><dd>{new Intl.NumberFormat("en-US", {style:"currency",currency:"USD",maximumFractionDigits:0}).format(receipt.mandate.proposedAllocationUsd)} proposed allocation</dd></div>
      <div><dt>02 / Evidence provenance</dt><dd>{receipt.evidence.source} · {receipt.evidence.vaultName}</dd><dd>{receipt.evidence.chainName} / {receipt.evidence.chainId}</dd><dd><time dateTime={receipt.evidence.evidenceTimestamp}>{receipt.evidence.evidenceTimestamp}</time></dd><dd><code>Vault / {receipt.evidence.vaultId}</code></dd></div>
      <div><dt>03 / Decision binding</dt><dd><code>{receipt.authorization.decisionId}</code></dd><dd>{receipt.authorization.state} · {receipt.authorization.constraints.length} constraints</dd><dd>SERV evidence {receipt.servVerification.evidenceSufficient ? "sufficient" : "unresolved"}</dd></div>
      <div><dt>06 / Final disposition</dt><dd>{receipt.execution.state}</dd><dd>{receipt.execution.reason}</dd></div>
    </dl>
    <div className="receipt-footer"><p>One record. Mandate → evidence → decision → action.</p><div className="receipt-actions"><button onClick={copyReceipt}>Copy receipt <span aria-hidden="true">↗</span></button><a href={`data:application/json;charset=utf-8,${encodeURIComponent(json)}`} download={`terms-receipt-${receipt.receiptId}.json`}>Download JSON <span aria-hidden="true">↓</span></a></div><span className="copy-status" role="status">{copyStatus}</span></div>
  </article>;
}
