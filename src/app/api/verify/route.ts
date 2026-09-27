import { VERIFICATION_FAILURE_MESSAGE } from "@/lib/serv/errors";
import { consumeVerificationTicket } from "@/lib/terms/verification-ticket";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  TreasuryMandateSchema,
  VaultEvidenceSchema,
  TermsDecisionSchema,
} from "@/lib/terms/schemas";
import { evaluateMandate } from "@/lib/terms/evaluate";
import { verifyWithServ } from "@/lib/serv/client";
import { preflightIxsDeposit } from "@/lib/ixs/preflight";
import { evaluateActionGate } from "@/lib/terms/action-gate";
import { createDecisionReceipt } from "@/lib/receipts/decision-receipt";

const VerifyRequestSchema = z.object({
  verificationToken: z.string().uuid(),
  mandate: TreasuryMandateSchema,
  evidence: VaultEvidenceSchema,
  decision: TermsDecisionSchema,
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/),
});

export async function POST(request: Request) {
  try {
    const body = VerifyRequestSchema.parse(
      await request.json(),
    );

    if (body.decision.verdict !== "EXECUTE" || !body.decision.transactionConstructionAllowed) {
      throw new Error("Only an executable evaluation can request SERV verification.");
    }
    consumeVerificationTicket(body.verificationToken, { mandate: body.mandate, evidence: body.evidence, decision: body.decision, walletAddress: body.walletAddress });

    // Reject a modified deterministic record before spending SERV credit.
    const expected = evaluateMandate(body.mandate, body.evidence);
    if (body.decision.mandateId !== expected.mandateId ||
        body.decision.vaultId !== expected.vaultId ||
        body.decision.verdict !== expected.verdict ||
        body.decision.transactionConstructionAllowed !== expected.transactionConstructionAllowed ||
        JSON.stringify(body.decision.constraints) !== JSON.stringify(expected.constraints)) {
      throw new Error("Decision does not match the supplied mandate and evidence. Re-evaluate the proposal.");
    }

    /*
     * SERV verifies the deterministic authorization.
     * No execution work happens before this succeeds.
     */
    const verification = await verifyWithServ({
      mandate: body.mandate,
      evidence: body.evidence,
      deterministicDecision: body.decision,
    });

    /*
     * Only an EXECUTE decision should advance to IXS
     * transaction construction.
     */
    const preflight =
      body.decision.verdict === "EXECUTE" &&
      verification.evidenceSufficient &&
      verification.decisionId === body.decision.decisionId &&
      verification.authorizationState === body.decision.verdict
        ? await preflightIxsDeposit(
            body.evidence.vaultId,
            body.walletAddress,
            String(
              body.mandate.proposedAllocationUsd,
            ),
          )
        : {
            ok: false as const,
            reason:
              "Transaction construction was not attempted because authorization is not executable.",
          };

    const action = evaluateActionGate({
      decision: body.decision,
      verification,
      preflight,
    });

    const receipt = createDecisionReceipt({
      mandate: body.mandate,
      evidence: body.evidence,
      decision: body.decision,
      verification,
      action,
    });

    /*
     * Never return transaction construction data unless
     * the action gate explicitly authorizes release.
     */
    const transactionRequest =
      action.calldataReleased &&
      preflight.ok
        ? preflight.transactionRequest
        : null;

    return NextResponse.json({
      ok: true,
      verification,
      preflight: {
        ok: preflight.ok,
        ...(preflight.ok
          ? {}
          : { reason: preflight.reason }),
      },
      action,
      receipt,
      transactionRequest,
    });
  } catch (error) {
    console.error("Terms verification failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: VERIFICATION_FAILURE_MESSAGE,
      },
      {
        status: 400,
      },
    );
  }
}