import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, Timer, Award } from "lucide-react"

export function WeeklyInsights() {
  return (
    <Card className="rounded-2xl bg-card border border-beige-300 shadow-soft">
      <CardHeader>
        <CardTitle className="text-foreground treble-clef">Weekly Practice Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
            <TrendingUp className="h-5 w-5 text-apricot mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Peak Practice Hours</p>
              <p className="text-xs text-muted-foreground">
                Your most focused practice sessions are between 9-11 AM. Your technique improves 40% during these hours.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
            <Timer className="h-5 w-5 text-amber mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Practice Distribution</p>
              <p className="text-xs text-muted-foreground">
                You spent 65% of practice time on technique this week, up 12% from last week. Great progress!
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
            <Award className="h-5 w-5 text-sage mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Goal Achievement</p>
              <p className="text-xs text-muted-foreground">
                You completed 87% of planned pieces this week. Your sight-reading has improved significantly!
              </p>
            </div>
          </div>
        </div>

        <Button className="w-full bg-apricot text-white hover:bg-apricot-600 shadow-soft">
          Generate Practice Insights
        </Button>
      </CardContent>
    </Card>
  )
}
