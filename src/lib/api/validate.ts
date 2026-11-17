// Tiny request validation for the API: whitelisted fields, types, enums. Pure, so it is easy to test.
export type FieldSpec =
  | { type: "string"; required?: boolean; max?: number; nullable?: boolean }
  | { type: "enum"; values: readonly string[]; required?: boolean }
  | { type: "date"; required?: boolean; nullable?: boolean }
  | { type: "number"; required?: boolean; min?: number; max?: number; nullable?: boolean }
  | { type: "uuid"; required?: boolean; nullable?: boolean }
  | { type: "boolean"; required?: boolean }
  | { type: "json"; required?: boolean };
export type Fields = Record<string, FieldSpec>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type Validated = { ok: true; values: Record<string, unknown> } | { ok: false; errors: string[] };

/** `partial` (PATCH): only the fields that are present are checked and nothing is required. Unknown fields are rejected. */
export function validate(body: unknown, fields: Fields, partial = false): Validated {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, errors: ["The body must be a JSON object."] };
  const input = body as Record<string, unknown>;
  const errors: string[] = [];
  const values: Record<string, unknown> = {};
  for (const key of Object.keys(input)) if (!(key in fields)) errors.push(`Unknown field: ${key}.`);
  for (const [key, spec] of Object.entries(fields)) {
    const v = input[key];
    if (v === undefined) {
      if (!partial && spec.required) errors.push(`${key} is required.`);
      continue;
    }
    if (v === null) {
      if ("nullable" in spec && spec.nullable) values[key] = null;
      else errors.push(`${key} cannot be null.`);
      continue;
    }
    switch (spec.type) {
      case "string": {
        if (typeof v !== "string") errors.push(`${key} must be a string.`);
        else if (spec.required && v.trim() === "") errors.push(`${key} cannot be empty.`);
        else if (v.length > (spec.max ?? 4000)) errors.push(`${key} is too long (max ${spec.max ?? 4000}).`);
        else values[key] = v.trim();
        break;
      }
      case "enum":
        if (typeof v !== "string" || !spec.values.includes(v)) errors.push(`${key} must be one of: ${spec.values.join(", ")}.`);
        else values[key] = v;
        break;
      case "date":
        if (typeof v !== "string" || !DATE.test(v) || Number.isNaN(Date.parse(v))) errors.push(`${key} must be a date like 2026-01-31.`);
        else values[key] = v;
        break;
      case "number":
        if (typeof v !== "number" || !Number.isFinite(v)) errors.push(`${key} must be a number.`);
        else if (spec.min !== undefined && v < spec.min) errors.push(`${key} must be at least ${spec.min}.`);
        else if (spec.max !== undefined && v > spec.max) errors.push(`${key} must be at most ${spec.max}.`);
        else values[key] = v;
        break;
      case "uuid":
        if (typeof v !== "string" || !UUID.test(v)) errors.push(`${key} must be an id.`);
        else values[key] = v;
        break;
      case "boolean":
        if (typeof v !== "boolean") errors.push(`${key} must be true or false.`);
        else values[key] = v;
        break;
      case "json":
        if (typeof v !== "object") errors.push(`${key} must be an object.`);
        else values[key] = v;
        break;
    }
  }
  if (partial && errors.length === 0 && Object.keys(values).length === 0) errors.push("Nothing to change.");
  return errors.length ? { ok: false, errors } : { ok: true, values };
}

export function pageParams(url: URL): { limit: number; offset: number } {
  const n = (k: string, d: number) => {
    const v = Number(url.searchParams.get(k));
    return Number.isInteger(v) && v >= 0 && url.searchParams.get(k) !== "" && url.searchParams.has(k) ? v : d;
  };
  return { limit: Math.min(200, Math.max(1, n("limit", 50))), offset: n("offset", 0) };
}
