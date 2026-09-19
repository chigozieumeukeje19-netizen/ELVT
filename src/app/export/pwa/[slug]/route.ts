import { NextResponse, type NextRequest } from "next/server";
import { currentProfile, isStaff } from "@/lib/auth";
import { auditExport } from "@/lib/export/audit";
import { generateApp, ExportError, titleFor } from "@/lib/export/generate";
import { loadExportData } from "@/lib/export/load";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /export/pwa/:slug
 *
 * The single file client app, generated from the database.
 *
 * Coach only, because it carries one client's whole program in plain text. It
 * is also audited before it is served: a file that fails a non negotiable is
 * refused rather than handed over, since a client who hits the broken part mid
 * session stops trusting the rest of it.
 *
 * The title is asserted against the client it was generated for. The failure
 * that check exists for happened: the wrong client's file deployed to a
 * client's URL.
 */
export async function GET(
  request: NextRequest,
  route: { params: Promise<{ slug: string }> },
) {
  const profile = await currentProfile();
  if (!profile || !isStaff(profile.role)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { slug } = await route.params;
  const apiBase = `${new URL(request.url).origin}/api/v1`;

  const data = await loadExportData(supabaseAdmin(), slug, apiBase);
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let html: string;
  try {
    html = generateApp(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ExportError
            ? error.message
            : "That app could not be generated.",
      },
      { status: 409 },
    );
  }

  const title = titleFor(data);
  if (!html.includes(`<title>`) || !html.includes(data.client.slug)) {
    return NextResponse.json(
      { error: "The generated file is not titled for this client." },
      { status: 500 },
    );
  }

  const findings = auditExport(html);
  if (findings.length > 0) {
    return NextResponse.json(
      {
        error: "The generated file failed its own audits, so it was not served.",
        findings,
      },
      { status: 500 },
    );
  }

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="${data.client.slug}.html"`,
      "x-elvt-title": title,
      // Never cached. A stale program is worse than a slow download.
      "cache-control": "no-store",
    },
  });
}
