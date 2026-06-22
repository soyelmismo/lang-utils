// ============================================
// Lang Utils - OpenAI-compatible API client
// Single source of truth for chat completion calls.
// Supports plain JSON and SSE streaming responses.
// ============================================

import { ChatCompletionResponse, ChatMessage, Settings } from "../types";

/** Build the request body for an OpenAI-compatible chat completion. */
export function buildBody(
  messages: ChatMessage[],
  modelOverride: string,
  settings: Settings
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: (modelOverride && modelOverride.trim()) || settings.model,
    messages,
    stream: false,
  };
  if (
    settings.temperature !== undefined &&
    settings.temperature !== null &&
    !Number.isNaN(settings.temperature)
  ) {
    body.temperature = Number(settings.temperature);
  }
  return body;
}

/** Parse either a plain JSON response or an SSE stream. */
export function parseResponseText(text: string): string {
  if (!text || text.trim().length === 0) {
    throw new Error("API returned an empty response");
  }

  // Try plain JSON first
  try {
    const data = JSON.parse(text) as ChatCompletionResponse;
    if (data.error) {
      const err =
        typeof data.error === "string"
          ? data.error
          : data.error.message || data.error.msg || JSON.stringify(data.error);
      throw new Error("API error: " + err);
    }
    if (data.choices && data.choices[0]?.message?.content) {
      return data.choices[0].message.content || "";
    }
    // No choices found, fall through to SSE parsing
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    // Not JSON → try SSE
  }

  // SSE streaming response
  const lines = text.split("\n");
  let result = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "data: [DONE]") continue;
    if (trimmed.startsWith("data: ")) {
      try {
        const chunk = JSON.parse(trimmed.slice(6)) as ChatCompletionResponse;
        const choice = chunk.choices?.[0];
        if (choice?.delta?.content) result += choice.delta.content;
        if (choice?.message?.content) result += choice.message.content;
      } catch {
        // ignore malformed chunks
      }
    }
  }

  if (result.length > 0) return result;

  throw new Error(
    "Could not parse API response: " + (text || "").substring(0, 300)
  );
}

/** Perform a fetch to an OpenAI-compatible chat completions endpoint. */
export async function doAPIFetch(
  body: Record<string, unknown>,
  settings: Settings
): Promise<string> {
  const endpoint = settings.apiUrl.replace(/\/+$/, "") + "/chat/completions";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + settings.apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errText = "";
    try {
      errText = await response.text();
    } catch {
      // ignore
    }
    throw new Error(
      "API Error " + response.status + ": " + (errText || "no details")
    );
  }

  const respText = await response.text();
  return parseResponseText(respText);
}

/** Single-turn call: system prompt + user prompt. */
export async function callAPI(
  prompt: string,
  modelOverride: string,
  settings: Settings,
  systemPrompt: string
): Promise<string> {
  return doAPIFetch(
    buildBody(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      modelOverride,
      settings
    ),
    settings
  );
}

/** Multi-turn call for chatbot. */
export async function callChatAPI(
  messages: ChatMessage[],
  settings: Settings
): Promise<string> {
  return doAPIFetch(buildBody(messages, "", settings), settings);
}

/** Test that the API is reachable. Returns the trimmed response. */
export async function testAPIConnection(
  settings: Settings,
  testPrompt: string
): Promise<string> {
  return doAPIFetch(
    buildBody([{ role: "user", content: testPrompt }], "", settings),
    settings
  );
}
