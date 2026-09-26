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
  minimumLiquidityDays: 45,
  maxSingleVaultExposurePct: 30,
  requireRegulatedRwa: true,
  requireWalletEligibility: true,
};

const evidence: VaultEvidence = {
  vaultId: "vault-a",
  name: "Demo RWA Vault",
  regulatedRwa: true,
  walletEligible: true,
  liquidityDays: 30,
  currentExposureUsd: 0,
  evidenceTimestamp: new Date().toISOString(),
  source: "IXS",
  productId: "ixhyb",
chainId: 43113,
chainName: "Avalanche Fuji Testnet",
network: "avalanche-testnet",
contractAddress: "0x648c66E8791B1Ea20f01db549B49dE7FBa3f2a53",
underlyingAssetSymbol: "USDC",
status: "active",
requiresWhitelist: false,
ttm: 3.07,
actions: ["deposit", "mint", "withdraw", "redeem"],
};

describe("Terms mandate evaluation", () => {
  it("EXECUTEs when every required constraint passes", () => {
    const result = evaluateMandate(
      mandate,
      evidence,
    );

    expect(result.verdict).toBe("EXECUTE");
    expect(
      result.transactionConstructionAllowed,
    ).toBe(true);

    expect(
      result.constraints.every(
        (constraint) =>
          constraint.status === "PASS",
      ),
    ).toBe(true);
  });

  it("HOLDs when the allocation breaches the cash reserve", () => {
    const result = evaluateMandate(
      {
        ...mandate,
        proposedAllocationUsd: 35_000,
      },
      evidence,
    );

    expect(result.verdict).toBe("HOLD");
    expect(
      result.transactionConstructionAllowed,
    ).toBe(false);
  });

  it("HOLDs when concentration exceeds the mandate ceiling", () => {
    const result = evaluateMandate(
      mandate,
      {
        ...evidence,
        currentExposureUsd: 10_000,
      },
    );

    expect(result.verdict).toBe("HOLD");
  });

  it("HOLDs when the vault liquidity horizon is too long", () => {
    const result = evaluateMandate(
      mandate,
      {
        ...evidence,
        liquidityDays: 90,
      },
    );

    expect(result.verdict).toBe("HOLD");
  });

  it("ESCALATEs when required liquidity evidence is missing", () => {
    const result = evaluateMandate(
      mandate,
      {
        ...evidence,
        liquidityDays: null,
      },
    );

    expect(result.verdict).toBe("ESCALATE");
    expect(
      result.transactionConstructionAllowed,
    ).toBe(false);
  });

  it("ESCALATEs when wallet eligibility cannot be established", () => {
    const result = evaluateMandate(
      mandate,
      {
        ...evidence,
        walletEligible: null,
      },
    );

    expect(result.verdict).toBe("ESCALATE");
  });

  it("HOLD takes precedence when a known violation and unknown evidence coexist", () => {
    const result = evaluateMandate(
      {
        ...mandate,
        proposedAllocationUsd: 40_000,
      },
      {
        ...evidence,
        walletEligible: null,
      },
    );

    expect(result.verdict).toBe("HOLD");
  });

  it("does not require regulated status when the mandate does not demand it", () => {
    const result = evaluateMandate(
      {
        ...mandate,
        requireRegulatedRwa: false,
      },
      {
        ...evidence,
        regulatedRwa: null,
      },
    );

    expect(result.verdict).toBe("EXECUTE");
  });
});