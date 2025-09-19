export const runtime = "nodejs";
export const dynamic = "force-dynamic";
console.log("[api/log] route module loaded");

import { NextResponse } from "next/server";
import { z } from "zod";
import { supaServer } from "@/lib/supabaseServer";
import { getAIService, parseHeuristic } from "@/lib/aiService";

const Body = z.object({ 
  rawText: z.string().min(1), 
  date: z.string().optional(),
  useAI: z.boolean().optional().default(true) // Allow disabling AI for testing
});

export async function POST(req: Request) {
  try {
    const sb = supaServer();
    const body = Body.parse(await req.json());

    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let parsed;
    let parsingMethod = "heuristic";

    // Try AI parsing first if enabled
    if (body.useAI && process.env.OPENAI_API_KEY) {
      try {
        console.log(`[api/log] Attempting AI parsing for: "${body.rawText}"`);
        const aiService = getAIService();
        parsed = await aiService.parseEntry(body.rawText);
        parsingMethod = "ai";
        console.log(`[api/log] AI parsing successful:`, parsed);
      } catch (aiError) {
        console.log(`[api/log] AI parsing failed, falling back to heuristic:`, aiError);
        parsed = parseHeuristic(body.rawText);
      }
    } else {
      console.log(`[api/log] Using heuristic parsing (AI disabled or no API key)`);
      parsed = parseHeuristic(body.rawText);
    }

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
    
    return NextResponse.json({ 
      ok: true, 
      log: data, 
      parsing_method: parsingMethod,
      parsed_data: parsed 
    });
  } catch (e) {
    console.error("[api/log] POST failed", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

