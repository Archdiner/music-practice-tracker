import logger from "@/lib/logger";
import { createRequestLogger, getRequestIdFrom } from "@/lib/requestLogger";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { supaServer } from "@/lib/supabaseServer";

const CreateGoalBody = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(0).max(600).optional(),
  goal_type: z.enum(["piece", "exam", "technique", "performance", "general"]),
  difficulty_level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  target_date: z.string().optional() // ISO date string
});

const UpdateGoalBody = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(0).max(600).optional(),
  goal_type: z.enum(["piece", "exam", "technique", "performance", "general"]).optional(),
  difficulty_level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  target_date: z.string().optional(),
  status: z.enum(["active", "completed", "paused"]).optional()
});

// GET: Retrieve user's current overarching goal
export async function GET() {
  try {
    const sb = supaServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data: goal, error } = await sb
      .from("overarching_goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      const reqLogger = createRequestLogger();
      reqLogger.warn("api_overarching_goals_get_query_error", { message: error.message });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ goal: goal || null });
  } catch (e) {
    const reqLogger = createRequestLogger();
    reqLogger.error("api_overarching_goals_get_failed", { error: (e as Error)?.message, stack: (e as Error)?.stack });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// POST: Create new overarching goal
export async function POST(req: Request) {
  try {
    const sb = supaServer();
    const body = CreateGoalBody.parse(await req.json());

    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // First, check if user already has an active goal
    const { data: existingGoal } = await sb
      .from("overarching_goals")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (existingGoal) {
      return NextResponse.json({ 
        error: "You already have an active goal. Complete or pause it first." 
      }, { status: 400 });
    }

    const { data: newGoal, error } = await sb
      .from("overarching_goals")
      .insert({
        user_id: user.id,
        title: body.title,
        description: body.description,
        goal_type: body.goal_type,
        difficulty_level: body.difficulty_level,
        target_date: body.target_date,
        status: "active"
      })
      .select()
      .single();

    if (error) {
      const reqLogger = createRequestLogger();
      reqLogger.warn("api_overarching_goals_post_query_error", { message: error.message });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ goal: newGoal });
  } catch (e) {
    const reqLogger = createRequestLogger();
    reqLogger.error("api_overarching_goals_post_failed", { error: (e as Error)?.message, stack: (e as Error)?.stack });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// PUT: Update existing overarching goal
export async function PUT(req: Request) {
  try {
    const sb = supaServer();
    const body = UpdateGoalBody.parse(await req.json());

    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data: updatedGoal, error } = await sb
      .from("overarching_goals")
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id)
      .eq("status", "active")
      .select()
      .single();

    if (error) {
      const reqLogger = createRequestLogger();
      reqLogger.warn("api_overarching_goals_put_query_error", { message: error.message });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!updatedGoal) {
      return NextResponse.json({ error: "No active goal found to update" }, { status: 404 });
    }

    return NextResponse.json({ goal: updatedGoal });
  } catch (e) {
    const reqLogger = createRequestLogger();
    reqLogger.error("api_overarching_goals_put_failed", { error: (e as Error)?.message, stack: (e as Error)?.stack });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// DELETE: Remove/pause overarching goal
export async function DELETE() {
  try {
    const sb = supaServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data: pausedGoal, error } = await sb
      .from("overarching_goals")
      .update({ 
        status: "paused",
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id)
      .eq("status", "active")
      .select()
      .single();

    if (error) {
      const reqLogger = createRequestLogger();
      reqLogger.warn("api_overarching_goals_delete_query_error", { message: error.message });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!pausedGoal) {
      return NextResponse.json({ error: "No active goal found to pause" }, { status: 404 });
    }

    return NextResponse.json({ goal: pausedGoal });
  } catch (e) {
    const reqLogger = createRequestLogger();
    reqLogger.error("api_overarching_goals_delete_failed", { error: (e as Error)?.message, stack: (e as Error)?.stack });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
