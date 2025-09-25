import { NextResponse } from "next/server";
import { supaServer } from "@/lib/supabaseServer";
import logger from "@/lib/logger";
import { getAIService } from "@/lib/aiService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {
    database: "unknown",
    ai: "unknown",
    timestamp: new Date().toISOString()
  };

  // Database health
  try {
    const sb = supaServer();
    const { error } = await sb.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
    if (error) throw error;
    checks.database = "healthy";
  } catch (error: any) {
    checks.database = "unhealthy";
    logger.error("health_check_database_failed", { error: error?.message });
  }

  // AI service configuration (no outbound call)
  try {
    if (process.env.OPENAI_API_KEY) {
      // Ensure service constructs without throwing
      void getAIService();
      checks.ai = "configured";
    } else {
      checks.ai = "not_configured";
    }
  } catch (error: any) {
    checks.ai = "unhealthy";
    logger.warn("health_check_ai_unhealthy", { error: error?.message });
  }

  const isHealthy = checks.database === "healthy";
  return NextResponse.json(checks, { status: isHealthy ? 200 : 503 });
}


