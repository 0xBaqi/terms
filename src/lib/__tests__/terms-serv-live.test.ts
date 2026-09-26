import { describe, expect, it } from "vitest";
import { gatherIxsEvidence } from "../ixs/evidence";
import { evaluateMandate } from "../terms/evaluate";
import { verifyWithServ } from "../serv/client";
import type { TreasuryMandate } from "../terms/schemas";

describe("Terms + IXS + SERV live integration", () => {
  it(
    "verifies a real IXS treasury decision with SERV",
    async () => {
      const mandate: TreasuryMandate = {
        mandateId: "terms-live-001",
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

      const evidence = await gatherIxsEvidence(
        "6a952683732c2b84b55ce89b",
        "0x0000000000000000000000000000000000000000",
      );

      const decision = evaluateMandate(mandate, evidence);

      console.log(
        "\nDETERMINISTIC TERMS DECISION\n",
        JSON.stringify(decision, null, 2),
      );

      expect(decision.verdict).toBe("EXECUTE");

      const verification = await verifyWithServ({
        mandate,
        evidence,
        deterministicDecision: decision,
      });

      console.log(
        "\nSERV VERIFICATION\n",
        JSON.stringify(verification, null, 2),
      );

      expect(verification.authorizationState).toBe(decision.verdict);
      expect(verification.evidenceSufficient).toBe(true);
      expect(verification.unresolvedFacts).toEqual([]);
    },
    60_000,
  );
});
