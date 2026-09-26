import { z } from "zod";
import type { ServVerification } from "../serv/client";
import type {
  TermsDecision,
  TreasuryMandate,
  VaultEvidence,
} from "../terms/schemas";
import type { ActionGateResult } from "../terms/action-gate";

export const DecisionReceiptSchema = z.object({
  receiptVersion: z.literal("terms-v1"),
  receiptId: z.string(),
  createdAt: z.string().datetime(),

  mandate: z.object({
    mandateId: z.string(),
    treasuryUsd: z.number(),
    proposedAllocationUsd: z.number(),
    minimumCashReserveUsd: z.number(),
    maxSingleVaultExposurePct: z.number(),
  }),

  evidence: z.object({
    source: z.literal("IXS"),
    vaultId: z.string(),
    vaultName: z.string(),
    productId: z.string(),
    chainId: z.number(),
    chainName: z.string(),
    underlyingAssetSymbol: z.string(),
    evidenceTimestamp: z.string().datetime(),
  }),

  authorization: z.object({
    decisionId: z.string(),
    state: z.enum([
      "EXECUTE",
      "HOLD",
      "ESCALATE",
    ]),
    constraints: z.array(
      z.object({
        constraint: z.string(),
        status: z.enum([
          "PASS",
          "FAIL",
          "UNKNOWN",
        ]),
        reason: z.string(),
      }),
    ),
  }),

  servVerification: z.object({
    verified: z.boolean(),
    evidenceSufficient: z.boolean(),
    decisiveFacts: z.array(z.string()),
    unresolvedFacts: z.array(z.string()),
    rationale: z.string(),
  }),

  execution: z.object({
    state: z.enum([
      "READY",
      "BLOCKED",
      "NOT_AUTHORIZED",
    ]),
    calldataReleased: z.boolean(),
    reason: z.string(),
  }),
});

export type DecisionReceipt = z.infer<
  typeof DecisionReceiptSchema
>;

type CreateDecisionReceiptInput = {
  mandate: TreasuryMandate;
  evidence: VaultEvidence;
  decision: TermsDecision;
  verification: ServVerification;
  action: ActionGateResult;
};

export function createDecisionReceipt(
  input: CreateDecisionReceiptInput,
): DecisionReceipt {
  const {
    mandate,
    evidence,
    decision,
    verification,
    action,
  } = input;

  if (
    decision.mandateId !== mandate.mandateId
  ) {
    throw new Error(
      "Decision does not belong to the supplied mandate.",
    );
  }

  if (
    decision.vaultId !== evidence.vaultId
  ) {
    throw new Error(
      "Decision does not belong to the supplied IXS evidence.",
    );
  }

  if (
    verification.decisionId !== decision.decisionId
  ) {
    throw new Error(
      "SERV verification does not belong to the supplied decision.",
    );
  }

  if (
    action.decisionId !== decision.decisionId
  ) {
    throw new Error(
      "Action result does not belong to the supplied decision.",
    );
  }

  return DecisionReceiptSchema.parse({
    receiptVersion: "terms-v1",
    receiptId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),

    mandate: {
      mandateId: mandate.mandateId,
      treasuryUsd: mandate.treasuryUsd,
      proposedAllocationUsd:
        mandate.proposedAllocationUsd,
      minimumCashReserveUsd:
        mandate.minimumCashReserveUsd,
      maxSingleVaultExposurePct:
        mandate.maxSingleVaultExposurePct,
    },

    evidence: {
      source: "IXS",
      vaultId: evidence.vaultId,
      vaultName: evidence.name,
      productId: evidence.productId,
      chainId: evidence.chainId,
      chainName: evidence.chainName,
      underlyingAssetSymbol:
        evidence.underlyingAssetSymbol,
      evidenceTimestamp:
        evidence.evidenceTimestamp,
    },

    authorization: {
      decisionId: decision.decisionId,
      state: decision.verdict,
      constraints: decision.constraints,
    },

    servVerification: {
      verified:
        verification.authorizationState ===
        decision.verdict,
      evidenceSufficient:
        verification.evidenceSufficient,
      decisiveFacts:
        verification.decisiveFacts,
      unresolvedFacts:
        verification.unresolvedFacts,
      rationale:
        verification.authorizationRationale,
    },

    execution: {
      state: action.executionState,
      calldataReleased:
        action.calldataReleased,
      reason: action.reason,
    },
  });
}