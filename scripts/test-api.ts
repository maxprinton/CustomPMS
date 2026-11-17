// API keys, request validation, paging and webhook signing/dispatch (against a fake database and fetch).
// Run: npm run test:api
import { KEY_PREFIX, bearerToken, displayPrefix, generateKey, hashKey } from "@/lib/api/keys";
import { pageParams, validate } from "@/lib/api/validate";
import { clients, projects, tasks, backlog } from "@/lib/api/resources";
import { WEBHOOK_EVENTS, dispatchEvent, matchesEvent, newSecret, parseEvents, signBody } from "@/lib/api/webhooks";
import { createHmac } from "node:crypto";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log(`❌ ${name}${extra ? `  [${extra}]` : ""}`);
  }
}

// keys
const k1 = generateKey(), k2 = generateKey();
ok("key prefix", k1.startsWith(KEY_PREFIX));
ok("keys are unique and long", k1 !== k2 && k1.length > 40);
ok("hash is stable sha-256 hex", hashKey(k1) === hashKey(k1) && /^[0-9a-f]{64}$/.test(hashKey(k1)));
ok("different keys, different hashes", hashKey(k1) !== hashKey(k2));
ok("hash does not contain the key", !hashKey(k1).includes(k1.slice(5, 15)));
ok("display prefix is short", displayPrefix(k1).length === 12 && k1.startsWith(displayPrefix(k1)));
ok("bearer parses", bearerToken(`Bearer ${k1}`) === k1 && bearerToken(`bearer ${k1}`) === k1);
ok("bearer rejects others", bearerToken(null) === null && bearerToken("Bearer abc") === null && bearerToken(`Basic ${k1}`) === null && bearerToken(`Bearer ${k1} x`) === null);

// validation
const good = validate({ name: "  Acme ", kind: "internal" }, clients.fields);
ok("client valid, trimmed", good.ok && (good.values as { name: string }).name === "Acme");
ok("name required", !validate({}, clients.fields).ok);
ok("empty name rejected", !validate({ name: "  " }, clients.fields).ok);
ok("unknown field rejected", !validate({ name: "a", workspace_id: "x" }, clients.fields).ok);
ok("bad enum rejected", !validate({ name: "a", kind: "vip" }, clients.fields).ok);
ok("non-object body rejected", !validate([], clients.fields).ok && !validate(null, clients.fields).ok && !validate("x", clients.fields).ok);
ok("null on non-nullable rejected", !validate({ name: null }, clients.fields).ok);
ok("nullable null ok", validate({ notes: null }, clients.fields, true).ok);
ok("patch needs something", !validate({}, clients.fields, true).ok);
ok("patch does not require name", validate({ archived: true }, clients.fields, true).ok);
ok("workspace_id cannot be set", !validate({ name: "a", workspace_id: "00000000-0000-0000-0000-000000000000" }, projects.fields).ok);
ok("date format", validate({ name: "p", start_date: "2026-03-01" }, projects.fields).ok && !validate({ name: "p", start_date: "03/01/2026" }, projects.fields).ok && !validate({ name: "p", start_date: "2026-13-45" }, projects.fields).ok);
ok("uuid format", validate({ project_id: "123e4567-e89b-12d3-a456-426614174000", title: "t" }, tasks.fields).ok && !validate({ project_id: "nope", title: "t" }, tasks.fields).ok);
ok("task needs project", !validate({ title: "t" }, tasks.fields).ok);
ok("number range", validate({ title: "x", value: 3 }, backlog.fields).ok && !validate({ title: "x", value: 9 }, backlog.fields).ok && !validate({ title: "x", value: "2" }, backlog.fields).ok);
ok("budget must be >= 0", !validate({ name: "p", budget: -1 }, projects.fields).ok);
ok("string max", !validate({ title: "x".repeat(201) }, backlog.fields).ok);
ok("backlog status enum", validate({ title: "x", status: "now" }, backlog.fields).ok && !validate({ title: "x", status: "doing" }, backlog.fields).ok);
const errs = validate({ foo: 1, kind: "x" }, clients.fields);
ok("errors are listed", !errs.ok && errs.errors.length >= 3);

