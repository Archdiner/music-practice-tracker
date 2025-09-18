import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function CalendarHeatmap() {
  // Generate sample heatmap data
  const generateHeatmapData = () => {
    const data = []
    const today = new Date()

    for (let i = 364; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)

      // Random activity level (0-4)
      const activity = Math.floor(Math.random() * 5)
      data.push({
        date: date.toISOString().split("T")[0],
        activity,
      })
    }
    return data
  }

  const heatmapData = generateHeatmapData()

  const getActivityColor = (level: number) => {
    const colors = [
      "bg-muted/30", // 0 - no activity (beige)
      "bg-apricot/20", // 1 - low
      "bg-apricot/40", // 2 - medium-low
      "bg-apricot/60", // 3 - medium-high
      "bg-apricot/80", // 4 - high (apricot to rust)
    ]
    return colors[level]
  }

  return (
    <Card className="rounded-2xl bg-card border border-beige-300 shadow-soft">
      <CardHeader>
        <CardTitle className="text-foreground">Activity Calendar</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Placeholder heatmap grid */}
          <div className="grid grid-cols-53 gap-1 text-xs">
            {heatmapData.map((day, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-sm ${getActivityColor(day.activity)} border border-beige-300/50`}
                title={`${day.date}: ${day.activity} activities`}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-4">
            <span>Less</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={`w-3 h-3 rounded-sm ${getActivityColor(level)} border border-beige-300/50`}
                />
              ))}
            </div>
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
