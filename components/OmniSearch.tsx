"use client";

import { useEffect, useState, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import { Search, Music, BookOpen, Monitor, ArrowRight } from 'lucide-react';
import { Song, fetchSongs } from '@/utils/songManager';
import { detectVersesInText, lookupVerseAsync } from '@/utils/bible';

interface OmniSearchProps {
    onGoLive: (content: any) => void;
    onAddToSchedule: (content: any) => void;
}

type SearchResult = {
    id: string;
    type: 'song' | 'bible' | 'media';
    title: string;
    subtitle: string;
    content: any;
    score: number;
};

export default function OmniSearch({ onGoLive, onAddToSchedule }: OmniSearchProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [songs, setSongs] = useState<Song[]>([]);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load songs on mount
    useEffect(() => {
        fetchSongs().then(setSongs);
    }, []);

    // Fuse instance
    const fuse = useMemo(() => new Fuse(songs, {
        keys: ['title', 'lyrics.content', 'author'],
        threshold: 0.3,
        includeScore: true
    }), [songs]);

    // Handle Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Search Logic
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const newResults: SearchResult[] = [];

        // 1. Bible Detection (Regex)
        const verses = detectVersesInText(query);
        if (verses.length > 0) {
            verses.forEach((v, idx) => {
                newResults.push({
                    id: `bible-${idx}`,
                    type: 'bible',
                    title: v.reference,
                    subtitle: v.text.substring(0, 50) + "...",
                    content: v,
                    score: 0 // Best match
                });
            });
        }

        // 2. Song Search (Fuse)
        const songMatches = fuse.search(query);
        songMatches.slice(0, 5).forEach(result => {
            newResults.push({
                id: `song-${result.item.id}`,
                type: 'song',
                title: result.item.title,
                subtitle: result.item.author,
                content: result.item,
                score: result.score || 1
            });
        });

        // Sort by score (lower is better for Fuse, but we put Bible first if it matches regex)
        // Actually, if we have a bible match, it's usually intended.

        setResults(newResults);
        setSelectedIndex(0);

    }, [query, fuse]);

    // Selection Logic
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (results[selectedIndex]) {
                const item = results[selectedIndex];
                if (e.shiftKey) {
                    onGoLive(item);
                    setIsOpen(false);
                } else {
                    onAddToSchedule(item);
                    // Just provide feedback, don't close? Or close? Let's close for now or keep open for bulk add.
                    // Let's close for "Spotlight" feel.
                    setIsOpen(false);
                }
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[20vh]" onClick={() => setIsOpen(false)}>
            <div
                className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center px-4 py-4 border-b border-zinc-200 dark:border-white/5 gap-3">
                    <Search className="w-5 h-5 text-zinc-500" />
                    <input
                        ref={inputRef}
                        className="flex-1 bg-transparent text-xl text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none"
                        placeholder="Search songs, scripture, or media..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoComplete="off"
                    />
                    <div className="flex gap-2">
                        <span className="text-[10px] bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded border border-white/5">ESC</span>
                    </div>
                </div>

                {/* Results List */}
                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {results.length === 0 ? (
                        <div className="text-center py-12 text-zinc-600">
                            {query ? "No results found." : "Type to search..."}
                        </div>
                    ) : (
                        results.map((result, idx) => (
                            <div
                                key={result.id}
                                className={`flex items-center gap-4 px-4 py-3 rounded-lg cursor-pointer transition-colors ${idx === selectedIndex ? 'bg-indigo-600/20 border border-indigo-500/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border border-transparent'}`}
                                onClick={() => {
                                    onAddToSchedule(result);
                                    setIsOpen(false);
                                }}
                            >
                                {/* Icon Box */}
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${result.type === 'song' ? 'bg-purple-500/20 text-purple-400' :
                                    result.type === 'bible' ? 'bg-amber-500/20 text-amber-400' :
                                        'bg-blue-500/20 text-blue-400'
                                    }`}>
                                    {result.type === 'song' && <Music size={20} />}
                                    {result.type === 'bible' && <BookOpen size={20} />}
                                    {result.type === 'media' && <Monitor size={20} />}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h4 className={`text-sm font-bold truncate ${idx === selectedIndex ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'}`}>
                                            {result.title}
                                        </h4>
                                        {idx === selectedIndex && (
                                            <span className="text-[10px] text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded">
                                                Press Shift+Enter to Go Live
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-500 truncate">{result.subtitle}</p>
                                </div>

                                <ArrowRight className={`w-4 h-4 ${idx === selectedIndex ? 'text-indigo-400 opacity-100' : 'text-zinc-600 opacity-0'}`} />
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="bg-zinc-100 dark:bg-zinc-950/50 px-4 py-2 border-t border-zinc-200 dark:border-white/5 flex justify-between items-center text-[10px] text-zinc-500">
                    <div className="flex gap-4">
                        <span><kbd className="font-sans bg-zinc-50 dark:bg-zinc-800 px-1 rounded text-zinc-600 dark:text-zinc-300">↵</kbd> Add to Schedule</span>
                        <span><kbd className="font-sans bg-zinc-50 dark:bg-zinc-800 px-1 rounded text-zinc-600 dark:text-zinc-300">⇧ ↵</kbd> Go Live</span>
                    </div>
                    <div>
                        ProTip: Use <kbd className="font-sans bg-zinc-50 dark:bg-zinc-800 px-1 rounded text-zinc-600 dark:text-zinc-300">↑</kbd> <kbd className="font-sans bg-zinc-50 dark:bg-zinc-800 px-1 rounded text-zinc-600 dark:text-zinc-300">↓</kbd> to navigate
                    </div>
                </div>
            </div>
        </div>
    );
}
