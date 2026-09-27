# SERV second retry investigation

The exact second retry is preserved in src/lib/__tests__/fixtures/serv-second-retry.json. The production stderr log captured a complete chat.completion with one assistant choice, finish_reason stop, refusal null, and 175 completion tokens. The content contains decisionId, authorization (EXECUTE), vaultId, mandateId, unresolvedFacts (empty), and seven decisiveFacts. It omits authorizationState, evidenceSufficient, and authorizationRationale. The actual exception was Unsupported SERV output fields.

This is an insufficient verification, not a safe alias variant. Even renaming authorization and removing context IDs leaves two required semantic assertions absent. No inference from passing facts or empty unresolvedFacts is allowed. The parser is intentionally unchanged; this exact payload must continue to reject.

The request used json_object, with no enforced field schema. The provider returned a different contract despite explicit prompt instructions. Logs prove the contract violation, not whether internal model generation or SERV prompt transformation caused it. It was not truncation or a wrong envelope path.

The repair requests json_schema with strict true, all six fields required, additionalProperties false, and decision-specific ID/verdict enums. Prompt instructions explicitly exclude the observed alternate fields and require independent sufficiency and rationale. Local bounds, semantic consistency, ID binding and verdict checks remain authoritative. Rejected output redacts any echoed API key before logging. UI, expiry, replay and single-attempt behavior are unchanged. No automatic retry or JSON-mode fallback exists.

OpenServ's API reference documents forwarding other OpenAI Chat Completions parameters: https://docs.openserv.ai/serv-reasoning/api/chat-completions . JSON mode versus schema enforcement is documented at https://developers.openai.com/api/docs/guides/structured-outputs . This establishes request syntax, not verified serv-nano enforcement. Unsupported schema requests must fail closed. No live SERV validation was performed.

Offline replay and mocked request tests validate rejection of the actual response, strict request construction, canonical/alias compatibility, absent semantics, HTTP rejection without fallback, secret redaction, and existing security guards. Provider compliance remains unverified. Paid retries are stopped; do not recommend another paid retry on the basis of passing mocks. Further fixture replay and provider documentation/support clarification require no SERV inference spend.
