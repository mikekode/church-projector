export type LyricSection = {
    type: string;
    label: string;
    content: string;
};

export type Song = {
    id: string;
    title: string;
    author: string;
    ccli?: string;
    lyrics: LyricSection[];
};

export async function fetchSongs(): Promise<Song[]> {
    try {
        const response = await fetch('/api/songs');
        if (!response.ok) {
            throw new Error('Failed to fetch songs');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching songs:', error);
        return [];
    }
}
