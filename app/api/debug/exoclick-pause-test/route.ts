/**
 * GET /api/debug/exoclick-pause-test?id=CAMPAIGN_ID&action=pause|resume|status
 * Debug: test ExoClick pause/resume and get raw API response.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { Network } from "@prisma/client";

const https = require("https");
const agent = new https.Agent({ rejectUnauthorized: false });
const BASE = "https://api.exoclick.com/v2";
const CF_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Content-Type": "application/json",
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("id") ?? "8090226";
  const action = searchParams.get("action") ?? "status";

  const account = await prisma.account.findFirst({
    where: { userId: user.id, network: Network.EXOCLICK, isActive: true },
  });
  if (!account) return NextResponse.json({ error: "No ExoClick account" }, { status: 404 });

  const apiToken = decrypt(account.apiKeyEnc);

  // Step 1: Login
  const loginRes = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: CF_HEADERS,
    body: JSON.stringify({ api_token: apiToken }),
    cache: "no-store",
    // @ts-expect-error undici
    agent,
  });
  const loginText = await loginRes.text();
  if (!loginRes.ok) return NextResponse.json({ error: "Login failed", status: loginRes.status, body: loginText });
  const loginData = JSON.parse(loginText) as Record<string, unknown>;
  const token = (loginData?.token ?? loginData?.access_token) as string;

  // Step 2: GET current campaign status
  const getCampaignRes = await fetch(`${BASE}/campaigns/${campaignId}`, {
    headers: { ...CF_HEADERS, Authorization: `Bearer ${token}` },
    cache: "no-store",
    // @ts-expect-error undici
    agent,
  });
  const getCampaignText = await getCampaignRes.text();

  if (action === "status") {
    return NextResponse.json({
      action: "status",
      campaignId,
      httpStatus: getCampaignRes.status,
      body: JSON.parse(getCampaignText),
    });
  }

  // Step 3: Pause or resume
  const statusValue = action === "pause" ? 0 : 1;
  const putRes = await fetch(`${BASE}/campaigns/${campaignId}`, {
    method: "PUT",
    headers: { ...CF_HEADERS, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: statusValue }),
    cache: "no-store",
    // @ts-expect-error undici
    agent,
  });
  const putText = await putRes.text();

  // Step 4: GET again to verify
  const verifyRes = await fetch(`${BASE}/campaigns/${campaignId}`, {
    headers: { ...CF_HEADERS, Authorization: `Bearer ${token}` },
    cache: "no-store",
    // @ts-expect-error undici
    agent,
  });
  const verifyText = await verifyRes.text();

  return NextResponse.json({
    action,
    campaignId,
    statusValue,
    putHttpStatus: putRes.status,
    putBody: (() => { try { return JSON.parse(putText); } catch { return putText; } })(),
    verifyHttpStatus: verifyRes.status,
    verifyBody: (() => { try { return JSON.parse(verifyText); } catch { return verifyText; } })(),
  });
}
