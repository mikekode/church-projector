/**
 * Motion Backgrounds Library
 * A curated collection of free-to-use motion background URLs for worship services
 */

export interface MotionBackground {
    id: string;
    name: string;
    category: 'worship' | 'nature' | 'abstract' | 'seasonal' | 'minimal';
    thumbnail: string;
    videoUrl: string;
    tags: string[];
}

// User can import valid video files manually. Default collection cleared to prevent broken links.
export const MOTION_BACKGROUNDS: MotionBackground[] = [];

export const BACKGROUND_CATEGORIES = ['all', 'worship', 'nature', 'abstract', 'seasonal', 'minimal'] as const;
export type BackgroundCategory = typeof BACKGROUND_CATEGORIES[number];

export function filterBackgrounds(category: BackgroundCategory, searchQuery?: string): MotionBackground[] {
    let results = category === 'all'
        ? MOTION_BACKGROUNDS
        : MOTION_BACKGROUNDS.filter(bg => bg.category === category);

    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        results = results.filter(bg =>
            bg.name.toLowerCase().includes(query) ||
            bg.tags.some(tag => tag.includes(query))
        );
    }

    return results;
}
