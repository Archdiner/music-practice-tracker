export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { supaServer } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

type AiUsageRow = {
  user_id: string;
  endpoint: string;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  status?: string | null;
  created_at: string;
};

function formatUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatInt(n: number): string {
  return n.toLocaleString();
}

export default async function DeveloperAiUsagePage() {
  const sb = supaServer();
  const { data: auth } = await sb.auth.getUser();
  const user = auth?.user;
  if (!user) redirect("/login");

  // Gate to developer role. We check user metadata first, then profile role flags if present.
  const isDevMeta = (user.user_metadata as any)?.role === "developer" || (user.app_metadata as any)?.roles?.includes?.("developer");
  let isDev = !!isDevMeta;

  if (!isDev) {
    const { data: prof } = await sb
      .from("profiles")
      .select("role,is_developer")
      .eq("id", user.id)
      .maybeSingle();
    isDev = !!(prof && ((prof as any).role === "developer" || (prof as any).is_developer === true));
  }

  if (!isDev) {
    redirect("/");
  }

  // Load last 30 days of AI usage (cap rows for safety)
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: rows, error } = await sb
    .from("ai_usage")
    .select("user_id,endpoint,model,prompt_tokens,completion_tokens,total_tokens,cost_usd,status,created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">AI Usage (Developer)</h1>
        <p className="text-red-600 mt-4">Failed to load usage: {error.message}</p>
      </div>
    );
  }

  const data = (rows || []) as AiUsageRow[];

  // KPIs
  const totalRequests = data.length;
  const totalTokens = data.reduce((s, r) => s + (r.total_tokens || 0), 0);
  const totalCost = data.reduce((s, r) => s + (r.cost_usd || 0), 0);

  // Breakdown by endpoint
  const byEndpoint = new Map<string, { requests: number; tokens: number; cost: number }>();
  data.forEach(r => {
    const k = r.endpoint || "unknown";
    const v = byEndpoint.get(k) || { requests: 0, tokens: 0, cost: 0 };
    v.requests += 1;
    v.tokens += r.total_tokens || 0;
    v.cost += r.cost_usd || 0;
    byEndpoint.set(k, v);
  });

  // Breakdown by model
  const byModel = new Map<string, { requests: number; tokens: number; cost: number }>();
  data.forEach(r => {
    const k = r.model || "unknown";
    const v = byModel.get(k) || { requests: 0, tokens: 0, cost: 0 };
    v.requests += 1;
    v.tokens += r.total_tokens || 0;
    v.cost += r.cost_usd || 0;
    byModel.set(k, v);
  });

  // Top users by tokens
  const byUser = new Map<string, { tokens: number; cost: number; requests: number }>();
  data.forEach(r => {
    const v = byUser.get(r.user_id) || { tokens: 0, cost: 0, requests: 0 };
    v.tokens += r.total_tokens || 0;
    v.cost += r.cost_usd || 0;
    v.requests += 1;
    byUser.set(r.user_id, v);
  });
  const topUsers = Array.from(byUser.entries())
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <h1 className="text-2xl font-semibold">AI Usage (Developer)</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-md border p-4">
          <div className="text-sm text-muted-foreground">Requests (30d)</div>
          <div className="text-2xl font-semibold mt-1">{formatInt(totalRequests)}</div>
        </div>
        <div className="rounded-md border p-4">
          <div className="text-sm text-muted-foreground">Tokens (30d)</div>
          <div className="text-2xl font-semibold mt-1">{formatInt(totalTokens)}</div>
        </div>
        <div className="rounded-md border p-4">
          <div className="text-sm text-muted-foreground">Cost (30d)</div>
          <div className="text-2xl font-semibold mt-1">{formatUsd(totalCost)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-md border p-4">
          <div className="text-lg font-semibold mb-2">By Endpoint</div>
          <div className="space-y-2">
            {Array.from(byEndpoint.entries()).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <div className="font-medium">{k}</div>
                <div className="text-muted-foreground">{formatInt(v.requests)} req • {formatInt(v.tokens)} toks • {formatUsd(v.cost)}</div>
              </div>
            ))}
            {byEndpoint.size === 0 && <div className="text-sm text-muted-foreground">No data</div>}
          </div>
        </div>

        <div className="rounded-md border p-4">
          <div className="text-lg font-semibold mb-2">By Model</div>
          <div className="space-y-2">
            {Array.from(byModel.entries()).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <div className="font-medium">{k}</div>
                <div className="text-muted-foreground">{formatInt(v.requests)} req • {formatInt(v.tokens)} toks • {formatUsd(v.cost)}</div>
              </div>
            ))}
            {byModel.size === 0 && <div className="text-sm text-muted-foreground">No data</div>}
          </div>
        </div>
      </div>

      <div className="rounded-md border p-4">
        <div className="text-lg font-semibold mb-2">Top Users (by tokens)</div>
        <div className="space-y-2">
          {topUsers.map(u => (
            <div key={u.userId} className="flex items-center justify-between text-sm">
              <div className="font-mono">{u.userId.slice(0, 8)}…</div>
              <div className="text-muted-foreground">{formatInt(u.requests)} req • {formatInt(u.tokens)} toks • {formatUsd(u.cost)}</div>
            </div>
          ))}
          {topUsers.length === 0 && <div className="text-sm text-muted-foreground">No data</div>}
        </div>
      </div>

      <div className="rounded-md border p-4">
        <div className="text-lg font-semibold mb-2">Recent Usage (50)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Endpoint</th>
                <th className="py-2 pr-4">Model</th>
                <th className="py-2 pr-4">Tokens</th>
                <th className="py-2 pr-4">Cost</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).slice(0, 50).map((r, i) => (
                <tr key={`${r.created_at}-${i}`} className="border-t">
                  <td className="py-2 pr-4 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-4 font-mono">{r.user_id.slice(0, 8)}…</td>
                  <td className="py-2 pr-4">{r.endpoint}</td>
                  <td className="py-2 pr-4">{r.model}</td>
                  <td className="py-2 pr-4">{formatInt(r.total_tokens || 0)}</td>
                  <td className="py-2 pr-4">{formatUsd(r.cost_usd || 0)}</td>
                  <td className="py-2 pr-4">{r.status || "completed"}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td className="py-4 text-muted-foreground" colSpan={7}>No usage in the last 30 days</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


