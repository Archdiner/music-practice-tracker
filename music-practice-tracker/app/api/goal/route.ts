export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { supaServer } from "@/lib/supabaseServer";
import logger from "@/lib/logger";
import { createRequestLogger, getRequestIdFrom } from "@/lib/requestLogger";

const UpdateGoalBody = z.object({
  dailyTarget: z.number().min(1).max(480) // 1 minute to 8 hours
});

// GET: Retrieve current daily goal
export async function GET() {
  try {
    const sb = supaServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data: prof } = await sb.from("profiles").select("daily_target").eq("id", user.id).maybeSingle();
    const target = prof?.daily_target ?? 20;

    return NextResponse.json({ dailyTarget: target });
  } catch (e) {
    const reqLogger = createRequestLogger();
    reqLogger.error("api_goal_get_failed", { error: (e as Error)?.message, stack: (e as Error)?.stack });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// PUT: Update daily goal
export async function PUT(req: Request) {
  try {
    const sb = supaServer();
    const body = UpdateGoalBody.parse(await req.json());

    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const reqLogger = createRequestLogger({ userId: user.id, requestId: getRequestIdFrom(req) });
    reqLogger.info("api_goal_update_daily_target", { dailyTarget: body.dailyTarget });

    // First check if profile exists
    const { data: existingProfile } = await sb
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    let result;
    if (existingProfile) {
      // Update existing profile
      result = await sb
        .from("profiles")
        .update({ daily_target: body.dailyTarget })
        .eq("id", user.id)
        .select()
        .single();
    } else {
      // Create new profile
      result = await sb
        .from("profiles")
        .insert({
          id: user.id,
          daily_target: body.dailyTarget
        })
        .select()
        .single();
    }

    const { data, error } = result;

    if (error) {
      reqLogger.warn("api_goal_db_error", { message: error.message });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    reqLogger.info("api_goal_update_success");
    return NextResponse.json({ ok: true, dailyTarget: body.dailyTarget });
  } catch (e) {
    const reqLogger = createRequestLogger({ requestId: getRequestIdFrom(req) });
    reqLogger.error("api_goal_put_failed", { error: (e as Error)?.message, stack: (e as Error)?.stack });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
