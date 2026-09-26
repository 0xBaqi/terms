import { describe, expect, it } from "vitest";
import { evaluateActionGate } from "../terms/action-gate";
import type { ServVerification } from "../serv/client";
import type { TermsDecision } from "../terms/schemas";

const executeDecision: TermsDecision = {
  decisionId: "decision-001",
  mandateId: "mandate-001",
  vaultId: "vault-001",
  verdict: "EXECUTE",
  constraints: [],
  summary:
    "All required mandate constraints are established and satisfied.",
  decidedAt: "2026-09-26T17:00:00.000Z",
  servUsed: false,
  transactionConstructionAllowed: true,
};

const verification: ServVerification = {
  decisionId: "decision-001",
  authorizationState: "EXECUTE",
  evidenceSufficient: true,
  decisiveFacts: [
    "All required hard constraints pass.",
  ],
  unresolvedFacts: [],
  authorizationRationale:
    "The supplied evidence supports EXECUTE.",
};

describe("Terms action gate", () => {
  it("releases action only when authorization and preflight both pass", () => {
    const result = evaluateActionGate({
      decision: executeDecision,
      verification,
      preflight: {
        ok: true,
      },
    });

    expect(result.executionState).toBe("READY");
    expect(result.calldataReleased).toBe(true);
  });

  it("blocks an authorized action when IXS preflight fails", () => {
    const result = evaluateActionGate({
      decision: executeDecision,
      verification,
      preflight: {
        ok: false,
        reason:
          "Deposit amount exceeds the current vault limit of 0 USDC.",
      },
    });

    expect(result.authorizationState).toBe(
      "EXECUTE",
    );
    expect(result.executionState).toBe("BLOCKED");
    expect(result.calldataReleased).toBe(false);
    expect(result.reason).toContain(
      "vault limit of 0 USDC",
    );
  });

  it("never releases action for HOLD", () => {
    const holdDecision: TermsDecision = {
      ...executeDecision,
      verdict: "HOLD",
      transactionConstructionAllowed: false,
    };

    const holdVerification: ServVerification = {
      ...verification,
      authorizationState: "HOLD",
      evidenceSufficient: true,
    };

    const result = evaluateActionGate({
      decision: holdDecision,
      verification: holdVerification,
      preflight: {
        ok: true,
      },
    });

    expect(result.executionState).toBe(
      "NOT_AUTHORIZED",
    );
    expect(result.calldataReleased).toBe(false);
  });

  it("never releases action for ESCALATE", () => {
    const escalateDecision: TermsDecision = {
      ...executeDecision,
      verdict: "ESCALATE",
      transactionConstructionAllowed: false,
    };

    const escalateVerification: ServVerification = {
      ...verification,
      authorizationState: "ESCALATE",
      evidenceSufficient: false,
      unresolvedFacts: [
        "Wallet eligibility is unknown.",
      ],
    };

    const result = evaluateActionGate({
      decision: escalateDecision,
      verification: escalateVerification,
      preflight: {
        ok: true,
      },
    });

    expect(result.executionState).toBe(
      "NOT_AUTHORIZED",
    );
    expect(result.calldataReleased).toBe(false);
  });

  it("rejects a verification belonging to another decision", () => {
    const result = evaluateActionGate({
      decision: executeDecision,
      verification: {
        ...verification,
        decisionId: "different-decision",
      },
      preflight: {
        ok: true,
      },
    });

    expect(result.executionState).toBe(
      "NOT_AUTHORIZED",
    );
    expect(result.calldataReleased).toBe(false);
  });

  it("rejects disagreement between SERV and deterministic policy", () => {
    const result = evaluateActionGate({
      decision: executeDecision,
      verification: {
        ...verification,
        authorizationState: "HOLD",
      },
      preflight: {
        ok: true,
      },
    });

    expect(result.executionState).toBe(
      "NOT_AUTHORIZED",
    );
    expect(result.calldataReleased).toBe(false);
  });
});