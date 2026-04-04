import { NextResponse }  from "next/server";
import { createClient }  from "@/lib/supabase/server";
import { prisma }        from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.account.findMany({ where: { userId: user.id } });
  const userRow  = await prisma.user.findUnique({ where: { id: user.id } });

  return NextResponse.json({
    supabaseUserId: user.id,
    supabaseEmail:  user.email,
    userRowInDB:    !!userRow,
    accounts: accounts.map(a => ({
      id:        a.id,
      network:   a.network,
      isActive:  a.isActive,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
  });
}
