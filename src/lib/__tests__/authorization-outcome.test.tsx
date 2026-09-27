import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthorizationOutcome } from "../../app/components/authorization-outcome";
import { createDecisionReceipt } from "../receipts/decision-receipt";
import { evaluateMandate } from "../terms/evaluate";
import type { TreasuryMandate, VaultEvidence } from "../terms/schemas";
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


const decision=evaluateMandate(mandate,evidence);
const serv={decisionId:decision.decisionId,authorizationState:decision.verdict,evidenceSufficient:true,decisiveFacts:["All constraints pass"],unresolvedFacts:[],authorizationRationale:"Evidence supports policy authorization."};
const action={decisionId:decision.decisionId,authorizationState:decision.verdict,executionState:"BLOCKED" as const,calldataReleased:false,reason:"Vault deposit limit exceeded."};
const response={verification:serv,preflight:{ok:false,reason:action.reason},action,receipt:createDecisionReceipt({mandate,evidence,decision,verification:serv,action}),transactionRequest:"DO_NOT_LEAK"};
const props={verdict:"EXECUTE" as const,stale:false,loading:false,verifying:false,counterfactual:false,verificationError:null,verification:response,onVerify:vi.fn()};
describe("authorization boundary presentation",()=>{
  it("shows verified, blocked and withheld without exposing transaction data",()=>{
    const html=renderToStaticMarkup(<AuthorizationOutcome {...props}/>);
    expect(html).toContain("VERIFIED"); expect(html).toContain("BLOCKED"); expect(html).toContain("WITHHELD");
    expect(html).not.toContain("DO_NOT_LEAK"); expect(html).toContain("Download JSON");
    expect(html).toContain(response.receipt.receiptId); expect(html).toContain(decision.decisionId);
    expect(html).toContain(evidence.evidenceTimestamp); expect(html).toContain("Copy receipt");
    expect(props.onVerify).not.toHaveBeenCalled();
  });
  it("shows pending verification without claiming a preflight result or receipt",()=>{
    const html=renderToStaticMarkup(<AuthorizationOutcome {...props} verification={null}/>);
    expect(html).toContain("VERIFY WITH SERV"); expect(html).toContain("NOT ATTEMPTED");
    expect(html).toContain("RECEIPT PENDING"); expect(html).not.toContain("Download JSON");
    expect(props.onVerify).not.toHaveBeenCalled();
  });
  it("discards a stale successful release presentation",()=>{
    const html=renderToStaticMarkup(<AuthorizationOutcome {...props} stale verification={{...response,action:{...action,executionState:"READY",calldataReleased:true}}}/>);
    expect(html).toContain("WITHHELD"); expect(html).not.toContain("DO_NOT_LEAK");
    expect(html).not.toContain(response.receipt.receiptId); expect(html).toContain("RE-EVALUATE");
  });
  it("only exposes transaction data when the action gate releases it",()=>{
    const ready={...action,executionState:"READY" as const,calldataReleased:true};
    const html=renderToStaticMarkup(<AuthorizationOutcome {...props} verification={{...response,action:ready,preflight:{ok:true},receipt:createDecisionReceipt({mandate,evidence,decision,verification:serv,action:ready})}}/>);
    expect(html).toContain("RELEASED"); expect(html).toContain("Inspect transaction data"); expect(html).toContain("DO_NOT_LEAK");
  });
  it.each([{verifying:true}, {stale:true}, {loading:true}, {verificationError:"Request failed"}])("disables verification for unavailable states %j", state => {
    const html=renderToStaticMarkup(<AuthorizationOutcome {...props} verification={null} {...state}/>);
    expect(html).toMatch(/class="evaluate-button verify-button"[^>]*disabled/);
    expect(props.onVerify).not.toHaveBeenCalled();
  });
  it.each(["HOLD","ESCALATE"] as const)("keeps %s outside the paid verification flow",verdict=>{
    const html=renderToStaticMarkup(<AuthorizationOutcome {...props} verdict={verdict} verification={null}/>);
    expect(html).not.toContain("VERIFY WITH SERV"); expect(html).toContain("NOT AUTHORIZED"); expect(html).toContain("WITHHELD");
  });
});
