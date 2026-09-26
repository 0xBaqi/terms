import { z } from "zod";
import type { TermsDecision } from "./schemas";
import type { ServVerification } from "../serv/client";

export const ActionGateResultSchema = z.object({
  decisionId: z.string(),
  authorizationState: z.enum([
    "EXECUTE",
    "HOLD",
    "ESCALATE",
  ]),
  executionState: z.enum([
    "READY",
    "BLOCKED",
    "NOT_AUTHORIZED",
  ]),
  calldataReleased: z.boolean(),
  reason: z.string(),
});

export type ActionGateResult = z.infer<
  typeof ActionGateResultSchema
>;

type EvaluateActionGateInput = {
  decision: TermsDecision;
  verification: ServVerification;
  preflight:
    | {
        ok: true;
      }
    | {
        ok: false;
        reason: string;
      };
};

export function evaluateActionGate(
  input: EvaluateActionGateInput,
): ActionGateResult {
  const {
    decision,
    verification,
    preflight,
  } = input;

  if (
    verification.decisionId !== decision.decisionId
  ) {
    return ActionGateResultSchema.parse({
      decisionId: decision.decisionId,
      authorizationState: decision.verdict,
      executionState: "NOT_AUTHORIZED",
      calldataReleased: false,
      reason:
        "SERV verification is not bound to this Terms decision.",
    });
  }

  if (
    verification.authorizationState !==
    decision.verdict
  ) {
    return ActionGateResultSchema.parse({
      decisionId: decision.decisionId,
      authorizationState: decision.verdict,
      executionState: "NOT_AUTHORIZED",
      calldataReleased: false,
      reason:
        "SERV verification does not agree with deterministic policy.",
    });
  }

  if (decision.verdict !== "EXECUTE") {
    return ActionGateResultSchema.parse({
      decisionId: decision.decisionId,
      authorizationState: decision.verdict,
      executionState: "NOT_AUTHORIZED",
      calldataReleased: false,
      reason:
        decision.verdict === "HOLD"
          ? "A hard mandate constraint failed."
          : "Required authorization evidence is unresolved.",
    });
  }

  if (!verification.evidenceSufficient) {
    return ActionGateResultSchema.parse({
      decisionId: decision.decisionId,
      authorizationState: decision.verdict,
      executionState: "NOT_AUTHORIZED",
      calldataReleased: false,
      reason:
        "SERV could not establish sufficient evidence for execution.",
    });
  }

  if (!preflight.ok) {
    return ActionGateResultSchema.parse({
      decisionId: decision.decisionId,
      authorizationState: decision.verdict,
      executionState: "BLOCKED",
      calldataReleased: false,
      reason: preflight.reason,
    });
  }

  return ActionGateResultSchema.parse({
    decisionId: decision.decisionId,
    authorizationState: decision.verdict,
    executionState: "READY",
    calldataReleased: true,
    reason:
      "Mandate authorization is verified and execution preflight passed.",
  });
}