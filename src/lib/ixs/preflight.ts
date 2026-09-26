import { z } from "zod";
import { buildIxsDepositRequest } from "./mcp";

export const IxsDepositPreflightSchema = z.discriminatedUnion(
  "ok",
  [
    z.object({
      ok: z.literal(true),
      transactionRequest: z.string(),
    }),
    z.object({
      ok: z.literal(false),
      reason: z.string(),
    }),
  ],
);

export type IxsDepositPreflight = z.infer<
  typeof IxsDepositPreflightSchema
>;

export async function preflightIxsDeposit(
  vaultId: string,
  ownerAddress: string,
  assetAmount: string,
): Promise<IxsDepositPreflight> {
  try {
    const transactionRequest =
      await buildIxsDepositRequest(
        vaultId,
        ownerAddress,
        assetAmount,
      );

    return IxsDepositPreflightSchema.parse({
      ok: true,
      transactionRequest,
    });
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "IXS deposit construction failed for an unknown reason.";

    return IxsDepositPreflightSchema.parse({
      ok: false,
      reason,
    });
  }
}