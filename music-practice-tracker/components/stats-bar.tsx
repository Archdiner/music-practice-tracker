"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Music, Music2, Music3, Edit2, Check, X } from "lucide-react"

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
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState<string>("");
  const [isSavingGoal, setIsSavingGoal] = useState(false);

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

  const startEditingGoal = () => {
    if (stats) {
      setTempGoal(stats.target.toString());
      setIsEditingGoal(true);
    }
  };

  const cancelEditingGoal = () => {
    setIsEditingGoal(false);
    setTempGoal("");
  };

  const saveGoal = async () => {
    const newGoal = parseInt(tempGoal);
    if (isNaN(newGoal) || newGoal < 1 || newGoal > 480) return;
    
    setIsSavingGoal(true);
    try {
      const res = await fetch("/api/goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyTarget: newGoal })
      });
      
      if (res.ok) {
        setIsEditingGoal(false);
        setTempGoal("");
        // Trigger refresh to update stats
        window.location.reload();
      } else {
        console.error("Failed to update goal");
      }
    } catch (error) {
      console.error("Error updating goal:", error);
    } finally {
      setIsSavingGoal(false);
    }
  };

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
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground treble-clef">Today&apos;s Goal</p>
                {isEditingGoal ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={tempGoal}
                      onChange={(e) => setTempGoal(e.target.value)}
                      className="text-2xl font-bold text-foreground bg-transparent border-b-2 border-sage focus:outline-none w-16"
                      min="1"
                      max="480"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveGoal();
                        if (e.key === 'Escape') cancelEditingGoal();
                      }}
                    />
                    <span className="text-2xl font-bold text-foreground">min</span>
                    <Button
                      size="sm"
                      onClick={saveGoal}
                      disabled={isSavingGoal}
                      className="h-6 w-6 p-0 bg-sage hover:bg-sage-600"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={cancelEditingGoal}
                      disabled={isSavingGoal}
                      className="h-6 w-6 p-0 bg-gray-400 hover:bg-gray-500"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-foreground">{stats.todayMinutes}/{stats.target} min</p>
                    <Button
                      size="sm"
                      onClick={startEditingGoal}
                      className="h-6 w-6 p-0 bg-transparent hover:bg-sage/10 border border-sage/20 hover:border-sage"
                    >
                      <Edit2 className="h-3 w-3 text-sage" />
                    </Button>
                  </div>
                )}
              </div>
              {!isEditingGoal && (
                <Badge className="bg-sage text-white border border-sage">{goalPct}%</Badge>
              )}
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
