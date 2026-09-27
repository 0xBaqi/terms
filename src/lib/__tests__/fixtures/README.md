SERV fixtures

serv-canonical.json uses the previously supported six-field contract and existing mock values; it is not a recovered live payload.

serv-missing-fields.json reconstructs only the two missing fields reported by the user (evidenceSufficient and authorizationRationale). No raw failed response was recoverable: fe38e47 removed raw logging and the available Next development log has no SERV payload. Do not describe this fixture as an exact capture or claim that any alias was observed live.

serv-second-retry.json is the exact JSON envelope recovered from the second manual retry in the prior chat work/terms-server.stderr.log, decision be531c4b-75c2-4051-bddd-f6d756b852a0, created 1790508693. Node inspect escaping was decoded, then the envelope was pretty-printed; message.content is unchanged. No credential was present (checked against local environment values). IDs are retained for binding reproduction. It MUST reject: authorizationState, evidenceSufficient and authorizationRationale are absent; authorization, vaultId and mandateId are unsupported.
