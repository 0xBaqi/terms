import { z } from "zod";

/**
 * Machine-executable treasury mandate.
 *
 * Every hard constraint here maps to evidence that Terms can
 * establish from treasury state or the live IXS integration.
 */
export const TreasuryMandateSchema = z.object({
  mandateId: z.string().min(1),

  treasuryUsd: z.number().positive(),
  proposedAllocationUsd: z.number().positive(),
  minimumCashReserveUsd: z.number().nonnegative(),

  maxSingleVaultExposurePct: z.number().min(0).max(100),

  allowedProductIds: z.array(z.string().min(1)).min(1),
  allowedChainIds: z.array(z.number().int().positive()).min(1),

  requireActiveVault: z.boolean(),
  requireDepositSupport: z.boolean(),
  requireWalletEligibility: z.boolean(),
});

export type TreasuryMandate = z.infer<typeof TreasuryMandateSchema>;

export const VaultEvidenceSchema = z.object({
  vaultId: z.string().min(1),
  name: z.string().min(1),
  productId: z.string().min(1),

  chainId: z.number().int().positive(),
  chainName: z.string().min(1),
  network: z.string().min(1),

  contractAddress: z.string().min(1),
  underlyingAssetSymbol: z.string().min(1),

  status: z.string().min(1),
  requiresWhitelist: z.boolean(),
  walletEligible: z.boolean().nullable(),

  ttm: z.number().nullable(),
  actions: z.array(z.string()),

  /**
   * Exposure is null until a wallet position has actually been read.
   * Missing position evidence must never silently become zero exposure.
   */
  currentExposureUsd: z.number().nonnegative().nullable(),

  evidenceTimestamp: z.string().datetime(),
  source: z.literal("IXS"),
});

export type VaultEvidence = z.infer<typeof VaultEvidenceSchema>;

export const ConstraintResultSchema = z.object({
  constraint: z.string().min(1),
  status: z.enum(["PASS", "FAIL", "UNKNOWN"]),
  reason: z.string().min(1),
});

export type ConstraintResult = z.infer<typeof ConstraintResultSchema>;

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
