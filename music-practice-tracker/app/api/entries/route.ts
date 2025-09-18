export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { supaServer } from "@/lib/supabaseServer";

// GET: Retrieve entries for a specific date or date range
export async function GET(req: Request) {
  try {
    const sb = supaServer();
    const { data: auth } = await sb.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const date = url.searchParams.get("date"); // Specific date (YYYY-MM-DD)
    const from = url.searchParams.get("from"); // Date range start
    const to = url.searchParams.get("to"); // Date range end

    let query = sb
      .from("practice_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: false });

    if (date) {
      // Get entries for specific date
      query = query.eq("logged_at", date);
    } else if (from || to) {
      // Get entries for date range
      if (from) query = query.gte("logged_at", from);
      if (to) query = query.lte("logged_at", to);
    } else {
      // Default: get last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];
      query = query.gte("logged_at", thirtyDaysAgo);
    }

    const { data: entries, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ entries, count: entries?.length || 0 });
  } catch (e) {
    console.error("[api/entries] GET failed", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
