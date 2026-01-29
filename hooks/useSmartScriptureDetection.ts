import { useRef, useCallback } from 'react';
import { lookupVerse } from '@/utils/bible';

type DetectedScripture = {
    book: string;
    chapter: number;
    verse: number;
    verseEnd?: number;
    text: string;
    reference: string;
};

type NavigationCommand = {
    type: 'next_verse' | 'prev_verse' | 'next_chapter' | 'prev_chapter' | 'clear';
};

type OnDetectCallback = (scriptures: DetectedScripture[], commands: NavigationCommand[]) => void;

/**
 * Smart Scripture Detection Hook
 *
 * Uses LLM to detect scripture references from natural sermon speech.
 * Processes transcript chunks in real-time with debouncing.
 */
export function useSmartScriptureDetection(onDetect: OnDetectCallback) {
    const bufferRef = useRef<string>('');
    const contextRef = useRef<string>('');
    const lastProcessedRef = useRef<string>('');
    const processingRef = useRef<boolean>(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const recentDetectionsRef = useRef<Set<string>>(new Set());

    const processBuffer = useCallback(async () => {
        if (processingRef.current) return;
        if (bufferRef.current.trim().length < 10) return;

        // Skip if we just processed the same text
        if (bufferRef.current === lastProcessedRef.current) return;

        processingRef.current = true;
        const textToProcess = bufferRef.current;
        lastProcessedRef.current = textToProcess;

        try {
            console.log('[SmartDetect] Processing:', textToProcess.slice(-100));

            const response = await fetch('/api/detect-scripture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript: textToProcess,
                    context: contextRef.current,
                }),
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const scriptures: DetectedScripture[] = [];

            console.log('[SmartDetect] API returned:', data.scriptures, 'Commands:', data.commands);

            const commands: NavigationCommand[] = (data.commands || []).map((c: any) => ({ type: c.type }));

            for (const s of data.scriptures || []) {
                // Create unique key for deduplication
                const key = `${s.book}-${s.chapter}-${s.verse}`;

                // Skip if recently detected (within 10 seconds)
                if (recentDetectionsRef.current.has(key)) {
                    console.log('[SmartDetect] Skipping duplicate:', key);
                    continue;
                }

                // Look up the verse text - try multiple name variations
                let verseText = lookupVerse(s.book, s.chapter, s.verse);

                // If not found, try common variations
                if (!verseText) {
                    const variations = [
                        s.book.toLowerCase(),
                        s.book.replace(/\s+/g, ''),  // "1 John" -> "1John"
                        s.book.replace(/(\d)\s+/, '$1 '),  // Normalize spacing
                    ];
                    for (const v of variations) {
                        verseText = lookupVerse(v, s.chapter, s.verse);
                        if (verseText) break;
                    }
                }

                if (verseText) {
                    const reference = s.verseEnd
                        ? `${s.book} ${s.chapter}:${s.verse}-${s.verseEnd}`
                        : `${s.book} ${s.chapter}:${s.verse}`;

                    scriptures.push({
                        book: s.book,
                        chapter: s.chapter,
                        verse: s.verse,
                        verseEnd: s.verseEnd,
                        text: verseText,
                        reference,
                    });

                    // Mark as recently detected
                    recentDetectionsRef.current.add(key);

                    // Remove from recent after 10 seconds
                    setTimeout(() => {
                        recentDetectionsRef.current.delete(key);
                    }, 10000);

                    console.log('[SmartDetect] SUCCESS:', reference, '-', verseText.slice(0, 50) + '...');
                } else {
                    console.log('[SmartDetect] FAILED to find verse:', s.book, s.chapter, s.verse);
                }
            }

            if (scriptures.length > 0 || commands.length > 0) {
                onDetect(scriptures, commands);
            }

            // If commands were detected, clear the buffer to prevent re-detection
            // Commands like "next verse" shouldn't accumulate
            if (commands.length > 0) {
                console.log('[SmartDetect] Clearing buffer after command detection');
                bufferRef.current = '';
                lastProcessedRef.current = '';
            }

            // Keep last 200 chars as context for next detection
            contextRef.current = textToProcess.slice(-200);

        } catch (error) {
            console.error('[SmartDetect] Error:', error);
        } finally {
            processingRef.current = false;
        }
    }, [onDetect]);

    const addText = useCallback((text: string) => {
        // Add to buffer
        bufferRef.current = (bufferRef.current + ' ' + text).slice(-500);

        // Debounce: wait 500ms after last text before processing
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            processBuffer();
        }, 500);
    }, [processBuffer]);

    const reset = useCallback(() => {
        bufferRef.current = '';
        contextRef.current = '';
        lastProcessedRef.current = '';
        recentDetectionsRef.current.clear();
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    }, []);

    return { addText, reset };
}
