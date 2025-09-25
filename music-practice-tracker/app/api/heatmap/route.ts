export const runtime = "nodejs";
export const dynamic = "force-dynamic";
console.log("[api/heatmap] route module loaded");

import { NextResponse } from "next/server";
import { supaServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const sb = supaServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? new Date(Date.now()-365*24*3600e3).toISOString().slice(0,10);

    const { data, error } = await sb
      .from("practice_logs")
      .select("logged_at,total_minutes")
      .eq("user_id", user.id)
      .gte("logged_at", from)
      .order("logged_at", { ascending: false })
      .limit(500);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const map: Record<string, number> = {};
    (data ?? []).forEach(r => { map[r.logged_at] = (map[r.logged_at] ?? 0) + r.total_minutes; });
    return NextResponse.json(map);
  } catch (e) {
    console.error("[api/heatmap] GET failed", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
