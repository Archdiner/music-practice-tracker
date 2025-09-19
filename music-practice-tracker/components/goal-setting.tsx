"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Target, Plus, Edit2, Check, X, Calendar, Flag } from "lucide-react"
import { useState, useEffect } from "react"

interface OverarchingGoal {
  id: string;
  title: string;
  description?: string;
  goal_type: "piece" | "exam" | "technique" | "performance" | "general";
  difficulty_level?: "beginner" | "intermediate" | "advanced";
  target_date?: string;
  status: "active" | "completed" | "paused";
  created_at: string;
  updated_at: string;
}

export function GoalSetting({ onGoalChange }: { onGoalChange?: () => void }) {
  const [goal, setGoal] = useState<OverarchingGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    goal_type: "piece" | "exam" | "technique" | "performance" | "general";
    difficulty_level: "beginner" | "intermediate" | "advanced";
    target_date: string;
  }>({
    title: "",
    description: "",
    goal_type: "general",
    difficulty_level: "intermediate",
    target_date: ""
  });

  const loadGoal = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/overarching-goals', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error(`Failed to load goal: ${response.status}`);
      }

      const data = await response.json();
      setGoal(data.goal);
      
      if (data.goal) {
        setFormData({
          title: data.goal.title,
          description: data.goal.description || "",
          goal_type: data.goal.goal_type,
          difficulty_level: data.goal.difficulty_level || "intermediate",
          target_date: data.goal.target_date || ""
        });
      }
    } catch (err) {
      console.error('Failed to load goal:', err);
      setError(err instanceof Error ? err.message : 'Failed to load goal');
    } finally {
      setLoading(false);
    }
  };

  const saveGoal = async () => {
    try {
      setSaving(true);
      setError(null);

      const method = goal ? 'PUT' : 'POST';
      const response = await fetch('/api/overarching-goals', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to save goal: ${response.status}`);
      }

      const data = await response.json();
      setGoal(data.goal);
      setEditing(false);
      onGoalChange?.();
    } catch (err) {
      console.error('Failed to save goal:', err);
      setError(err instanceof Error ? err.message : 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  const pauseGoal = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/overarching-goals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to pause goal');
      }

      setGoal(null);
      setFormData({
        title: "",
        description: "",
        goal_type: "general",
        difficulty_level: "intermediate", 
        target_date: ""
      });
      onGoalChange?.();
    } catch (err) {
      console.error('Failed to pause goal:', err);
      setError(err instanceof Error ? err.message : 'Failed to pause goal');
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    setEditing(true);
    setError(null);
  };

  const cancelEditing = () => {
    setEditing(false);
    setError(null);
    if (goal) {
      setFormData({
        title: goal.title,
        description: goal.description || "",
        goal_type: goal.goal_type,
        difficulty_level: goal.difficulty_level || "intermediate",
        target_date: goal.target_date || ""
      });
    }
  };

  useEffect(() => {
    loadGoal();
  }, []);

  const goalTypeLabels = {
    piece: "Learn a Piece",
    exam: "Pass an Exam",
    technique: "Improve Technique",
    performance: "Prepare Performance",
    general: "General Improvement"
  };

  const difficultyLabels = {
    beginner: "Beginner",
    intermediate: "Intermediate", 
    advanced: "Advanced"
  };

  if (loading) {
    return (
      <Card className="rounded-2xl bg-card border border-beige-300 shadow-soft">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Target className="h-5 w-5 text-apricot" />
            Your Musical Goal
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">Loading goal...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl bg-card border border-beige-300 shadow-soft">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Target className="h-5 w-5 text-apricot" />
          Your Musical Goal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {!goal && !editing ? (
          <div className="text-center py-6">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Set an overarching musical goal to get personalized practice insights and track your progress.
            </p>
            <Button 
              onClick={startEditing}
              className="bg-apricot text-white hover:bg-apricot-600 shadow-soft"
            >
              <Plus className="h-4 w-4 mr-2" />
              Set Your Goal
            </Button>
          </div>
        ) : editing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Goal Title</label>
              <input
                type="text"
                placeholder="e.g., Learn Chopin's Minute Waltz"
                className="w-full p-3 rounded-lg border border-beige-300 bg-white/80 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-apricot/20 focus:border-apricot"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Goal Type</label>
              <select
                className="w-full p-3 rounded-lg border border-beige-300 bg-white/80 text-foreground focus:outline-none focus:ring-2 focus:ring-apricot/20 focus:border-apricot"
                value={formData.goal_type}
                onChange={(e) => setFormData({...formData, goal_type: e.target.value as any})}
              >
                {Object.entries(goalTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Difficulty</label>
                <select
                  className="w-full p-3 rounded-lg border border-beige-300 bg-white/80 text-foreground focus:outline-none focus:ring-2 focus:ring-apricot/20 focus:border-apricot"
                  value={formData.difficulty_level}
                  onChange={(e) => setFormData({...formData, difficulty_level: e.target.value as any})}
                >
                  {Object.entries(difficultyLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Target Date</label>
                <input
                  type="date"
                  className="w-full p-3 rounded-lg border border-beige-300 bg-white/80 text-foreground focus:outline-none focus:ring-2 focus:ring-apricot/20 focus:border-apricot"
                  value={formData.target_date}
                  onChange={(e) => setFormData({...formData, target_date: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Description (Optional)</label>
              <Textarea
                placeholder="Add more details about your goal, current level, specific challenges..."
                className="min-h-[80px] rounded-lg border-beige-300 bg-white/80 text-foreground placeholder:text-muted-foreground resize-none focus:shadow-ring"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={saveGoal}
                disabled={saving || !formData.title.trim()}
                className="flex-1 bg-apricot text-white hover:bg-apricot-600 shadow-soft"
              >
                <Check className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : goal ? 'Update Goal' : 'Save Goal'}
              </Button>
              <Button 
                onClick={cancelEditing}
                disabled={saving}
                variant="outline"
                className="border-beige-300 hover:bg-muted/50"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : goal && (
          <div className="space-y-4">
            <div className="p-4 bg-apricot/5 border border-apricot/20 rounded-lg">
              <h3 className="font-semibold text-foreground mb-2">{goal.title}</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="px-2 py-1 bg-apricot/10 text-apricot text-xs rounded-full">
                  {goalTypeLabels[goal.goal_type]}
                </span>
                {goal.difficulty_level && (
                  <span className="px-2 py-1 bg-sage/10 text-sage text-xs rounded-full">
                    {difficultyLabels[goal.difficulty_level]}
                  </span>
                )}
                {goal.target_date && (
                  <span className="px-2 py-1 bg-amber/10 text-amber text-xs rounded-full flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(goal.target_date).toLocaleDateString()}
                  </span>
                )}
              </div>
              {goal.description && (
                <p className="text-sm text-muted-foreground">{goal.description}</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={startEditing}
                variant="outline"
                className="flex-1 border-beige-300 hover:bg-apricot/10 hover:border-apricot text-muted-foreground hover:text-apricot"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Goal
              </Button>
              <Button 
                onClick={pauseGoal}
                disabled={saving}
                variant="outline"
                className="border-amber/30 hover:bg-amber/10 text-amber hover:border-amber"
              >
                <Flag className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
