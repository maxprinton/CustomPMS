// The AI sits behind one small interface, so the model (or the vendor) can be swapped without touching the screens.
export type AiRequest = { system: string; prompt: string; maxTokens?: number };
export type AiProvider = { name: string; generate(req: AiRequest): Promise<string> };

export class AiNotConfigured extends Error {
  constructor() {
    super("AI is not set up yet. Add GEMINI_API_KEY in Vercel.");
  }
}

/** Google Gemini over plain HTTPS (free tier). The model can be changed with GEMINI_MODEL. */
export function geminiProvider(apiKey: string, model = "gemini-2.5-flash", fetchImpl: typeof fetch = fetch): AiProvider {
  return {
    name: `gemini:${model}`,
    async generate({ system, prompt, maxTokens = 2048 }) {
      const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
        }),
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 200);
        throw new Error(`The AI service answered ${res.status}. ${detail}`.trim());
      }
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
      if (!text) throw new Error("The AI returned no text. Try again.");
      return text;
    },
  };
}

export function getProvider(env: Record<string, string | undefined> = process.env): AiProvider {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new AiNotConfigured();
  return geminiProvider(key, env.GEMINI_MODEL || undefined);
}

/** Drafts per workspace per day (the free tier is generous, but never by accident unlimited). */
export function dailyLimit(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.AI_DAILY_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 20;
}
