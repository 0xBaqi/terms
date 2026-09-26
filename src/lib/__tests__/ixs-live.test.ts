import { describe, expect, it } from "vitest";

import { gatherIxsEvidence } from "../ixs/evidence";

describe("IXS live evidence integration", () => {
  it(
    "builds evidence from the live Avalanche vault and wallet position",
    async () => {
      const evidence = await gatherIxsEvidence(
        "6a952683732c2b84b55ce89b",
        "0x0000000000000000000000000000000000000000",
      );

      console.log(
        "\nLIVE IXS EVIDENCE\n",
        JSON.stringify(evidence, null, 2),
      );

      expect(evidence.vaultId).toBe(
        "6a952683732c2b84b55ce89b",
      );

      expect(evidence.productId).toBe("ixhyb");
      expect(evidence.chainId).toBe(43113);
      expect(evidence.status).toBe("active");

      expect(evidence.requiresWhitelist).toBe(false);
      expect(evidence.walletEligible).toBe(true);

      expect(evidence.currentExposureUsd).toBe(0);
      expect(evidence.source).toBe("IXS");
    },
    20_000,
  );
});
