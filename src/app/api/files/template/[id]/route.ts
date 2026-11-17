import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FILES_BUCKET } from "@/lib/documents";

/** Download one template file. The signed-in user's own access rules decide whether the file is visible. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("template_files").select("storage_path, file_name").eq("id", id).maybeSingle();
  const file = data as unknown as { storage_path: string; file_name: string | null } | null;
  const admin = createAdminClient();
  if (!file || !admin) return NextResponse.json({ error: "File not found." }, { status: 404 });
  const signed = await admin.storage.from(FILES_BUCKET).createSignedUrl(file.storage_path, 60, { download: file.file_name ?? true });
  if (signed.error || !signed.data) return NextResponse.json({ error: "File not found." }, { status: 404 });
  return NextResponse.redirect(signed.data.signedUrl);
}
