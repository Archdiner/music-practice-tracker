export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supaServer } from "@/lib/supabaseServer";
import logger from "@/lib/logger";
import { createRequestLogger, getRequestIdFrom } from "@/lib/requestLogger";

// Helper function to get week boundaries (Monday to Sunday)
function formatLocalYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeekBoundaries(date: Date): { weekStart: string; weekEnd: string } {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay();
  const diff = d.getDate() - dow + (dow === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { weekStart: formatLocalYYYYMMDD(monday), weekEnd: formatLocalYYYYMMDD(sunday) };
}

// Helper function to check if a week has ended
function hasWeekEnded(weekEnd: string): boolean {
  const [y, m, d] = weekEnd.split('-').map(Number);
  const end = new Date(y, (m as number) - 1, d as number, 23, 59, 59, 999);
  const now = new Date();
  return now.getTime() > end.getTime();
}

// POST: Auto-generate insights for completed weeks
export async function POST(req: Request) {
  try {
    const sb = supaServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const reqLogger = createRequestLogger({ userId: user.id, requestId: getRequestIdFrom(req) });

    const today = new Date();
    const currentWeek = getWeekBoundaries(today);
    
    // Check if current week has ended
    if (!hasWeekEnded(currentWeek.weekEnd)) {
      return NextResponse.json({ 
        message: "Current week has not ended yet",
        shouldGenerate: false 
      });
    }

    // Check if insights already exist for this week
    const { data: existingInsights } = await sb
      .from("weekly_insights")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", currentWeek.weekStart)
      .single();

    if (existingInsights) {
      return NextResponse.json({ 
        message: "Insights already exist for this week",
        shouldGenerate: false,
        existing: true
      });
    }

    // Trigger generation by calling the main insights endpoint
    const generateResponse = await fetch(`${req.url.replace('/auto-generate', '')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        autoGenerate: true,
        weekStartDate: currentWeek.weekStart
      })
    });

    if (!generateResponse.ok) {
      const errorData = await generateResponse.json();
      reqLogger.warn("api_weekly_auto_generate_failed_subcall", { status: generateResponse.status, error: errorData.error });
      throw new Error(errorData.error || 'Failed to generate insights');
    }

    const result = await generateResponse.json();
    
    return NextResponse.json({
      message: "Insights generated automatically",
      shouldGenerate: true,
      generated: true,
      insights: result.insights
    });

  } catch (e) {
    const reqId = getRequestIdFrom(req);
    const reqLogger = createRequestLogger({ requestId: reqId });
    reqLogger.error("api_weekly_auto_generate_post_failed", { error: (e as Error)?.message, stack: (e as Error)?.stack });
    return NextResponse.json({ 
      error: "internal",
      message: e instanceof Error ? e.message : "Internal server error"
    }, { status: 500 });
  }
}

// GET: Check if auto-generation is needed
export async function GET(req: Request) {
  try {
    const sb = supaServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const reqLogger = createRequestLogger({ userId: user.id, requestId: getRequestIdFrom(req) });

    const today = new Date();
    const currentWeek = getWeekBoundaries(today);
    
    // Check if current week has ended
    const weekHasEnded = hasWeekEnded(currentWeek.weekEnd);
    
    if (!weekHasEnded) {
      return NextResponse.json({ 
        needsAutoGeneration: false,
        message: "Current week has not ended yet",
        weekEnd: currentWeek.weekEnd
      });
    }

    // Check if insights already exist
    const { data: existingInsights } = await sb
      .from("weekly_insights")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", currentWeek.weekStart)
      .single();

    return NextResponse.json({
      needsAutoGeneration: !existingInsights,
      weekHasEnded,
      weekStart: currentWeek.weekStart,
      weekEnd: currentWeek.weekEnd,
      hasExistingInsights: !!existingInsights
    });

  } catch (e) {
    const reqId = getRequestIdFrom(req);
    const reqLogger = createRequestLogger({ requestId: reqId });
    reqLogger.error("api_weekly_auto_generate_get_failed", { error: (e as Error)?.message, stack: (e as Error)?.stack });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
