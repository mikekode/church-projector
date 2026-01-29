
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// Initialize clients (lazy load to avoid build errors if keys missing)
const getGeminiClient = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    return new GoogleGenerativeAI(key);
};

const getOpenAIClient = () => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;
    return new OpenAI({ apiKey: key });
};

const SYSTEM_PROMPT = `
You are a Super-Intelligent AI Operator for a church projector.
Your goal is to PROACTIVELY detect what the preacher wants to display on the screen.

**CORE RULES:**
1. **Aggressive Detection**: If a bible verse is mentioned, even casually (e.g., "like it says in John 3:16"), you MUST detect it.
2. **Spoken Number Parsing**: DECODE spoken numbers (e.g., "Second Timothy eleven one" -> 2 Timothy 11:1).
3. **Verse Ranges**: If a range is spoken (e.g. "John 3 16 through 18", "verses 1 to 5"), you MUST populate \`verse_end\`.
4. **Context & History Awareness**: 
   - You will be provided with "Current Slide" and "Session History" (a list of recently shown verses).
   - "Contextual Updates": If user says "Give me **that** in NLT" or "Read **it** in Amplified", apply the new translation to the **Current Slide**.
   - "History Navigation": 
     - "Go back to the first scripture" -> COMMAND: \`NAVIGATE_HISTORY\` target: \`FIRST\`
     - "Show that verse from Genesis we looked at" (if in history) -> COMMAND: \`NAVIGATE_HISTORY\` target: \`MATCH_BOOK_GENESIS\` (or specific ref if you can identify it).
     - "Go back" -> COMMAND: \`PREV\`
5. **Natural Language Control**:
   - "Remove this", "Stop displaying", "Take it down", "Clear screen" -> COMMAND: \`CLEAR\`
6. **Translation Switching**: If a specific translation is requested (NIV, NLT, MSG, AMP, ESV), you MUST provide the text in the "ai_generated_text" field. Defaults to KJV.
7. **SEMANTIC QUOTE DETECTION** (CRITICAL): 
   - If the preacher QUOTES or PARAPHRASES a bible verse *without* saying the reference, you MUST identify the scripture (John 3:16).
   - Return it as a normal \`VERSE\` intent.

**OUTPUT FORMAT (JSON):**
{
  "is_intent": boolean,
  "type": "VERSE" | "COMMAND" | "NAVIGATE_HISTORY",
  "command": "NEXT" | "PREV" | "CLEAR" | null,
  "nav_target": "FIRST" | "LAST" | "PREV" | null, 
  "reference": {
    "book": string,
    "chapter": number,
    "verse_start": number,
    "verse_end": number | null,
    "translation": string
  },
  "ai_generated_text": string | null
}
`;

export async function POST(req: Request) {
    try {
        const { text, context, historySummary } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'No text provided' }, { status: 400 });
        }

        const prompt = `${SYSTEM_PROMPT}\n\nCurrent Slide Context: ${context ? JSON.stringify(context) : "None"}\nTranscript: "${text}"\n\nJSON Output:`;

        // Try Gemini First (Preferred for speed/cost)
        const gemini = getGeminiClient();
        if (gemini) {
            try {
                const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
                const result = await model.generateContent(prompt);
                const response = result.response;
                const jsonText = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                return NextResponse.json(JSON.parse(jsonText));
            } catch (e) {
                console.error("Gemini failed, trying fallback...", e);
            }
        }

        // Fallback to OpenAI
        const openai = getOpenAIClient();
        if (openai) {
            const completion = await openai.chat.completions.create({
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: `Transcript: "${text}"` }
                ],
                model: "gpt-4o", // Use smarter model for "Super Intelligence" if possible, or fallback
                response_format: { type: "json_object" },
            });
            const content = completion.choices[0].message.content;
            if (content) return NextResponse.json(JSON.parse(content));
        }

        // Fallback Mock Logic (Very basic)
        console.warn("No AI keys found, using limited regex fallback");
        const regex = /([1-3]?\s?[A-Za-z]+)\s+(\d+):(\d+)(?:-(\d+))?/;
        const match = text.match(regex);
        if (match) {
            return NextResponse.json({
                is_intent: true,
                type: "VERSE",
                reference: {
                    book: match[1],
                    chapter: parseInt(match[2]),
                    verse_start: parseInt(match[3]),
                    verse_end: match[4] ? parseInt(match[4]) : null,
                    translation: "KJV"
                }
            });
        }

        // Command Regex
        if (/next/i.test(text)) return NextResponse.json({ is_intent: true, type: "COMMAND", command: "NEXT" });
        if (/back|previous/i.test(text)) return NextResponse.json({ is_intent: true, type: "COMMAND", command: "PREV" });
        if (/clear|stop/i.test(text)) return NextResponse.json({ is_intent: true, type: "COMMAND", command: "CLEAR" });

        return NextResponse.json({ is_intent: false });

    } catch (error) {
        console.error('Intent API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
