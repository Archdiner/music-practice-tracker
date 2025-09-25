// Heuristic, zero-cost musicality confidence scoring for goals and practice logs
// Returns a score in [0,1] and contributing reasons for observability/UX

export interface ConfidenceResult {
  score: number; // 0.0 to 1.0
  reasons: string[];
}

const START_VERBS = [
  "learn","practice","master","prepare","perform","memorize","record","compose",
  "arrange","improvise","transcribe","analyze","study","rehearse","sight read","sight-read",
  "warm up","warm-up"
];

const MUSICAL_KEYWORDS = [
  // general
  "music","musical","piece","song","repertoire","etude","etudes","work","composition","concert",
  // instruments
  "piano","guitar","violin","cello","viola","flute","clarinet","sax","saxophone","trumpet","trombone","horn","tuba","drums","drum","percussion","bass","voice","vocal","singing",
  // technique/skills
  "technique","scale","scales","arpeggio","arpeggios","chord","chords","voicing","voicings","harmony","theory","rhythm","tempo","metronome","ear training","ear-training","sight reading","sight-reading",
  // activities
  "improv","improvisation","transcription","composition","arranging","recording","mixing","production",
  // exams/contexts
  "exam","recital","audition","performance"
];

const MUSICAL_HINTS_REGEX: RegExp[] = [
  /\bii[-\s]?V[-\s]?I\b/i,
  /\bBPM\b/i,
  /\b([ACDFG]#?|Eb|Bb|Ab|Db)\s+(major|minor)\b/i,
  /\b(measures?|bars?)\s+\d+(-\d+)?\b/i,
  /\b(tempo|metronome|sight[-\s]?reading)\b/i,
  /\b(scale|arpeggio|interval|chord)s?\b/i
];

const NON_MUSICAL_HINTS = [
  "burger","grocer","groceries","gym","workout","marathon","10k","5k","triathlon","run club",
  "crypto","stock","shopping","laundry","errand","movie","tv","game","gaming"
];

function includesAny(text: string, list: string[]): boolean {
  const t = text.toLowerCase();
  return list.some(k => t.includes(k));
}

function startsWithAny(text: string, starters: string[]): string | null {
  const t = text.trim().toLowerCase();
  for (const v of starters) {
    if (t.startsWith(v)) return v;
  }
  return null;
}

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)); }

export function scoreMusicalityForGoal(title: string, description?: string | null): ConfidenceResult {
  const txt = `${title || ''} ${description || ''}`.trim();
  const reasons: string[] = [];
  let score = 0;

  // Starter verb boost
  const starter = startsWithAny(title || '', START_VERBS);
  if (starter) { score += 0.35; reasons.push(`starts_with_verb:${starter}`); }

  // Musical keywords
  if (includesAny(txt, MUSICAL_KEYWORDS)) { score += 0.35; reasons.push("has_musical_keyword"); }

  // Musical regex hints
  const hintMatch = MUSICAL_HINTS_REGEX.some(r => r.test(txt));
  if (hintMatch) { score += 0.2; reasons.push("matches_musical_hint"); }

  // Song/piece indicator patterns
  if (/\b(song|piece|etude|opus|op\.|no\.)\b/i.test(txt)) { score += 0.15; reasons.push("has_song_or_piece_indicator"); }
  if (/\bby\s+[A-Z][a-z]+\b/.test(title)) { score += 0.1; reasons.push("artist_by_clause"); }

  // Penalties for non-musical hints if no musical signals
  const nonMusical = includesAny(txt, NON_MUSICAL_HINTS);
  if (nonMusical && score < 0.35) { score -= 0.25; reasons.push("non_musical_terms"); }

  return { score: clamp01(score), reasons };
}

export function scoreMusicalityForPractice(rawText: string): ConfidenceResult {
  const txt = (rawText || '').trim();
  const reasons: string[] = [];
  let score = 0;

  // Duration/time cues
  if (/\b(\d+\s*(min|mins|minutes|hr|hour|hours))\b/i.test(txt)) { score += 0.2; reasons.push("has_duration"); }

  // Musical keywords and hints
  if (includesAny(txt, MUSICAL_KEYWORDS)) { score += 0.35; reasons.push("has_musical_keyword"); }
  if (MUSICAL_HINTS_REGEX.some(r => r.test(txt))) { score += 0.25; reasons.push("matches_musical_hint"); }

  // Action verbs
  const starter = startsWithAny(txt, START_VERBS);
  if (starter) { score += 0.2; reasons.push(`starts_with_verb:${starter}`); }

  // Category-like words
  if (/(technique|repertoire|theory|ear|recording|improvisation)/i.test(txt)) { score += 0.15; reasons.push("has_category_word"); }

  // Penalty for strong non-musical hints absent other signals
  const nonMusical = includesAny(txt, NON_MUSICAL_HINTS);
  if (nonMusical && score < 0.35) { score -= 0.3; reasons.push("non_musical_terms"); }

  return { score: clamp01(score), reasons };
}

export const DEFAULT_GOAL_CONFIDENCE_THRESHOLD = 0.4;
export const DEFAULT_PRACTICE_CONFIDENCE_THRESHOLD = 0.4;


