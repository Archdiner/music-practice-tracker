"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Music4, Plus, Trash2, CheckSquare, Square, X, Edit2, Check, Target, Lightbulb } from "lucide-react"
import { useState, useEffect } from "react"

export function TodayCard({ 
  onSaved, 
  selectedDate, 
  onDateReset 
}: { 
  onSaved?: () => void;
  selectedDate: string | null;
  onDateReset: () => void;
}) {
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [todayEntries, setTodayEntries] = useState<any[]>([])
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  
  // Practice Goals State
  const [practiceGoals, setPracticeGoals] = useState<{id: string, text: string, completed: boolean}[]>([])
  const [loadingGoals, setLoadingGoals] = useState(true)
  const [isAddingGoal, setIsAddingGoal] = useState(false)
  const [newGoalText, setNewGoalText] = useState("")
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [editingGoalText, setEditingGoalText] = useState("")
  
  // Daily tip state
  const [dailyTip, setDailyTip] = useState<string | null>(null)
  const [loadingTip, setLoadingTip] = useState(true)
  const [tipCached, setTipCached] = useState(false)
  const [tipGoalTitle, setTipGoalTitle] = useState<string | null>(null)

  const loadTodayEntries = async () => {
    try {
      const dateToLoad = selectedDate || new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/entries?date=${dateToLoad}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      
      if (res.ok) {
        const data = await res.json();
        setTodayEntries(data.entries || []);
      }
    } catch (error) {
      console.error("Failed to load entries:", error);
    } finally {
      setLoadingEntries(false);
    }
  };

  const deleteActivity = async (entryId: string, activityIndex: number) => {
    setDeletingId(`${entryId}-${activityIndex}`);
    try {
      const res = await fetch(`/api/entries/${entryId}?activityIndex=${activityIndex}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });
      
      if (res.ok) {
        await loadTodayEntries(); // Reload entries after deletion
        onSaved?.(); // Trigger refresh of other components
      } else {
        const errorData = await res.json();
        setErr(errorData.error || "Failed to delete activity");
      }
    } catch (error) {
      console.error("Failed to delete activity:", error);
      setErr("Network error deleting activity");
    } finally {
      setDeletingId(null);
    }
  };

  const loadPracticeGoals = async () => {
    try {
      setLoadingGoals(true);
      const res = await fetch("/api/practice-goals", {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      
      if (res.ok) {
        const data = await res.json();
        setPracticeGoals(data.goals || []);
      }
    } catch (error) {
      console.error("Failed to load practice goals:", error);
    } finally {
      setLoadingGoals(false);
    }
  };

  const addGoal = async () => {
    if (!newGoalText.trim()) return;
    
    try {
      const res = await fetch("/api/practice-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newGoalText.trim() })
      });
      
      if (res.ok) {
        const data = await res.json();
        setPracticeGoals(goals => [...goals, data.goal]);
        setNewGoalText("");
        setIsAddingGoal(false);
      }
    } catch (error) {
      console.error("Failed to add goal:", error);
    }
  };

  const updateGoal = async (goalId: string, updates: { text?: string; completed?: boolean }) => {
    try {
      const res = await fetch(`/api/practice-goals/${goalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      
      if (res.ok) {
        const data = await res.json();
        setPracticeGoals(goals => 
          goals.map(goal => 
            goal.id === goalId ? data.goal : goal
          )
        );
      }
    } catch (error) {
      console.error("Failed to update goal:", error);
    }
  };

  const deleteGoal = async (goalId: string) => {
    try {
      const res = await fetch(`/api/practice-goals/${goalId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });
      
      if (res.ok) {
        setPracticeGoals(goals => goals.filter(goal => goal.id !== goalId));
      }
    } catch (error) {
      console.error("Failed to delete goal:", error);
    }
  };

  const toggleGoal = (goalId: string) => {
    const goal = practiceGoals.find(g => g.id === goalId);
    if (goal) {
      updateGoal(goalId, { completed: !goal.completed });
    }
  };

  const startEditingGoal = (goalId: string, currentText: string) => {
    setEditingGoalId(goalId);
    setEditingGoalText(currentText);
  };

  const saveGoalEdit = async () => {
    if (!editingGoalId || !editingGoalText.trim()) return;
    
    await updateGoal(editingGoalId, { text: editingGoalText.trim() });
    setEditingGoalId(null);
    setEditingGoalText("");
  };

  const cancelGoalEdit = () => {
    setEditingGoalId(null);
    setEditingGoalText("");
  };

  const loadDailyTip = async (forceRegenerate = false) => {
    try {
      setLoadingTip(true);
      const url = forceRegenerate ? "/api/daily-tip?forceRegenerate=true" : "/api/daily-tip";
      const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      
      if (res.ok) {
        const data = await res.json();
        setDailyTip(data.tip);
        setTipCached(data.cached || false);
        setTipGoalTitle(data.goal_title || null);
        console.log(`Daily tip loaded: ${data.cached ? 'cached' : 'fresh'}`);
      }
    } catch (error) {
      console.error("Failed to load daily tip:", error);
    } finally {
      setLoadingTip(false);
    }
  };

  useEffect(() => {
    loadTodayEntries();
    loadDailyTip();
  }, [selectedDate]);

  useEffect(() => {
    // Only load goals once on component mount, not when selectedDate changes
    loadPracticeGoals();
  }, []);

  async function save(rawText: string) {
    setErr(null)
    if (!rawText.trim()) return;
    setIsSaving(true)
    try {
      const dateToSave = selectedDate || new Date().toISOString().split('T')[0];
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, date: dateToSave })
      })
      if (res.status === 401) {
        if (typeof window !== "undefined") window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as { error?: string }));
        setErr((j as { error?: string })?.error ?? "Failed to save");
        return;
      }
      setNotes("")
      // Reload entries after successful save
      await loadTodayEntries();
      onSaved?.()
    } catch {
      setErr("Network error")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="rounded-2xl bg-card border border-beige-300 shadow-soft h-fit">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Music4 className="h-5 w-5" />
            {selectedDate ? (
              <>
                Practice - {new Date(selectedDate).toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </>
            ) : (
              "Today's Practice"
            )}
          </CardTitle>
          {selectedDate && (
            <Button
              size="sm"
              variant="outline"
              onClick={onDateReset}
              className="text-xs border-beige-300 hover:bg-apricot/10 hover:border-apricot text-muted-foreground hover:text-apricot"
            >
              Back to Today
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Daily Tip Section */}
        {dailyTip && (
          <div className="p-3 bg-apricot/5 border border-apricot/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Target className="h-4 w-4 text-apricot mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-apricot">Today's Goal-Focused Tip</p>
                  <div className="flex items-center gap-1">
                    {tipCached && (
                      <span className="text-xs text-muted-foreground">cached</span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => loadDailyTip(true)}
                      disabled={loadingTip}
                      className="h-5 w-5 p-0 hover:bg-apricot/10"
                    >
                      <Lightbulb className="h-3 w-3 text-apricot" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-foreground">{dailyTip}</p>
                {tipGoalTitle && (
                  <p className="text-xs text-muted-foreground mt-1">For: {tipGoalTitle}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Practice notes & goals</p>
          <Textarea
            placeholder="What pieces are you working on today? Add practice notes, techniques to focus on..."
            className="min-h-[120px] rounded-2xl border-beige-400 bg-white/80 text-foreground placeholder:text-muted-foreground resize-none focus:shadow-ring"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSaving}
          />
        </div>

        <div className="flex gap-2 items-center">
          <Button size="sm" className="flex-1 bg-apricot text-white hover:bg-apricot-600 shadow-soft" onClick={() => save(notes)} disabled={isSaving}>
            <Plus className="h-4 w-4 mr-1" />
            Parse & Save
          </Button>
          {err && <span className="text-sm text-[#D26A6A]">{err}</span>}
        </div>

        {/* Practice Goals */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedDate ? 'Today\'s Practice Goals' : 'Today\'s Practice Goals'}
            </p>
            {!selectedDate && !isAddingGoal && practiceGoals.length < 5 && (
              <Button
                size="sm"
                onClick={() => setIsAddingGoal(true)}
                className="h-6 px-2 text-xs bg-sage/10 hover:bg-sage/20 text-sage border border-sage/20"
              >
                + Add Goal
              </Button>
            )}
          </div>
          
          {loadingGoals ? (
            <div className="text-sm text-muted-foreground">Loading goals...</div>
          ) : (
            <div className="space-y-2">
              {practiceGoals.map((goal) => (
                <div 
                  key={goal.id}
                  className="flex items-center gap-2 p-2 border border-beige-300/50 rounded-lg bg-card/50 hover:bg-card/70 transition-colors group"
                >
                  <div 
                    className="flex-shrink-0 cursor-pointer"
                    onClick={() => toggleGoal(goal.id)}
                  >
                    {goal.completed ? (
                      <CheckSquare className="h-4 w-4 text-sage" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground hover:text-sage transition-colors" />
                    )}
                  </div>
                  
                  {editingGoalId === goal.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editingGoalText}
                        onChange={(e) => setEditingGoalText(e.target.value)}
                        className="text-sm bg-transparent border-b border-sage focus:outline-none flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveGoalEdit();
                          if (e.key === 'Escape') cancelGoalEdit();
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={saveGoalEdit}
                        className="h-5 w-5 p-0 bg-sage hover:bg-sage-600"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={cancelGoalEdit}
                        className="h-5 w-5 p-0 bg-gray-400 hover:bg-gray-500"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <span 
                        className={`text-sm flex-1 ${!selectedDate ? 'cursor-pointer' : ''} ${goal.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                        onClick={() => !selectedDate && startEditingGoal(goal.id, goal.text)}
                      >
                        {goal.text}
                      </span>
                      {!selectedDate && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            onClick={() => startEditingGoal(goal.id, goal.text)}
                            className="h-5 w-5 p-0 bg-transparent hover:bg-sage/10 border border-sage/20 hover:border-sage"
                          >
                            <Edit2 className="h-3 w-3 text-sage" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => deleteGoal(goal.id)}
                            className="h-5 w-5 p-0 bg-transparent hover:bg-red-50 border border-red-300/20 hover:border-red-400"
                          >
                            <X className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {isAddingGoal && (
                <div className="flex items-center gap-2 p-2 border border-sage/50 rounded-lg bg-sage/5">
                  <Square className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <input
                    type="text"
                    value={newGoalText}
                    onChange={(e) => setNewGoalText(e.target.value)}
                    placeholder="Enter practice goal..."
                    className="text-sm bg-transparent border-b border-sage focus:outline-none flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addGoal();
                      if (e.key === 'Escape') {
                        setIsAddingGoal(false);
                        setNewGoalText("");
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={addGoal}
                    className="h-5 w-5 p-0 bg-sage hover:bg-sage-600"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsAddingGoal(false);
                      setNewGoalText("");
                    }}
                    className="h-5 w-5 p-0 bg-gray-400 hover:bg-gray-500"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              
              {practiceGoals.length === 0 && !isAddingGoal && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No practice goals yet. Click "Add Goal" to get started!
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-beige-300">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">
              {selectedDate ? 'Practice Sessions' : "Today's Practice Sessions"}
            </p>
            {todayEntries.length > 0 && (() => {
              const allActivities = todayEntries.flatMap(entry => entry.activities || []);
              const goalRelatedActivities = allActivities.filter(act => act.goal_related);
              const goalRelatedMinutes = goalRelatedActivities.reduce((sum, act) => sum + (act.minutes || 0), 0);
              const totalMinutes = allActivities.reduce((sum, act) => sum + (act.minutes || 0), 0);
              const goalPercentage = totalMinutes > 0 ? Math.round((goalRelatedMinutes / totalMinutes) * 100) : 0;
              
              return goalPercentage > 0 ? (
                <div className="flex items-center gap-1">
                  <Target className="h-3 w-3 text-apricot" />
                  <span className="text-xs text-apricot font-medium">{goalPercentage}% goal-focused</span>
                </div>
              ) : null;
            })()}
          </div>
          <div className="space-y-2">
            {loadingEntries ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : todayEntries.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                {selectedDate ? 'No practice sessions logged for this date' : "No practice sessions logged today"}
              </div>
            ) : (
              todayEntries.flatMap((entry) => 
                entry.activities?.map((activity: any, actIndex: number) => (
                  <div key={`${entry.id}-${actIndex}`} className={`flex items-center justify-between p-2 border-2 rounded-lg ${
                    activity.goal_related 
                      ? 'border-apricot bg-apricot/8' 
                      : 'border-beige-300/50 bg-card/50'
                  }`}>
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.category === 'Technique' ? 'bg-sage' :
                        activity.category === 'Repertoire' ? 'bg-amber' :
                        activity.category === 'Theory' ? 'bg-blue-400' :
                        activity.category === 'Ear' ? 'bg-purple-400' :
                        activity.category === 'Improvisation' ? 'bg-green-400' :
                        activity.category === 'Recording' ? 'bg-red-400' :
                        'bg-gray-400'
                      }`}></div>
                      <span className="text-foreground">
                        {activity.sub} - {activity.minutes}min
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({activity.category})
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteActivity(entry.id, actIndex)}
                      disabled={deletingId === `${entry.id}-${actIndex}`}
                      className="h-6 w-6 p-0 border-red-300 hover:bg-red-50 hover:border-red-400"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                )) || []
              )
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
