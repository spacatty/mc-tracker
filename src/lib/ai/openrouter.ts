import "server-only";

type JsonSchema = Record<string, unknown>;
type ChatMessage = { role: "system" | "user"; content: string };
type OpenRouterChoice = {
  finish_reason?: string;
  message?: { content?: string };
};
type OpenRouterResponse = {
  choices?: OpenRouterChoice[];
  error?: { message?: string };
};

export function openRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

function stripJsonMarkdown(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() || trimmed;
}

function parseJsonContent<T>(content: string): T | null {
  try {
    return JSON.parse(stripJsonMarkdown(content)) as T;
  } catch {
    return null;
  }
}

export async function openRouterJson<T>({
  messages,
  schema,
  schemaName,
}: {
  messages: ChatMessage[];
  schema: JsonSchema;
  schemaName: string;
}): Promise<T> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const maxTokens = Number(process.env.AI_IMPORT_MAX_OUTPUT_TOKENS || 8000);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_APP_URL || "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME || "MC Tracker",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite",
        messages: attempt === 1
          ? messages
          : [
              ...messages,
              {
                role: "user",
                content: "Return the same result again, but ensure the response is complete, valid JSON only, with no markdown and no truncated strings.",
              } satisfies ChatMessage,
            ],
        max_tokens: maxTokens,
        temperature: 0.1,
        provider: {
          require_parameters: true,
        },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            strict: true,
            schema,
          },
        },
      }),
    });

    const data = (await response.json().catch(() => null)) as OpenRouterResponse | null;

    if (!response.ok) {
      throw new Error(data?.error?.message || "OpenRouter request failed.");
    }

    const choice = data?.choices?.[0];
    const content = choice?.message?.content;
    if (!content) {
      if (attempt === 1) continue;
      throw new Error("OpenRouter returned an empty response.");
    }

    const parsed = parseJsonContent<T>(content);
    if (parsed) return parsed;

    if (choice?.finish_reason === "length") {
      throw new Error(`AI response was too large and got cut off. Increase AI_IMPORT_MAX_OUTPUT_TOKENS above ${maxTokens} or import fewer rows at once.`);
    }
  }

  throw new Error("AI returned invalid JSON twice. Please retry, or split the input into smaller batches.");
}
