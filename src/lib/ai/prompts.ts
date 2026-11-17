// Prompts for the project drafts. Pure functions: easy to test, no network.
export const DRAFT_KINDS = ["charter", "status_report", "risk_review", "meeting_agenda", "lessons"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export type ProjectFacts = {
  name: string;
  client: string | null;
  method: string;
  phase: string;
  status: string;
  objective: string | null;
  sponsor: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  tasks: { title: string; status: string; due_date: string | null }[];
  milestones: { title: string; due_date: string | null; done: boolean }[];
  risks: { title: string; score: number | null; response: string | null; status?: string }[];
};

const TASK_LIMIT = 40;

export function factsText(f: ProjectFacts): string {
  const lines = [
    `Project: ${f.name}`,
    `Client: ${f.client ?? "(internal)"}`,
    `Method: ${f.method}; phase: ${f.phase}; status: ${f.status}`,
    `Objective: ${f.objective || "(not written yet)"}`,
    `Sponsor: ${f.sponsor || "(not set)"}`,
    `Dates: ${f.start_date ?? "?"} to ${f.end_date ?? "?"}`,
    `Budget: ${f.budget ?? "(not set)"}`,
  ];
  lines.push("", "Milestones:");
  lines.push(...(f.milestones.length ? f.milestones.map((m) => `- ${m.title} (${m.due_date ?? "no date"}) ${m.done ? "[done]" : "[open]"}`) : ["- none"]));
  lines.push("", "Risks:");
  lines.push(...(f.risks.length ? f.risks.map((r) => `- ${r.title} (score ${r.score ?? "?"}; response: ${r.response || "none yet"})`) : ["- none"]));
  lines.push("", "Tasks:");
  const tasks = f.tasks.slice(0, TASK_LIMIT);
  lines.push(...(tasks.length ? tasks.map((t) => `- ${t.title} [${t.status}]${t.due_date ? ` due ${t.due_date}` : ""}`) : ["- none"]));
  if (f.tasks.length > TASK_LIMIT) lines.push(`- ...and ${f.tasks.length - TASK_LIMIT} more`);
  return lines.join("\n");
}

const WHAT: Record<DraftKind, string> = {
  charter: "a project charter with these sections: Purpose, Objectives, Scope (in and out), Key deliverables, Milestones, High-level risks, Assumptions and constraints, Stakeholders, Approval",
  status_report: "a one-page status report with these sections: Summary (green/amber/red with one sentence why), Progress since last report, Next steps, Milestones, Risks and issues, Decisions needed",
  risk_review: "a risk review: a short assessment of the current risks, which ones need a response first and why, suggested responses (avoid, mitigate, transfer or accept) and any risks that seem to be missing",
  meeting_agenda: "an agenda for the next project meeting: goal, time-boxed items based on open tasks, milestones and risks, and the decisions to leave with",
  lessons: "a lessons-learned review: what went well, what did not, causes, and concrete recommendations for the next project",
};

export function buildPrompt(kind: DraftKind, facts: ProjectFacts, lang: "en" | "es"): { system: string; prompt: string } {
  const language = lang === "es" ? "Spanish" : "English";
  return {
    system:
      `You are a careful project management assistant (PMBOK and agile aware). Write in ${language}. ` +
      "Use only the facts given; where something is missing write a clear [TO BE DEFINED] placeholder instead of inventing it. " +
      "Output clean Markdown with short headings and bullet points. No preamble and no closing remarks.",
    prompt: `Write ${WHAT[kind]}.\n\nProject facts:\n${factsText(facts)}`,
  };
}

export function draftTitle(kind: DraftKind, name: string, labels: Record<DraftKind, string>): string {
  return `${labels[kind]} - ${name}`.slice(0, 200);
}
