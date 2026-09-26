"use client";

import { useMemo, useState } from "react";

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
  evidence: Evidence;
  decision: Decision;
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

  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] =
    useState<string | null>(null);

  const [evidenceOpen, setEvidenceOpen] =
    useState(true);

  function markChanged() {
    if (result) setStale(true);
  }

  function applyPreset(next: Preset) {
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
    setLoading(true);
    setError(null);

    try {
      if (preset === "gap") {
        const liveResponse = await fetch(
          "/api/evaluate",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mandate: {
                mandateId: `terms-ui-${Date.now()}`,
                treasuryUsd,
                proposedAllocationUsd:
                  allocationUsd,
                minimumCashReserveUsd:
                  reserveFloor,
                maxSingleVaultExposurePct:
                  maxExposure,
                allowedProductIds: ["ixhyb"],
                allowedChainIds: [43113],
                requireActiveVault: true,
                requireDepositSupport: true,
                requireWalletEligibility: true,
              },
              vaultId: VAULT_ID,
              walletAddress: ZERO_WALLET,
            }),
          },
        );

        const liveData = await liveResponse.json();

        if (!liveResponse.ok || !liveData.ok) {
          throw new Error(
            liveData.error ??
              "Live IXS evidence retrieval failed.",
          );
        }

        const evidence: Evidence = {
          ...liveData.evidence,
          walletEligible: null,
        };

        const constraints: Constraint[] =
          liveData.decision.constraints.map(
            (constraint: Constraint) =>
              constraint.constraint ===
              "wallet_eligibility"
                ? {
                    ...constraint,
                    status:
                      "UNKNOWN" as const,
                    reason:
                      "Wallet eligibility evidence intentionally withheld for this counterfactual.",
                  }
                : constraint,
          );

        const decision: Decision = {
          ...liveData.decision,
          verdict: "ESCALATE",
          constraints,
          summary:
            "A required authorization fact is unresolved.",
          transactionConstructionAllowed:
            false,
        };

        setResult({
          ok: true,
          mode: "COUNTERFACTUAL_EVIDENCE_GAP",
          evidence,
          decision,
        });
      } else {
        const response = await fetch(
          "/api/evaluate",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mandate: {
                mandateId: `terms-ui-${Date.now()}`,
                treasuryUsd,
                proposedAllocationUsd:
                  allocationUsd,
                minimumCashReserveUsd:
                  reserveFloor,
                maxSingleVaultExposurePct:
                  maxExposure,
                allowedProductIds: ["ixhyb"],
                allowedChainIds: [43113],
                requireActiveVault: true,
                requireDepositSupport: true,
                requireWalletEligibility: true,
              },
              vaultId: VAULT_ID,
              walletAddress: ZERO_WALLET,
            }),
          },
        );

        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(
            data.error ??
              "Terms evaluation failed.",
          );
        }

        setResult(data);
      }

      setStale(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Terms evaluation failed.",
      );
    } finally {
      setLoading(false);
    }
  }

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
          SERV READY
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
        <div className="process-rail">
          {[
            ["01", "Mandate"],
            ["02", "Evidence"],
            ["03", "Authorization"],
            ["04", "Action"],
          ].map(([number, label], index) => (
            <div
              className="rail-step"
              key={number}
            >
              <span>{number}</span>
              <strong>{label}</strong>
              {index < 3 && (
                <div className="rail-line" />
              )}
            </div>
          ))}
        </div>

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
              disabled={loading}
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
                withheld after live IXS retrieval.
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
                03 / AUTHORIZATION
              </span>

              <span className="decision-id">
                {shortId(
                  result?.decision
                    .decisionId,
                )}
              </span>
            </div>

            <div className="verdict-wrap">
              {loading ? (
                <>
                  <div className="state-orb evaluating-orb">
                    <div className="orb-core" />
                  </div>

                  <span className="verdict-eyebrow">
                    LIVE EVALUATION
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
                  <div className="state-orb">
                    <div className="orb-core" />
                  </div>

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
                  <div className="state-orb">
                    <div className="orb-core" />
                  </div>

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
                  <div className="state-orb idle-orb">
                    <div className="orb-core" />
                  </div>

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

            <div className="verification-strip">
              <div>
                <span className="verification-icon">
                  {result ? "○" : "·"}
                </span>
                <span>
                  <small>SERV</small>
                  {result
                    ? "NOT YET VERIFIED"
                    : "READY"}
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
                      ? "LIVE + GAP"
                      : "LIVE EVIDENCE"
                    : "AWAITING"}
                </span>
              </div>
            </div>
          </section>

          <aside className="action-panel panel">
            <div className="panel-heading">
              <span className="step-number">
                04
              </span>
              <div>
                <span className="micro-label">
                  EXECUTION
                </span>
                <h2>Action gate</h2>
              </div>
            </div>

            <div className="execution-state locked">
              <span className="execution-symbol">
                {verdict === "EXECUTE"
                  ? "!"
                  : "#"}
              </span>

              <div>
                <span>
                  EXECUTION STATE
                </span>
                <strong>
                  {!result
                    ? "AWAITING"
                    : verdict === "EXECUTE"
                      ? "AUTHORIZATION ONLY"
                      : "NOT AUTHORIZED"}
                </strong>
              </div>
            </div>

            <p className="execution-copy">
              {!result
                ? "Evaluate the proposal before transaction construction can be considered."
                : verdict === "EXECUTE"
                  ? "Policy authorization is established. SERV verification and IXS execution preflight are still required before transaction data can be released."
                  : verdict === "HOLD"
                    ? "A hard mandate constraint failed. Transaction construction remains locked."
                    : "Required authorization evidence is unresolved. Transaction construction remains locked."}
            </p>

            <div className="action-rule">
              <span>Authorization</span>
              <strong>
                {verdict ?? "PENDING"}
              </strong>
            </div>

            <div className="action-rule">
              <span>SERV verification</span>
              <strong>PENDING</strong>
            </div>

            <div className="action-rule">
              <span>Transaction data</span>
              <strong>WITHHELD</strong>
            </div>

            <button
              className="disabled-action"
              disabled
            >
              RELEASE TRANSACTION
              <span>-&gt;</span>
            </button>

            <small className="safety-note">
              Authorization is not execution
              feasibility.
            </small>
          </aside>
        </div>

        <section className="evidence-section">
          <button
            className="evidence-toggle"
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
            <div className="evidence-body">
              <div className="evidence-provenance">
                <div className="provenance-head">
                  <span className="micro-label">
                    SOURCE /{" "}
                    {isCounterfactual
                      ? "IXS + TEST GAP"
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
                        {evidence.contractAddress.slice(
                          0,
                          22,
                        )}
                        ...
                        {evidence.contractAddress.slice(
                          -12,
                        )}
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
                    POLICY EVALUATION
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
                      BOUNDED VERIFIER
                    </span>
                    <strong>SERV</strong>
                  </div>

                  <span className="pending-pill">
                    PENDING
                  </span>
                </div>

                <blockquote>
                  {result
                    ? "Deterministic authorization established. SERV verification has not yet been requested."
                    : "Evaluate a proposal before requesting bounded SERV verification."}
                </blockquote>

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
