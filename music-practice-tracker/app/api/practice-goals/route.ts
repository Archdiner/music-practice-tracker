export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { supaServer } from "@/lib/supabaseServer";

const CreateGoalBody = z.object({
  text: z.string().min(1).max(100)
});

const UpdateGoalBody = z.object({
  text: z.string().min(1).max(100).optional(),
  completed: z.boolean().optional()
});

// GET: Retrieve user's practice goals
export async function GET() {
  try {
    const sb = supaServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data: goals, error } = await sb
      .from("practice_goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ goals: goals || [] });
  } catch (e) {
    console.error("[api/practice-goals] GET failed", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// POST: Create new practice goal
export async function POST(req: Request) {
  try {
    const sb = supaServer();
    const body = CreateGoalBody.parse(await req.json());

    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data, error } = await sb
      .from("practice_goals")
      .insert({
        user_id: user.id,
        text: body.text,
        completed: false
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ goal: data });
  } catch (e) {
    console.error("[api/practice-goals] POST failed", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
