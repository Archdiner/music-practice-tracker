export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { supaServer } from "@/lib/supabaseServer";

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
    console.error("[api/goal] GET failed", e);
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

    console.log(`[api/goal] Updating daily target for user ${user.id} to ${body.dailyTarget}`);

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
      console.error("[api/goal] Database error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log("[api/goal] Successfully updated daily target:", data);
    return NextResponse.json({ ok: true, dailyTarget: body.dailyTarget });
  } catch (e) {
    console.error("[api/goal] PUT failed", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
