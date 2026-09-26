import { describe, expect, it } from "vitest";

import { evaluateMandate } from "../terms/evaluate";
import type {
  TreasuryMandate,
  VaultEvidence,
} from "../terms/schemas";

const mandate: TreasuryMandate = {
  mandateId: "mandate-demo",
  treasuryUsd: 50_000,
  proposedAllocationUsd: 10_000,
  minimumCashReserveUsd: 18_000,
  maxSingleVaultExposurePct: 30,

  allowedProductIds: ["ixhyb"],
  allowedChainIds: [43113],

  requireActiveVault: true,
  requireDepositSupport: true,
  requireWalletEligibility: true,
};

const evidence: VaultEvidence = {
  vaultId: "6a952683732c2b84b55ce89b",
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

  actions: [
    "deposit",
    "mint",
    "withdraw",
    "redeem",
  ],

  currentExposureUsd: 0,

  evidenceTimestamp: new Date().toISOString(),
  source: "IXS",
};

describe("evaluateMandate", () => {
  it("EXECUTEs when every required constraint is established and satisfied", () => {
    const decision =
      evaluateMandate(mandate, evidence);

    expect(decision.verdict).toBe("EXECUTE");
    expect(
      decision.transactionConstructionAllowed,
    ).toBe(true);

    expect(
      decision.constraints.every(
        (constraint) => constraint.status === "PASS",
      ),
    ).toBe(true);
  });

  it("HOLDs when the allocation breaches the cash reserve floor", () => {
    const decision = evaluateMandate(
      {
        ...mandate,
        proposedAllocationUsd: 35_000,
      },
      evidence,
    );

    expect(decision.verdict).toBe("HOLD");

    expect(
      decision.constraints.find(
        (constraint) =>
          constraint.constraint ===
          "minimum_cash_reserve",
      )?.status,
    ).toBe("FAIL");
  });

  it("HOLDs when post-allocation concentration exceeds the ceiling", () => {
    const decision = evaluateMandate(
      mandate,
      {
        ...evidence,
        currentExposureUsd: 10_000,
      },
    );

    expect(decision.verdict).toBe("HOLD");

    expect(
      decision.constraints.find(
        (constraint) =>
          constraint.constraint ===
          "single_vault_exposure",
      )?.status,
    ).toBe("FAIL");
  });

  it("ESCALATEs when current exposure has not been established", () => {
    const decision = evaluateMandate(
      mandate,
      {
        ...evidence,
        currentExposureUsd: null,
      },
    );

    expect(decision.verdict).toBe("ESCALATE");

    expect(
      decision.constraints.find(
        (constraint) =>
          constraint.constraint ===
          "single_vault_exposure",
      )?.status,
    ).toBe("UNKNOWN");
  });

  it("HOLDs when the product is outside the mandate", () => {
    const decision = evaluateMandate(
      mandate,
      {
        ...evidence,
        productId: "unapproved-product",
      },
    );

    expect(decision.verdict).toBe("HOLD");

    expect(
      decision.constraints.find(
        (constraint) =>
          constraint.constraint ===
          "allowed_product",
      )?.status,
    ).toBe("FAIL");
  });

  it("HOLDs when the chain is outside the mandate", () => {
    const decision = evaluateMandate(
      mandate,
      {
        ...evidence,
        chainId: 97,
        chainName: "BSC Testnet",
      },
    );

    expect(decision.verdict).toBe("HOLD");

    expect(
      decision.constraints.find(
        (constraint) =>
          constraint.constraint ===
          "allowed_chain",
      )?.status,
    ).toBe("FAIL");
  });

  it("HOLDs when IXS reports the vault as inactive", () => {
    const decision = evaluateMandate(
      mandate,
      {
        ...evidence,
        status: "inactive",
      },
    );

    expect(decision.verdict).toBe("HOLD");

    expect(
      decision.constraints.find(
        (constraint) =>
          constraint.constraint ===
          "active_vault",
      )?.status,
    ).toBe("FAIL");
  });

  it("HOLDs when deposit is not a supported action", () => {
    const decision = evaluateMandate(
      mandate,
      {
        ...evidence,
        actions: ["withdraw", "redeem"],
      },
    );

    expect(decision.verdict).toBe("HOLD");

    expect(
      decision.constraints.find(
        (constraint) =>
          constraint.constraint ===
          "deposit_supported",
      )?.status,
    ).toBe("FAIL");
  });

  it("HOLDs when an IXS whitelist check establishes that the wallet is ineligible", () => {
    const decision = evaluateMandate(
      mandate,
      {
        ...evidence,
        requiresWhitelist: true,
        walletEligible: false,
      },
    );

    expect(decision.verdict).toBe("HOLD");

    expect(
      decision.constraints.find(
        (constraint) =>
          constraint.constraint ===
          "wallet_eligibility",
      )?.status,
    ).toBe("FAIL");
  });

  it("ESCALATEs when a required whitelist result is unavailable", () => {
    const decision = evaluateMandate(
      mandate,
      {
        ...evidence,
        requiresWhitelist: true,
        walletEligible: null,
      },
    );

    expect(decision.verdict).toBe("ESCALATE");

    expect(
      decision.constraints.find(
        (constraint) =>
          constraint.constraint ===
          "wallet_eligibility",
      )?.status,
    ).toBe("UNKNOWN");
  });

  it("gives HOLD precedence over UNKNOWN evidence", () => {
    const decision = evaluateMandate(
      {
        ...mandate,
        proposedAllocationUsd: 40_000,
      },
      {
        ...evidence,
        currentExposureUsd: null,
        walletEligible: null,
      },
    );

    expect(decision.verdict).toBe("HOLD");
    expect(
      decision.transactionConstructionAllowed,
    ).toBe(false);
  });

  it("allows wallet eligibility to be optional when the mandate does not require it", () => {
    const decision = evaluateMandate(
      {
        ...mandate,
        requireWalletEligibility: false,
      },
      {
        ...evidence,
        requiresWhitelist: true,
        walletEligible: null,
      },
    );

    expect(decision.verdict).toBe("EXECUTE");
  });

  it("allows active-vault enforcement to be disabled by the mandate", () => {
    const decision = evaluateMandate(
      {
        ...mandate,
        requireActiveVault: false,
      },
      {
        ...evidence,
        status: "inactive",
      },
    );

    expect(decision.verdict).toBe("EXECUTE");
  });

  it("allows deposit-support enforcement to be disabled by the mandate", () => {
    const decision = evaluateMandate(
      {
        ...mandate,
        requireDepositSupport: false,
      },
      {
        ...evidence,
        actions: ["withdraw", "redeem"],
      },
    );

    expect(decision.verdict).toBe("EXECUTE");
  });
});
