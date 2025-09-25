export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { supaServer } from "@/lib/supabaseServer";
import { createRequestLogger, getRequestIdFrom } from "@/lib/requestLogger";

const UpdateGoalBody = z.object({
  text: z.string().min(1).max(100).optional(),
  completed: z.boolean().optional()
});

// PUT: Update practice goal
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const sb = supaServer();
    const body = UpdateGoalBody.parse(await req.json());

    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const updateData: any = {};
    if (body.text !== undefined) updateData.text = body.text;
    if (body.completed !== undefined) updateData.completed = body.completed;

    const { data, error } = await sb
      .from("practice_goals")
      .update(updateData)
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    return NextResponse.json({ goal: data });
  } catch (e) {
    const reqLogger = createRequestLogger({ requestId: getRequestIdFrom(req) });
    reqLogger.error("api_practice_goals_id_put_failed", { error: (e as Error)?.message, stack: (e as Error)?.stack });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// DELETE: Delete practice goal
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const sb = supaServer();

    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data, error } = await sb
      .from("practice_goals")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    return NextResponse.json({ goal: data });
  } catch (e) {
    const reqLogger = createRequestLogger({ requestId: getRequestIdFrom(req) });
    reqLogger.error("api_practice_goals_id_delete_failed", { error: (e as Error)?.message, stack: (e as Error)?.stack });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
