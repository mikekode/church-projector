import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'smart_api.log');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
});

/**
 * Smart Scripture Detection API (PersonaPlex-style)
 */

export type DetectionSignal = 'WAIT' | 'SWITCH' | 'HOLD';

export type NavigationCommand = {
    type: 'next_verse' | 'prev_verse' | 'next_chapter' | 'prev_chapter' | 'clear' | 'jump_to_verse' | 'switch_translation';
    verse?: number;
    verseCount?: number;
    version?: string;
};

export type SmartDetectionResult = {
    scriptures: {
        book: string;
        chapter: number;
        verse: number;
        verseEnd?: number;
        confidence: number;
        matchType: 'exact' | 'partial' | 'paraphrase';
        reason: string;
    }[];
    commands: NavigationCommand[];
    signal: DetectionSignal;
    signalReason: string;
    verseCount?: number;
};

export async function POST(req: Request) {
    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    try {
        const {
            text,
            context,
            pastorHints,
            currentVerse,
            chapterContext,
        } = await req.json();

        fs.appendFileSync(LOG_FILE, `[REQ] ${new Date().toISOString()} | text: "${text}" | context: "${chapterContext}"\n`);

        if (!text || text.trim().length < 3) {
            return NextResponse.json({
                scriptures: [],
                commands: [],
                signal: 'WAIT',
                signalReason: 'Insufficient text'
            });
        }

        const systemPrompt = buildSystemPrompt(pastorHints, currentVerse, chapterContext);

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `Context: "${context || 'none'}"\n\nNew text: "${text}"\n\nAnalyze for scripture references and commands.`
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0,
            max_tokens: 300,
        });

        const content = response.choices[0]?.message?.content || '{}';
        fs.appendFileSync(LOG_FILE, `[RES] ${content}\n`);

        try {
            const parsed = JSON.parse(content);
            return NextResponse.json(validateAndNormalize(parsed));
        } catch (parseError) {
            console.error("Failed to parse:", content);
            return NextResponse.json({
                scriptures: [],
                commands: [],
                signal: 'WAIT',
                signalReason: 'Parse error'
            });
        }

    } catch (error: any) {
        console.error("Smart detection error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

function buildSystemPrompt(pastorHints?: string, currentVerse?: string, chapterContext?: string): string {
    let prompt = `You are a real-time scripture detection system for a church projector. You analyze small text windows (5-15 words) from live sermon transcription.

RESPOND with JSON:
{
  "scriptures": [
    {
      "book": "string",
      "chapter": number,
      "verse": number,
      "confidence": number,
      "matchType": "exact" | "partial" | "paraphrase",
      "reason": "string"
    }
  ],
  "commands": [...],
  "signal": "SWITCH" | "HOLD" | "WAIT",
  "signalReason": "string",
  "verseCount": 1
}

STRICT RULE: You MUST ALWAYS include "verseCount" (1, 2, or 3) in the JSON response whenever "scriptures" or "commands" are not empty. Default to 1 if only one verse is mentioned or implied.

DETECTION TYPES:
- "exact": Direct verse reference like "John 3:16" or "John chapter 3 verse 16"
- "partial": Incomplete reference like "For God so loved..." (recognizable start of verse)
- "paraphrase": Sermon paraphrase like "Paul tells us love is patient" (1 Cor 13:4)

CONFIDENCE SCORING (0-100):
- 90-100: Direct reference or unmistakable quote
- 70-89: Strong match, high certainty
- 50-69: Likely match but could be ambiguous
- Below 50: Don't include (too uncertain)

SIGNALS:
- "SWITCH": High confidence detection (>=80), switch projector NOW
- "HOLD": Currently displaying correct verse, no change needed
- "WAIT": No clear detection yet, keep listening

NAVIGATION COMMANDS (only if explicitly stated):
- "next verse" / "go forward" -> {"type": "next_verse"}
- "previous verse" / "go back" / "previous" / "last" / "go to the previous" -> {"type": "prev_verse"}
- "verse [number]" -> {"type": "jump_to_verse", "verse": [number]}
- "next chapter" -> {"type": "next_chapter"}
- "previous chapter" -> {"type": "prev_chapter"}
- "clear" / "clear screen" -> {"type": "clear"}
- "give me this in [version]" / "switch to [version]" / "[version] version" -> {"type": "switch_translation", "version": "[ID]"}

BIBLE VERSION IDs:
- King James Version / KJV -> "KJV"
- New King James / NKJV -> "NKJV"
- American Standard / ASV -> "ASV"
- Revised Standard / RSV -> "RSV"
- New Living Translation / NLT -> "NLT"
- Amplified / AMP -> "AMP"
- Amplified Classic / AMPC -> "AMPC"
- New International / NIV -> "NIV"

LOGIC FOR VERSE NUMBERS:
- If speaker says "go to verse 5" while on verse 4, return {"type": "jump_to_verse", "verse": 5}
- If speaker says "let's go back to verse 1" while on verse 8, return {"type": "jump_to_verse", "verse": 1}
- Always use "jump_to_verse" for specific numbers.

MULTI-VERSE DETECTION:
- If speaker says "together", "and", or mentions a range like "verse 9 and 10", set "verseCount" accordingly.
- "Show me verse 15 and 16 together" -> verse: 15, verseCount: 2
- "Read verses 1 through 3" -> verse: 1, verseCount: 3
- Max verseCount is 3.

RULES:
- Convert spoken numbers: "three" -> 3
- Always use "Revelation" (singular), never "Revelations" (plural).
- Always use "Song of Solomon" (canonical name).
- Standard book names (John not Jn)
- Be aggressive on partial detection`;

    if (pastorHints) {
        prompt += `\n\nPASTOR CONTEXT:\n${pastorHints}`;
    }

    if (currentVerse) {
        prompt += `\n\nCURRENTLY DISPLAYING: ${currentVerse}
- If text relates to the current verse, signal "HOLD"
- Use CURRENTLY DISPLAYING info to resolve relative navigation correctly.`;
    }

    if (chapterContext) {
        prompt += `\n\nACTIVE CHAPTER CONTEXT: ${chapterContext}
- The speaker has just mentioned this chapter.
- If the speaker starts quoting or PARAPHRASING text that matches a verse IN THIS CHAPTER, return that verse reference.
- Favor verses from ${chapterContext} if the text matches the content, even if the speaker DOES NOT say a verse number.
- High confidence (90+) for content matches within this active chapter.`;
    }

    return prompt;
}

function validateAndNormalize(parsed: any): SmartDetectionResult {
    const scriptures = (Array.isArray(parsed.scriptures) ? parsed.scriptures : [])
        .map((s: any) => {
            if (typeof s === 'string') {
                // Handle case where AI returns a simple string "Genesis 1:1"
                const match = s.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
                if (match) {
                    return {
                        book: normalizeBookName(match[1]),
                        chapter: parseInt(match[2]),
                        verse: parseInt(match[3]),
                        verseEnd: match[4] ? parseInt(match[4]) : undefined,
                        confidence: 90, // Default high confidence for explicit strings
                        matchType: 'exact',
                        reason: 'AI string match'
                    };
                }
                return null;
            }
            return {
                book: normalizeBookName(s.book || ''),
                chapter: parseInt(s.chapter) || 1,
                verse: parseInt(s.verse) || 1,
                verseEnd: s.verseEnd ? parseInt(s.verseEnd) : undefined,
                confidence: Math.min(100, Math.max(0, parseInt(s.confidence) || 50)),
                matchType: ['exact', 'partial', 'paraphrase'].includes(s.matchType) ? s.matchType : 'exact',
                reason: s.reason || 'Detected',
            };
        })
        .filter((s: any) => s && s.book && s.chapter && s.confidence >= 50)
        .sort((a: any, b: any) => b.confidence - a.confidence);

    const validCommands = ['next_verse', 'prev_verse', 'next_chapter', 'prev_chapter', 'clear', 'jump_to_verse', 'switch_translation'];

    // Normalize commands to array
    let rawCommands = parsed.commands;
    if (rawCommands && !Array.isArray(rawCommands)) {
        rawCommands = [rawCommands];
    }

    const commands = (Array.isArray(rawCommands) ? rawCommands : [])
        .filter((c: any) => c && c.type && validCommands.includes(c.type))
        .map((c: any) => ({
            type: c.type,
            verse: c.verse ? parseInt(c.verse) : undefined,
            version: c.version?.toUpperCase()
        }));

    let signal: DetectionSignal = parsed.signal || 'WAIT';
    let signalReason = parsed.signalReason || '';

    if (scriptures.length > 0 && scriptures[0].confidence >= 80) {
        signal = 'SWITCH';
    } else if (commands.length > 0) {
        signal = 'SWITCH';
    } else if (!scriptures.length && !commands.length) {
        signal = 'WAIT';
    }

    let verseCount = parsed.verseCount ? Math.min(3, Math.max(1, parseInt(parsed.verseCount))) : undefined;

    // RULE: If we have a detection or command but no explicit verseCount from AI, default to 1
    // This prevents being "stuck" in a previous multi-verse state.
    if (!verseCount && (scriptures.length > 0 || commands.length > 0)) {
        verseCount = 1;
    }

    return {
        scriptures,
        commands: commands.map((c: any) => ({ ...c, verseCount: c.verseCount || verseCount })),
        signal,
        signalReason,
        verseCount
    };
}

function normalizeBookName(book: string): string {
    const normalized = book.trim();
    const ordinalMap: Record<string, string> = {
        'first': '1', 'second': '2', 'third': '3',
        '1st': '1', '2nd': '2', '3rd': '3',
        'i': '1', 'ii': '2', 'iii': '3'
    };
    let result = normalized;
    for (const [word, num] of Object.entries(ordinalMap)) {
        const regex = new RegExp(`^${word}\\s+`, 'i');
        if (regex.test(result)) {
            result = result.replace(regex, `${num} `);
            break;
        }
    }
    if (result.toLowerCase() === 'song of solomon' || result.toLowerCase() === 'songs of solomon' || result.toLowerCase() === 'sos') {
        result = 'Song of Solomon';
    }
    if (result.toLowerCase() === 'song of songs' || result.toLowerCase() === 'canticles') {
        result = 'Song of Solomon';
    }
    if (result.toLowerCase() === 'revelations' || result.toLowerCase() === 'rev' || result.toLowerCase() === 're' || result.toLowerCase() === 'rv') {
        result = 'Revelation';
    }
    if (result.toLowerCase() === 'psalms' || result.toLowerCase() === 'psa' || result.toLowerCase() === 'ps') {
        result = 'Psalm';
    }
    return result.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}
