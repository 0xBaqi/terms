import { describe, expect, it } from "vitest";
import { createDecisionReceipt } from "../receipts/decision-receipt";
import type { ServVerification } from "../serv/client";
import type { ActionGateResult } from "../terms/action-gate";
import type {
  TermsDecision,
  TreasuryMandate,
  VaultEvidence,
} from "../terms/schemas";

const mandate: TreasuryMandate = {
  mandateId: "mandate-001",
  treasuryUsd: 100_000,
  proposedAllocationUsd: 10_000,
  minimumCashReserveUsd: 50_000,
  maxSingleVaultExposurePct: 25,
  allowedProductIds: ["ixhyb"],
  allowedChainIds: [43113],
  requireActiveVault: true,
  requireDepositSupport: true,
  requireWalletEligibility: true,
};

const evidence: VaultEvidence = {
  vaultId: "vault-001",
  name: "IXHYB - Avalanche",
  productId: "ixhyb",
  chainId: 43113,
  chainName: "Avalanche Fuji Testnet",
  network: "avalanche-testnet",
  contractAddress:
    "0x648c66E8791B1Ea20f01db549B49dE7FBa3f2a53",
  underlyingAssetSymbol: "USDC",
  status: "active",
  requiresWhitelist: false,
  walletEligible: true,
  ttm: 3.07,
  actions: ["deposit"],
  currentExposureUsd: 0,
  evidenceTimestamp:
    "2026-09-26T17:00:00.000Z",
  source: "IXS",
};

const decision: TermsDecision = {
  decisionId: "decision-001",
  mandateId: "mandate-001",
  vaultId: "vault-001",
  verdict: "EXECUTE",
  constraints: [
    {
      constraint: "minimum_cash_reserve",
      status: "PASS",
      reason: "Reserve floor satisfied.",
    },
  ],
  summary:
    "All required mandate constraints are established and satisfied.",
  decidedAt:
    "2026-09-26T17:00:01.000Z",
  servUsed: false,
  transactionConstructionAllowed: true,
};

const verification: ServVerification = {
  decisionId: "decision-001",
  authorizationState: "EXECUTE",
  evidenceSufficient: true,
  decisiveFacts: [
    "Required hard constraints pass.",
  ],
  unresolvedFacts: [],
  authorizationRationale:
    "Evidence supports authorization.",
};

const action: ActionGateResult = {
  decisionId: "decision-001",
  authorizationState: "EXECUTE",
  executionState: "BLOCKED",
  calldataReleased: false,
  reason:
    "Deposit amount exceeds the current vault limit of 0 USDC.",
};

describe("Terms decision receipt", () => {
  it("creates an auditable receipt for an authorized but blocked action", () => {
    const receipt = createDecisionReceipt({
      mandate,
      evidence,
      decision,
      verification,
      action,
    });

    expect(receipt.receiptVersion).toBe(
      "terms-v1",
    );
    expect(receipt.authorization.state).toBe(
      "EXECUTE",
    );
    expect(
      receipt.servVerification.verified,
    ).toBe(true);
    expect(receipt.execution.state).toBe(
      "BLOCKED",
    );
    expect(
      receipt.execution.calldataReleased,
    ).toBe(false);
  });

  it("rejects evidence belonging to another vault", () => {
    expect(() =>
      createDecisionReceipt({
        mandate,
        evidence: {
          ...evidence,
          vaultId: "wrong-vault",
        },
        decision,
        verification,
        action,
      }),
    ).toThrow(
      "Decision does not belong to the supplied IXS evidence.",
    );
  });

  it("rejects SERV verification belonging to another decision", () => {
    expect(() =>
      createDecisionReceipt({
        mandate,
        evidence,
        decision,
        verification: {
          ...verification,
          decisionId: "wrong-decision",
        },
        action,
      }),
    ).toThrow(
      "SERV verification does not belong to the supplied decision.",
    );
  });

  it("rejects an action result belonging to another decision", () => {
    expect(() =>
      createDecisionReceipt({
        mandate,
        evidence,
        decision,
        verification,
        action: {
          ...action,
          decisionId: "wrong-decision",
        },
      }),
    ).toThrow(
      "Action result does not belong to the supplied decision.",
    );
  });
});