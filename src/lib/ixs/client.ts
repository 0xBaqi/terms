import { z } from "zod";

import {
  VaultEvidenceSchema,
  type VaultEvidence,
} from "../terms/schemas";

const IXS_BASE_URL = "https://api-dev-v2.ixs.finance";

const IxsVaultSchema = z.object({
  id: z.string(),
  name: z.string(),
  productId: z.string(),

  chainId: z.number(),
  chainName: z.string(),
  network: z.string(),

  contractAddress: z.string(),

  underlyingAsset: z.object({
    symbol: z.string(),
    decimals: z.number(),
    address: z.string(),
  }),

  requiresWhitelist: z.boolean(),

  status: z.string(),

  ttm: z.number().nullable(),

  actions: z.array(z.string()),
});

const IxsVaultDetailResponseSchema = z.object({
  vault: IxsVaultSchema,
});

export async function getIxsVault(
  vaultId: string,
): Promise<VaultEvidence> {
  const response = await fetch(
    `${IXS_BASE_URL}/vaults/${encodeURIComponent(vaultId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `IXS vault request failed: ${response.status} ${response.statusText}`,
    );
  }

  const raw: unknown = await response.json();

  const parsed =
    IxsVaultDetailResponseSchema.parse(raw);

  const vault = parsed.vault;

  return VaultEvidenceSchema.parse({
    vaultId: vault.id,
    name: vault.name,
    productId: vault.productId,

    chainId: vault.chainId,
    chainName: vault.chainName,
    network: vault.network,

    contractAddress: vault.contractAddress,

    underlyingAssetSymbol:
      vault.underlyingAsset.symbol,

    status: vault.status,

    requiresWhitelist:
      vault.requiresWhitelist,

    // This must come from a separate eligibility check.
    // We deliberately refuse to infer it from requiresWhitelist.
    walletEligible: vault.requiresWhitelist
      ? null
      : true,

    ttm: vault.ttm,

    actions: vault.actions,

    // Current IXS vault responses do not establish these.
    regulatedRwa: null,
    liquidityDays: null,

    // Position integration comes next.
    currentExposureUsd: 0,

    evidenceTimestamp:
      new Date().toISOString(),

    source: "IXS",
  });
}