import {
  getIxsPosition,
  getIxsVault,
  positionExposureInAssetUnits,
} from "./client";

import { checkIxsWhitelist } from "./mcp";

import {
  VaultEvidenceSchema,
  type VaultEvidence,
} from "../terms/schemas";

export async function gatherIxsEvidence(
  vaultId: string,
  walletAddress: string,
): Promise<VaultEvidence> {
  const [vault, position] = await Promise.all([
    getIxsVault(vaultId),
    getIxsPosition(vaultId, walletAddress),
  ]);

  let walletEligible: boolean | null;

  if (vault.requiresWhitelist) {
    const whitelist = await checkIxsWhitelist(
      vaultId,
      walletAddress,
    );

    walletEligible =
      whitelist.whitelistEnabled
        ? whitelist.whitelisted
        : true;
  } else {
    walletEligible = true;
  }

  const exposure =
    positionExposureInAssetUnits(position);

  return VaultEvidenceSchema.parse({
    ...vault,
    walletEligible,

    // Hackathon MVP currently treats the underlying
    // stablecoin asset value as treasury USD exposure.
    //
    // Keep this conversion here rather than inside
    // the generic position parser.
    currentExposureUsd: exposure,

    evidenceTimestamp:
      new Date().toISOString(),
  });
}
