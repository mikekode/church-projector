/**
 * Pastor Profile System
 *
 * Tracks pastor-specific patterns over time:
 * - Favorite books/verses
 * - Common transitions
 * - Sermon series context
 * - Detection accuracy feedback
 */

export type PastorProfile = {
    id: string;
    name: string;
    // Verse frequency tracking
    verseHistory: {
        reference: string;
        count: number;
        lastUsed: string;
    }[];
    // Book preferences (weighted by usage)
    bookPreferences: Record<string, number>;
    // Common phrase patterns that lead to scripture
    transitionPhrases: string[];
    // Current sermon series context
    sermonContext: {
        series?: string;
        theme?: string;
        focusBooks?: string[];
        focusVerses?: string[];
    };
    // Detection feedback for learning
    detectionFeedback: {
        correct: number;
        falsePositives: number;
        missed: number;
    };
    createdAt: string;
    updatedAt: string;
};

const STORAGE_KEY = 'pastor-profile';
const DEFAULT_PROFILE: PastorProfile = {
    id: 'default',
    name: 'Pastor',
    verseHistory: [],
    bookPreferences: {},
    transitionPhrases: [
        'turn to',
        'let\'s read',
        'the bible says',
        'scripture tells us',
        'as we read in',
        'the book of',
        'paul wrote',
        'jesus said',
        'the lord said',
        'it is written',
    ],
    sermonContext: {},
    detectionFeedback: {
        correct: 0,
        falsePositives: 0,
        missed: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

/**
 * Load pastor profile from localStorage
 */
export function loadPastorProfile(): PastorProfile {
    if (typeof window === 'undefined') return DEFAULT_PROFILE;

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return { ...DEFAULT_PROFILE, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.error('[PastorProfile] Failed to load:', e);
    }
    return DEFAULT_PROFILE;
}

/**
 * Save pastor profile to localStorage
 */
export function savePastorProfile(profile: PastorProfile): void {
    if (typeof window === 'undefined') return;

    try {
        profile.updatedAt = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
        console.error('[PastorProfile] Failed to save:', e);
    }
}

/**
 * Record a verse detection (for learning)
 */
export function recordVerseUsage(profile: PastorProfile, reference: string, book: string): PastorProfile {
    const now = new Date().toISOString();

    // Update verse history
    const existingVerse = profile.verseHistory.find(v => v.reference === reference);
    if (existingVerse) {
        existingVerse.count++;
        existingVerse.lastUsed = now;
    } else {
        profile.verseHistory.push({ reference, count: 1, lastUsed: now });
    }

    // Keep only top 100 verses
    profile.verseHistory = profile.verseHistory
        .sort((a, b) => b.count - a.count)
        .slice(0, 100);

    // Update book preferences
    profile.bookPreferences[book] = (profile.bookPreferences[book] || 0) + 1;

    return profile;
}

/**
 * Get pastor's top books (for context hints)
 */
export function getTopBooks(profile: PastorProfile, limit: number = 5): string[] {
    return Object.entries(profile.bookPreferences)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([book]) => book);
}

/**
 * Get recently used verses (for quick detection)
 */
export function getRecentVerses(profile: PastorProfile, limit: number = 10): string[] {
    return profile.verseHistory
        .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
        .slice(0, limit)
        .map(v => v.reference);
}

/**
 * Get frequently used verses (for prediction)
 */
export function getFrequentVerses(profile: PastorProfile, limit: number = 10): string[] {
    return profile.verseHistory
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map(v => v.reference);
}

/**
 * Update sermon context
 */
export function updateSermonContext(
    profile: PastorProfile,
    context: Partial<PastorProfile['sermonContext']>
): PastorProfile {
    profile.sermonContext = { ...profile.sermonContext, ...context };
    return profile;
}

/**
 * Record detection feedback
 */
export function recordFeedback(
    profile: PastorProfile,
    type: 'correct' | 'falsePositive' | 'missed'
): PastorProfile {
    switch (type) {
        case 'correct':
            profile.detectionFeedback.correct++;
            break;
        case 'falsePositive':
            profile.detectionFeedback.falsePositives++;
            break;
        case 'missed':
            profile.detectionFeedback.missed++;
            break;
    }
    return profile;
}

/**
 * Generate context string for AI prompt
 */
export function generateContextHint(profile: PastorProfile): string {
    const hints: string[] = [];

    // Add sermon context
    if (profile.sermonContext.series) {
        hints.push(`Current sermon series: "${profile.sermonContext.series}"`);
    }
    if (profile.sermonContext.theme) {
        hints.push(`Theme: ${profile.sermonContext.theme}`);
    }
    if (profile.sermonContext.focusBooks?.length) {
        hints.push(`Focus books: ${profile.sermonContext.focusBooks.join(', ')}`);
    }

    // Add pastor preferences
    const topBooks = getTopBooks(profile, 3);
    if (topBooks.length > 0) {
        hints.push(`Pastor frequently references: ${topBooks.join(', ')}`);
    }

    const frequentVerses = getFrequentVerses(profile, 5);
    if (frequentVerses.length > 0) {
        hints.push(`Common verses: ${frequentVerses.join(', ')}`);
    }

    return hints.join('\n');
}
