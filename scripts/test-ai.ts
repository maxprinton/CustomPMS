// AI drafting and notes helpers: prompts, the Gemini provider against a fake fetch, limits, note text and tag names.
// Run: npm run test:ai
import { AiNotConfigured, dailyLimit, geminiProvider, getProvider } from "@/lib/ai/provider";
import { DRAFT_KINDS, buildPrompt, draftTitle, factsText, type ProjectFacts } from "@/lib/ai/prompts";
import { cleanTagName, noteText, toContent } from "@/lib/notes";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log(`❌ ${name}${extra ? `  [${extra}]` : ""}`);
  }
}

const facts: ProjectFacts = {
  name: "ERP rollout",
  client: "Acme",
  method: "hybrid",
  phase: "planning",
  status: "active",
  objective: "Replace the old system",
  sponsor: null,
  start_date: "2026-01-05",
  end_date: null,
  budget: 12000,
  tasks: Array.from({ length: 45 }, (_, i) => ({ title: `Task ${i + 1}`, status: "todo", due_date: null })),
  milestones: [{ title: "Kickoff", due_date: "2026-01-05", done: true }],
  risks: [{ title: "Key person leaves", score: 12, response: null }],
};

// ---- prompts ----
const text = factsText(facts);
ok("facts include the project, client and objective", text.includes("ERP rollout") && text.includes("Acme") && text.includes("Replace the old system"));
ok("missing values are marked, not invented", text.includes("Sponsor: (not set)") && text.includes("2026-01-05 to ?"));
ok("milestones and risks are listed", text.includes("Kickoff (2026-01-05) [done]") && text.includes("Key person leaves (score 12; response: none yet)"));
ok("tasks are capped at 40 with a count of the rest", text.includes("Task 40") && !text.includes("Task 41") && text.includes("...and 5 more"));
ok("empty lists say none", factsText({ ...facts, tasks: [], milestones: [], risks: [] }).split("- none").length === 4);
for (const k of DRAFT_KINDS) {
  const en = buildPrompt(k, facts, "en");
  const es = buildPrompt(k, facts, "es");
  ok(`${k}: English and Spanish prompts`, en.system.includes("English") && es.system.includes("Spanish") && en.prompt.includes("ERP rollout"));
  ok(`${k}: forbids inventing facts`, en.system.includes("[TO BE DEFINED]"));
}
ok("charter prompt lists its sections", buildPrompt("charter", facts, "en").prompt.includes("Purpose, Objectives, Scope"));
const labels = { charter: "Charter", status_report: "Status", risk_review: "Risks", meeting_agenda: "Agenda", lessons: "Lessons" };
ok("draft title", draftTitle("charter", "ERP rollout", labels) === "Charter - ERP rollout");
ok("draft title is capped at 200", draftTitle("charter", "x".repeat(400), labels).length === 200);

// ---- provider ----
const reply = (status: number, body: unknown) => (async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;
{
  let seen: { url: string; init: RequestInit } | null = null;
  const f = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "# Draft " }, { text: "body" }] } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const out = await geminiProvider("KEY", "gemini-x", f).generate({ system: "sys", prompt: "go" });
  ok("provider joins the parts and trims", out === "# Draft body");
  ok("provider calls the model URL", seen !== null && (seen as { url: string }).url.endsWith("/models/gemini-x:generateContent"));
  const headers = (seen as unknown as { init: { headers: Record<string, string> } }).init.headers;
  ok("the key goes in a header, never in the URL", headers["x-goog-api-key"] === "KEY" && !(seen as unknown as { url: string }).url.includes("KEY"));
  const body = JSON.parse((seen as unknown as { init: { body: string } }).init.body);
  ok("system and user text are sent", body.systemInstruction.parts[0].text === "sys" && body.contents[0].parts[0].text === "go");
}
{
  let msg = "";
  try { await geminiProvider("K", "m", reply(429, "quota exceeded")).generate({ system: "s", prompt: "p" }); } catch (e) { msg = (e as Error).message; }
  ok("an HTTP error becomes a readable message", msg.includes("429") && msg.includes("quota exceeded"));
  msg = "";
  try { await geminiProvider("K", "m", reply(200, { candidates: [] })).generate({ system: "s", prompt: "p" }); } catch (e) { msg = (e as Error).message; }
  ok("an empty answer is an error", msg.includes("no text"));
}
{
  let threw: unknown = null;
  try { getProvider({}); } catch (e) { threw = e; }
  ok("no key means AiNotConfigured", threw instanceof AiNotConfigured);
  ok("a key gives a provider", getProvider({ GEMINI_API_KEY: "k" }).name === "gemini:gemini-2.5-flash");
  ok("the model can be changed", getProvider({ GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-y" }).name === "gemini:gemini-y");
  ok("daily limit default is 20", dailyLimit({}) === 20);
  ok("daily limit from the environment", dailyLimit({ AI_DAILY_LIMIT: "5" }) === 5);
  ok("a bad limit falls back", dailyLimit({ AI_DAILY_LIMIT: "-3" }) === 20 && dailyLimit({ AI_DAILY_LIMIT: "abc" }) === 20);
}

// ---- notes helpers ----
ok("note text round trip", noteText(toContent("Hello\n\nWorld")) === "Hello\n\nWorld");
ok("empty text is an empty block list", toContent("   ").length === 0 && noteText([]) === "");
ok("non-array content is empty text", noteText(null) === "" && noteText({}) === "");
ok("blocks without text are skipped", noteText([{ type: "x" }, { type: "markdown", text: "A" }, 5]) === "A");
ok("tag names are cleaned", cleanTagName("  #Urgent   client ") === "Urgent client");
ok("empty tag is rejected", cleanTagName("  # ") === null && cleanTagName("") === null);
ok("tag names are capped at 40", (cleanTagName("x".repeat(80)) ?? "").length === 40);

console.log(`\nai and notes: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
