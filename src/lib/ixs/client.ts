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

    // Exposure remains unknown until the wallet position is fetched.
    currentExposureUsd: null,

    evidenceTimestamp:
      new Date().toISOString(),

    source: "IXS",
  });
}

const IxsPositionResponseSchema = z.object({
  position: z.object({
    vaultId: z.string(),
    wallet: z.string(),

    balances: z.object({
      asset: z.object({
        baseUnits: z.string(),
        decimals: z.number().int().nonnegative(),
        display: z.string(),
      }),

      shares: z.object({
        baseUnits: z.string(),
        decimals: z.number().int().nonnegative(),
        display: z.string(),
      }),

      shareValueInAssets: z.object({
        baseUnits: z.string(),
        decimals: z.number().int().nonnegative(),
        display: z.string(),
      }),
    }),

    limits: z.object({
      allowanceToVault: z.object({
        baseUnits: z.string(),
        decimals: z.number().int().nonnegative(),
        display: z.string(),
      }),

      maxWithdraw: z.object({
        baseUnits: z.string(),
        decimals: z.number().int().nonnegative(),
        display: z.string(),
      }),

      maxRedeem: z.object({
        baseUnits: z.string(),
        decimals: z.number().int().nonnegative(),
        display: z.string(),
      }),
    }),
  }),
});

export type IxsPosition = z.infer<
  typeof IxsPositionResponseSchema
>["position"];

export async function getIxsPosition(
  vaultId: string,
  walletAddress: string,
): Promise<IxsPosition> {
  const response = await fetch(
    `${IXS_BASE_URL}/vaults/${encodeURIComponent(
      vaultId,
    )}/positions/${encodeURIComponent(walletAddress)}`,
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
      `IXS position request failed: ${response.status} ${response.statusText}`,
    );
  }

  const raw: unknown = await response.json();

  return IxsPositionResponseSchema.parse(raw).position;
}

export function positionExposureInAssetUnits(
  position: IxsPosition,
): number {
  const value = position.balances.shareValueInAssets;

  const baseUnits = BigInt(value.baseUnits);
  const scale = 10 ** value.decimals;

  return Number(baseUnits) / scale;
}
