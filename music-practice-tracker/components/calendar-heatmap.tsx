"use client";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function CalendarHeatmap({ 
  refreshTick, 
  selectedDate, 
  onDateSelect 
}: { 
  refreshTick: number;
  selectedDate: string | null;
  onDateSelect: (date: string | null) => void;
}) {
  const [byDate, setByDate] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    (async () => {
      setError(null);
      const from = new Date(Date.now() - 365*24*3600e3).toISOString().slice(0,10);
      try {
        const res = await fetch(`/api/heatmap?from=${from}`, { cache: "no-store" });
        if (res.status === 401) {
          if (typeof window !== "undefined") window.location.href = "/login";
          return;
        }
        if (!res.ok) {
          setError("Failed to load heatmap");
          return;
        }
        const data = await res.json();
        if (!aborted) setByDate(data);
      } catch {
        setError("Network error loading heatmap");
      }
    })();
    return () => { aborted = true };
  }, [refreshTick]);

  const heatmapData = useMemo(() => {
    const data: { date: string; level: number }[] = [];
    const today = new Date();
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0,10);
      const mins = byDate[key] ?? 0;
      const level = mins === 0 ? 0 : mins <= 10 ? 1 : mins <= 25 ? 2 : mins <= 45 ? 3 : 4;
      data.push({ date: key, level });
    }
    return data;
  }, [byDate]);

  const getActivityColor = (level: number, date: string) => {
    const isSelected = selectedDate === date;
    const colors = [
      "bg-muted/30", // 0 - no activity (beige)
      "bg-apricot/20", // 1 - low
      "bg-apricot/40", // 2 - medium-low
      "bg-apricot/60", // 3 - medium-high
      "bg-apricot/80", // 4 - high (apricot)
    ]
    
    if (isSelected) {
      return "bg-apricot border-2 border-apricot-600 shadow-md";
    }
    
    return colors[level];
  };

  const handleDateClick = (date: string) => {
    if (selectedDate === date) {
      onDateSelect(null); // Deselect if clicking the same date
    } else {
      onDateSelect(date);
    }
  };

  return (
    <Card className="rounded-2xl bg-card border border-beige-300 shadow-soft">
      <CardHeader>
        <CardTitle className="text-foreground">Activity Calendar</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-sm text-muted-foreground">{error}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-53 gap-1 text-xs overflow-hidden">
              {heatmapData.map((day, index) => (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-sm ${getActivityColor(day.level, day.date)} border border-beige-300/50 hover:border-apricot transition-colors cursor-pointer`}
                  title={`${day.date}: ${byDate[day.date] || 0} minutes`}
                  onClick={() => handleDateClick(day.date)}
                />
              ))}
            </div>
            <div className="flex items-center justify-center text-xs text-muted-foreground">
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`w-3 h-3 rounded-sm ${getActivityColor(level, "")} border border-beige-300/50`}
                    title={`Level ${level}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
