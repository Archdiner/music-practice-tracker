export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import logger from "@/lib/logger";
import { createRequestLogger, getRequestIdFrom } from "@/lib/requestLogger";
logger.debug("api_log_route_loaded");

import { NextResponse } from "next/server";
import { z } from "zod";
import { supaServer } from "@/lib/supabaseServer";
import { getAIService, parseHeuristic } from "@/lib/aiService";
import { RateLimitError, QuotaExceededError } from "@/lib/aiUsage";

const Body = z.object({ 
  rawText: z.string().trim().min(3).max(2000), 
  date: z.string().optional(),
  useAI: z.boolean().optional().default(true), // Allow disabling AI for testing
  validateAI: z.boolean().optional().default(false) // Optional non-blocking validation
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
        reqLogger.info("api_log_attempt_ai_parsing", { rawLength: body.rawText.length });
        const aiService = getAIService();
        parsed = await aiService.parseEntry(user.id, body.rawText, overarchingGoal || undefined);
        parsingMethod = "ai";
        reqLogger.info("api_log_ai_parsing_success", { activities: parsed.activities?.length ?? 0 });
      } catch (aiError) {
        if (aiError instanceof RateLimitError || aiError instanceof QuotaExceededError) {
          return NextResponse.json({ error: aiError.message, code: aiError.name }, { status: 429 });
        }
        reqLogger.warn("api_log_ai_parsing_failed_fallback", { error: (aiError as Error)?.message });
        parsed = parseHeuristic(body.rawText);
      }
    } else {
      reqLogger.info("api_log_using_heuristic_parsing");
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
      reqLogger.warn("api_log_save_error", { message: error.message });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    // Optional non-blocking validation: flag odd entries, don't block
    let warnings: string[] = [];
    if (body.validateAI) {
      const hasMusic = /(music|practice|guitar|piano|violin|cello|drums|bass|sax|trumpet|flute|clarinet|sing|vocal|scale|arpeggio|chord|harmony|theory|ear|transcription|repertoire|piece|song|etude|record|mix|production|metronome|tempo|rhythm|sight[- ]?reading|improv|improvisation|composition)/i.test(body.rawText);
      if (!hasMusic) warnings.push("This doesn't look music-related. Consider adding instrument, piece, or technique.");
      const total = parsed.total_minutes ?? 0;
      if (total <= 0 || total > 240) warnings.push("Session length seems unrealistic (must be 1-240 minutes).");
    }

    return NextResponse.json({ 
      ok: true, 
      log: data, 
      parsing_method: parsingMethod,
      parsed_data: parsed,
      warnings 
    });
  } catch (e) {
    const reqLogger = createRequestLogger({ requestId: getRequestIdFrom(req as any) });
    reqLogger.error("api_log_post_failed", { error: (e as Error)?.message, stack: (e as Error)?.stack });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

