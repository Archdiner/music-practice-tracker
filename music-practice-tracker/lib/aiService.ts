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
  minutes: z.number().min(1).max(240)
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

  async parseEntry(rawText: string): Promise<ParsedEntry> {
    const prompt = `You are a music practice tracker AI. Parse the following practice session description into structured JSON.

CATEGORIES (use exactly these):
- "Technique": scales, arpeggios, exercises, finger work, bow technique, breathing, embouchure, posture
- "Repertoire": specific pieces, songs, compositions, etudes, studies
- "Improvisation": improvisation, jamming, free play, composition, songwriting
- "Ear": ear training, interval recognition, chord identification, transcription
- "Theory": music theory, harmony, analysis, sight-reading, rhythm studies
- "Recording": recording, mixing, production, audio work

RULES:
1. Extract time durations from text (30min, 1 hour, half hour, etc.)
2. If no time specified, estimate reasonable duration (10-30 minutes)
3. Create clear, standardized descriptions for "sub" field
4. Total minutes should not exceed 240 (4 hours)
5. Each activity should be 1-240 minutes
6. Return 1-10 activities maximum

INPUT: "${rawText}"

Return ONLY valid JSON in this exact format:
{
  "total_minutes": <number>,
  "activities": [
    {
      "category": "<category>",
      "sub": "<clear description>",
      "minutes": <number>
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
