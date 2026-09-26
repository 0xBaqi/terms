import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { preflightIxsDeposit } from "../ixs/preflight";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IXS deposit preflight", () => {
  it("returns the transaction request when IXS construction succeeds", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        [
          "event: message",
          'data: {"jsonrpc":"2.0","id":"test","result":{"content":[{"type":"text","text":"{\\"to\\":\\"0x123\\",\\"data\\":\\"0xabcdef\\"}"}],"isError":false}}',
          "",
        ].join("\n"),
        {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
          },
        },
      ),
    );

    const result = await preflightIxsDeposit(
      "vault-001",
      "0x0000000000000000000000000000000000000000",
      "1",
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.transactionRequest).toContain(
        "0xabcdef",
      );
    }
  });

  it("converts an IXS vault-limit rejection into BLOCKED evidence", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        [
          "event: message",
          'data: {"jsonrpc":"2.0","id":"test","result":{"content":[{"type":"text","text":"Deposit amount exceeds the current vault limit of 0 USDC."}],"isError":true}}',
          "",
        ].join("\n"),
        {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
          },
        },
      ),
    );

    const result = await preflightIxsDeposit(
      "vault-001",
      "0x0000000000000000000000000000000000000000",
      "1",
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.reason).toContain(
        "vault limit of 0 USDC",
      );
    }
  });

  it("fails closed when the IXS MCP request itself fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Service unavailable", {
        status: 503,
        statusText: "Service Unavailable",
      }),
    );

    const result = await preflightIxsDeposit(
      "vault-001",
      "0x0000000000000000000000000000000000000000",
      "1",
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.reason).toContain(
        "IXS MCP request failed",
      );
    }
  });
});