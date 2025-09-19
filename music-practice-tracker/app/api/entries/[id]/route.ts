export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { supaServer } from "@/lib/supabaseServer";

const UpdateBody = z.object({
  rawText: z.string().min(1),
  date: z.string().optional()
});

function parseHeuristic(raw: string) {
  const chunks = raw.split(/[;,]+/).map(s=>s.trim()).filter(Boolean);
  let total = 0;
  const acts = chunks.map(c=>{
    const m = c.match(/(\d+)\s*(m|min)/i);
    const minutes = m ? parseInt(m[1],10) : 10;
    total += minutes;
    const sub = c.replace(/(\d+)\s*(m|min)/i,'').trim() || "General";
    const cat =
      /(scale|arpeggio|slap|metronome|technique)/i.test(sub) ? "Technique" :
      /(improv|jam)/i.test(sub) ? "Improvisation" :
      /(ear|interval)/i.test(sub) ? "Ear" :
      /(theory|mode|harmony)/i.test(sub) ? "Theory" :
      /(record|mix)/i.test(sub) ? "Recording" :
      "Repertoire";
    return { category: cat, sub, minutes };
  });
  if (!acts.length) return { total_minutes: 30, activities:[{category:"Repertoire",sub:"General",minutes:30}] };
  return { total_minutes: Math.min(total,240), activities: acts };
}

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

    const parsed = parseHeuristic(body.rawText);

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

    return NextResponse.json({ ok: true, entry: data });
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
