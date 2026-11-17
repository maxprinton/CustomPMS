// One-time import of the built-in template files from Personal OS. Needs the SOURCE_ variables and a token
// that exists in the import_tokens table (only the database owner can put one there).
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { FILES_BUCKET } from "@/lib/documents";

export const maxDuration = 60;

type SourceFile = {
  id: string;
  lang: string | null;
  storage_path: string;
  file_name: string;
  mime: string | null;
  size: number | null;
  sha256: string | null;
  tm_templates: { code: string | null } | { code: string | null }[] | null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const limit = Math.min(60, Math.max(1, Number(url.searchParams.get("limit")) || 30));

  const admin = createAdminClient();
  const srcUrl = process.env.SOURCE_SUPABASE_URL;
  const srcKey = process.env.SOURCE_SUPABASE_SECRET_KEY;
  if (!admin || !srcUrl || !srcKey) return NextResponse.json({ error: "Import is not configured." }, { status: 503 });

  const { data: tok, error: tokError } = await admin.from("import_tokens").select("token").eq("token", token).maybeSingle();
  if (tokError) return NextResponse.json({ error: `Token check failed: ${tokError.message}` }, { status: 500 });
  if (!token || !tok) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const src = createClient(srcUrl, srcKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await src
    .from("tm_files")
    .select("id, lang, storage_path, file_name, mime, size, sha256, tm_templates(code)")
    .eq("role", "original")
    .is("copy_id", null)
    .order("id")
    .range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: `Source read failed: ${error.message}` }, { status: 500 });
  const files = (data ?? []) as unknown as SourceFile[];

  const { data: tpl, error: tplError } = await admin.from("templates").select("id, code").is("workspace_id", null);
  if (tplError) return NextResponse.json({ error: tplError.message }, { status: 500 });
  const idByCode = new Map(((tpl ?? []) as unknown as { id: string; code: string }[]).map((t) => [t.code, t.id]));

  const errors: string[] = [];
  let copied = 0;
  const copyOne = async (f: SourceFile) => {
    const code = (Array.isArray(f.tm_templates) ? f.tm_templates[0] : f.tm_templates)?.code ?? "";
    const templateId = idByCode.get(code);
    const lang = f.lang === "es" ? "es" : f.lang === "en" ? "en" : null;
    if (!templateId || !lang) {
      errors.push(`${f.file_name}: no matching template or language`);
      return;
    }
    const ext = (f.file_name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `builtin/${code}/${lang}/${f.id}.${ext}`;
    const dl = await src.storage.from("note-files").download(f.storage_path);
    if (dl.error || !dl.data) {
      errors.push(`${f.file_name}: download failed`);
      return;
    }
    const bytes = new Uint8Array(await dl.data.arrayBuffer());
    const up = await admin.storage.from(FILES_BUCKET).upload(path, bytes, { upsert: true, contentType: f.mime ?? "application/octet-stream" });
    if (up.error) {
      errors.push(`${f.file_name}: upload failed (${up.error.message})`);
      return;
    }
    const row = { template_id: templateId, lang, role: "original", storage_path: path, file_name: f.file_name, mime: f.mime, size: bytes.length, sha256: f.sha256 };
    const ins = await admin.from("template_files").upsert(row, { onConflict: "storage_path" });
    if (ins.error) {
      errors.push(`${f.file_name}: ${ins.error.message}`);
      return;
    }
    copied++;
  };
  for (let i = 0; i < files.length; i += 6) await Promise.all(files.slice(i, i + 6).map(copyOne));

  return NextResponse.json({ offset, read: files.length, copied, errors, done: files.length < limit, next: offset + files.length });
}
