# SERV second retry investigation

The exact second retry is preserved in src/lib/__tests__/fixtures/serv-second-retry.json. The production stderr log captured a complete chat.completion with one assistant choice, finish_reason stop, refusal null, and 175 completion tokens. The content contains decisionId, authorization (EXECUTE), vaultId, mandateId, unresolvedFacts (empty), and seven decisiveFacts. It omits authorizationState, evidenceSufficient, and authorizationRationale. The actual exception was Unsupported SERV output fields.

This is an insufficient verification, not a safe alias variant. Even renaming authorization and removing context IDs leaves two required semantic assertions absent. No inference from passing facts or empty unresolvedFacts is allowed. The parser is intentionally unchanged; this exact payload must continue to reject.

The request used json_object, with no enforced field schema. The provider returned a different contract despite explicit prompt instructions. Logs prove the contract violation, not whether internal model generation or SERV prompt transformation caused it. It was not truncation or a wrong envelope path.

The repair requests json_schema with strict true, all six fields required, additionalProperties false, and decision-specific ID/verdict enums. Prompt instructions explicitly exclude the observed alternate fields and require independent sufficiency and rationale. Local bounds, semantic consistency, ID binding and verdict checks remain authoritative. Rejected output redacts any echoed API key before logging. UI, expiry, replay and single-attempt behavior are unchanged. No automatic retry or JSON-mode fallback exists.

OpenServ's API reference documents forwarding other OpenAI Chat Completions parameters: https://docs.openserv.ai/serv-reasoning/api/chat-completions . JSON mode versus schema enforcement is documented at https://developers.openai.com/api/docs/guides/structured-outputs . This establishes request syntax, not verified serv-nano enforcement. Unsupported schema requests must fail closed. No live SERV validation was performed.

Offline replay and mocked request tests validate rejection of the actual response, strict request construction, canonical/alias compatibility, absent semantics, HTTP rejection without fallback, secret redaction, and existing security guards. Provider compliance remains unverified. Paid retries are stopped; do not recommend another paid retry on the basis of passing mocks. Further fixture replay and provider documentation/support clarification require no SERV inference spend.


## Final no-cost compatibility check (2026-09-27)

This checkpoint supersedes the earlier recommendation to wait for documentation clarification. Public documentation was fetched without any inference API request:

- https://docs.openserv.ai/serv-reasoning/api/chat-completions documents the existing POST endpoint and forwarding other OpenAI Chat Completions parameters.
- https://docs.openserv.ai/serv-reasoning/models lists gpt-5.4-nano at $0.250 input / $1.60 output per million tokens, including SERV Reasoning. serv-nano is not listed. Its previous successful HTTP completion proves historical acceptance, not a current alias mapping or schema capability.
- https://docs.openserv.ai/serv-reasoning/tutorials/structured-outputs explicitly documents response_format.json_schema with name, strict:true, schema, required and additionalProperties:false, and forwarding to a compatible upstream provider. Its example uses gpt-5.4-mini; it is not a nano-specific end-to-end guarantee.
- https://developers.openai.com/api/docs/models/gpt-5.4-nano documents Chat Completions, structured outputs, and none reasoning (default).
- https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.4 documents temperature compatibility with none reasoning.

Selected gpt-5.4-nano through OpenServ, with explicit reasoning_effort:none to avoid an implicit reasoning setting conflicting with temperature:0 or consuming the small completion budget. This is a documented low-cost model with structured-output support, not a claim that it is the cheapest catalog entry or equivalent to serv-nano. Model and reasoning setting are the only runtime changes. Existing strict schema, 700 completion-token cap, prompt, parser, UI and guards are unchanged. Historical fixtures retain serv-nano accurately.

Three mocked contract cases assert the complete request for EXECUTE/HOLD/ESCALATE, including endpoint, model, headers (fake key only), six-field strict schema, exact bindings, prompt rules, no key in body/result/logs, and one fetch. They test client contract construction, not permission to submit HOLD/ESCALATE through the route. Existing route tests retain that prohibition. The exact second retry still rejects; no fallback exists.

Validation excludes both paid SERV and free live IXS tests: fixtures/mocks only. Recommendation after checks pass: GO for one manually monitored paid attempt is technically justified by documented model + schema compatibility and offline safety checks. This is not proof of account availability, provider enforcement or semantic success, and is not authorization for an automated paid call. The previous production process is not restarted by this investigation; it must load this build before any user-chosen attempt.
