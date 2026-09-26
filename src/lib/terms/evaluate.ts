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
      ? `Allocation leaves $${remaining.toFixed(2)}, satisfying the $${mandate.minimumCashReserveUsd.toFixed(2)} reserve floor.`
      : `Allocation leaves $${remaining.toFixed(2)}, below the required $${mandate.minimumCashReserveUsd.toFixed(2)} reserve floor.`,
  };
}

function checkProduct(
  mandate: TreasuryMandate,
  evidence: VaultEvidence,
): ConstraintResult {
  const pass =
    mandate.allowedProductIds.includes(evidence.productId);

  return {
    constraint: "allowed_product",
    status: pass ? "PASS" : "FAIL",
    reason: pass
      ? `Product ${evidence.productId} is permitted by the mandate.`
      : `Product ${evidence.productId} is not permitted by the mandate.`,
  };
}

function checkChain(
  mandate: TreasuryMandate,
  evidence: VaultEvidence,
): ConstraintResult {
  const pass =
    mandate.allowedChainIds.includes(evidence.chainId);

  return {
    constraint: "allowed_chain",
    status: pass ? "PASS" : "FAIL",
    reason: pass
      ? `Chain ${evidence.chainId} (${evidence.chainName}) is permitted by the mandate.`
      : `Chain ${evidence.chainId} (${evidence.chainName}) is not permitted by the mandate.`,
  };
}

function checkVaultStatus(
  mandate: TreasuryMandate,
  evidence: VaultEvidence,
): ConstraintResult {
  if (!mandate.requireActiveVault) {
    return {
      constraint: "active_vault",
      status: "PASS",
      reason: "Mandate does not require active vault status.",
    };
  }

  const pass = evidence.status.toLowerCase() === "active";

  return {
    constraint: "active_vault",
    status: pass ? "PASS" : "FAIL",
    reason: pass
      ? "IXS reports the vault as active."
      : `IXS reports vault status as ${evidence.status}.`,
  };
}

function checkDepositSupport(
  mandate: TreasuryMandate,
  evidence: VaultEvidence,
): ConstraintResult {
  if (!mandate.requireDepositSupport) {
    return {
      constraint: "deposit_supported",
      status: "PASS",
      reason: "Mandate does not require deposit support.",
    };
  }

  const pass = evidence.actions.includes("deposit");

  return {
    constraint: "deposit_supported",
    status: pass ? "PASS" : "FAIL",
    reason: pass
      ? "IXS reports deposit as a supported vault action."
      : "IXS does not report deposit as a supported vault action.",
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
      reason: evidence.requiresWhitelist
        ? "Vault requires a whitelist check, but wallet eligibility has not been established."
        : "Wallet eligibility has not been established.",
    };
  }

  return {
    constraint: "wallet_eligibility",
    status: evidence.walletEligible ? "PASS" : "FAIL",
    reason: evidence.walletEligible
      ? "Wallet satisfies the vault eligibility requirements."
      : "Wallet does not satisfy the vault eligibility requirements.",
  };
}

function checkConcentration(
  mandate: TreasuryMandate,
  evidence: VaultEvidence,
): ConstraintResult {
  if (evidence.currentExposureUsd === null) {
    return {
      constraint: "single_vault_exposure",
      status: "UNKNOWN",
      reason:
        "Current wallet exposure has not been established from position evidence.",
    };
  }

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
      ? `Post-allocation exposure is ${exposurePct.toFixed(2)}%, within the ${mandate.maxSingleVaultExposurePct}% ceiling.`
      : `Post-allocation exposure is ${exposurePct.toFixed(2)}%, above the ${mandate.maxSingleVaultExposurePct}% ceiling.`,
  };
}

export function evaluateMandate(
  mandate: TreasuryMandate,
  evidence: VaultEvidence,
): TermsDecision {
  const constraints = [
    checkReserve(mandate),
    checkProduct(mandate, evidence),
    checkChain(mandate, evidence),
    checkVaultStatus(mandate, evidence),
    checkDepositSupport(mandate, evidence),
    checkEligibility(mandate, evidence),
    checkConcentration(mandate, evidence),
  ];

  const hasFailure = constraints.some(
    (constraint) => constraint.status === "FAIL",
  );

  const hasUnknown = constraints.some(
    (constraint) => constraint.status === "UNKNOWN",
  );

  // A known violation is sufficient to deny authorization.
  // Missing evidence matters only when no established fact
  // already proves that the action violates the mandate.
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
    servUsed: false,
    transactionConstructionAllowed:
      verdict === "EXECUTE",
  };
}
