export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import logger from "@/lib/logger";

import { NextResponse } from "next/server";
import { z } from "zod";
import { supaServer } from "@/lib/supabaseServer";
import { getAIService, WeeklyData, WeeklyInsights } from "@/lib/aiService";
import { RateLimitError, QuotaExceededError } from "@/lib/aiUsage";

const GenerateInsightsBody = z.object({
  weekStartDate: z.string().optional(), // YYYY-MM-DD format, defaults to current week
  forceRegenerate: z.boolean().optional().default(false),
  autoGenerate: z.boolean().optional().default(false) // For automatic generation
});

// Helper function to get week boundaries (Monday to Sunday)
function formatLocalYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeekBoundaries(date: Date): { weekStart: string; weekEnd: string } {
  // Work in local time, Monday-Sunday week
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay();
  const diff = d.getDate() - dow + (dow === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { weekStart: formatLocalYYYYMMDD(monday), weekEnd: formatLocalYYYYMMDD(sunday) };
}

// Helper function to check if a week has ended
function hasWeekEnded(weekEnd: string): boolean {
  // Treat week end as local Sunday 23:59:59
  const [y, m, d] = weekEnd.split('-').map(Number);
  const end = new Date(y, (m as number) - 1, d as number, 23, 59, 59, 999);
  const now = new Date();
  return now.getTime() > end.getTime();
}

// Helper function to get the most recent completed week
function getMostRecentCompletedWeek(): { weekStart: string; weekEnd: string } {
  const today = new Date();
  const currentWeek = getWeekBoundaries(today);
  
  // If current week hasn't ended, return previous week
  if (!hasWeekEnded(currentWeek.weekEnd)) {
    const prevWeek = new Date(today);
    prevWeek.setDate(prevWeek.getDate() - 7);
    return getWeekBoundaries(prevWeek);
  }
  
  // If current week has ended, return current week
  return currentWeek;
}

function getNextWeekStart(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number);
  const monday = new Date(y as number, (m as number) - 1, d as number);
  const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  return formatLocalYYYYMMDD(nextMonday);
}

