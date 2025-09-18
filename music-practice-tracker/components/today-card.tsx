"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Music4, Plus } from "lucide-react"
import { useState, useEffect } from "react"

export function TodayCard({ onSaved }: { onSaved?: () => void }) {
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [todayEntries, setTodayEntries] = useState<any[]>([])
  const [loadingEntries, setLoadingEntries] = useState(true)

  const loadTodayEntries = async () => {
    try {
      const res = await fetch("/api/log", {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      
      if (res.ok) {
        const data = await res.json();
        const today = new Date().toISOString().split('T')[0];
        const todayOnly = (data.entries || []).filter((entry: any) => 
          entry.logged_at === today
        );
        setTodayEntries(todayOnly);
      }
    } catch (error) {
      console.error("Failed to load today's entries:", error);
    } finally {
      setLoadingEntries(false);
    }
  };

  useEffect(() => {
    loadTodayEntries();
  }, []);

  async function save(rawText: string) {
    setErr(null)
    if (!rawText.trim()) return;
    setIsSaving(true)
    console.log("Saving practice data:", rawText);
    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText })
      })
      console.log("API response status:", res.status);
      if (res.status === 401) {
        if (typeof window !== "undefined") window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as { error?: string }));
        console.error("API error response:", j);
        setErr((j as { error?: string })?.error ?? "Failed to save");
        return;
      }
      const result = await res.json();
      console.log("API success response:", result);
      setNotes("")
      // Reload today's entries after successful save
      await loadTodayEntries();
      onSaved?.()
    } catch {
      setErr("Network error")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="rounded-2xl bg-card border border-beige-300 shadow-soft h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Music4 className="h-5 w-5" />
          Today&apos;s Practice
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Practice notes & goals</p>
          <Textarea
            placeholder="What pieces are you working on today? Add practice notes, techniques to focus on..."
            className="min-h-[120px] rounded-2xl border-beige-400 bg-white/80 text-foreground placeholder:text-muted-foreground resize-none focus:shadow-ring"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSaving}
          />
        </div>

        <div className="flex gap-2 items-center">
          <Button size="sm" className="flex-1 bg-apricot text-white hover:bg-apricot-600 shadow-soft" onClick={() => save(notes)} disabled={isSaving}>
            <Plus className="h-4 w-4 mr-1" />
            Parse & Save
          </Button>
          {err && <span className="text-sm text-[#D26A6A]">{err}</span>}
        </div>

        <div className="pt-2 border-t border-beige-300">
          <p className="text-xs text-muted-foreground mb-2">Today&apos;s Practice Sessions</p>
          <div className="space-y-2">
            {loadingEntries ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : todayEntries.length === 0 ? (
              <div className="text-sm text-muted-foreground">No practice sessions logged today</div>
            ) : (
              todayEntries.map((entry, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-apricot rounded-full"></div>
                    <span className="text-foreground font-medium">{entry.total_minutes} minutes total</span>
                  </div>
                  {entry.activities && entry.activities.map((activity: any, actIndex: number) => (
                    <div key={actIndex} className="flex items-center gap-2 text-sm ml-4">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        activity.category === 'Technique' ? 'bg-sage' :
                        activity.category === 'Repertoire' ? 'bg-amber' :
                        activity.category === 'Theory' ? 'bg-blue-400' :
                        'bg-gray-400'
                      }`}></div>
                      <span className="text-muted-foreground text-xs">
                        {activity.sub} - {activity.minutes}min ({activity.category})
                      </span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
