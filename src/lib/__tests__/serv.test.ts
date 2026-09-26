import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyWithServ } from "../serv/client";
import type {
  TermsDecision,
  TreasuryMandate,
  VaultEvidence,
} from "../terms/schemas";

const mandate: TreasuryMandate = {
  mandateId: "terms-demo-001",
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
  actions: ["deposit", "mint", "withdraw", "redeem"],
  currentExposureUsd: 0,
  evidenceTimestamp: "2026-09-26T15:58:49.018Z",
  source: "IXS",
};

const deterministicDecision: TermsDecision = {
  decisionId: "decision-demo-001",
  mandateId: "terms-demo-001",
  vaultId: "6a952683732c2b84b55ce89b",
  verdict: "EXECUTE",
  constraints: [
    {
      constraint: "minimum_cash_reserve",
      status: "PASS",
      reason: "Required reserve remains intact.",
    },
  ],
  summary: "All required treasury constraints pass.",
  decidedAt: "2026-09-26T16:00:00.000Z",
  servUsed: false,
  transactionConstructionAllowed: true,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("SERV bounded verifier", () => {
  it(
    "accepts a SERV verification that agrees with deterministic policy",
    async () => {
      vi.stubEnv("OPENSERV_KEY", "test-key");

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    decisionId: "decision-demo-001",
                    authorizationState: "EXECUTE",
                    evidenceSufficient: true,
                    decisiveFacts: [
                      "The supplied hard constraints pass.",
                    ],
                    unresolvedFacts: [],
                    authorizationRationale:
                      "The supplied evidence supports the authorization state.",
                  }),
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );

      const result = await verifyWithServ({
        mandate,
        evidence,
        deterministicDecision,
      });

      expect(result.decisionId).toBe(
        deterministicDecision.decisionId,
      );
      expect(result.authorizationState).toBe("EXECUTE");
      expect(result.evidenceSufficient).toBe(true);
    },
  );

  it(
    "rejects SERV if it tries to override deterministic policy",
    async () => {
      vi.stubEnv("OPENSERV_KEY", "test-key");

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    decisionId: "decision-demo-001",
                    authorizationState: "HOLD",
                    evidenceSufficient: true,
                    decisiveFacts: [],
                    unresolvedFacts: [],
                    authorizationRationale:
                      "Attempted override.",
                  }),
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );

      await expect(
        verifyWithServ({
          mandate,
          evidence,
          deterministicDecision,
        }),
      ).rejects.toThrow(
        "SERV authorization mismatch: deterministic=EXECUTE, SERV=HOLD",
      );
    },
  );

  it(
    "rejects a SERV verification bound to the wrong decision",
    async () => {
      vi.stubEnv("OPENSERV_KEY", "test-key");

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    decisionId: "wrong-decision-id",
                    authorizationState: "EXECUTE",
                    evidenceSufficient: true,
                    decisiveFacts: [
                      "The supplied hard constraints pass.",
                    ],
                    unresolvedFacts: [],
                    authorizationRationale:
                      "Authorization appears supported.",
                  }),
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );

      await expect(
        verifyWithServ({
          mandate,
          evidence,
          deterministicDecision,
        }),
      ).rejects.toThrow(
        "SERV decision ID mismatch: expected=decision-demo-001, SERV=wrong-decision-id",
      );
    },
  );
});