import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Music, Music2, Music3 } from "lucide-react"

export function StatsBar() {
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
              <p className="text-2xl font-bold text-foreground">12 days</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today Goal Badge */}
      <Card className="rounded-2xl bg-card border border-beige-300 shadow-soft">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sage/10 rounded-lg">
              <Music2 className="h-5 w-5 text-sage" />
            </div>
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm text-muted-foreground treble-clef">Today's Goal</p>
                <p className="text-2xl font-bold text-foreground">3/5 songs</p>
              </div>
              <Badge className="bg-sage text-white border border-sage">60%</Badge>
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
              <p className="text-2xl font-bold text-foreground">18 sessions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
