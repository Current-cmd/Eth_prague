import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// ── Provider selection ─────────────────────────────────────────────────────
// Set LLM_PROVIDER=glm (default) or LLM_PROVIDER=claude in the environment.

type Provider = "glm" | "claude";

function activeProvider(): Provider {
  return process.env.LLM_PROVIDER === "claude" ? "claude" : "glm";
}

// ── Unified tool / completion types ───────────────────────────────────────

export interface LlmTool {
  name: string;
  description: string;
  // Standard JSON Schema object — same underlying format for both providers.
  parameters: {
    type: "object";
    required?: string[];
    properties: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface StructuredCompletionOptions {
  system: string;
  user: string;
  tool: LlmTool;
  maxTokens?: number;
}

// ── Claude path ────────────────────────────────────────────────────────────

async function runWithClaude(
  opts: StructuredCompletionOptions
): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    tools: [
      {
        name: opts.tool.name,
        description: opts.tool.description,
        input_schema: opts.tool.parameters as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "any" }, // force tool call
    messages: [{ role: "user", content: opts.user }],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`[llmClient] Claude did not call tool '${opts.tool.name}'`);
  }
  return toolUse.input as Record<string, unknown>;
}

// ── GLM path ───────────────────────────────────────────────────────────────

const GLM_BASE_URL = "https://api.z.ai/api/paas/v4";
const GLM_MODEL = "glm-4.6";

function makeGlmClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.GLM_API_KEY,
    baseURL: GLM_BASE_URL,
  });
}

interface GlmCallResult {
  toolArguments?: string; // raw JSON string from tool_calls[0].function.arguments
  content?: string | null; // prose fallback
}

async function callGlm(
  client: OpenAI,
  opts: StructuredCompletionOptions,
  systemOverride: string
): Promise<GlmCallResult> {
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: GLM_MODEL,
        max_tokens: opts.maxTokens ?? 1024,
        messages: [
          { role: "system", content: systemOverride },
          { role: "user", content: opts.user },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: opts.tool.name,
              description: opts.tool.description,
              parameters: opts.tool.parameters,
            },
          },
        ],
        tool_choice: "auto",
      });

      const choice = response.choices[0];
      console.debug(
        `[llmClient] GLM attempt=${attempt} finish_reason=${choice?.finish_reason} tool_calls=${choice?.message?.tool_calls?.length ?? 0} content_len=${choice?.message?.content?.length ?? 0}`
      );
      const toolCall = choice?.message?.tool_calls?.[0];
      const args =
        toolCall && "function" in toolCall ? toolCall.function.arguments : undefined;
      return {
        toolArguments: args,
        content: choice?.message?.content,
      };
    } catch (err: unknown) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      const isRetryable = !status || status >= 500;
      if (!isRetryable || attempt === MAX_ATTEMPTS) throw err;
      const delay = 1000 * attempt;
      console.warn(`[llmClient] GLM attempt ${attempt} failed (${status ?? "network"}), retrying in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastErr;
}

function extractJsonFromContent(content: string): Record<string, unknown> {
  // Try to peel off markdown fences first, then raw parse.
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1] : content;
  return JSON.parse(raw.trim()) as Record<string, unknown>;
}

async function runWithGlm(
  opts: StructuredCompletionOptions
): Promise<Record<string, unknown>> {
  const client = makeGlmClient();

  // Attempt 1 — normal system prompt
  let result = await callGlm(client, opts, opts.system);

  if (!result.toolArguments) {
    // Attempt 2 — stronger instruction
    console.warn(
      `[llmClient] GLM did not call '${opts.tool.name}' — retrying with forced instruction`
    );
    const forcedSystem = `${opts.system}\n\nCRITICAL: You MUST call the provided tool '${opts.tool.name}'. Do not respond in prose under any circumstances.`;
    result = await callGlm(client, opts, forcedSystem);
  }

  if (result.toolArguments) {
    try {
      return JSON.parse(result.toolArguments) as Record<string, unknown>;
    } catch {
      throw new Error(
        `[llmClient] GLM tool arguments were not valid JSON: ${result.toolArguments.slice(0, 200)}`
      );
    }
  }

  // Fallback — try to parse prose content as JSON
  if (result.content) {
    console.warn(
      `[llmClient] GLM still did not call '${opts.tool.name}' after retry — parsing message content as JSON`
    );
    try {
      return extractJsonFromContent(result.content);
    } catch {
      throw new Error(
        `[llmClient] GLM returned prose that was not parseable JSON. Content: ${result.content.slice(0, 300)}`
      );
    }
  }

  throw new Error(
    `[llmClient] GLM did not call '${opts.tool.name}' and returned no content after two attempts`
  );
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function runStructuredCompletion(
  opts: StructuredCompletionOptions
): Promise<Record<string, unknown>> {
  const provider = activeProvider();
  console.info(`[llmClient] provider=${provider} tool=${opts.tool.name}`);
  return provider === "claude" ? runWithClaude(opts) : runWithGlm(opts);
}
