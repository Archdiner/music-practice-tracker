export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { supaServer } from "@/lib/supabaseServer";
import { getAIService, WeeklyData, WeeklyInsights } from "@/lib/aiService";

const GenerateInsightsBody = z.object({
  weekStartDate: z.string().optional(), // YYYY-MM-DD format, defaults to current week
  forceRegenerate: z.boolean().optional().default(false)
});

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

// GET: Retrieve existing weekly insights
export async function GET(req: Request) {
  try {
    const sb = supaServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const weekStartDate = url.searchParams.get("weekStartDate");
    
    let targetDate = weekStartDate ? new Date(weekStartDate) : new Date();
    const { weekStart } = getWeekBoundaries(targetDate);

    // Get existing insights for this week
    const { data: existingInsights, error } = await sb
      .from("weekly_insights")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error("[api/weekly-insights] GET failed", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      insights: existingInsights || null,
      weekStart,
      weekEnd: getWeekBoundaries(targetDate).weekEnd
    });

  } catch (e) {
    console.error("[api/weekly-insights] GET failed", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// POST: Generate new weekly insights
export async function POST(req: Request) {
  try {
    const sb = supaServer();
    const body = GenerateInsightsBody.parse(await req.json());

    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // Get target week boundaries
    const targetDate = body.weekStartDate ? new Date(body.weekStartDate) : new Date();
    const { weekStart, weekEnd } = getWeekBoundaries(targetDate);

    console.log(`[api/weekly-insights] Generating insights for week ${weekStart} to ${weekEnd}`);

    // Check if insights already exist and don't force regenerate
    if (!body.forceRegenerate) {
      const { data: existing } = await sb
        .from("weekly_insights")
        .select("*")
        .eq("user_id", user.id)
        .eq("week_start", weekStart)
        .single();

      if (existing) {
        return NextResponse.json({ 
          insights: existing,
          generated: false,
          message: "Insights already exist for this week"
        });
      }
    }

    // Get user's daily target and overarching goal
    const { data: profile } = await sb
      .from("profiles")
      .select("daily_target")
      .eq("id", user.id)
      .single();
    
    const dailyTarget = profile?.daily_target || 20;

    // Get user's current overarching goal
    const { data: overarchingGoal } = await sb
      .from("overarching_goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    // Get practice data for the target week
    const { data: weekLogs, error: logsError } = await sb
      .from("practice_logs")
      .select("logged_at, total_minutes, activities")
      .eq("user_id", user.id)
      .gte("logged_at", weekStart)
      .lte("logged_at", weekEnd)
      .order("logged_at", { ascending: true });

    if (logsError) {
      console.error("[api/weekly-insights] Error fetching week logs:", logsError);
      return NextResponse.json({ error: logsError.message }, { status: 400 });
    }

    // Get previous week data for comparison
    const prevWeekStart = new Date(targetDate);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const { weekStart: prevWeekStartStr, weekEnd: prevWeekEndStr } = getWeekBoundaries(prevWeekStart);

    const { data: prevWeekLogs } = await sb
      .from("practice_logs")
      .select("total_minutes")
      .eq("user_id", user.id)
      .gte("logged_at", prevWeekStartStr)
      .lte("logged_at", prevWeekEndStr);

    // Calculate week statistics
    const totalMinutes = (weekLogs || []).reduce((sum, log) => sum + log.total_minutes, 0);
    const daysPracticed = new Set((weekLogs || []).map(log => log.logged_at)).size;
    
    // Calculate days hit goal
    const dailyTotals = new Map<string, number>();
    (weekLogs || []).forEach(log => {
      const existing = dailyTotals.get(log.logged_at) || 0;
      dailyTotals.set(log.logged_at, existing + log.total_minutes);
    });
    const daysHitGoal = Array.from(dailyTotals.values()).filter(mins => mins >= dailyTarget).length;

    // Calculate category breakdown
    const categoryMinutes: Record<string, number> = {};
    const allActivities: Array<{category: string, sub: string, minutes: number}> = [];
    
    (weekLogs || []).forEach(log => {
      (log.activities || []).forEach((activity: any) => {
        categoryMinutes[activity.category] = (categoryMinutes[activity.category] || 0) + activity.minutes;
        allActivities.push({
          category: activity.category,
          sub: activity.sub,
          minutes: activity.minutes
        });
      });
    });

    // Calculate category percentages
    const categoryPercentages: Record<string, number> = {};
    Object.entries(categoryMinutes).forEach(([cat, mins]) => {
      categoryPercentages[cat] = totalMinutes > 0 ? Math.round((mins / totalMinutes) * 100) : 0;
    });

    // Previous week total
    const previousWeekMinutes = (prevWeekLogs || []).reduce((sum, log) => sum + log.total_minutes, 0);
    const minutesChangePercent = previousWeekMinutes > 0 
      ? Math.round(((totalMinutes - previousWeekMinutes) / previousWeekMinutes) * 100)
      : null;

    // Prepare data for AI
    const weekData: WeeklyData = {
      totalMinutes,
      daysPracticed,
      daysHitGoal,
      dailyTarget,
      previousWeekMinutes: previousWeekMinutes || undefined,
      categoryMinutes,
      activities: allActivities,
      overarchingGoal: overarchingGoal || undefined
    };

    // Generate AI insights (only if there's practice data)
    let aiInsights: WeeklyInsights | null = null;
    if (totalMinutes > 0 && process.env.OPENAI_API_KEY) {
      try {
        console.log("[api/weekly-insights] Generating AI insights...");
        const aiService = getAIService();
        aiInsights = await aiService.generateWeeklyInsights(weekData);
        console.log("[api/weekly-insights] AI insights generated successfully");
      } catch (aiError) {
        console.error("[api/weekly-insights] AI generation failed:", aiError);
        // Continue without AI insights rather than failing completely
      }
    }

    // Store in database - match your existing schema
    const insertData = {
      user_id: user.id,
      week_start: weekStart,
      summary: aiInsights?.summary || null,
      suggestions: aiInsights?.recommendations || [],
      metrics: {
        total_minutes: totalMinutes,
        days_practiced: daysPracticed,
        days_hit_goal: daysHitGoal,
        daily_target: dailyTarget,
        category_minutes: categoryMinutes,
        category_percentages: categoryPercentages,
        previous_week_minutes: previousWeekMinutes || null,
        minutes_change_percent: minutesChangePercent,
        key_insights: aiInsights?.insights || []
      }
    };

    const { data: savedInsights, error: insertError } = await sb
      .from("weekly_insights")
      .upsert(insertData, { 
        onConflict: 'user_id,week_start',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (insertError) {
      console.error("[api/weekly-insights] Insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({
      insights: savedInsights,
      generated: true,
      hasAI: !!aiInsights,
      weekData: {
        totalMinutes,
        daysPracticed,
        daysHitGoal,
        dailyTarget
      }
    });

  } catch (e) {
    console.error("[api/weekly-insights] POST failed", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
