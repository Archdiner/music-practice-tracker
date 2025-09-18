"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Music4, Plus } from "lucide-react"
import { useState } from "react"

export function TodayCard({ onSaved }: { onSaved?: () => void }) {
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save(rawText: string) {
    setErr(null)
    if (!rawText.trim()) return;
    setIsSaving(true)
    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText })
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
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-apricot rounded-full"></div>
              <span className="text-foreground">Scales & arpeggios - 20 min</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-sage rounded-full"></div>
              <span className="text-foreground">Bach Invention No. 1</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-amber rounded-full"></div>
              <span className="text-foreground">Chopin Nocturne practice</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
