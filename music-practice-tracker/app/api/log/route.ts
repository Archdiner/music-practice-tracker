export const runtime = "nodejs";
export const dynamic = "force-dynamic";
console.log("[api/log] route module loaded");

import { NextResponse } from "next/server";
import { z } from "zod";
import { supaServer } from "@/lib/supabaseServer";

const Body = z.object({ rawText: z.string().min(1), date: z.string().optional() });

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

export async function POST(req: Request) {
  try {
    const sb = supaServer();
    const body = Body.parse(await req.json());

    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const parsed = parseHeuristic(body.rawText);
    
    console.log(`[api/log] Saving practice data for user ${user.id}`);
    console.log(`[api/log] Date: ${body.date ?? 'null (today)'}`);
    console.log(`[api/log] Raw text: ${body.rawText}`);
    console.log(`[api/log] Parsed: ${JSON.stringify(parsed)}`);

    const { data, error } = await sb.rpc("log_practice", {
      p_user_id: user.id,
      p_date: body.date ?? null,
      p_raw_text: body.rawText,
      p_total_minutes: parsed.total_minutes,
      p_activities: parsed.activities
    });

    if (error) {
      console.log(`[api/log] Error saving practice data: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    console.log(`[api/log] Successfully saved practice data: ${JSON.stringify(data)}`);
    return NextResponse.json({ ok: true, log: data });
  } catch (e) {
    console.error("[api/log] POST failed", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

