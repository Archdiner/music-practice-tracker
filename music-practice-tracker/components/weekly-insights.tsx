"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, Timer, Award, AlertCircle, Target, Loader2, RefreshCw, ChevronLeft, ChevronRight, Calendar } from "lucide-react"
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
  is_final?: boolean;
  generation_method?: 'automatic' | 'manual';
}

export function WeeklyInsights({ 
  onGenerated, 
  selectedDate,
  onWeekChange 
}: { 
  onGenerated?: () => void;
  selectedDate?: string | null;
  onWeekChange?: (weekStart: string) => void;
}) {
  const [insights, setInsights] = useState<WeeklyInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<string>("");
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [isCurrentWeek, setIsCurrentWeek] = useState(false);

  const loadInsights = async (weekStartDate?: string, checkAutoGenerate = false, retryCount = 0) => {
    try {
      setLoading(true);
      setError(null);
      
      const url = new URL('/api/weekly-insights', window.location.origin);
      if (weekStartDate) url.searchParams.set('weekStartDate', weekStartDate);
      if (checkAutoGenerate) url.searchParams.set('checkAutoGenerate', 'true');
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (response.status >= 500 && retryCount < 3) {
          // Retry on server errors with exponential backoff
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`Retrying in ${delay}ms (attempt ${retryCount + 1})`);
          setTimeout(() => {
            loadInsights(weekStartDate, checkAutoGenerate, retryCount + 1);
          }, delay);
          return;
        }
        throw new Error(`Failed to load insights: ${response.status}`);
      }

      const data = await response.json();
      console.log('Loaded insights data:', data);
      setInsights(data.insights);
      setCurrentWeekStart(data.weekStart);
      setAvailableWeeks(data.availableWeeks || []);
      setIsCurrentWeek(data.isCurrentWeek || false);
      
      // Auto-generate insights if needed
      if (data.needsAutoGeneration && !data.insights) {
        console.log('Auto-generating insights for completed week');
        await generateInsights(false, true, weekStartDate);
      }
    } catch (err) {
      console.error('Failed to load weekly insights:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load insights';
      
      // Provide user-friendly error messages
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        setError('Network error. Please check your connection and try again.');
      } else if (errorMessage.includes('500') || errorMessage.includes('internal')) {
        setError('Server error. Please try again in a moment.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = async (forceRegenerate = false, autoGenerate = false, weekStartDate?: string, retryCount = 0) => {
    try {
      setGenerating(true);
      setError(null);

      const response = await fetch('/api/weekly-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          forceRegenerate, 
          autoGenerate,
          weekStartDate: weekStartDate || currentWeekStart
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        
        // Retry on server errors with exponential backoff
        if (response.status >= 500 && retryCount < 2) {
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`Retrying generation in ${delay}ms (attempt ${retryCount + 1})`);
          setTimeout(() => {
            generateInsights(forceRegenerate, autoGenerate, weekStartDate, retryCount + 1);
          }, delay);
          return;
        }
        
        throw new Error(`Failed to generate insights: ${response.status}`);
      }

      const data = await response.json();
      console.log('Generated insights data:', data);
      
      if (data.generated) {
        setInsights(data.insights);
        // Refresh available weeks after generating
        loadInsights(weekStartDate || currentWeekStart);
        onGenerated?.();
      } else if (data.message) {
        // Handle different types of messages
        if (data.hasPracticeData === false) {
          setError(data.message);
        } else if (data.isFinal) {
          setError(data.message);
        } else {
          setError(data.message);
        }
      }
    } catch (err) {
      console.error('Failed to generate weekly insights:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate insights';
      
      // Provide user-friendly error messages
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        setError('Network error. Please check your connection and try again.');
      } else if (errorMessage.includes('AI generation failed')) {
        setError('AI insights generation failed, but basic insights are still available.');
      } else if (errorMessage.includes('500') || errorMessage.includes('internal')) {
        setError('Server error. Please try again in a moment.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    loadInsights(undefined, true); // Check for auto-generation on mount
  }, []);

  // Handle date selection from heatmap
  useEffect(() => {
    if (selectedDate) {
      const weekStart = getWeekBoundaries(new Date(selectedDate));
      loadInsights(weekStart);
      onWeekChange?.(weekStart);
    }
  }, [selectedDate]);

  // Helper function to get week boundaries
  const getWeekBoundaries = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  // Navigation functions
  const navigateToWeek = (direction: 'prev' | 'next') => {
    const currentDate = new Date(currentWeekStart);
    let targetDate: Date;
    
    if (direction === 'prev') {
      // Go to previous week
      targetDate = new Date(currentDate);
      targetDate.setDate(targetDate.getDate() - 7);
    } else {
      // Go to next week
      targetDate = new Date(currentDate);
      targetDate.setDate(targetDate.getDate() + 7);
    }
    
    const targetWeekStart = getWeekBoundaries(targetDate);
    
    // Check if we're going into the future (beyond current week)
    const today = new Date();
    const currentWeekStartDate = getWeekBoundaries(today);
    if (targetWeekStart > currentWeekStartDate) {
      return; // Don't navigate to future weeks
    }
    
    loadInsights(targetWeekStart);
    onWeekChange?.(targetWeekStart);
  };

  // Check navigation availability
  const today = new Date();
  const currentWeekStartDate = getWeekBoundaries(today);
  const canNavigatePrev = currentWeekStart !== "" && currentWeekStart > "2024-01-01"; // Reasonable limit
  const canNavigateNext = currentWeekStart !== "" && currentWeekStart < currentWeekStartDate;

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
      case 'recommendation': return 'text-orange-500';
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground treble-clef">Weekly Practice Insights</CardTitle>
          
          {/* Week Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateToWeek('prev')}
              disabled={!canNavigatePrev}
              className="p-1 h-8 w-8"
              title="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">
                {currentWeekStart ? new Date(currentWeekStart).toLocaleDateString() : ''}
              </span>
              {isCurrentWeek && (
                <span className="text-apricot font-medium">(Current)</span>
              )}
              {selectedDate && (
                <span className="text-blue-600 font-medium">(From Calendar)</span>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateToWeek('next')}
              disabled={!canNavigateNext}
              className="p-1 h-8 w-8"
              title="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            
            {/* Reset to current week button */}
            {!isCurrentWeek && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  loadInsights();
                  onWeekChange?.("");
                }}
                className="p-1 h-8 w-8 text-apricot hover:bg-apricot/10"
                title="Back to current week"
              >
                <Timer className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className={`p-3 rounded-lg border ${
            error.includes('No practice data') 
              ? 'bg-blue-50 border-blue-200' 
              : error.includes('cannot be regenerated')
              ? 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <p className={`text-sm ${
              error.includes('No practice data') 
                ? 'text-blue-600' 
                : error.includes('cannot be regenerated')
                ? 'text-amber-600'
                : 'text-red-600'
            }`}>
              {error}
            </p>
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
              <div className="p-3 bg-orange-50/50 border border-apricot/30 rounded-lg">
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
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-blue-700 font-medium mb-2">
                {isCurrentWeek 
                  ? "This week is still in progress"
                  : "No practice data found for this week"
                }
              </p>
              <p className="text-xs text-blue-600">
                {isCurrentWeek 
                  ? "Insights will be generated automatically when the week ends."
                  : "Any practice data (even just one day) will generate insights for this week!"
                }
              </p>
            </div>
          </div>
        )}

        {/* Generation Controls - Only show for current week or when no insights exist */}
        {(!insights || !insights.is_final) && (
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
            
            {/* Only show regenerate button for non-final insights */}
            {insights && !insights.is_final && (!insights.generation_method || insights.generation_method === 'manual') && (
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
        )}

        {/* Show final insights indicator */}
        {insights && insights.is_final && (
          <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs text-green-700 flex items-center gap-1">
              <Award className="h-3 w-3" />
              Final insights generated {insights.generation_method === 'automatic' ? 'automatically' : (insights.generation_method || 'manually')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
