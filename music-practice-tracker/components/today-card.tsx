"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Music4, Plus, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"

export function TodayCard({ 
  onSaved, 
  selectedDate, 
  onDateReset 
}: { 
  onSaved?: () => void;
  selectedDate: string | null;
  onDateReset: () => void;
}) {
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [todayEntries, setTodayEntries] = useState<any[]>([])
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadTodayEntries = async () => {
    try {
      const dateToLoad = selectedDate || new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/entries?date=${dateToLoad}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      
      if (res.ok) {
        const data = await res.json();
        setTodayEntries(data.entries || []);
      }
    } catch (error) {
      console.error("Failed to load entries:", error);
    } finally {
      setLoadingEntries(false);
    }
  };

  const deleteActivity = async (entryId: string, activityIndex: number) => {
    setDeletingId(`${entryId}-${activityIndex}`);
    try {
      const res = await fetch(`/api/entries/${entryId}?activityIndex=${activityIndex}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });
      
      if (res.ok) {
        await loadTodayEntries(); // Reload entries after deletion
        onSaved?.(); // Trigger refresh of other components
      } else {
        const errorData = await res.json();
        setErr(errorData.error || "Failed to delete activity");
      }
    } catch (error) {
      console.error("Failed to delete activity:", error);
      setErr("Network error deleting activity");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    loadTodayEntries();
  }, [selectedDate]);

  async function save(rawText: string) {
    setErr(null)
    if (!rawText.trim()) return;
    setIsSaving(true)
    try {
      const dateToSave = selectedDate || new Date().toISOString().split('T')[0];
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, date: dateToSave })
      })
      if (res.status === 401) {
        if (typeof window !== "undefined") window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as { error?: string }));
        setErr((j as { error?: string })?.error ?? "Failed to save");
        return;
      }
      setNotes("")
      // Reload entries after successful save
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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Music4 className="h-5 w-5" />
            {selectedDate ? (
              <>
                Practice - {new Date(selectedDate).toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </>
            ) : (
              "Today's Practice"
            )}
          </CardTitle>
          {selectedDate && (
            <Button
              size="sm"
              variant="outline"
              onClick={onDateReset}
              className="text-xs border-beige-300 hover:bg-apricot/10 hover:border-apricot text-muted-foreground hover:text-apricot"
            >
              Back to Today
            </Button>
          )}
        </div>
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
          <p className="text-xs text-muted-foreground mb-2">
            {selectedDate ? 'Practice Sessions' : "Today's Practice Sessions"}
          </p>
          <div className="space-y-2">
            {loadingEntries ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : todayEntries.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                {selectedDate ? 'No practice sessions logged for this date' : "No practice sessions logged today"}
              </div>
            ) : (
              todayEntries.flatMap((entry) => 
                entry.activities?.map((activity: any, actIndex: number) => (
                  <div key={`${entry.id}-${actIndex}`} className="flex items-center justify-between p-2 border border-beige-300/50 rounded-lg bg-card/50">
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.category === 'Technique' ? 'bg-sage' :
                        activity.category === 'Repertoire' ? 'bg-amber' :
                        activity.category === 'Theory' ? 'bg-blue-400' :
                        activity.category === 'Ear' ? 'bg-purple-400' :
                        activity.category === 'Improvisation' ? 'bg-green-400' :
                        activity.category === 'Recording' ? 'bg-red-400' :
                        'bg-gray-400'
                      }`}></div>
                      <span className="text-foreground">
                        {activity.sub} - {activity.minutes}min
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({activity.category})
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteActivity(entry.id, actIndex)}
                      disabled={deletingId === `${entry.id}-${actIndex}`}
                      className="h-6 w-6 p-0 border-red-300 hover:bg-red-50 hover:border-red-400"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                )) || []
              )
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
