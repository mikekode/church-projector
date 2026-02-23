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
        const { text, context, pastorHints, currentVerse, chapterContext, suggestions, history } = req.body;

        if (!text || text.trim().length < 3) {
            return res.status(200).json({
                scriptures: [],
                commands: [],
                signal: 'WAIT',
                signalReason: 'Insufficient text'
            });
        }

        if (context === 'extract_sermon_theme') {
            const themeResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a sermon analysis assistant. Extract the core theological theme from the transcript snippet. Respond with JSON: { \"theme\": \"string\" }. Theme should be 1-3 words (e.g. 'Power of God')."
                    },
                    { role: "user", content: `Transcript: "${text}"` }
                ],
                response_format: { type: "json_object" },
                temperature: 0.3,
                max_tokens: 50,
            });
            const themeContent = themeResponse.choices[0]?.message?.content || '{}';
            return res.status(200).json(JSON.parse(themeContent));
        }

        const systemPrompt = buildSystemPrompt(pastorHints, currentVerse, chapterContext, suggestions, history);

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `TRANSCRIPT: "${text}"\n\nAnalyze for scriptures and commands.`
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0,
            max_tokens: 400,
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

function buildSystemPrompt(pastorHints, currentVerse, chapterContext, suggestions, history) {
    let prompt = `You are an ELITE scripture detection agent for a church projector. You analyze small windows from live speech transcripts.

CORE INTELLECT:
1. PHONETIC RECOVERY: Transcripts may be noisy/muddled. Treat words as phonetic clues.
   - Example: "John tree 16" -> John 3:16
   - Example: "Revelations tree 5" -> Revelation 3:5
   - Example: "Isiah" -> Isaiah
2. CONTEXTUAL REPAIR: Use current/recent verses to "repair" incomplete or broken commands.
   - If the pastor is in "Psalm 23" and says "verse 4", infer Psalm 23:4.
3. FUZZY ACCENTS: Handle heavy accents by looking for "sounds-like" biblically relevant matches.

RESPOND with JSON:
{
  "scriptures": [
    {
      "book": "string",
      "chapter": number,
      "verse": number,
      "confidence": number,
      "matchType": "exact" | "partial" | "paraphrase",
      "reason": "Why did you pick this? (e.g. 'Phonetic repair of John tree')"
    }
  ],
  "commands": [],
  "signal": "SWITCH" | "HOLD" | "WAIT",
  "signalReason": "string",
  "verseCount": 1
}

STRICT BIBLE RULES:
- "Revelation" (Never "Revelations")
- "Song of Solomon" (Never "Songs of Solomon")
- "Psalms" is the book, "Psalm" is the singular reference.

NAVIGATION COMMANDS: "next verse", "previous verse", "clear", "jump to verse [number]", "next chapter".`;

    if (history && history.length > 0) {
        prompt += `\n\nRECENTLY DETECTED (History):\n${history.join(' -> ')}`;
    }

    if (suggestions && suggestions.length > 0) {
        prompt += `\n\nLOCAL SEMANTIC SUGGESTIONS (Top matches from database):\n${suggestions.map(s => `- ${s}`).join('\n')}\nUse these to guide your detection if the transcript is blurry.`;
    }

    if (pastorHints) prompt += `\n\nPASTOR CONTEXT / THEME:\n${pastorHints}`;
    if (currentVerse) prompt += `\n\nCURRENTLY ON SCREEN: ${currentVerse}`;
    if (chapterContext) prompt += `\n\nACTIVE CHAPTER ANCHOR: ${chapterContext}`;

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
