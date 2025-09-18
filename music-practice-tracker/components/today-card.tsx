import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Music4, Plus } from "lucide-react"

export function TodayCard() {
  return (
    <Card className="rounded-2xl bg-card border border-beige-300 shadow-soft h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Music4 className="h-5 w-5" />
          Today's Practice
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Practice notes & goals</p>
          <Textarea
            placeholder="What pieces are you working on today? Add practice notes, techniques to focus on..."
            className="min-h-[120px] rounded-2xl border-beige-400 bg-white/80 text-foreground placeholder:text-muted-foreground resize-none focus:shadow-ring"
          />
        </div>

        <div className="flex gap-2">
          <Button size="sm" className="flex-1 bg-apricot text-white hover:bg-apricot-600 shadow-soft">
            <Plus className="h-4 w-4 mr-1" />
            Parse & Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-beige-300 text-foreground hover:bg-muted/50 bg-transparent"
          >
            Save Note
          </Button>
        </div>

        <div className="pt-2 border-t border-beige-300">
          <p className="text-xs text-muted-foreground mb-2">Today's Practice Sessions</p>
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
