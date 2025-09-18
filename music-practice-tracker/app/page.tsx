import { StatsBar } from "@/components/stats-bar"
import { CalendarHeatmap } from "@/components/calendar-heatmap"
import { WeeklyInsights } from "@/components/weekly-insights"
import { TodayCard } from "@/components/today-card"

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Top Stats Bar */}
        <StatsBar />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            <CalendarHeatmap />
            <WeeklyInsights />
          </div>

          {/* Right Column - 1/3 width */}
          <div className="lg:col-span-1">
            <TodayCard />
          </div>
        </div>
      </div>
    </div>
  )
}
