export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { supaServer } from "@/lib/supabaseServer";
import { getAIService, WeeklyData, WeeklyInsights } from "@/lib/aiService";

const GenerateInsightsBody = z.object({
  weekStartDate: z.string().optional(), // YYYY-MM-DD format, defaults to current week
  forceRegenerate: z.boolean().optional().default(false),
  autoGenerate: z.boolean().optional().default(false) // For automatic generation
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

// Helper function to check if a week has ended
function hasWeekEnded(weekEnd: string): boolean {
  const today = new Date();
  const weekEndDate = new Date(weekEnd);
  return today > weekEndDate;
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
      // Specific week requested
      targetDate = new Date(weekStartDate);
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
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error("[api/weekly-insights] GET failed", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Check if we should auto-generate insights for a completed week
    let needsAutoGeneration = false;
    if (checkAutoGenerate && !existingInsights && hasWeekEnded(weekEnd)) {
      needsAutoGeneration = true;
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

    // Get target week boundaries
    const targetDate = body.weekStartDate ? new Date(body.weekStartDate) : new Date();
    const { weekStart, weekEnd } = getWeekBoundaries(targetDate);

    console.log(`[api/weekly-insights] Generating insights for week ${weekStart} to ${weekEnd}`);

    // Check if insights already exist - NO REGENERATION ALLOWED for final insights
    const { data: existing } = await sb
      .from("weekly_insights")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .single();

    if (existing) {
      // If insights are marked as final, never allow regeneration
      // Check if is_final column exists and is true
      if (existing.is_final === true) {
        return NextResponse.json({ 
          insights: existing,
          generated: false,
          message: "Final insights for this week cannot be regenerated",
          isFinal: true
        });
      }
      
      // Only allow regeneration if not final and explicitly requested
      if (!body.forceRegenerate) {
        return NextResponse.json({ 
          insights: existing,
          generated: false,
          message: "Insights already exist for this week"
        });
      }
    }

    // For auto-generation, only generate for completed weeks
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

    // Get practice data for the target week (back to original working query)
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
    
    // Handle case where there's no practice data for the week
    if (totalMinutes === 0 && daysPracticed === 0) {
      return NextResponse.json({
        insights: null,
        generated: false,
        message: "No practice data found for this week. Start practicing to generate insights!",
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
        console.log(`[api/weekly-insights] Generating AI insights for week with ${daysPracticed} days practiced and ${totalMinutes} minutes...`);
        const aiService = getAIService();
        aiInsights = await aiService.generateWeeklyInsights(weekData);
        console.log("[api/weekly-insights] AI insights generated successfully");
      } catch (aiError) {
        console.error("[api/weekly-insights] AI generation failed:", aiError);
        // Continue without AI insights rather than failing completely
      }
    } else if (totalMinutes > 0) {
      // Generate basic insights even without AI
      console.log(`[api/weekly-insights] Generating basic insights for week with ${daysPracticed} days practiced and ${totalMinutes} minutes (no AI available)`);
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
      console.error("[api/weekly-insights] Insert error:", insertError);
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
    console.error("[api/weekly-insights] POST failed", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
