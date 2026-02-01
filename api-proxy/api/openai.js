/**
 * Creenly API Proxy - OpenAI Smart Detection
 *
 * This endpoint proxies requests to OpenAI, keeping the API key server-side.
 * Deploy this to Vercel and set OPENAI_API_KEY in environment variables.
 */

const OpenAI = require('openai');

// Initialize OpenAI with server-side key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Validate API key is configured
    if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY not configured');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const { text, context, pastorHints, currentVerse, chapterContext } = req.body;

        if (!text || text.trim().length < 3) {
            return res.status(200).json({
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
        const parsed = JSON.parse(content);
        const result = validateAndNormalize(parsed);

        return res.status(200).json(result);

    } catch (error) {
        console.error('OpenAI proxy error:', error);
        return res.status(500).json({ error: error.message });
    }
};

function buildSystemPrompt(pastorHints, currentVerse, chapterContext) {
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
  "commands": [],
  "signal": "SWITCH" | "HOLD" | "WAIT",
  "signalReason": "string",
  "verseCount": 1
}

STRICT RULE: You MUST ALWAYS include "verseCount" (1, 2, or 3) in the JSON response whenever "scriptures" or "commands" are not empty. Default to 1 if only one verse is mentioned or implied.

DETECTION TYPES:
- "exact": Direct verse reference like "John 3:16" or "John chapter 3 verse 16"
- "partial": Incomplete reference like "For God so loved..." (recognizable start of verse)
- "paraphrase": Sermon paraphrase type

CONFIDENCE SCORING (0-100):
- 90-100: Direct reference
- 70-89: Strong match
- 50-69: Likely match
- Below 50: Don't include

SIGNALS:
- "SWITCH": High confidence (>=80)
- "HOLD": Currently displaying correct verse
- "WAIT": No detection

NAVIGATION COMMANDS:
- "next verse" -> {"type": "next_verse"}
- "previous verse" -> {"type": "prev_verse"}
- "verse [number]" -> {"type": "jump_to_verse", "verse": number}
- "next chapter" / "previous chapter"
- "clear"

RULES:
- "three" -> 3
- "Revelation" (singular)
- "Song of Solomon"`;

    if (pastorHints) prompt += `\n\nPASTOR CONTEXT:\n${pastorHints}`;
    if (currentVerse) prompt += `\n\nCURRENTLY DISPLAYING: ${currentVerse}`;
    if (chapterContext) prompt += `\n\nACTIVE CHAPTER CONTEXT: ${chapterContext}`;

    return prompt;
}

function validateAndNormalize(parsed) {
    const scriptures = (Array.isArray(parsed.scriptures) ? parsed.scriptures : [])
        .map(s => ({
            book: normalizeBookName(s.book || ''),
            chapter: parseInt(s.chapter) || 1,
            verse: parseInt(s.verse) || 1,
            verseEnd: s.verseEnd ? parseInt(s.verseEnd) : undefined,
            confidence: Math.min(100, Math.max(0, parseInt(s.confidence) || 50)),
            matchType: ['exact', 'partial', 'paraphrase'].includes(s.matchType) ? s.matchType : 'exact',
            reason: s.reason || 'Detected',
        }))
        .filter(s => s && s.book && s.chapter && s.confidence >= 50)
        .sort((a, b) => b.confidence - a.confidence);

    const validCommands = ['next_verse', 'prev_verse', 'next_chapter', 'prev_chapter', 'clear', 'jump_to_verse', 'switch_translation'];

    let rawCommands = parsed.commands;
    if (rawCommands && !Array.isArray(rawCommands)) rawCommands = [rawCommands];

    const commands = (Array.isArray(rawCommands) ? rawCommands : [])
        .filter(c => c && c.type && validCommands.includes(c.type))
        .map(c => ({
            type: c.type,
            verse: c.verse ? parseInt(c.verse) : undefined,
            version: c.version?.toUpperCase()
        }));

    let signal = parsed.signal || 'WAIT';
    if (scriptures.length > 0 && scriptures[0].confidence >= 80) signal = 'SWITCH';
    else if (commands.length > 0) signal = 'SWITCH';
    else if (!scriptures.length && !commands.length) signal = 'WAIT';

    let verseCount = parsed.verseCount ? Math.min(3, Math.max(1, parseInt(parsed.verseCount))) : undefined;
    if (!verseCount && (scriptures.length > 0 || commands.length > 0)) verseCount = 1;

    return { scriptures, commands, signal, signalReason: parsed.signalReason || '', verseCount };
}

function normalizeBookName(book) {
    let result = book.trim();
    if (result.match(/^Song of/i) || result.match(/^Canticles/i)) return 'Song of Solomon';
    if (result.match(/^Rev/i)) return 'Revelation';
    if (result.match(/^Psalm/i)) return 'Psalm';
    return result.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())));
}