// paging
const p = (q: string) => pageParams(new URL("https://x/y" + q));
ok("paging defaults", p("").limit === 50 && p("").offset === 0);
ok("paging caps", p("?limit=9999").limit === 200 && p("?limit=0").limit === 1);
ok("paging ignores junk", p("?limit=abc&offset=-3").limit === 50 && p("?limit=abc&offset=-3").offset === 0);
ok("paging offset", p("?offset=40").offset === 40);

// webhooks
const s = newSecret();
ok("secret format", s.startsWith("whsec_") && s.length > 20);
ok("signature matches independent HMAC", signBody("k", "body") === "sha256=" + createHmac("sha256", "k").update("body").digest("hex"));
ok("signature depends on secret and body", signBody("a", "x") !== signBody("b", "x") && signBody("a", "x") !== signBody("a", "y"));
ok("empty events = all", matchesEvent([], "task.created") && matchesEvent(null, "task.created"));
ok("events filter", matchesEvent(["task.created"], "task.created") && !matchesEvent(["task.created"], "task.updated"));
ok("parseEvents keeps valid only", JSON.stringify(parseEvents("task.created, nope client.updated")) === JSON.stringify(["task.created", "client.updated"]));
ok("event list", WEBHOOK_EVENTS.includes("backlog.moved"));

// dispatch against a fake database and fetch
const hooks = [
  { id: "h1", url: "https://a.test/hook", secret: "s1", events: [] as string[] },
  { id: "h2", url: "https://b.test/hook", secret: "s2", events: ["client.created"] },
  { id: "h3", url: "https://c.test/hook", secret: "s3", events: ["task.created"] },
];
const log: Record<string, unknown>[] = [];
let askedWs = "";
const admin = {
  from(t: string) {
    if (t === "webhooks") {
      const q: Record<string, unknown> = {};
      const chain = { select: () => chain, eq: (c: string, v: unknown) => { if (c === "workspace_id") askedWs = String(v); return chain; }, then: (r: (v: unknown) => void) => r({ data: hooks }) };
      void q;
      return chain;
    }
    return { insert: async (row: Record<string, unknown>) => { log.push(row); return { error: null }; } };
  },
};
const calls: { url: string; init: RequestInit }[] = [];
const fakeFetch = (async (url: string, init: RequestInit) => {
  calls.push({ url, init });
  if (url.startsWith("https://a.test")) throw new Error("boom");
  return { ok: true, status: 200 } as Response;
}) as unknown as typeof fetch;
const n = await dispatchEvent(admin, "ws-1", "client.created", { id: "c1" }, fakeFetch);
ok("sent to matching hooks only", n === 2 && calls.length === 2 && !calls.some((c) => c.url.includes("c.test")));
ok("workspace is filtered", askedWs === "ws-1");
const b = calls.find((c) => c.url.includes("b.test"))!;
const body = String(b.init.body);
const headers = b.init.headers as Record<string, string>;
ok("signed body", headers["x-cpms-signature"] === signBody("s2", body) && headers["x-cpms-event"] === "client.created");
ok("body content", JSON.parse(body).event === "client.created" && JSON.parse(body).data.id === "c1" && JSON.parse(body).workspace_id === "ws-1");
ok("deliveries logged", log.length === 2 && log.some((r) => r.webhook_id === "h1" && r.error === "boom" && r.status_code === null) && log.some((r) => r.webhook_id === "h2" && r.status_code === 200 && r.error === null));
ok("no admin client = no-op", (await dispatchEvent(null, "ws", "task.created", {}, fakeFetch)) === 0);
ok("never throws", (await dispatchEvent({ from: () => { throw new Error("db down"); } }, "ws", "task.created", {}, fakeFetch)) === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
