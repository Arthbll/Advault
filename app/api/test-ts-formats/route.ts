import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { TrafficStarsAdapter } from "@/lib/adapters/trafficstars";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.account.findFirst({
    where: { userId: user.id, network: "TRAFFICSTARS", isActive: true },
  });
  if (!account) return NextResponse.json({ error: "No TS account" }, { status: 404 });

  const apiKey = decrypt(account.apiKeyEnc);
  const adapter = new TrafficStarsAdapter(apiKey);
  // @ts-expect-error accessing private fetch for test
  const formats = await adapter.fetch("https://api.trafficstars.com/v1.1/ad_formats");

  return NextResponse.json(formats);
}
