/**
 * GET /api/postback-token
 * Retourne le token postback et l'URL complète pour l'utilisateur connecté.
 */
import { NextResponse }          from "next/server";
import { createClient }          from "@/lib/supabase/server";
import { generatePostbackToken } from "@/lib/postback-token";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token   = generatePostbackToken(user.id);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const postbackUrl = `${baseUrl}/api/track?uid=${user.id}&token=${token}&cid={campaign_id}&clickid={clickid}&rev={payout}&src={source}`;

  return NextResponse.json({
    uid:         user.id,
    token:       token,
    postbackUrl: postbackUrl,
  });
}
