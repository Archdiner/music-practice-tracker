"use client";
import { useState, useEffect } from "react";
import { StatsBar } from "@/components/stats-bar";
import { CalendarHeatmap } from "@/components/calendar-heatmap";
import { WeeklyInsights } from "@/components/weekly-insights";
import { TodayCard } from "@/components/today-card";
import { GoalSetting } from "@/components/goal-setting";
import { supaBrowser } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function Dashboard() {
  const [refreshTick, setRefreshTick] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const bump = () => setRefreshTick((x) => x + 1);

  const handleLogout = async () => {
    const supabase = supaBrowser();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  useEffect(() => {
    const supabase = supaBrowser();
    
    // Check current auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("Dashboard: Current session:", session?.user?.id);
      if (!session) {
        console.log("Dashboard: No session, redirecting to login");
        window.location.href = "/login";
        return;
      }
      console.log("Dashboard: User authenticated, showing dashboard");
      setIsAuthenticated(true);
    });

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Dashboard: Auth state change:", event, session?.user?.id);
      if (event === 'SIGNED_OUT' || !session) {
        console.log("Dashboard: User signed out, redirecting to login");
        window.location.href = "/login";
      } else if (event === 'SIGNED_IN' && session) {
        console.log("Dashboard: User signed in, showing dashboard");
        setIsAuthenticated(true);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header with Logout */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-foreground treble-clef">Music Practice Tracker</h1>
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="border-beige-300 hover:bg-apricot/10 hover:border-apricot text-muted-foreground hover:text-apricot transition-colors"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Top Stats Bar */}
        <StatsBar refreshTick={refreshTick} />

        {/* Goal Setting Section */}
        <GoalSetting onGoalChange={bump} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            <CalendarHeatmap 
              refreshTick={refreshTick} 
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
            />
            <WeeklyInsights onGenerated={bump} />
          </div>

          {/* Right Column - 1/3 width */}
          <div className="lg:col-span-1">
            <TodayCard 
              onSaved={bump} 
              selectedDate={selectedDate}
              onDateReset={() => setSelectedDate(null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}