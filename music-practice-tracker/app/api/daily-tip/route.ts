import logger from "@/lib/logger";
import { createRequestLogger, getRequestIdFrom } from "@/lib/requestLogger";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { supaServer } from "@/lib/supabaseServer";
import { getAIService, OverarchingGoal } from "@/lib/aiService";
import { RateLimitError, QuotaExceededError } from "@/lib/aiUsage";

const RegenerateTipBody = z.object({
  forceRegenerate: z.boolean().optional().default(false)
});

// GET: Get cached daily tip or generate new one if needed
export async function GET(req: Request) {
  try {
    const sb = supaServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const forceRegenerate = url.searchParams.get("forceRegenerate") === "true";
    const today = new Date().toISOString().split('T')[0];

    // Check if we have a cached tip in user profile (unless forcing regeneration)
    if (!forceRegenerate) {
      const { data: profile } = await sb
        .from("profiles")
        .select("last_tip_date, last_tip_text, last_tip_goal_title")
        .eq("id", user.id)
        .single();

      if (profile?.last_tip_date === today && profile?.last_tip_text) {
        const reqLogger = createRequestLogger({ requestId: getRequestIdFrom(req) });
        reqLogger.info("api_daily_tip_returning_cached");
        return NextResponse.json({
          tip: profile.last_tip_text,
          cached: true,
          goal_title: profile.last_tip_goal_title,
          generated_at: profile.last_tip_date
        });
      }
    }

    // No cached tip, need to generate new one
    const reqLogger = createRequestLogger({ requestId: getRequestIdFrom(req) });
    reqLogger.info("api_daily_tip_generating_new");

    // Get user's current overarching goal
    const { data: overarchingGoal } = await sb
      .from("overarching_goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!overarchingGoal) {
      return NextResponse.json({ 
        tip: null,
        cached: false,
        message: "No active goal set. Set a goal to get personalized daily tips!"
      });
    }

    // Get recent practice data (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const { data: recentPractice } = await sb
      .from("practice_logs")
      .select("logged_at, total_minutes, activities, raw_text")
      .eq("user_id", user.id)
      .gte("logged_at", sevenDaysAgoStr)
      .order("logged_at", { ascending: false })
      .limit(10);

    // Generate AI tip if OpenAI is available
    let dailyTip = null;
    if (process.env.OPENAI_API_KEY) {
      try {
        const reqLogger = createRequestLogger({ requestId: getRequestIdFrom(req) });
        reqLogger.info("api_daily_tip_ai_generate_start");
        const aiService = getAIService();
        dailyTip = await aiService.generateDailyTip(user.id, overarchingGoal, recentPractice || []);
        reqLogger.info("api_daily_tip_ai_generate_success");
      } catch (aiError) {
        if (aiError instanceof RateLimitError || aiError instanceof QuotaExceededError) {
          return NextResponse.json({ error: aiError.message, code: aiError.name }, { status: 429 });
        }
        reqLogger.error("api_daily_tip_ai_generate_failed", { error: (aiError as Error)?.message });
        // Fallback to generic tip
        dailyTip = generateFallbackTip(overarchingGoal);
      }
    } else {
      dailyTip = generateFallbackTip(overarchingGoal);
    }

    // Cache the generated tip in user profile
    try {
      await sb
        .from("profiles")
        .upsert({
          id: user.id,
          last_tip_date: today,
          last_tip_text: dailyTip,
          last_tip_goal_title: overarchingGoal.title
        }, {
          onConflict: 'id'
        });
      const reqLogger2 = createRequestLogger({ requestId: getRequestIdFrom(req) });
      reqLogger2.info("api_daily_tip_cache_success");
    } catch (cacheError) {
      reqLogger2.error("api_daily_tip_cache_failed", { error: (cacheError as Error)?.message });
      // Continue anyway - caching failure shouldn't break the response
    }

    return NextResponse.json({ 
      tip: dailyTip,
      cached: false,
      goal_title: overarchingGoal.title,
      generated_at: new Date().toISOString()
    });

  } catch (e) {
    const reqLogger3 = createRequestLogger({ requestId: getRequestIdFrom(req) });
    reqLogger3.error("api_daily_tip_get_failed", { error: (e as Error)?.message, stack: (e as Error)?.stack });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// Fallback tip generation without AI
function generateFallbackTip(goal: OverarchingGoal): string {
  const tipsByType = {
    piece: `Today, focus on a specific section of "${goal.title}". Practice slowly and pay attention to fingering.`,
    exam: `Work on exam requirements today. Practice scales or sight-reading for your ${goal.title}.`,
    technique: `Dedicate 15 minutes to technical exercises related to ${goal.title}. Focus on accuracy over speed.`,
    performance: `Practice performing sections of your pieces today. Work on expression and confidence.`,
    general: `Set aside focused practice time today. Work on fundamentals that support your goal: ${goal.title}.`
  };

  return tipsByType[goal.goal_type] || tipsByType.general;
}
