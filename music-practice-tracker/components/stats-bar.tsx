"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Music, Music2, Music3 } from "lucide-react"

type Stats = {
  target: number;
  streakDays: number;
  weekTotal: number;
  todayMinutes: number;
  categoryBreakdown: Record<string, number>;
}

export function StatsBar({ refreshTick }: { refreshTick: number }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    (async () => {
      setError(null);
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (res.status === 401) {
          if (typeof window !== "undefined") window.location.href = "/login";
          return;
        }
        if (!res.ok) {
          setError("Failed to load stats");
          return;
        }
        const data = await res.json();
        if (!aborted) setStats(data);
      } catch {
        setError("Network error loading stats");
      }
    })();
    return () => { aborted = true };
  }, [refreshTick]);

  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl bg-card border border-beige-300 shadow-soft col-span-1 md:col-span-3">
          <CardContent className="p-6">
            <div className="text-sm text-muted-foreground">{error}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl bg-card border border-beige-300 shadow-soft col-span-1 md:col-span-3">
          <CardContent className="p-6">
            <div className="text-sm text-muted-foreground">Loading stats...</div>
          </CardContent>
        </Card>
      </div>
    );
  }
  const hit = stats.todayMinutes >= stats.target;
  const goalPct = Math.round((stats.todayMinutes / stats.target) * 100);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Streak Card */}
      <Card className="rounded-2xl bg-card border border-beige-300 shadow-soft musical-accent">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-apricot/10 rounded-lg">
              <Music className="h-5 w-5 text-apricot" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Practice Streak</p>
              <p className="text-2xl font-bold text-foreground">{stats.streakDays} days</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today Goal Badge */}
      <Card className={`rounded-2xl bg-card border border-beige-300 shadow-soft ${hit ? "" : ""}`}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sage/10 rounded-lg">
              <Music2 className="h-5 w-5 text-sage" />
            </div>
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm text-muted-foreground treble-clef">Today&apos;s Goal</p>
                <p className="text-2xl font-bold text-foreground">{stats.todayMinutes}/{stats.target} min</p>
              </div>
              <Badge className="bg-sage text-white border border-sage">{goalPct}%</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Week Total */}
      <Card className="rounded-2xl bg-card border border-beige-300 shadow-soft">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber/10 rounded-lg">
              <Music3 className="h-5 w-5 text-amber" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Week Total</p>
              <p className="text-2xl font-bold text-foreground">{stats.weekTotal} min</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
