import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
});

/**
 * Smart Scripture Detection API
 * Uses GPT-4o-mini to detect scripture references from natural sermon speech.
 * Handles variations like:
 * - "turn to John chapter 3 verse 16"
 * - "the book of Isaiah says..."
 * - "First Corinthians tells us..."
 * - "as we read in Psalm 23"
 */
export async function POST(req: Request) {
    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    try {
        const { transcript, context } = await req.json();

        if (!transcript || transcript.trim().length < 5) {
            return NextResponse.json({ scriptures: [] });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You detect Bible scripture references AND navigation commands in sermon transcripts for a church projector.

RESPOND with JSON in this format:
{
  "scriptures": [{"book": "John", "chapter": 3, "verse": 16}],
  "commands": []
}

SCRIPTURE PATTERNS to detect:
- "John 3:16" or "John chapter 3 verse 16"
- "the book of Proverbs chapter 3 verse 5"
- "Psalm 23" or "First Corinthians 13"

NAVIGATION COMMANDS to detect:
- "next verse" / "the next verse" / "verse 17" → {"type": "next_verse"}
- "previous verse" / "go back" / "back one verse" → {"type": "prev_verse"}
- "next chapter" → {"type": "next_chapter"}
- "previous chapter" → {"type": "prev_chapter"}
- "clear" / "clear screen" / "blank" → {"type": "clear"}

Rules:
- Convert spoken numbers: "three" → 3
- If only chapter given, verse = 1
- Standard book names (John, Genesis, Psalm)`
                },
                {
                    role: "user",
                    content: `Detect scriptures and commands:\n\n"${transcript}"`
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0,
            max_tokens: 200,
        });

        console.log("[DetectAPI] LLM response:", response.choices[0]?.message?.content);

        const content = response.choices[0]?.message?.content || '{"scriptures":[]}';

        try {
            const parsed = JSON.parse(content);
            const scriptures = parsed.scriptures || [];
            const commands = parsed.commands || [];

            // Validate and normalize scriptures
            const validatedScriptures = (Array.isArray(scriptures) ? scriptures : [])
                .filter((s: any) => s.book && s.chapter)
                .map((s: any) => ({
                    book: normalizeBookName(s.book),
                    chapter: parseInt(s.chapter) || 1,
                    verse: parseInt(s.verse) || 1,
                    verseEnd: s.verseEnd ? parseInt(s.verseEnd) : undefined,
                }));

            // Validate commands
            const validCommands = ['next_verse', 'prev_verse', 'next_chapter', 'prev_chapter', 'clear'];
            const validatedCommands = (Array.isArray(commands) ? commands : [])
                .filter((c: any) => c.type && validCommands.includes(c.type))
                .map((c: any) => ({ type: c.type }));

            return NextResponse.json({
                scriptures: validatedScriptures,
                commands: validatedCommands
            });
        } catch (parseError) {
            console.error("Failed to parse LLM response:", content);
            return NextResponse.json({ scriptures: [], commands: [] });
        }

    } catch (error: any) {
        console.error("Scripture detection error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Normalize book names to standard format
 */
function normalizeBookName(book: string): string {
    const normalized = book.trim();

    // Handle ordinal prefixes
    const ordinalMap: Record<string, string> = {
        'first': '1',
        'second': '2',
        'third': '3',
        '1st': '1',
        '2nd': '2',
        '3rd': '3',
        'i': '1',
        'ii': '2',
        'iii': '3',
    };

    let result = normalized;

    // Replace ordinal words at start
    for (const [word, num] of Object.entries(ordinalMap)) {
        const regex = new RegExp(`^${word}\\s+`, 'i');
        if (regex.test(result)) {
            result = result.replace(regex, `${num} `);
            break;
        }
    }

    // Capitalize properly
    return result
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}
