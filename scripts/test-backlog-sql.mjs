// Runs migrations 0001-0004 on a SCRATCH Postgres, then every scenario of fixtures/backlog-scenarios.json against the
// real trigger, plus extra tests (numbers per workspace, events, steps, test missions and probes, RLS for each role).
// It starts its own temporary cluster (needs the Postgres 16 binaries and `psql`); nothing touches Supabase.
// Run: npm run test:backlog-sql
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(join(here, "fixtures/backlog-scenarios.json"), "utf8"));
const mig = (f) => join(here, "../supabase/migrations", f);
const BIN = ["/usr/lib/postgresql/16/bin", "/usr/lib/postgresql/17/bin", "/usr/lib/postgresql/15/bin"].find((d) => existsSync(join(d, "initdb")));
if (!BIN) {
  console.error("Postgres binaries not found (looked for /usr/lib/postgresql/{15,16,17}/bin).");
  process.exit(2);
}
const work = mkdtempSync(join(tmpdir(), "cpms-pg-"));
const data = join(work, "data");
const sock = work;
const isRoot = process.getuid?.() === 0;
const sh = (a) => `'${String(a).replace(/'/g, `'\\''`)}'`;
const asPg = (cmd, args) => (isRoot ? spawnSync("su", ["postgres", "-s", "/bin/bash", "-c", [cmd, ...args].map(sh).join(" ")], { encoding: "utf8" }) : spawnSync(cmd, args, { encoding: "utf8" }));
if (isRoot) spawnSync("chown", ["postgres", work]);

let pass = 0;
let fail = 0;
function ok(name, cond, extra = "") {
  if (cond) pass++;
  else {
    fail++;
    console.log(`FAIL ${name}${extra ? `  [${extra}]` : ""}`);
  }
}
function psql(args, input) {
  const base = ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", sock, "-U", "postgres", "-d", "scratch"];
  const r = isRoot
    ? spawnSync("su", ["postgres", "-s", "/bin/bash", "-c", ["psql", ...base, ...args].map(sh).join(" ")], { encoding: "utf8", input })
    : spawnSync("psql", [...base, ...args], { encoding: "utf8", input });
  return { code: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
}
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

let r = asPg(join(BIN, "initdb"), ["-D", data, "-U", "postgres", "--auth=trust", "-E", "UTF8"]);
ok("initdb", r.status === 0, r.stderr);
r = asPg(join(BIN, "pg_ctl"), ["-D", data, "-o", `-c listen_addresses='' -c unix_socket_directories=${sock}`, "-l", join(work, "log"), "-w", "start"]);
ok("postgres starts", r.status === 0, r.stderr);
function stop() {
  asPg(join(BIN, "pg_ctl"), ["-D", data, "-m", "immediate", "stop"]);
}
process.on("exit", stop);
const create = isRoot
  ? spawnSync("su", ["postgres", "-s", "/bin/bash", "-c", `'${join(BIN, "createdb")}' -h '${sock}' -U postgres scratch`], { encoding: "utf8" })
  : spawnSync(join(BIN, "createdb"), ["-h", sock, "-U", "postgres", "scratch"], { encoding: "utf8" });
ok("scratch database", create.status === 0, create.stderr);

// ---- 1. stubs + migrations ----
for (const [name, file] of [["stubs", join(here, "fixtures/pg-stubs.sql")], ["0001", mig("0001_foundation.sql")], ["0002", mig("0002_template_files.sql")], ["0003", mig("0003_backlog_full.sql")], ["0004", mig("0004_notes_ai_api.sql")]]) {
  r = psql(["-f", file]);
  ok(`${name} runs`, r.code === 0, r.err.slice(0, 500));
  if (r.code !== 0) {
    console.log(`\nbacklog SQL: ${pass} passed, ${fail} failed`);
    process.exit(1);
  }
}

// ---- 2. one user = one workspace (the sign-up trigger) ----
const U = "00000000-0000-0000-0000-0000000000a1";
r = psql(["-c", `insert into auth.users (id, email) values (${q(U)}, 'a@example.com')`]);
ok("sign-up creates a user", r.code === 0, r.err);
r = psql(["-At", "-c", `select workspace_id from public.workspace_members where user_id = ${q(U)}`]);
const W = r.out.trim();
ok("sign-up creates a workspace", /^[0-9a-f-]{36}$/.test(W), r.out + r.err);
r = psql(["-At", "-c", "select count(*) from public.backlog_settings"]);
ok("a workspace made after the migration has no settings row yet (defaults apply)", r.out.trim() === "0", r.out);

// ---- 3. shared scenarios ----
function filler(status, n) {
  let sql = "";
  for (let i = 0; i < n; i++) {
    sql += `insert into public.backlog_items (workspace_id, number, title, status, size, spec_link) values (${q(W)}, public.test_nn(${q(W)}), ${q(`filler ${status} ${i}`)}, ${q(status)}, 'S', 'x');\n`;
  }
  return sql;
}
function itemInsert(it, status, withNumber) {
  const cols = ["workspace_id", "title", "type", "status", "size", "spec_link", "parked_reason"];
  const vals = [q(W), q("subject"), q(it.type ?? "feature"), q(status), it.size ? q(it.size) : "null", it.spec_link ? q(it.spec_link) : "null", it.parked_reason ? q(it.parked_reason) : "null"];
  if (withNumber) {
    cols.push("number");
    vals.push(`public.test_nn(${q(W)})`);
  }
  return `insert into public.backlog_items (${cols.join(", ")}) values (${vals.join(", ")})`;
}
const fillers = (c = {}) => filler("now", c.now ?? 0) + filler("next", c.next ?? 0) + filler("verifying", c.verifying ?? 0);
function scenarioSql(s, kind) {
  const tag = `RESULT|${kind}|${s.name}`.replace(/'/g, "''");
  const setup = `delete from public.backlog_events; delete from public.backlog_items;\nset local session_replication_role = replica;\n${fillers(s.counts)}`;
  if (kind === "move") {
    return `do $$ declare v_id uuid; v_re int; begin
