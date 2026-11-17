// Notes keep their text as one markdown block inside the jsonb column, so a richer editor can be added later without a migration.
export const NOTE_KINDS = ["note", "meeting", "decision", "lesson"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export function noteText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((b) => (b && typeof b === "object" && typeof (b as { text?: unknown }).text === "string" ? (b as { text: string }).text : ""))
    .filter((x) => x !== "")
    .join("\n\n");
}

export function toContent(text: string): { type: "markdown"; text: string }[] {
  return text.trim() === "" ? [] : [{ type: "markdown", text }];
}

export const TAG_ENTITIES = ["note", "project", "client"] as const;
export type TagEntity = (typeof TAG_ENTITIES)[number];

export function cleanTagName(raw: string): string | null {
  const n = raw.replace(/\s+/g, " ").trim().replace(/^#/, "").slice(0, 40);
  return n === "" ? null : n;
}
