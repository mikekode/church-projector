
export const NUMBER_WORDS: Record<string, number> = {
    'one': 1, 'first': 1, '1st': 1,
    'two': 2, 'second': 2, '2nd': 2,
    'three': 3, 'third': 3, '3rd': 3,
    'four': 4, 'fourth': 4, '4th': 4,
    'five': 5, 'fifth': 5, '5th': 5,
    'six': 6, 'sixth': 6, '6th': 6,
    'seven': 7, 'seventh': 7, '7th': 7,
    'eight': 8, 'eighth': 8, '8th': 8,
    'nine': 9, 'ninth': 9, '9th': 9,
    'ten': 10, 'tenth': 10, '10th': 10,
    'eleven': 11,
    'twelve': 12,
    'thirteen': 13,
    'fourteen': 14,
    'fifteen': 15,
    'sixteen': 16,
    'seventeen': 17,
    'eighteen': 18,
    'nineteen': 19,
    'twenty': 20,
    'thirty': 30,
    'forty': 40,
    'fifty': 50,
    'sixty': 60,
    'seventy': 70,
    'eighty': 80,
    'ninety': 90
};

export function textToNumbers(text: string): string {
    // Phase 1: Normalize "chapter" and "verse" patterns
    let normalized = text.toLowerCase()
        .replace(/chapter\s+/g, ' ')
        .replace(/verse\s+/g, ':');

    // Phase 2: Convert number words
    return normalized.split(/\s+/).map(word => {
        // Remove ANY punctuation that might be attached to the word (e.g. "1.", "Peter,")
        const clean = word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');
        const val = NUMBER_WORDS[clean];
        if (val !== undefined) {
            // Restore suffix if it was a colon (likely verse separator)
            const suffix = word.includes(':') ? ':' : '';
            return val.toString() + suffix;
        }
        return clean; // Return the cleaned word anyway to help regex matches
    }).join(' ');
}
