import type {
  ConstraintResult,
  TermsDecision,
  TreasuryMandate,
  VaultEvidence,
} from "./schemas";

function checkReserve(
  mandate: TreasuryMandate,
): ConstraintResult {
  const remaining =
    mandate.treasuryUsd - mandate.proposedAllocationUsd;

  const pass = remaining >= mandate.minimumCashReserveUsd;

  return {
    constraint: "minimum_cash_reserve",
    status: pass ? "PASS" : "FAIL",
    reason: pass
      ? `Allocation leaves $${remaining.toFixed(
          2,
        )}, satisfying the $${mandate.minimumCashReserveUsd.toFixed(
          2,
        )} reserve floor.`
      : `Allocation leaves $${remaining.toFixed(
          2,
        )}, below the required $${mandate.minimumCashReserveUsd.toFixed(
          2,
        )} reserve floor.`,
  };
}

function checkLiquidity(
  mandate: TreasuryMandate,
  evidence: VaultEvidence,
): ConstraintResult {
  if (evidence.liquidityDays === null) {
    return {
      constraint: "minimum_liquidity",
      status: "UNKNOWN",
      reason: "Vault liquidity evidence is unavailable.",
    };
  }

  const pass =
    evidence.liquidityDays <= mandate.minimumLiquidityDays;

  return {
    constraint: "minimum_liquidity",
    status: pass ? "PASS" : "FAIL",
    reason: pass
      ? `Vault liquidity horizon of ${evidence.liquidityDays} days is within the permitted ${mandate.minimumLiquidityDays} days.`
      : `Vault liquidity horizon of ${evidence.liquidityDays} days exceeds the permitted ${mandate.minimumLiquidityDays} days.`,
  };
}

function checkConcentration(
  mandate: TreasuryMandate,
  evidence: VaultEvidence,
): ConstraintResult {
  const exposureAfter =
    evidence.currentExposureUsd +
    mandate.proposedAllocationUsd;

  const exposurePct =
    (exposureAfter / mandate.treasuryUsd) * 100;

  const pass =
    exposurePct <= mandate.maxSingleVaultExposurePct;

  return {
    constraint: "single_vault_exposure",
    status: pass ? "PASS" : "FAIL",
    reason: pass
      ? `Post-allocation exposure is ${exposurePct.toFixed(
          2,
        )}%, within the ${mandate.maxSingleVaultExposurePct}% ceiling.`
      : `Post-allocation exposure is ${exposurePct.toFixed(
          2,
        )}%, above the ${mandate.maxSingleVaultExposurePct}% ceiling.`,
  };
}

function checkRegulatedRwa(
  mandate: TreasuryMandate,
  evidence: VaultEvidence,
): ConstraintResult {
  if (!mandate.requireRegulatedRwa) {
    return {
      constraint: "regulated_rwa",
      status: "PASS",
      reason: "Mandate does not require regulated RWA status.",
    };
  }

  if (evidence.regulatedRwa === null) {
    return {
      constraint: "regulated_rwa",
      status: "UNKNOWN",
      reason: "Regulated RWA status could not be established.",
    };
  }

  return {
    constraint: "regulated_rwa",
    status: evidence.regulatedRwa ? "PASS" : "FAIL",
    reason: evidence.regulatedRwa
      ? "Vault is established as a regulated RWA product."
      : "Vault is not established as a regulated RWA product.",
  };
}

function checkEligibility(
  mandate: TreasuryMandate,
  evidence: VaultEvidence,
): ConstraintResult {
  if (!mandate.requireWalletEligibility) {
    return {
      constraint: "wallet_eligibility",
      status: "PASS",
      reason: "Mandate does not require wallet eligibility.",
    };
  }

  if (evidence.walletEligible === null) {
    return {
      constraint: "wallet_eligibility",
      status: "UNKNOWN",
      reason: "Wallet eligibility could not be established.",
    };
  }

  return {
    constraint: "wallet_eligibility",
    status: evidence.walletEligible ? "PASS" : "FAIL",
    reason: evidence.walletEligible
      ? "Wallet satisfies vault eligibility requirements."
      : "Wallet does not satisfy vault eligibility requirements.",
  };
}

export function evaluateMandate(
  mandate: TreasuryMandate,
  evidence: VaultEvidence,
): TermsDecision {
  const constraints = [
    checkReserve(mandate),
    checkLiquidity(mandate, evidence),
    checkConcentration(mandate, evidence),
    checkRegulatedRwa(mandate, evidence),
    checkEligibility(mandate, evidence),
  ];

  const hasFailure = constraints.some(
    (constraint) => constraint.status === "FAIL",
  );

  const hasUnknown = constraints.some(
    (constraint) => constraint.status === "UNKNOWN",
  );

  // Known violations take precedence over missing evidence.
  // If we already know the action violates the mandate,
  // there is no reason to pretend more evidence could authorize it.
  const verdict =
    hasFailure
      ? "HOLD"
      : hasUnknown
        ? "ESCALATE"
        : "EXECUTE";

  return {
    decisionId: crypto.randomUUID(),
    mandateId: mandate.mandateId,
    vaultId: evidence.vaultId,
    verdict,
    constraints,
    summary:
      verdict === "EXECUTE"
        ? "All required mandate constraints are established and satisfied."
        : verdict === "HOLD"
          ? "At least one established fact violates the treasury mandate."
          : "Required evidence is missing or unsupported; authorization cannot be established.",
    decidedAt: new Date().toISOString(),

    // This is deterministic preflight only.
    // SERV will later produce the bounded reasoning record.
    servUsed: false,

    transactionConstructionAllowed:
      verdict === "EXECUTE",
  };
}