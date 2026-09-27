import { issueVerificationTicket } from "@/lib/terms/verification-ticket";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gatherIxsEvidence } from "@/lib/ixs/evidence";
import { evaluateMandate } from "@/lib/terms/evaluate";
import { TreasuryMandateSchema } from "@/lib/terms/schemas";

const ZERO_WALLET =
  "0x0000000000000000000000000000000000000000";

const EvaluateRequestSchema = z.object({
  mandate: TreasuryMandateSchema,
  evidenceMode: z.enum(["LIVE", "COUNTERFACTUAL_EVIDENCE_GAP"]).default("LIVE"),
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

    const liveEvidence = await gatherIxsEvidence(
      body.vaultId,
      body.walletAddress,
    );

    // Withhold the selected fact before the real policy evaluation.
    const counterfactual = body.evidenceMode === "COUNTERFACTUAL_EVIDENCE_GAP";
    const evidence = counterfactual
      ? { ...liveEvidence, walletEligible: null }
      : liveEvidence;

    const decision = evaluateMandate(
      body.mandate,
      evidence,
    );

    return NextResponse.json({
      ok: true,
      mode: counterfactual ? "COUNTERFACTUAL_EVIDENCE_GAP" : "POLICY_EVALUATION",
      mandate: body.mandate,
      evidence,
      decision,
      verificationTicket: issueVerificationTicket({ mandate: body.mandate, evidence, decision, walletAddress: body.walletAddress }, counterfactual),
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