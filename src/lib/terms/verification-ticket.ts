import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { TreasuryMandate, VaultEvidence, TermsDecision } from "./schemas";

type Record = { mandate: TreasuryMandate; evidence: VaultEvidence; decision: TermsDecision; walletAddress: string };
type Ticket = { record: Record; expiresAt: number; used: boolean };
// Shared across route bundles in this single-process local demo. Restarting
// invalidates all tickets; multi-instance deployment requires an atomic store.
const state = globalThis as typeof globalThis & { termsTickets?: Map<string, Ticket> };
const tickets = state.termsTickets ??= new Map<string, Ticket>();
export function issueVerificationTicket(record: Record, counterfactual = false) {
  if (counterfactual || record.decision.verdict !== "EXECUTE") return null;
  for (const [key, value] of tickets) if (value.expiresAt <= Date.now()) tickets.delete(key);
  if (tickets.size >= 1000) throw new Error("Evaluation capacity reached. Try again later.");
  const token = randomUUID();
  const expiresAt = Date.now() + 15 * 60 * 1000;
  tickets.set(token, {record: structuredClone(record), expiresAt, used: false});
  return { token, expiresAt };
}
export function consumeVerificationTicket(token: string, record: Record) {
  const ticket = tickets.get(token);
  if (!ticket || ticket.expiresAt <= Date.now()) throw new Error("Evaluation expired or unavailable. Re-evaluate the proposal.");
  if (!isDeepStrictEqual(ticket.record, record)) throw new Error("Request does not match the server evaluation. Re-evaluate the proposal.");
  if (ticket.used) throw new Error("Verification already attempted for this decision. Re-evaluate before another paid attempt.");
  // Consume synchronously before any await, including on paid-request failure.
  ticket.used = true;
}