${setup}
${itemInsert(s.item, s.item.status, true)} returning id into v_id;
set local session_replication_role = origin;
begin
  update public.backlog_items set status = ${q(s.to)} where id = v_id;
  select reopened_count into v_re from public.backlog_items where id = v_id;
  raise notice '${tag}|ok|%', v_re;
exception when others then
  raise notice '${tag}|error|%', sqlerrm;
end;
end $$;`;
  }
  return `do $$ begin
${setup}
set local session_replication_role = origin;
begin
  ${itemInsert(s.item, s.item.status, false)};
  raise notice '${tag}|ok|0';
exception when others then
  raise notice '${tag}|error|%', sqlerrm;
end;
end $$;`;
}
const all = [...spec.scenarios.map((s) => ({ s, kind: "move" })), ...spec.creates.map((s) => ({ s, kind: "create" }))];
const dir = mkdtempSync(join(tmpdir(), "backlog-"));
const file = join(dir, "scenarios.sql");
writeFileSync(file, all.map(({ s, kind }) => scenarioSql(s, kind)).join("\n"));
isRoot && spawnSync("chmod", ["755", dir]) && spawnSync("chmod", ["644", file]);
r = psql(["-f", file]);
ok("scenario script runs", r.code === 0, r.err.slice(0, 400));
const results = new Map();
for (const line of r.err.split("\n")) {
  const m = line.match(/RESULT\|(move|create)\|(.*?)\|(ok|error)\|(.*)$/);
  if (m) results.set(`${m[1]}|${m[2]}`, { outcome: m[3], detail: m[4] });
}
for (const { s, kind } of all) {
  const got = results.get(`${kind}|${s.name}`);
  if (!got) {
    ok(s.name, false, "no result");
    continue;
  }
  if (s.ok) {
    ok(s.name, got.outcome === "ok", `${got.outcome}: ${got.detail}`);
    if (s.reopen) ok(`${s.name} (reopened_count = 1)`, got.detail.trim() === "1", got.detail);
  } else {
    ok(s.name, got.outcome === "error" && got.detail.trim() === s.error, `${got.outcome}: ${got.detail}`);
  }
}

// ---- 4. extra tests ----
const extra = readFileSync(join(here, "fixtures/backlog-extra-tests.sql"), "utf8").replaceAll("__U__", q(U)).replaceAll("__W__", q(W));
const extraFile = join(dir, "extra.sql");
writeFileSync(extraFile, extra);
isRoot && spawnSync("chmod", ["644", extraFile]);
r = psql(["-f", extraFile]);
ok("extra tests run", r.code === 0, r.err.slice(0, 800));
const extras = r.err.split("\n").filter((l) => l.includes("EXTRA|"));
const EXPECTED = 9;
ok(`all ${EXPECTED} extra blocks passed`, extras.length === EXPECTED, `${extras.length} passed`);

console.log(`\nbacklog SQL: ${pass} passed, ${fail} failed (${all.length} shared scenarios, ${extras.length} extra blocks)`);
process.exit(fail ? 1 : 0);
