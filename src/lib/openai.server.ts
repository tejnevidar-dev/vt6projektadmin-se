// Shared OpenAI chat-completions helper. Replaces Lovable's AI gateway
// (ai.gateway.lovable.dev) now that the project has its own OpenAI API key.
const OPENAI_MODEL = "gpt-5.6-sol";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

export async function callOpenAIChat(body: {
  messages: ChatMessage[];
  response_format?: { type: "json_object" };
  tools?: unknown[];
  tool_choice?: unknown;
}): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("AI är inte konfigurerad (OPENAI_API_KEY saknas på servern).");

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: OPENAI_MODEL, ...body }),
  });

  if (res.status === 429) throw new Error("AI är överbelastad eller kvoten är slut just nu – försök igen om en stund.");
  if (res.status === 401) throw new Error("AI-anropet nekades – kontrollera OPENAI_API_KEY.");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("OpenAI-fel", res.status, text);
    throw new Error(`AI-tjänsten svarade inte (${res.status}).`);
  }
  return res.json();
}
