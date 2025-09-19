import OpenAI from 'openai';
import { z } from 'zod';

// Validation schema for AI parsing output
const ActivitySchema = z.object({
  category: z.enum([
    "Technique", 
    "Improvisation", 
    "Ear", 
    "Theory", 
    "Recording", 
    "Repertoire"
  ]),
  sub: z.string().min(1).max(100),
  minutes: z.number().min(1).max(240),
  goal_related: z.boolean().optional() // Flag if activity relates to overarching goal
});

const ParsedEntrySchema = z.object({
  total_minutes: z.number().min(1).max(240),
  activities: z.array(ActivitySchema).min(1).max(10)
});

export type Activity = z.infer<typeof ActivitySchema>;
export type ParsedEntry = z.infer<typeof ParsedEntrySchema>;

class MusicPracticeAI {
  private openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async parseEntry(rawText: string, userGoal?: OverarchingGoal): Promise<ParsedEntry> {
    const goalContext = userGoal ? `
USER'S OVERARCHING GOAL:
- Goal: ${userGoal.title}
- Type: ${userGoal.goal_type}
- Description: ${userGoal.description || 'No additional details'}
` : '';

    const prompt = `You are a music practice tracker AI. Parse the following practice session description into structured JSON.
${goalContext}
CATEGORIES (use exactly these):
- "Technique": scales, arpeggios, exercises, finger work, bow technique, breathing, embouchure, posture
- "Repertoire": specific pieces, songs, compositions, etudes, studies
- "Improvisation": improvisation, jamming, free play, composition, songwriting
- "Ear": ear training, interval recognition, chord identification, transcription
- "Theory": music theory, harmony, analysis, sight-reading, rhythm studies
- "Recording": recording, mixing, production, audio work

RULES:
1. Extract time durations from text (30min, 1 hour, half hour, etc.)
2. If no time specified, estimate reasonable duration in minutes
3. Create clear, standardized descriptions for "sub" field
4. Total minutes should not exceed 240 (4 hours)
5. Each activity should be 1-240 minutes
6. Return 1-10 activities maximum
7. ${userGoal ? 'Set goal_related to true if the activity directly helps with their overarching goal' : 'Set goal_related to false for all activities'}

INPUT: "${rawText}"

Return ONLY valid JSON in this exact format:
{
  "total_minutes": <number>,
  "activities": [
    {
      "category": "<category>",
      "sub": "<clear description>",
      "minutes": <number>,
      "goal_related": <boolean>
    }
  ]
}

Examples of good "sub" descriptions:
- "Major scales - C, G, D"
- "Bach Invention No. 1 - hands together"
- "Jazz improvisation over ii-V-I"
- "Interval recognition training"
- "Chord progressions in A minor"
- "Recording demo track"`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini", // More cost-effective than gpt-4
        messages: [
          {
            role: "system",
            content: "You are a precise music practice parser. Return only valid JSON, no additional text or formatting."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent parsing
        max_tokens: 500,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse and validate JSON response
      let parsedResult;
      try {
        parsedResult = JSON.parse(content);
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        throw new Error('Invalid JSON response from AI');
      }

      // Validate against schema
      const validatedResult = ParsedEntrySchema.parse(parsedResult);
      
      // Ensure total_minutes matches sum of activities
      const calculatedTotal = validatedResult.activities.reduce((sum, act) => sum + act.minutes, 0);
      validatedResult.total_minutes = Math.min(calculatedTotal, 240);

      return validatedResult;

    } catch (error) {
      console.error('AI parsing error:', error);
      
      // If AI fails, throw error so we can fallback to heuristic parsing
      if (error instanceof z.ZodError) {
        throw new Error(`AI parsing validation failed: ${error.errors.map(e => e.message).join(', ')}`);
      }
      
      throw new Error(`AI parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateWeeklyInsights(weekData: WeeklyData): Promise<WeeklyInsights> {
    const goalContext = weekData.overarchingGoal ? `
OVERARCHING GOAL:
- Goal: ${weekData.overarchingGoal.title}
- Type: ${weekData.overarchingGoal.goal_type}
- Difficulty: ${weekData.overarchingGoal.difficulty_level || 'Not specified'}
- Target Date: ${weekData.overarchingGoal.target_date ? new Date(weekData.overarchingGoal.target_date).toLocaleDateString() : 'No deadline set'}
- Description: ${weekData.overarchingGoal.description || 'No additional details'}
` : '';

    const prompt = `You are a music practice coach AI. Generate personalized weekly insights based on practice data.
${goalContext}
WEEK SUMMARY:
- Total practice time: ${weekData.totalMinutes} minutes (${Math.round(weekData.totalMinutes/60*10)/10} hours)
- Days practiced: ${weekData.daysPracticed}/7
- Days hit daily goal (${weekData.dailyTarget}min): ${weekData.daysHitGoal}/7
- Previous week: ${weekData.previousWeekMinutes || 'N/A'} minutes

CATEGORY BREAKDOWN:
${Object.entries(weekData.categoryMinutes).map(([cat, mins]) => 
  `- ${cat}: ${mins} minutes (${Math.round(mins/weekData.totalMinutes*100)}%)`
).join('\n')}

PRACTICE ACTIVITIES:
${weekData.activities.slice(0, 10).map(act => `- ${act.sub} (${act.minutes}min)`).join('\n')}

Generate insights in this JSON format:
{
  "summary": "2-3 sentence overview of the week's practice",
  "insights": [
    {
      "type": "progress|achievement|concern|recommendation",
      "title": "Short title (max 25 chars)",
      "content": "Detailed insight (max 120 chars)",
      "icon": "trending-up|award|alert-circle|target"
    }
  ],
  "recommendations": [
    "Specific actionable recommendation 1",
    "Specific actionable recommendation 2"
  ]
}

GUIDELINES:
1. Be encouraging and constructive
2. Highlight both achievements and areas for improvement  
3. Make recommendations specific and actionable
4. Use musician-friendly language
5. Compare to previous week if data available
6. Focus on balance across categories
7. Celebrate consistency and progress
8. ${weekData.overarchingGoal ? 'ALWAYS include at least ONE insight about progress toward their overarching goal' : 'Focus on general improvement'}
9. ${weekData.overarchingGoal ? 'Connect practice activities to goal advancement when relevant' : ''}
10. Maximum 4 insights, 3 recommendations`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system", 
            content: "You are an expert music practice coach. Generate helpful, encouraging insights in valid JSON format only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3, // Slightly creative but consistent
        max_tokens: 800,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse and validate JSON response
      let parsedResult;
      try {
        parsedResult = JSON.parse(content);
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        throw new Error('Invalid JSON response from AI');
      }

      // Basic validation
      if (!parsedResult.summary || !Array.isArray(parsedResult.insights)) {
        throw new Error('Invalid insights structure from AI');
      }

      return parsedResult as WeeklyInsights;

    } catch (error) {
      console.error('AI insights generation error:', error);
      throw new Error(`AI insights generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateDailyTip(goal: OverarchingGoal, recentPractice: any[]): Promise<string> {
    const recentActivities = recentPractice
      .flatMap(log => log.activities || [])
      .slice(0, 10)
      .map(act => `${act.sub} (${act.minutes}min)`)
      .join(', ');

    const daysUntilTarget = goal.target_date 
      ? Math.ceil((new Date(goal.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const prompt = `You are a music practice coach. Generate ONE specific, actionable practice tip for today.

USER'S GOAL:
- Title: ${goal.title}
- Type: ${goal.goal_type}
- Difficulty: ${goal.difficulty_level || 'Not specified'}
- Target Date: ${goal.target_date ? `${daysUntilTarget} days away` : 'No deadline'}
- Description: ${goal.description || 'No additional details'}

RECENT PRACTICE (last 7 days):
${recentActivities || 'No recent practice logged'}

Generate a specific practice tip for TODAY that directly helps them progress toward their goal.

REQUIREMENTS:
- ONE sentence only
- Specific and actionable
- Directly related to their goal
- Appropriate for their skill level
- Focus on today's practice session

Examples:
- "Practice measures 16-24 of your Chopin piece slowly, focusing on the left-hand arpeggios."
- "Spend 15 minutes on C major scales at 100 BPM to build finger independence for your exam."
- "Work on sight-reading simple pieces in the key of your target composition."

Return ONLY the tip text, no extra formatting or explanations.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a concise music practice coach. Provide specific, actionable daily practice tips."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.4, // Slightly creative but focused
        max_tokens: 100,
      });

      const tip = completion.choices[0]?.message?.content?.trim();
      if (!tip) {
        throw new Error('No tip generated from AI');
      }

      return tip;

    } catch (error) {
      console.error('AI daily tip generation error:', error);
      throw new Error(`AI daily tip generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Types for overarching goals
export interface OverarchingGoal {
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

// Types for weekly insights
export interface WeeklyData {
  totalMinutes: number;
  daysPracticed: number;
  daysHitGoal: number;
  dailyTarget: number;
  previousWeekMinutes?: number;
  categoryMinutes: Record<string, number>;
  activities: Array<{
    category: string;
    sub: string;
    minutes: number;
  }>;
  overarchingGoal?: OverarchingGoal;
}

export interface WeeklyInsight {
  type: 'progress' | 'achievement' | 'concern' | 'recommendation';
  title: string;
  content: string;
  icon: 'trending-up' | 'award' | 'alert-circle' | 'target';
}

export interface WeeklyInsights {
  summary: string;
  insights: WeeklyInsight[];
  recommendations: string[];
}

// Singleton instance
let aiInstance: MusicPracticeAI | null = null;

export function getAIService(): MusicPracticeAI {
  if (!aiInstance) {
    aiInstance = new MusicPracticeAI();
  }
  return aiInstance;
}

// Fallback heuristic parsing (existing logic)
export function parseHeuristic(raw: string): ParsedEntry {
  const chunks = raw.split(/[;,]+/).map(s=>s.trim()).filter(Boolean);
  let total = 0;
  
  const acts = chunks.map(c=>{
    const m = c.match(/(\d+)\s*(m|min)/i);
    const minutes = m ? parseInt(m[1],10) : 10;
    total += minutes;
    const sub = c.replace(/(\d+)\s*(m|min)/i,'').trim() || "General practice";
    
    const cat =
      /(scale|arpeggio|slap|metronome|technique|finger|bow|breathing)/i.test(sub) ? "Technique" :
      /(improv|jam|composition|songwriting)/i.test(sub) ? "Improvisation" :
      /(ear|interval|transcription|chord identification)/i.test(sub) ? "Ear" :
      /(theory|mode|harmony|sight.reading|rhythm)/i.test(sub) ? "Theory" :
      /(record|mix|production|audio)/i.test(sub) ? "Recording" :
      "Repertoire";
      
    return { category: cat as Activity['category'], sub, minutes };
  });
  
  if (!acts.length) {
    return { 
      total_minutes: 30, 
      activities: [{ category: "Repertoire", sub: "General practice", minutes: 30 }] 
    };
  }
  
  return { total_minutes: Math.min(total, 240), activities: acts };
}
