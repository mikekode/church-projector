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
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
    'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
    'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
    'hundred': 100, 'thousand': 1000
};

export function textToNumbers(text: string): string {
    // Phase 1: Normalize "chapter" and "verse" patterns
    let normalized = text.toLowerCase()
        .replace(/chapter\s+/g, ' ')
        .replace(/verse\s+/g, ':');

    const words = normalized.split(/\s+/);
    const result: string[] = [];

    let currentNumValue: number | null = null;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        // Clean word of punctuation for dictionary lookup (but keep colons for verse detection)
        const hasColon = word.includes(':');
        const clean = word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');
        const val = NUMBER_WORDS[clean];

        if (val !== undefined) {
            if (currentNumValue === null) {
                currentNumValue = val;
            } else {
                // SMART MERGING LOGIC
                // 1. Tens + Unit (e.g. 40 + 4 = 44)
                if (currentNumValue >= 20 && currentNumValue < 100 && currentNumValue % 10 === 0 && val < 10) {
                    currentNumValue += val;
                }
                // 2. Unit + Hundred/Thousand (e.g. 1 + 100 = 100)
                else if (val >= 100 && currentNumValue < 100) {
                    currentNumValue *= val;
                }
                // 3. Hundred + Value (e.g. 100 + 19 = 119)
                else if (currentNumValue >= 100 && val < 100) {
                    currentNumValue += val;
                }
                // SAFETY: DO NOT MERGE sequential numbers (e.g. "one one" stays 1 1)
                else {
                    result.push(currentNumValue.toString());
                    currentNumValue = val;
                }
            }

            // If the word had a colon, it's a verse marker - flush immediately
            if (hasColon) {
                result.push(currentNumValue.toString() + ':');
                currentNumValue = null;
            }
        } else {
            // Not a number word
            if (currentNumValue !== null) {
                result.push(currentNumValue.toString());
                currentNumValue = null;
            }
            result.push(clean);
        }
    }

    if (currentNumValue !== null) {
        result.push(currentNumValue.toString());
    }

    return result.join(' ');
}
