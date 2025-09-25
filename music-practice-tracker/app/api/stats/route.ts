export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import logger from "@/lib/logger";
logger.debug("api_stats_route_loaded");

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

    // Get bounded practice data to avoid scanning entire history
    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - 400); // supports 365-day streak + buffer
    const fromKey = fromDate.toISOString().slice(0,10);

    const { data: rows } = await sb
      .from("practice_logs")
      .select("logged_at,total_minutes,activities")
      .eq("user_id", user.id)
      .gte("logged_at", fromKey)
      .order("logged_at", { ascending: false })
      .limit(1000);

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
    
    // Start from today and work backwards
    for (let i = 0; i < 365; i++) { // Safety limit to prevent infinite loops
      const key = currentDate.toISOString().slice(0,10);
      const mins = byDate.get(key) ?? 0;
      
      // If there's any practice data for this day, continue the streak
      if (mins > 0) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        // No practice data for this day, streak ends
        break;
      }
    }

    // Calculate week stats using historical goals
    const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay()+6)%7));
    const weekKey = monday.toISOString().slice(0,10);
    const weekLogs = (rows ?? []).filter(r => r.logged_at >= weekKey);
    const weekTotal = weekLogs.reduce((s,r)=>s+r.total_minutes,0);
    const categoryBreakdown = weekLogs.flatMap((r: { activities: { category: string; minutes: number }[] })=>r.activities)
      .reduce((acc: Record<string, number>, a: { category: string; minutes: number })=>((acc[a.category]=(acc[a.category]||0)+a.minutes),acc),{} as Record<string, number>);

    // Calculate week days hit goal (back to original simple approach)
    const weekDailyTotals = new Map<string, number>();
    weekLogs.forEach(log => {
      const existing = weekDailyTotals.get(log.logged_at) || 0;
      weekDailyTotals.set(log.logged_at, existing + log.total_minutes);
    });
    const weekDaysHitGoal = Array.from(weekDailyTotals.values()).filter(mins => mins >= target).length;

    const todayKey = new Date().toISOString().slice(0,10);
    const todayMinutes = byDate.get(todayKey) ?? 0;

    return NextResponse.json({ 
      target, 
      streakDays: streak, 
      weekTotal, 
      weekDaysHitGoal,
      todayMinutes, 
      categoryBreakdown 
    });
  } catch (e) {
    logger.error("api_stats_get_failed", { error: (e as Error)?.message, stack: (e as Error)?.stack });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
