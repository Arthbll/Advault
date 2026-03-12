import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Non authentifié", { status: 401 });
  }

  const { messages } = await req.json();

  const campaigns = await prisma.campaign.findMany({
    where: { userId: user.id },
    select: { name: true, network: true, status: true, spend: true, revenue: true, impressions: true, clicks: true },
    orderBy: { spend: "desc" },
    take: 20,
  });

  const totalSpend   = campaigns.reduce((s, c) => s + Number(c.spend),   0);
  const totalRevenue = campaigns.reduce((s, c) => s + Number(c.revenue), 0);
  const profit       = totalRevenue - totalSpend;
  const roi          = totalSpend > 0 ? (profit / totalSpend) * 100 : 0;

  const systemPrompt = [
    "Tu es un expert en publicité adulte et optimisation de campagnes ad network.",
    "L'utilisateur gère des campagnes sur ExoClick, TrafficStars et TrafficJunky via AdVault.",
    "",
    "DONNÉES ACTUELLES :",
    `- Dépenses totales : $${totalSpend.toFixed(2)}`,
    `- Revenus totaux   : $${totalRevenue.toFixed(2)}`,
    `- Profit net       : $${profit.toFixed(2)}`,
    `- ROI global       : ${roi.toFixed(1)}%`,
    `- Campagnes actives : ${campaigns.filter(c => c.status === "ACTIVE").length}`,
    "",
    "DÉTAIL PAR CAMPAGNE :",
    ...campaigns.map(c => {
      const spend   = Number(c.spend);
      const revenue = Number(c.revenue);
      const cRoi = spend > 0 ? ((revenue - spend) / spend * 100).toFixed(1) : "0";
      const ctr  = c.impressions > 0 ? (c.clicks / c.impressions * 100).toFixed(2) : "0";
      return `• ${c.name} [${c.network}] [${c.status}] — $${spend.toFixed(2)} dép | $${revenue.toFixed(2)} rev | ROI: ${cRoi}% | CTR: ${ctr}%`;
    }),
    "",
    "Réponds en français, de façon concise et actionnable.",
  ].join("\n");

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      const stream = client.messages.stream({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system:     systemPrompt,
        messages,
      });

      stream.on("text", (text: string) => {
        writer.write(encoder.encode(text));
      });

      await stream.finalMessage();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writer.write(encoder.encode(`⚠ ${msg}`));
    } finally {
      writer.close();
    }
  })();

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
