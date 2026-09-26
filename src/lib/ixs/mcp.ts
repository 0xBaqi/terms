import { z } from "zod";

const IXS_MCP_URL =
  "https://api-dev-v2.ixs.finance/mcp";

const McpEnvelopeSchema = z.object({
  result: z
    .object({
      content: z
        .array(
          z.object({
            type: z.string(),
            text: z.string(),
          }),
        )
        .optional(),

      isError: z.boolean().optional(),
    })
    .optional(),

  error: z
    .object({
      code: z.number(),
      message: z.string(),
    })
    .optional(),
});

async function callIxsTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(IXS_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `IXS MCP request failed: ${response.status} ${response.statusText}`,
    );
  }

  const body = await response.text();

  const dataLine = body
    .split(/\r?\n/)
    .find((line) => line.startsWith("data: "));

  if (!dataLine) {
    throw new Error(
      "IXS MCP response did not contain an SSE data event.",
    );
  }

  const envelope = McpEnvelopeSchema.parse(
    JSON.parse(dataLine.slice(6)),
  );

  if (envelope.error) {
    throw new Error(
      `IXS MCP error ${envelope.error.code}: ${envelope.error.message}`,
    );
  }

  const text =
    envelope.result?.content?.find(
      (item) => item.type === "text",
    )?.text;

  if (!text) {
    throw new Error(
      "IXS MCP response did not contain text content.",
    );
  }

  if (envelope.result?.isError) {
    throw new Error(text);
  }

  return text;
}

const WhitelistResultSchema = z.object({
  ok: z.boolean(),
  whitelistEnabled: z.boolean(),
  whitelisted: z.boolean(),
});

export type IxsWhitelistResult = z.infer<
  typeof WhitelistResultSchema
>;

export async function checkIxsWhitelist(
  vaultId: string,
  walletAddress: string,
): Promise<IxsWhitelistResult> {
  const text = await callIxsTool(
    "vault_check_whitelist",
    {
      vaultId,
      walletAddress,
    },
  );

  return WhitelistResultSchema.parse(
    JSON.parse(text),
  );
}

export async function buildIxsDepositRequest(
  vaultId: string,
  ownerAddress: string,
  assetAmount: string,
): Promise<string> {
  return callIxsTool(
    "vault_build_request_deposit",
    {
      vaultId,
      ownerAddress,
      assetAmount,
    },
  );
}
