export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supaServer } from "@/lib/supabaseServer";
import { getAIService, OverarchingGoal } from "@/lib/aiService";

// GET: Generate daily tip based on user's goal and recent practice
export async function GET() {
  try {
    const sb = supaServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
        console.log("[api/daily-tip] Generating AI tip...");
        const aiService = getAIService();
        dailyTip = await aiService.generateDailyTip(overarchingGoal, recentPractice || []);
        console.log("[api/daily-tip] AI tip generated successfully");
      } catch (aiError) {
        console.error("[api/daily-tip] AI generation failed:", aiError);
        // Fallback to generic tip
        dailyTip = generateFallbackTip(overarchingGoal);
      }
    } else {
      dailyTip = generateFallbackTip(overarchingGoal);
    }

    return NextResponse.json({ 
      tip: dailyTip,
      goal: overarchingGoal
    });

  } catch (e) {
    console.error("[api/daily-tip] GET failed", e);
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
