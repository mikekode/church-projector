"use client";

import { useState } from 'react';
import { X, FileText, Upload, Music, Check, AlertCircle } from 'lucide-react';
import { ResourceItem } from '@/utils/resourceLibrary';

interface SongImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (song: ResourceItem) => void;
}

export default function SongImportModal({ isOpen, onClose, onImport }: SongImportModalProps) {
    const [mode, setMode] = useState<'text' | 'file'>('text');
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [lyrics, setLyrics] = useState('');
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleImport = () => {
        if (!title.trim()) {
            setError('Please enter a song title');
            return;
        }

        if (!lyrics.trim()) {
            setError('Please paste the lyrics');
            return;
        }

        // Auto-segment lyrics
        // Split by double newlines or blank lines
        const segments = lyrics.split(/\n\s*\n/).filter(s => s.trim().length > 0);

        const slides = segments.map((text, i) => ({
            id: Date.now().toString() + i,
            content: text.trim(),
            label: `Slide ${i + 1}`,
            activeSlideIndex: 0
        }));

        const newSong: ResourceItem = {
            id: Date.now().toString(),
            title,
            type: 'song',
            category: 'song',
            activeSlideIndex: 0,
            slides,
            meta: {
                author: artist
            },
            tags: ['worship'],
            dateAdded: Date.now()
        };

        onImport(newSong);
        resetForm();
        onClose();
    };

    const resetForm = () => {
        setTitle('');
        setArtist('');
        setLyrics('');
        setError(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-zinc-900 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600/20 rounded-lg">
                            <Music className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Import Song</h2>
                            <p className="text-xs text-zinc-400">Add worship songs to your library</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Tabs */}
                    <div className="flex gap-4 border-b border-white/10 mb-6 pb-2">
                        <button
                            onClick={() => setMode('text')}
                            className={`px-4 py-2 font-medium text-sm transition-colors relative ${mode === 'text' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Paste Text
                            {mode === 'text' && <div className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-indigo-500"></div>}
                        </button>
                        <button
                            onClick={() => setMode('file')}
                            className={`px-4 py-2 font-medium text-sm transition-colors relative ${mode === 'file' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="Coming Soon"
                        >
                            Import File (Coming Soon)
                            {mode === 'file' && <div className="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-indigo-500"></div>}
                        </button>
                    </div>

                    {mode === 'text' ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-zinc-400">Song Title</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full bg-zinc-800 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                                        placeholder="e.g. Amazing Grace"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-zinc-400">Artist / Author</label>
                                    <input
                                        type="text"
                                        value={artist}
                                        onChange={(e) => setArtist(e.target.value)}
                                        className="w-full bg-zinc-800 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                                        placeholder="Optional"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-400">
                                    Lyrics
                                    <span className="text-zinc-500 font-normal ml-2">(Separate slides with blank lines)</span>
                                </label>
                                <textarea
                                    value={lyrics}
                                    onChange={(e) => setLyrics(e.target.value)}
                                    className="w-full h-64 bg-zinc-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 font-sans leading-relaxed"
                                    placeholder={`Amazing Grace, how sweet the sound\nThat saved a wretch like me\n\nI once was lost, but now am found\nWas blind but now I see...`}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-zinc-700 rounded-xl bg-zinc-900/50 text-zinc-500">
                            <Upload className="w-12 h-12 mb-4 opacity-50" />
                            <p className="font-medium">File Import Coming Soon</p>
                            <p className="text-sm mt-2">Support for .usr, .xml, and .txt files</p>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-white/10 bg-zinc-900 text-right flex justify-end gap-3 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 hover:bg-zinc-800 text-zinc-400 text-sm rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Check size={18} />
                        Save Song
                    </button>
                </div>
            </div>
        </div>
    );
}
