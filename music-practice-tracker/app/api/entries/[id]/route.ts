export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { supaServer } from "@/lib/supabaseServer";
import { getAIService, parseHeuristic } from "@/lib/aiService";

const UpdateBody = z.object({
  rawText: z.string().min(1),
  date: z.string().optional(),
  useAI: z.boolean().optional().default(true) // Allow disabling AI for testing
});

// GET: Retrieve a specific entry by ID
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const sb = supaServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data: entry, error } = await sb
      .from("practice_logs")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id) // Ensure user can only access their own entries
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    return NextResponse.json({ entry });
  } catch (e) {
    console.error("[api/entries/id] GET failed", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// PUT: Update an existing entry
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const sb = supaServer();
    const body = UpdateBody.parse(await req.json());

    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let parsed;
    let parsingMethod = "heuristic";

    // Get user's overarching goal for context
    const { data: overarchingGoal } = await sb
      .from("overarching_goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    // Try AI parsing first if enabled
    if (body.useAI && process.env.OPENAI_API_KEY) {
      try {
        console.log(`[api/entries/id] Attempting AI parsing for: "${body.rawText}"`);
        const aiService = getAIService();
        parsed = await aiService.parseEntry(body.rawText, overarchingGoal || undefined);
        parsingMethod = "ai";
        console.log(`[api/entries/id] AI parsing successful:`, parsed);
      } catch (aiError) {
        console.log(`[api/entries/id] AI parsing failed, falling back to heuristic:`, aiError);
        parsed = parseHeuristic(body.rawText);
      }
    } else {
      console.log(`[api/entries/id] Using heuristic parsing (AI disabled or no API key)`);
      parsed = parseHeuristic(body.rawText);
    }

    const { data, error } = await sb
      .from("practice_logs")
      .update({
        raw_text: body.rawText,
        total_minutes: parsed.total_minutes,
        activities: parsed.activities,
        logged_at: body.date ?? undefined // Only update date if provided
      })
      .eq("id", params.id)
      .eq("user_id", user.id) // Ensure user can only update their own entries
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Entry not found or access denied" }, { status: 404 });

    return NextResponse.json({ 
      ok: true, 
      entry: data,
      parsing_method: parsingMethod,
      parsed_data: parsed 
    });
  } catch (e) {
    console.error("[api/entries/id] PUT failed", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// DELETE: Delete a specific activity from a day's entry
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const sb = supaServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const activityIndex = url.searchParams.get("activityIndex");
    
    if (activityIndex === null) {
      return NextResponse.json({ error: "activityIndex parameter required" }, { status: 400 });
    }

    const actIndex = parseInt(activityIndex, 10);
    if (isNaN(actIndex) || actIndex < 0) {
      return NextResponse.json({ error: "Invalid activityIndex" }, { status: 400 });
    }

    // First, get the current entry
    const { data: currentEntry, error: fetchError } = await sb
      .from("practice_logs")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !currentEntry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // Remove the specific activity
    const activities = [...(currentEntry.activities || [])];
    
    if (actIndex >= activities.length) {
      return NextResponse.json({ error: "Activity index out of range" }, { status: 400 });
    }

    const deletedActivity = activities.splice(actIndex, 1)[0];
    
    // Recalculate total minutes
    const newTotalMinutes = activities.reduce((sum, act) => sum + (act.minutes || 0), 0);

    // If no activities left, delete the entire row
    if (activities.length === 0) {
      const { data, error } = await sb
        .from("practice_logs")
        .delete()
        .eq("id", params.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, deletedEntry: true, deletedActivity });
    }

    // Update the entry with remaining activities
    const { data, error } = await sb
      .from("practice_logs")
      .update({
        activities,
        total_minutes: newTotalMinutes
      })
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, entry: data, deletedActivity });
  } catch (e) {
    console.error("[api/entries/id] DELETE failed", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
