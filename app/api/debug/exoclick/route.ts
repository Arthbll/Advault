import { NextResponse } from "next/server";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { Network } from "@prisma/client";

export async function GET() {
  const supabase = await createSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.account.findFirst({
    where: { userId: user.id, network: Network.EXOCLICK, isActive: true },
  });
  if (!account) return NextResponse.json({ error: "Aucun compte ExoClick trouvé" });

  const apiToken = decrypt(account.apiKeyEnc);
  const tokenPreview = `${apiToken.slice(0, 6)}...${apiToken.slice(-4)}` ;

  // Test brut — curl équivalent
  let loginStatus = 0;
  let loginBody   = "";
  const loginHeaders: Record<string, string> = {};

  try {
    const res = await fetch("https://api.exoclick.com/v2/login", {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept":        "application/json",
        "User-Agent":    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({ api_token: apiToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    loginStatus = res.status;
    loginBody   = await res.text();
    res.headers.forEach((v, k) => { loginHeaders[k] = v; });
  } catch (err) {
    loginBody = String(err);
  }

  return NextResponse.json({
    tokenPreview,
    tokenLength: apiToken.length,
    loginStatus,
    loginBodySnippet: loginBody.slice(0, 500),
    loginHeaders,
    serverIp: "check vercel/netlify logs or use whatismyip",
  });
}
