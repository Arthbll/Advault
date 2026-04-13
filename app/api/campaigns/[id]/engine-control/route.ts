/**
 * GET  /api/campaigns/[id]/engine-control  — état des flags moteur d'une campagne
 * POST /api/campaigns/[id]/engine-control  — toggle des flags moteur
 *   Body: { action: "exclude" | "include" | "pause-automation" | "resume-automation" }
 */
import { NextRequest, NextResponse }  from "next/server";
import { createClient }               from "@/lib/supabase/server";
import { prisma }                     from "@/lib/prisma";
import { resolveWorkspaceUserId }     from "@/lib/workspace";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);
  const { id } = await params;

  let body: { action: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const campaign = await prisma.campaign.findFirst({ where: { id, userId } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  try {
    if (body.action === "exclude" || body.action === "include") {
      const val = body.action === "exclude";
      await prisma.campaign.update({
        where: { id },
        data:  { excludeFromEngine: val },
      });
      return NextResponse.json({ ok: true, excludeFromEngine: val });
    }

    if (body.action === "pause-automation" || body.action === "resume-automation") {
      const val = body.action === "pause-automation";
      await prisma.campaign.update({
        where: { id },
        data:  { automationPaused: val },
      });
      return NextResponse.json({ ok: true, automationPaused: val });
    }

    return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
  } catch (e) {
    console.error(e); return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveWorkspaceUserId(user.id);
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where:  { id, userId },
    select: { excludeFromEngine: true, automationPaused: true },
  });

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    excludeFromEngine: campaign.excludeFromEngine,
    automationPaused:  campaign.automationPaused,
  });
}
