import "server-only";

import { z } from "zod";

/**
 * Minimal OpenAI-compatible chat client that only knows how to ask for one
 * schema-validated JSON object.
 *
 * Configuration (all optional except a key):
 *   AI_API_KEY            falls back to OPENROUTER_API_KEY
 *   AI_BASE_URL           default https://openrouter.ai/api/v1 (DeepSeek direct: https://api.deepseek.com)
 *   AI_MODEL              falls back to OPENROUTER_MODEL, then DEFAULT_AI_MODEL
 *   AI_STRUCTURED_OUTPUT  "json_schema" (strict, default on OpenRouter) or "json_object"
 *                         (schema goes in the prompt; needed for DeepSeek's own API)
 *   AI_IMPORT_MAX_OUTPUT_TOKENS, OPENROUTER_APP_URL, OPENROUTER_APP_NAME
 */

export const DEFAULT_AI_MODEL = "deepseek/deepseek-v4.1-flash";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type ChatResponse = {
  choices?: Array<{ finish_reason?: string; message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  error?: { message?: string };
  model?: string;
};

export type AiUsage = { promptTokens: number; completionTokens: number; cost: number | null };

function config() {
  const apiKey = (process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || "").trim();
  const baseUrl = (process.env.AI_BASE_URL || OPENROUTER_BASE_URL).trim().replace(/\/+$/, "");
  const isOpenRouter = baseUrl.startsWith(OPENROUTER_BASE_URL);
  const mode = process.env.AI_STRUCTURED_OUTPUT === "json_object" || (!isOpenRouter && process.env.AI_STRUCTURED_OUTPUT !== "json_schema")
    ? "json_object"
    : "json_schema";
  return {
    apiKey,
    baseUrl,
    isOpenRouter,
    mode,
    model: (process.env.AI_MODEL || process.env.OPENROUTER_MODEL || DEFAULT_AI_MODEL).trim(),
    maxTokens: Number(process.env.AI_IMPORT_MAX_OUTPUT_TOKENS || 8000),
  } as const;
}

export function aiConfigured() {
  return Boolean(config().apiKey);
}

export function aiModelLabel() {
  return config().model;
}

/** JSON Schema for a zod schema, without the $schema header some providers reject. */
export function jsonSchemaFor(schema: z.ZodType) {
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  void _ignored;
  return jsonSchema;
}

function issuesText(error: z.ZodError) {
  return error.issues
    .slice(0, 12)
    .map((issue) => `- ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

async function chat(messages: ChatMessage[], name: string, jsonSchema: Record<string, unknown>) {
  const { apiKey, baseUrl, isOpenRouter, mode, model, maxTokens } = config();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(isOpenRouter
        ? {
            "HTTP-Referer": process.env.OPENROUTER_APP_URL || "http://localhost:3000",
            "X-Title": process.env.OPENROUTER_APP_NAME || "MC Tracker",
          }
        : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0,
      response_format:
        mode === "json_schema"
          ? { type: "json_schema", json_schema: { name, strict: true, schema: jsonSchema } }
          : { type: "json_object" },
      // Route only to providers that honour response_format, and ask OpenRouter for cost accounting.
      ...(isOpenRouter ? { provider: { require_parameters: true }, usage: { include: true } } : {}),
    }),
    signal: AbortSignal.timeout(90_000),
  });

  const data = (await response.json().catch(() => null)) as ChatResponse | null;
  if (!response.ok) {
    throw new Error(`AI request failed (${response.status}): ${data?.error?.message || response.statusText}`);
  }
  const choice = data?.choices?.[0];
  return {
    content: choice?.message?.content || "",
    truncated: choice?.finish_reason === "length",
    usage: {
      promptTokens: data?.usage?.prompt_tokens || 0,
      completionTokens: data?.usage?.completion_tokens || 0,
      cost: typeof data?.usage?.cost === "number" ? data.usage.cost : null,
    },
  };
}

/**
 * Asks the model for one JSON object matching `schema`. The reply is parsed and
 * validated with zod; on a schema violation the model gets one retry with the
 * exact validation errors. Nothing is ever recovered by regex from free text.
 */
export async function generateStructured<T extends z.ZodType>({
  name,
  schema,
  system,
  user,
}: {
  name: string;
  schema: T;
  system: string;
  user: string;
}): Promise<{ data: z.infer<T>; usage: AiUsage; model: string }> {
  const { apiKey, mode, model, maxTokens } = config();
  if (!apiKey) throw new Error("AI is not configured. Set AI_API_KEY or OPENROUTER_API_KEY.");

  const jsonSchema = jsonSchemaFor(schema);
  const systemPrompt = mode === "json_object"
    ? `${system}\n\nReply with a single JSON object that validates against this JSON Schema:\n${JSON.stringify(jsonSchema)}`
    : system;
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: user },
  ];
  const usage: AiUsage = { promptTokens: 0, completionTokens: 0, cost: 0 };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const reply = await chat(messages, name, jsonSchema);
    usage.promptTokens += reply.usage.promptTokens;
    usage.completionTokens += reply.usage.completionTokens;
    usage.cost = reply.usage.cost === null || usage.cost === null ? null : usage.cost + reply.usage.cost;

    if (reply.truncated) {
      throw new Error(`AI response hit the ${maxTokens}-token limit. Import fewer rows at once or raise AI_IMPORT_MAX_OUTPUT_TOKENS.`);
    }

    let json: unknown;
    let problem: string;
    try {
      json = JSON.parse(reply.content);
      const parsed = schema.safeParse(json);
      if (parsed.success) return { data: parsed.data, usage, model };
      problem = `The JSON did not match the schema:\n${issuesText(parsed.error)}`;
    } catch {
      problem = "The reply was not valid JSON.";
    }

    messages.push(
      { role: "assistant", content: reply.content.slice(0, 20_000) },
      { role: "user", content: `${problem}\nReturn the complete corrected JSON object only.` },
    );
  }

  throw new Error("AI returned data that did not match the import schema twice. Retry, or split the input into smaller batches.");
}
