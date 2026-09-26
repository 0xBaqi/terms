import { NextResponse } from "next/server";
import { z } from "zod";

import { gatherIxsEvidence } from "@/lib/ixs/evidence";
import { evaluateMandate } from "@/lib/terms/evaluate";
import { TreasuryMandateSchema } from "@/lib/terms/schemas";

const ZERO_WALLET =
  "0x0000000000000000000000000000000000000000";

const EvaluateRequestSchema = z.object({
  mandate: TreasuryMandateSchema,
  vaultId: z.string().min(1),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default(ZERO_WALLET),
});

export async function POST(request: Request) {
  try {
    const body = EvaluateRequestSchema.parse(
      await request.json(),
    );

    const evidence = await gatherIxsEvidence(
      body.vaultId,
      body.walletAddress,
    );

    const decision = evaluateMandate(
      body.mandate,
      evidence,
    );

    return NextResponse.json({
      ok: true,
      mode: "POLICY_EVALUATION",
      evidence,
      decision,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Terms evaluation failed.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status: 400,
      },
    );
  }
}