"use client";

import { useState, useEffect } from 'react';
import { X, Monitor, Video, RefreshCw, Play } from 'lucide-react';

interface DesktopSource {
    id: string;
    name: string;
    thumbnail: string;
    appIcon?: string;
}

interface LiveFeedSelectorProps {
    onSelect: (sourceId: string, name: string) => void;
    onClose: () => void;
}

export default function LiveFeedSelector({ onSelect, onClose }: LiveFeedSelectorProps) {
    const [sources, setSources] = useState<DesktopSource[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshSources = async () => {
        setLoading(true);
        if ((window as any).electronAPI?.getDesktopSources) {
            try {
                const results = await (window as any).electronAPI.getDesktopSources();
                setSources(results);
            } catch (err) {
                console.error("Failed to fetch desktop sources:", err);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        refreshSources();
    }, []);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                            <Video className="text-indigo-400" /> Route External Video Feed
                        </h2>
                        <p className="text-sm text-zinc-400 mt-1">Select a window or screen to route to the live projector.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={refreshSources}
                            className="p-2 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white transition-colors"
                            title="Refresh List"
                        >
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700">
                    {loading && sources.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-4">
                            <RefreshCw className="text-indigo-500 animate-spin" size={32} />
                            <p className="text-zinc-500 font-medium italic">Scanning for windows...</p>
                        </div>
                    ) : sources.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-4 text-center">
                            <Monitor className="text-zinc-700" size={48} />
                            <p className="text-zinc-500 max-w-xs">No windows or screens found. Make sure VLC or your player is open and not minimized.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                            {sources.map((source) => (
                                <div
                                    key={source.id}
                                    onClick={() => onSelect(source.id, source.name)}
                                    className="group bg-zinc-800/50 border border-white/5 hover:border-indigo-500/50 rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1"
                                >
                                    {/* Thumbnail Preview */}
                                    <div className="aspect-video relative bg-black flex items-center justify-center overflow-hidden">
                                        <img
                                            src={source.thumbnail}
                                            alt={source.name}
                                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                                                <Play fill="currentColor" size={20} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="p-4 bg-zinc-900/80 border-t border-white/5 flex items-center gap-3">
                                        {source.appIcon && (
                                            <img src={source.appIcon} alt="" className="w-5 h-5 flex-shrink-0" />
                                        ) || (
                                                <Monitor size={16} className="text-zinc-500 flex-shrink-0" />
                                            )}
                                        <div className="min-w-0 flex-1">
                                            <h4 className="text-xs font-bold text-zinc-200 truncate group-hover:text-indigo-400 transition-colors" title={source.name}>
                                                {source.name}
                                            </h4>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Tip */}
                <div className="p-4 bg-indigo-600/10 border-t border-indigo-500/20 text-center">
                    <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">
                        Tip: Open VLC or any video player and keep it visible to see it here.
                    </p>
                </div>
            </div>
        </div>
    );
}
