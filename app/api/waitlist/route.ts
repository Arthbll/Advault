import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const WAITLIST_FILE = path.join(process.cwd(), "waitlist.json");

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    // Read existing list (or start fresh)
    let list: { email: string; date: string }[] = [];
    try {
      const raw = await fs.readFile(WAITLIST_FILE, "utf-8");
      list = JSON.parse(raw);
    } catch {
      // File doesn't exist yet — that's fine
    }

    // Deduplicate
    const already = list.some((e) => e.email === normalized);
    if (!already) {
      list.push({ email: normalized, date: new Date().toISOString() });
      await fs.writeFile(WAITLIST_FILE, JSON.stringify(list, null, 2), "utf-8");
    }

    return NextResponse.json({ ok: true, already });
  } catch (err) {
    console.error("[waitlist]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET() {
  // Simple read endpoint (protect in prod!)
  try {
    const raw = await fs.readFile(WAITLIST_FILE, "utf-8");
    const list = JSON.parse(raw);
    return NextResponse.json({ count: list.length, entries: list });
  } catch {
    return NextResponse.json({ count: 0, entries: [] });
  }
}
