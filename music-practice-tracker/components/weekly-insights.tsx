"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, Timer, Award, AlertCircle, Target, Loader2, RefreshCw } from "lucide-react"
import { useState, useEffect } from "react"

interface WeeklyInsight {
  type: 'progress' | 'achievement' | 'concern' | 'recommendation';
  title: string;
  content: string;
  icon: 'trending-up' | 'award' | 'alert-circle' | 'target';
}

interface WeeklyInsightsData {
  id: string;
  week_start: string;
  summary: string | null;
  suggestions: string[];
  metrics: {
    total_minutes: number;
    days_practiced: number;
    days_hit_goal: number;
    daily_target: number;
    category_minutes: Record<string, number>;
    category_percentages: Record<string, number>;
    previous_week_minutes: number | null;
    minutes_change_percent: number | null;
    key_insights: WeeklyInsight[];
  };
  created_at: string;
}

export function WeeklyInsights({ onGenerated }: { onGenerated?: () => void }) {
  const [insights, setInsights] = useState<WeeklyInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/weekly-insights', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error(`Failed to load insights: ${response.status}`);
      }

      const data = await response.json();
      console.log('Loaded insights data:', data.insights);
      setInsights(data.insights);
    } catch (err) {
      console.error('Failed to load weekly insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = async (forceRegenerate = false) => {
    try {
      setGenerating(true);
      setError(null);

      const response = await fetch('/api/weekly-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRegenerate })
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error(`Failed to generate insights: ${response.status}`);
      }

      const data = await response.json();
      console.log('Generated insights data:', data.insights);
      setInsights(data.insights);
      onGenerated?.();
    } catch (err) {
      console.error('Failed to generate weekly insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'trending-up': return TrendingUp;
      case 'award': return Award;
      case 'alert-circle': return AlertCircle;
      case 'target': return Target;
      default: return Timer;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'progress': return 'text-apricot';
      case 'achievement': return 'text-sage';
      case 'concern': return 'text-amber-600';
      case 'recommendation': return 'text-blue-500';
      default: return 'text-apricot';
    }
  };

  if (loading) {
    return (
      <Card className="rounded-2xl bg-card border border-beige-300 shadow-soft">
        <CardHeader>
          <CardTitle className="text-foreground treble-clef">Weekly Practice Insights</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading insights...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl bg-card border border-beige-300 shadow-soft">
      <CardHeader>
        <CardTitle className="text-foreground treble-clef">Weekly Practice Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {insights ? (
          <div className="space-y-4">
            {/* Week Summary */}
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-foreground">
                  Week of {new Date(insights.week_start).toLocaleDateString()}
                </p>
                <div className="text-xs text-muted-foreground">
                  {Math.round((insights.metrics?.total_minutes || 0) / 60 * 10) / 10}h total
                </div>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{insights.metrics?.days_practiced || 0}/7 days practiced</span>
                <span>{insights.metrics?.days_hit_goal || 0}/7 goals hit</span>
                {insights.metrics?.minutes_change_percent !== null && insights.metrics?.minutes_change_percent !== undefined && (
                  <span className={insights.metrics.minutes_change_percent >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {insights.metrics.minutes_change_percent >= 0 ? '+' : ''}{insights.metrics.minutes_change_percent}% vs last week
                  </span>
                )}
              </div>
            </div>

            {/* AI Summary */}
            {insights.summary && (
              <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg">
                <p className="text-sm text-foreground">{insights.summary}</p>
              </div>
            )}

            {/* Key Insights */}
            <div className="space-y-3">
              {insights.metrics?.key_insights && Array.isArray(insights.metrics.key_insights) && insights.metrics.key_insights.length > 0 ? (
                insights.metrics.key_insights.map((insight, index) => {
                  const IconComponent = getIconComponent(insight.icon);
                  return (
                    <div key={index} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                      <IconComponent className={`h-5 w-5 mt-0.5 ${getIconColor(insight.type)}`} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{insight.title}</p>
                        <p className="text-xs text-muted-foreground">{insight.content}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <Timer className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Practice Summary</p>
                    <p className="text-xs text-muted-foreground">
                      You practiced {insights.metrics?.total_minutes || 0} minutes across {insights.metrics?.days_practiced || 0} days this week.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Recommendations */}
            {insights.suggestions && Array.isArray(insights.suggestions) && insights.suggestions.length > 0 && (
              <div className="p-3 bg-green-50/50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-foreground mb-2">💡 Recommendations</p>
                <ul className="space-y-1">
                  {insights.suggestions.map((rec, index) => (
                    <li key={index} className="text-xs text-muted-foreground">• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              No insights generated for this week yet.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            className="flex-1 bg-apricot text-white hover:bg-apricot-600 shadow-soft" 
            onClick={() => generateInsights(false)}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Timer className="h-4 w-4 mr-2" />
                Generate Insights
              </>
            )}
          </Button>
          
          {insights && (
            <Button 
              variant="outline"
              size="sm"
              onClick={() => generateInsights(true)}
              disabled={generating}
              className="border-beige-300 hover:bg-muted/50"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
