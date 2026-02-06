
export interface ProjectorTheme {
    id: string;
    name: string;
    isCustom?: boolean;
    styles: {
        fontFamily: string;
        fontSize: string; // e.g. "4rem"
        fontWeight: string; // "400", "700"
        color: string;
        textAlign: 'left' | 'center' | 'right';
        justifyContent: 'center' | 'flex-start' | 'flex-end'; // Vertical alignment
        alignItems: 'center' | 'flex-start' | 'flex-end'; // Horizontal alignment
        textShadow?: string;
        textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
        letterSpacing?: string;
        lineHeight?: string;
    };
    background: {
        type: 'color' | 'image' | 'gradient';
        value: string; // url, hex, or gradient string
        overlayOpacity: number; // 0 to 1
        blur: number; // px
    };
    layout?: {
        referencePosition: 'top' | 'bottom';
        referenceScale: number; // 1 = normal, 1.5 = large
        showVerseNumbers: boolean;
        referenceColor?: string;
        versionColor?: string;
        verseNumberColor?: string;
        verseNumberScale?: number; // Default 0.5
    };
}

export const GOOGLE_FONTS = [
    "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Oswald",
    "Source Sans Pro", "Raleway", "Merriweather", "Noto Sans",
    "Lora", "Playfair Display", "Poppins", "Ubuntu", "Roboto Slab",
    "Nunito", "Titillium Web", "Rubik", "Mukta", "Work Sans"
];

export const DEFAULT_LAYOUT = {
    referencePosition: 'top' as const,
    referenceScale: 1.5,
    showVerseNumbers: true,
    verseNumberScale: 0.5
};

const createTheme = (id: string, name: string, bg: string, font: string, align: 'center' | 'left' = 'center', color = '#ffffff'): ProjectorTheme => ({
    id, name,
    styles: {
        fontFamily: font,
        fontSize: '4.5vw',
        fontWeight: '700',
        color: color,
        textAlign: align,
        justifyContent: 'center',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
        lineHeight: '1.2'
    },
    background: {
        type: bg.startsWith('http') ? 'image' : bg.includes('gradient') ? 'gradient' : 'color',
        value: bg,
        overlayOpacity: 0.3,
        blur: 0
    },
    layout: {
        referencePosition: 'top',
        referenceScale: 1.5,
        showVerseNumbers: true,
        referenceColor: color,
        versionColor: color,
        verseNumberColor: color,
        verseNumberScale: 0.5
    }
});

export const DEFAULT_THEMES: ProjectorTheme[] = [
    createTheme('default', 'Classic Black', '#000000', 'Inter'),
    createTheme('blue-gradient', 'Ocean Depths', 'linear-gradient(to bottom right, #0f172a, #1e3a8a)', 'Montserrat'),
    createTheme('purple-haze', 'Purple Haze', 'linear-gradient(to right, #4c1d95, #7e22ce)', 'Poppins'),
    createTheme('sunset', 'Sunset Glow', 'linear-gradient(to top, #c2410c, #f59e0b)', 'Oswald'),
    createTheme('forest', 'Deep Forest', 'linear-gradient(to bottom, #064e3b, #10b981)', 'Nunito'),
    createTheme('clean-white', 'Modern Light', '#f3f4f6', 'Lato', 'center', '#111827'),
    createTheme('simple-grey', 'Minimal Grey', '#374151', 'Roboto', 'left'),
    createTheme('royal-gold', 'Royal Gold', 'linear-gradient(135deg, #422006, #fbbf24)', 'Playfair Display', 'center', '#fffbeb'),
    createTheme('midnight', 'Midnight Star', '#020617', 'Titillium Web'),
    createTheme('cherry', 'Cherry Red', 'linear-gradient(to top right, #991b1b, #ef4444)', 'Rubik'),
    createTheme('slate', 'Slate Focus', '#1e293b', 'Open Sans', 'left'),
    createTheme('warm-paper', 'Warm Paper', '#fff7ed', 'Lora', 'center', '#451a03'),
    createTheme('neon-cyber', 'Cyberpunk', 'linear-gradient(45deg, #020024, #090979, #00d4ff)', 'Oswald', 'center', '#e0f2fe'),
    createTheme('soft-cloud', 'Soft Cloud', 'linear-gradient(to top, #e0f2fe, #fff)', 'Work Sans', 'center', '#0c4a6e'),
    createTheme('cinema', 'Cinematic', '#18181b', 'Merriweather', 'center', '#fbbf24'),
    createTheme('nature-green', 'Fresh Nature', 'linear-gradient(to bottom left, #14532d, #4ade80)', 'Ubuntu'),
    createTheme('deep-space', 'Deep Space', '#000000', 'Space Mono', 'center'),
    createTheme('vibrant-pink', 'Vibrant Pink', 'linear-gradient(to right, #be185d, #f472b6)', 'Poppins'),
    createTheme('calm-teal', 'Calm Teal', '#115e59', 'Raleway'),
    createTheme('concrete', 'Urban Concrete', '#57534e', 'Roboto Slab')
];