// Generate basic insights when AI is not available or for minimal data
function generateBasicInsights(weekData: WeeklyData): WeeklyInsights {
  const { totalMinutes, daysPracticed, daysHitGoal, dailyTarget, categoryMinutes, previousWeekMinutes } = weekData;
  
  // Create basic summary
  let summary = `You practiced ${totalMinutes} minutes across ${daysPracticed} day${daysPracticed !== 1 ? 's' : ''} this week.`;
  
  if (daysHitGoal > 0) {
    summary += ` You hit your daily goal ${daysHitGoal} time${daysHitGoal !== 1 ? 's' : ''}.`;
  }
  
  if (previousWeekMinutes !== undefined) {
    const change = totalMinutes - previousWeekMinutes;
    if (change > 0) {
      summary += ` That's ${change} more minutes than last week!`;
    } else if (change < 0) {
      summary += ` That's ${Math.abs(change)} fewer minutes than last week.`;
    } else {
      summary += ` That's the same as last week.`;
    }
  }
  
  // Generate basic insights
  const insights = [];
  
  if (daysPracticed === 1) {
    insights.push({
      type: 'progress' as const,
      title: 'Getting Started',
      content: 'Great job starting your practice routine!',
      icon: 'trending-up' as const
    });
  } else if (daysPracticed >= 3) {
    insights.push({
      type: 'achievement' as const,
      title: 'Consistent Practice',
      content: `You practiced ${daysPracticed} days this week - excellent consistency!`,
      icon: 'award' as const
    });
  }
  
  if (daysHitGoal > 0) {
    insights.push({
      type: 'achievement' as const,
      title: 'Goal Achievement',
      content: `You hit your daily goal ${daysHitGoal} time${daysHitGoal !== 1 ? 's' : ''}!`,
      icon: 'target' as const
    });
  }
  
  // Add category insights
  const topCategory = Object.entries(categoryMinutes).reduce((a, b) => 
    categoryMinutes[a[0]] > categoryMinutes[b[0]] ? a : b, ['', 0]
  );
  
  if (topCategory[1] > 0) {
    insights.push({
      type: 'progress' as const,
      title: 'Focus Area',
      content: `You spent most time on ${topCategory[0]} (${Math.round(topCategory[1]/totalMinutes*100)}%)`,
      icon: 'trending-up' as const
    });
  }
  
  // Generate recommendations
  const recommendations = [];
  
  if (daysPracticed < 3) {
    recommendations.push('Try to practice at least 3 days per week for better progress');
  }
  
  if (daysHitGoal === 0 && daysPracticed > 0) {
    recommendations.push('Consider breaking your practice into smaller daily sessions');
  }
  
  if (Object.keys(categoryMinutes).length === 1) {
    recommendations.push('Try to diversify your practice across different areas');
  }
  
  return {
    summary,
    insights,
    recommendations
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
    const checkAutoGenerate = url.searchParams.get("checkAutoGenerate") === "true";
    
    let targetDate: Date;
    let weekStart: string;
    let weekEnd: string;
    
    if (weekStartDate) {
      // Specific week requested; parse as local date
      targetDate = new Date(`${weekStartDate}T00:00:00`);
      const boundaries = getWeekBoundaries(targetDate);
      weekStart = boundaries.weekStart;
      weekEnd = boundaries.weekEnd;
    } else {
      // Get most recent completed week
      const boundaries = getMostRecentCompletedWeek();
      weekStart = boundaries.weekStart;
      weekEnd = boundaries.weekEnd;
      targetDate = new Date(weekStart);
    }

    // Get existing insights for this week
    const { data: existingInsights, error } = await sb
      .from("weekly_insights")
      .select("week_start, created_at, summary, suggestions, metrics")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      logger.warn("api_weekly_insights_get_select_error", { code: error.code, message: error.message });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Determine if there is practice data in this week and whether regeneration is needed
    const { data: weekLogs } = await sb
      .from("practice_logs")
      .select("logged_at, total_minutes, updated_at")
      .eq("user_id", user.id)
      .gte("logged_at", weekStart)
      .lt("logged_at", getNextWeekStart(weekStart));

    const totalMinutes = (weekLogs || []).reduce((sum, log) => sum + (log.total_minutes || 0), 0);
    const hasPracticeData = totalMinutes > 0;

    let needsAutoGeneration = false;
    let needsRegeneration = false;
    let latestLogUpdateAt: string | null = null;
    if (weekLogs && weekLogs.length) {
      latestLogUpdateAt = weekLogs
        .map(log => (log as any).updated_at || (log as any).logged_at)
        .sort()
        .slice(-1)[0] || null;
    }

    if (!existingInsights) {
      if (checkAutoGenerate && hasWeekEnded(weekEnd)) {
        needsAutoGeneration = true;
      }
    } else if (latestLogUpdateAt && existingInsights.created_at && latestLogUpdateAt > existingInsights.created_at) {
      // Newer data than saved insights
      needsRegeneration = true;
    }

    // Get list of available weeks for navigation
    const { data: availableWeeks } = await sb
      .from("weekly_insights")
      .select("week_start")
      .eq("user_id", user.id)
      .order("week_start", { ascending: false })
      .limit(10);

    return NextResponse.json({ 
      insights: existingInsights || null,
      weekStart,
      weekEnd,
      needsAutoGeneration,
      needsRegeneration,
      hasPracticeData,
      availableWeeks: availableWeeks?.map(w => w.week_start) || [],
      isCurrentWeek: weekStart === getWeekBoundaries(new Date()).weekStart
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

    // Get target week boundaries (parse provided date as LOCAL midnight)
    const targetDate = body.weekStartDate ? new Date(`${body.weekStartDate}T00:00:00`) : new Date();
    const { weekStart, weekEnd } = getWeekBoundaries(targetDate);

    console.log(`[api/weekly-insights] Generating insights for week ${weekStart} to ${weekEnd}`);

    // Block manual generation for ongoing/current week. Allow only auto-generation after week ends.
    if (!hasWeekEnded(weekEnd) && !body.autoGenerate) {
      return NextResponse.json({
        insights: null,
        generated: false,
        message: "Weekly insights for the current week will be generated automatically when the week ends.",
        isCurrentWeek: true,
        hasPracticeData: undefined
      }, { status: 400 });
    }

    // Simplified: Allow generation/upsert for past weeks regardless of existing rows

    // Auto-generation still only for completed weeks
    if (body.autoGenerate && !hasWeekEnded(weekEnd)) {
      return NextResponse.json({
        insights: null,
        generated: false,
        message: "Cannot auto-generate insights for incomplete week"
      });
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

    // Get practice data for the target week (ensure full-week coverage)
    const { data: weekLogs, error: logsError } = await sb
      .from("practice_logs")
      .select("logged_at, total_minutes, activities")
      .eq("user_id", user.id)
      .gte("logged_at", weekStart)
      .lt("logged_at", getNextWeekStart(weekStart))
      .order("logged_at", { ascending: true });

    if (logsError) {
      logger.warn("api_weekly_insights_fetch_week_logs_error", { message: logsError.message });
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
    
    // If there is no practice at all in the week, do not generate insights
    if (totalMinutes === 0 && daysPracticed === 0) {
      return NextResponse.json({
        insights: null,
        generated: false,
        message: "No practice data found for this week.",
        hasPracticeData: false
      });
    }
    
    // Calculate days hit goal using HISTORICAL goal targets
    const dailyTotals = new Map<string, number>();
    (weekLogs || []).forEach(log => {
      const existing = dailyTotals.get(log.logged_at) || 0;
      dailyTotals.set(log.logged_at, existing + log.total_minutes);
    });

    // Calculate days hit goal (simplified - use current target for now)
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
        logger.info("api_weekly_insights_generate_ai_start", { daysPracticed, totalMinutes });
        const aiService = getAIService();
        aiInsights = await aiService.generateWeeklyInsights(user.id, weekData);
        console.log("[api/weekly-insights] AI insights generated successfully");
      } catch (aiError) {
        if (aiError instanceof RateLimitError || aiError instanceof QuotaExceededError) {
          return NextResponse.json({ error: aiError.message, code: aiError.name }, { status: 429 });
        }
        logger.error("api_weekly_insights_ai_generation_failed", { error: (aiError as Error)?.message });
        // Continue without AI insights rather than failing completely
      }
    } else if (totalMinutes > 0) {
      // Generate basic insights even without AI
      logger.info("api_weekly_insights_generate_basic", { daysPracticed, totalMinutes });
      aiInsights = generateBasicInsights(weekData);
    }

    // Store in database - use core schema that should exist
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
      logger.error("api_weekly_insights_upsert_error", { message: insertError.message });
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({
      insights: savedInsights,
      generated: true,
      hasAI: !!aiInsights,
      isAutoGenerated: body.autoGenerate,
      weekData: {
        totalMinutes,
        daysPracticed,
        daysHitGoal,
        dailyTarget
      }
    });

  } catch (e) {
    logger.error("api_weekly_insights_post_failed", { error: (e as Error)?.message, stack: (e as Error)?.stack });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
