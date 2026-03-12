import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function GET() {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 32,
      messages: [{ role: "user", content: "Dis juste: OK" }],
    });
    return NextResponse.json({ ok: true, reply: msg.content });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
