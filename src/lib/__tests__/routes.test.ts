import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type { TreasuryMandate, VaultEvidence } from "../terms/schemas";
import { consumeVerificationTicket, issueVerificationTicket } from "../terms/verification-ticket";
import { evaluateMandate } from "../terms/evaluate";
import { gatherIxsEvidence } from "../ixs/evidence";
import { verifyWithServ } from "../serv/client";
import { preflightIxsDeposit } from "../ixs/preflight";
import { POST as evaluate } from "../../app/api/evaluate/route";
import { POST as verify } from "../../app/api/verify/route";
vi.mock("../ixs/evidence", () => ({ gatherIxsEvidence: vi.fn() }));
vi.mock("../serv/client", () => ({ verifyWithServ: vi.fn() }));
vi.mock("../ixs/preflight", () => ({ preflightIxsDeposit: vi.fn() }));
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


const walletAddress = "0x0000000000000000000000000000000000000000";
const request = (body: unknown) => new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request in route tests"); }));
  vi.mocked(gatherIxsEvidence).mockResolvedValue(evidence);
});
afterEach(() => vi.unstubAllGlobals());
describe("evaluation route", () => {
  it("evaluates withheld eligibility on the server and labels it counterfactual", async () => {
    const response = await evaluate(request({ mandate, vaultId: evidence.vaultId, walletAddress, evidenceMode: "COUNTERFACTUAL_EVIDENCE_GAP" }));
    const data = await response.json();
    expect(data.mode).toBe("COUNTERFACTUAL_EVIDENCE_GAP");
    expect(data.evidence.walletEligible).toBeNull();
    expect(data.decision.verdict).toBe("ESCALATE");
    expect(data.decision.constraints.find((c: {constraint: string}) => c.constraint === "wallet_eligibility").status).toBe("UNKNOWN");
    expect(verifyWithServ).not.toHaveBeenCalled();
  });
  it("preserves HOLD precedence when a counterfactual also breaches the mandate", async () => {
    const response = await evaluate(request({ mandate: {...mandate, maxSingleVaultExposurePct: 5}, vaultId: evidence.vaultId, evidenceMode: "COUNTERFACTUAL_EVIDENCE_GAP" }));
    expect((await response.json()).decision.verdict).toBe("HOLD");
  });
  it("keeps live evidence unchanged and returns the evaluated mandate", async () => {
    const data = await (await evaluate(request({mandate, vaultId: evidence.vaultId}))).json();
    expect(data.mode).toBe("POLICY_EVALUATION");
    expect(data.evidence.walletEligible).toBe(true);
    expect(data.mandate).toEqual(mandate);
    expect(verifyWithServ).not.toHaveBeenCalled();
  });
});
describe("verification route", () => {
  function body() {
    const decision = evaluateMandate(mandate, evidence);
    vi.mocked(verifyWithServ).mockResolvedValue({decisionId: decision.decisionId, authorizationState: decision.verdict,
      evidenceSufficient: true, decisiveFacts: ["All constraints pass"], unresolvedFacts: [], authorizationRationale: "Supported"});
    const record = {mandate, evidence, decision, walletAddress};
    return {...record, verificationToken: issueVerificationTicket(record)!.token};
  }
  it("rejects a forged decision before SERV is called", async () => {
    const input = body(); input.decision.constraints[0].status = "FAIL";
    expect((await verify(request(input))).status).toBe(400);
    expect(verifyWithServ).not.toHaveBeenCalled();
    expect(preflightIxsDeposit).not.toHaveBeenCalled();
  });
  it("withholds transaction data and creates a receipt when IXS blocks", async () => {
    const input = body();
    vi.mocked(preflightIxsDeposit).mockResolvedValue({ok:false, reason:"Vault limit exceeded"});
    const data = await (await verify(request(input))).json();
    expect(data.action.executionState).toBe("BLOCKED");
    expect(data.transactionRequest).toBeNull();
    expect(data.receipt.receiptId).toBeTruthy();
    expect(data.preflight.reason).toBe("Vault limit exceeded");
  });
  it("releases data only when verification and preflight pass", async () => {
    const input = body();
    vi.mocked(preflightIxsDeposit).mockResolvedValue({ok:true, transactionRequest:"mock calldata"});
    const data = await (await verify(request(input))).json();
    expect(data.action.calldataReleased).toBe(true);
    expect(data.transactionRequest).toBe("mock calldata");
    expect(data.preflight).not.toHaveProperty("transactionRequest");
  });
  it.each(["insufficient", "wrong-id", "disagreement"])("skips IXS construction on %s verification", async kind => {
    const input = body();
    vi.mocked(verifyWithServ).mockResolvedValue({decisionId: kind === "wrong-id" ? "other" : input.decision.decisionId,
      authorizationState: kind === "disagreement" ? "HOLD" : "EXECUTE", evidenceSufficient: kind !== "insufficient",
      decisiveFacts: [], unresolvedFacts: [], authorizationRationale: "Unsupported"});
    const data = await (await verify(request(input))).json();
    expect(preflightIxsDeposit).not.toHaveBeenCalled();
    if (kind === "wrong-id") {
      expect(data.ok).toBe(false);
      expect(data.transactionRequest).toBeUndefined();
    } else {
      expect(data.action.calldataReleased).toBe(false);
      expect(data.transactionRequest).toBeNull();
    }
  });
  it.each(["mandate", "evidence", "wallet", "decision"])("rejects changed %s binding before spending", async kind => {
    const input = structuredClone(body());
    if (kind === "mandate") input.mandate.treasuryUsd += 1;
    if (kind === "evidence") input.evidence.name += " altered";
    if (kind === "wallet") input.walletAddress = "0x1111111111111111111111111111111111111111";
    if (kind === "decision") input.decision.decisionId = "forged";
    expect((await verify(request(input))).status).toBe(400);
    expect(verifyWithServ).not.toHaveBeenCalled();
  });
  it("allows only one paid attempt for concurrent duplicate requests", async () => {
    const input = body();
    vi.mocked(preflightIxsDeposit).mockResolvedValue({ok:false, reason:"Vault limit 0 USDC"});
    const responses = await Promise.all([verify(request(input)), verify(request(input))]);
    expect(responses.map(r => r.status).sort()).toEqual([200,400]);
    expect(verifyWithServ).toHaveBeenCalledTimes(1);
    expect(preflightIxsDeposit).toHaveBeenCalledTimes(1);
  });
  it.each(["HOLD", "ESCALATE"])("rejects %s before SERV and construction", async verdict => {
    const input = body(); input.decision.verdict = verdict as "HOLD" | "ESCALATE";
    expect((await verify(request(input))).status).toBe(400);
    expect(verifyWithServ).not.toHaveBeenCalled();
    expect(preflightIxsDeposit).not.toHaveBeenCalled();
  });
  it("expires server evaluations before spending", async () => {
    const input = body();
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 16 * 60 * 1000);
    try { expect((await verify(request(input))).status).toBe(400); } finally { now.mockRestore(); }
    expect(verifyWithServ).not.toHaveBeenCalled();
  });
  it("does not issue paid tickets for counterfactual or non-executable evaluations", () => {
    const input = body();
    expect(issueVerificationTicket(input, true)).toBeNull();
    expect(issueVerificationTicket({...input, decision: {...input.decision, verdict:"HOLD"}})).toBeNull();
    expect(issueVerificationTicket({...input, decision: {...input.decision, verdict:"ESCALATE"}})).toBeNull();
  });
  it("rejects unknown tickets", () => {
    expect(() => consumeVerificationTicket(crypto.randomUUID(), body())).toThrow("unavailable");
  });
  it("cannot retry a failed paid attempt with the same ticket", async () => {
    const input = body();
    vi.mocked(verifyWithServ).mockRejectedValue(new Error("SERV unavailable"));
    await verify(request(input)); await verify(request(input));
    expect(verifyWithServ).toHaveBeenCalledTimes(1);
    expect(preflightIxsDeposit).not.toHaveBeenCalled();
  });
  it("fails closed on SERV errors", async () => {
    const input = body(); vi.mocked(verifyWithServ).mockRejectedValue(new Error("SERV unavailable"));
    const response = await verify(request(input));
    expect(response.status).toBe(400);
    expect((await response.json()).transactionRequest).toBeUndefined();
    expect(preflightIxsDeposit).not.toHaveBeenCalled();
  });
});
