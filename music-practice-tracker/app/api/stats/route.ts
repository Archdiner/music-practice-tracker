export const runtime = "nodejs";
export const dynamic = "force-dynamic";
console.log("[api/stats] route module loaded");

import { NextResponse } from "next/server";
import { supaServer } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const sb = supaServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data: prof } = await sb.from("profiles").select("daily_target").eq("id", user.id).maybeSingle();
    const target = prof?.daily_target ?? 20;

    const since = new Date(Date.now()-60*24*3600e3).toISOString().slice(0,10);
    const { data: rows } = await sb
      .from("practice_logs")
      .select("logged_at,total_minutes,activities")
      .eq("user_id", user.id)
      .gte("logged_at", since);

    const byDate = new Map((rows ?? []).map(r=>[r.logged_at, r.total_minutes]));
    const d = new Date(); let streak = 0;
    for (;;) {
      const key = d.toISOString().slice(0,10);
      const mins = byDate.get(key) ?? 0;
      if (mins >= target) { streak++; d.setDate(d.getDate()-1); } else break;
    }

    const today = new Date();
    const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay()+6)%7));
    const weekKey = monday.toISOString().slice(0,10);
    const weekLogs = (rows ?? []).filter(r => r.logged_at >= weekKey);
    const weekTotal = weekLogs.reduce((s,r)=>s+r.total_minutes,0);
    const categoryBreakdown = weekLogs.flatMap((r: { activities: { category: string; minutes: number }[] })=>r.activities)
      .reduce((acc: Record<string, number>, a: { category: string; minutes: number })=>((acc[a.category]=(acc[a.category]||0)+a.minutes),acc),{} as Record<string, number>);

    const todayKey = new Date().toISOString().slice(0,10);
    const todayMinutes = byDate.get(todayKey) ?? 0;

    return NextResponse.json({ target, streakDays: streak, weekTotal, todayMinutes, categoryBreakdown });
  } catch (e) {
    console.error("[api/stats] GET failed", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
