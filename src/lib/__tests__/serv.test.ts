import canonical from "./fixtures/serv-canonical.json";
import missingFields from "./fixtures/serv-missing-fields.json";
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeServVerification, verifyWithServ } from "../serv/client";
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
  vi.unstubAllGlobals();
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
describe("SERV compatibility contract (offline fixtures)", () => {
  it("retains the canonical response", () => {
    expect(normalizeServVerification(canonical)).toEqual(canonical);
  });
  it.each(["evidence_sufficient", "isEvidenceSufficient"])("accepts explicit boolean alias %s", field => {
    const { evidenceSufficient, ...rest } = canonical;
    expect(normalizeServVerification({...rest, [field]: evidenceSufficient})).toEqual(canonical);
    expect(normalizeServVerification({...rest, [field]: false}).evidenceSufficient).toBe(false);
  });
  it.each(["authorization_rationale", "rationale", "reason", "explanation"])("maps explicit explanation %s", field => {
    const { authorizationRationale, ...rest } = canonical;
    expect(normalizeServVerification({...rest, [field]: authorizationRationale})).toEqual(canonical);
  });
  it("accepts only a sole verification wrapper", () => {
    expect(normalizeServVerification({verification:canonical})).toEqual(canonical);
  });
  it.each([
    missingFields,
    {...canonical, evidenceSufficient:undefined},
    {...canonical, authorizationRationale:undefined},
    {...canonical, evidenceSufficient:"true"},
    {...canonical, evidenceSufficient:null},
    {...canonical, authorizationRationale:"  "},
    {...canonical, rationale:"another explanation"},
    {...canonical, evidence_sufficient:true},
    {...canonical, evidence_sufficient:false},
    {...canonical, unresolvedFacts:["Wallet status unknown"]},
    {...canonical, authorizationState:"ESCALATE"},
    {...canonical, decisionId:""},
    {...canonical, decisiveFacts:"all pass"},
    {...canonical, extra:"unsupported"},
    {verification:canonical, ...canonical},
    {result:canonical}, null, [],
  ])("rejects incomplete, ambiguous, or contradictory output %#", value => {
    expect(() => normalizeServVerification(value)).toThrow();
  });
  it.each(["EXECUTE", "HOLD", "ESCALATE"])("preserves explicit insufficiency for %s", authorizationState => {
    expect(normalizeServVerification({...canonical, authorizationState, evidenceSufficient:false, unresolvedFacts:["Unknown fact"]}).evidenceSufficient).toBe(false);
  });
  it.each([
    {content:missingFields},
    {content:{...canonical, decisionId:"wrong"}},
    {content:{...canonical, authorizationState:"HOLD"}},
    {content:canonical, finish_reason:"length"},
    {content:canonical, finish_reason:"content_filter"},
    {content:canonical, refusal:"Cannot verify"},
  ])("rejects provider output without retrying %#", async variant => {
    vi.stubEnv("OPENSERV_KEY", "test-key");
    const log=vi.spyOn(console,"error").mockImplementation(() => {});
    const fetch=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({choices:[{
      finish_reason:variant.finish_reason ?? "stop",
      message:{content:JSON.stringify(variant.content), refusal:variant.refusal},
    }]})));
    await expect(verifyWithServ({mandate,evidence,deterministicDecision})).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("SERV response rejected",expect.objectContaining({decisionId:deterministicDecision.decisionId}));
    expect(JSON.stringify(log.mock.calls)).not.toContain("test-key");
  });
  it("normalizes supported aliases through the real client and retains the request contract", async () => {
    vi.stubEnv("OPENSERV_KEY", "test-key");
    const {evidenceSufficient,authorizationRationale,...rest}=canonical;
    const fetch=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:JSON.stringify({verification:{...rest,evidence_sufficient:evidenceSufficient,reason:authorizationRationale}})}}]})));
    expect(await verifyWithServ({mandate,evidence,deterministicDecision})).toEqual(canonical);
    const request=JSON.parse(fetch.mock.calls[0][1]!.body as string);
    expect(request.response_format).toEqual({type:"json_object"});
    expect(request.messages[0].content).toContain("All six fields are REQUIRED");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("SERV envelope validation", () => {
  it.each([
    "not JSON",
    JSON.stringify({choices:[]}),
    JSON.stringify({choices:[{message:{content:"not JSON"}}]}),
    JSON.stringify({choices:[{message:{content:canonical}}]}),
    JSON.stringify({choices:[{message:{content:JSON.stringify(canonical)}},{message:{content:JSON.stringify(canonical)}}]}),
    "x".repeat(65537),
  ])("rejects malformed or oversized envelope %# with one request", async raw => {
    vi.stubEnv("OPENSERV_KEY", "test-key");
    vi.spyOn(console,"error").mockImplementation(() => {});
    const fetch=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(raw));
    await expect(verifyWithServ({mandate,evidence,deterministicDecision})).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
