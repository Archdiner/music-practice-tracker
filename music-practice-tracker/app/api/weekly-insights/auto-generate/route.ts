export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supaServer } from "@/lib/supabaseServer";

// Helper function to get week boundaries (Monday to Sunday)
function getWeekBoundaries(date: Date): { weekStart: string; weekEnd: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    weekStart: monday.toISOString().split('T')[0],
    weekEnd: sunday.toISOString().split('T')[0]
  };
}

// Helper function to check if a week has ended
function hasWeekEnded(weekEnd: string): boolean {
  const today = new Date();
  const weekEndDate = new Date(weekEnd);
  return today > weekEndDate;
}

// POST: Auto-generate insights for completed weeks
export async function POST(req: Request) {
  try {
    const sb = supaServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
    console.error("[api/weekly-insights/auto-generate] POST failed", e);
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
    console.error("[api/weekly-insights/auto-generate] GET failed", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
