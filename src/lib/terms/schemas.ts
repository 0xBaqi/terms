import { z } from "zod";

/**
 * A treasury mandate defines the boundaries within which Terms
 * may authorize an allocation.
 *
 * Monetary values are represented in USD for the hackathon MVP.
 */
export const TreasuryMandateSchema = z.object({
  mandateId: z.string().min(1),

  treasuryUsd: z.number().positive(),

  proposedAllocationUsd: z.number().positive(),

  minimumCashReserveUsd: z.number().nonnegative(),

  minimumLiquidityDays: z.number().int().nonnegative(),

  maxSingleVaultExposurePct: z.number().min(0).max(100),

  requireRegulatedRwa: z.boolean(),

  requireWalletEligibility: z.boolean(),
});

export type TreasuryMandate = z.infer<typeof TreasuryMandateSchema>;

/**
 * Evidence represents facts Terms knows about a candidate vault
 * at decision time.
 *
 * Nullable fields are deliberate:
 * missing evidence must not silently become a favorable assumption.
 */
export const VaultEvidenceSchema = z.object({
  vaultId: z.string().min(1),

  name: z.string().min(1),

  regulatedRwa: z.boolean().nullable(),

  walletEligible: z.boolean().nullable(),

  liquidityDays: z.number().int().nonnegative().nullable(),

  currentExposureUsd: z.number().nonnegative(),

  evidenceTimestamp: z.string().datetime(),

  source: z.string().min(1),
});

export type VaultEvidence = z.infer<typeof VaultEvidenceSchema>;

export const ConstraintResultSchema = z.object({
  constraint: z.string().min(1),

  status: z.enum(["PASS", "FAIL", "UNKNOWN"]),

  reason: z.string().min(1),
});

export type ConstraintResult = z.infer<typeof ConstraintResultSchema>;

/**
 * EXECUTE:
 * Every required constraint is established and satisfied.
 *
 * HOLD:
 * Evidence establishes that at least one mandate constraint
 * would be violated.
 *
 * ESCALATE:
 * A decision cannot safely be made because required evidence
 * is missing, ambiguous, or unsupported.
 */
export const DecisionVerdictSchema = z.enum([
  "EXECUTE",
  "HOLD",
  "ESCALATE",
]);

export type DecisionVerdict = z.infer<typeof DecisionVerdictSchema>;

export const TermsDecisionSchema = z.object({
  decisionId: z.string().min(1),

  mandateId: z.string().min(1),

  vaultId: z.string().min(1),

  verdict: DecisionVerdictSchema,

  constraints: z.array(ConstraintResultSchema).min(1),

  summary: z.string().min(1),

  decidedAt: z.string().datetime(),

  servUsed: z.boolean(),

  transactionConstructionAllowed: z.boolean(),
});

export type TermsDecision = z.infer<typeof TermsDecisionSchema>;