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

    // Get ALL practice data (no time limit for streak calculation)
    const { data: rows } = await sb
      .from("practice_logs")
      .select("logged_at,total_minutes,activities")
      .eq("user_id", user.id);

    // Properly aggregate multiple entries per day
    const byDate = new Map<string, number>();
    (rows ?? []).forEach(r => {
      const existing = byDate.get(r.logged_at) ?? 0;
      byDate.set(r.logged_at, existing + r.total_minutes);
    });

    // Calculate consecutive days with ANY practice data (not just target met)
    const today = new Date();
    let streak = 0;
    let currentDate = new Date(today);
    
    console.log(`[api/stats] Calculating streak from today: ${today.toISOString().slice(0,10)}`);
    console.log(`[api/stats] Available practice dates:`, Array.from(byDate.keys()).sort());
    
    // Start from today and work backwards
    for (let i = 0; i < 365; i++) { // Safety limit to prevent infinite loops
      const key = currentDate.toISOString().slice(0,10);
      const mins = byDate.get(key) ?? 0;
      
      console.log(`[api/stats] Checking date ${key}: ${mins} minutes`);
      
      // If there's any practice data for this day, continue the streak
      if (mins > 0) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        // No practice data for this day, streak ends
        console.log(`[api/stats] No practice data for ${key}, streak ends at ${streak} days`);
        break;
      }
    }
    
    console.log(`[api/stats] Final streak: ${streak} days`);

    // Calculate week stats
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
