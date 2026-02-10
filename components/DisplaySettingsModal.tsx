"use client";

import { useState, useEffect } from 'react';
import { X, Monitor, Tv2, PointerIcon as Punto, CheckCircle, RefreshCw, Layers } from 'lucide-react';

interface Display {
    id: string;
    index: number;
    label: string;
    isPrimary: boolean;
}

interface DisplaySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function DisplaySettingsModal({ isOpen, onClose }: DisplaySettingsModalProps) {
    const [displays, setDisplays] = useState<Display[]>([]);
    const [projectorDisplayId, setProjectorDisplayId] = useState<string | null>(null);
    const [stageDisplayId, setStageDisplayId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const loadDisplays = async () => {
        setLoading(true);
        if (window.electronAPI?.getDisplays) {
            const results = await window.electronAPI.getDisplays();
            setDisplays(results);

            // Try to load saved settings from localStorage
            const savedProjector = localStorage.getItem('projectorDisplayId');
            const savedStage = localStorage.getItem('stageDisplayId');

            if (savedProjector) setProjectorDisplayId(savedProjector);
            if (savedStage) setStageDisplayId(savedStage);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen) loadDisplays();
    }, [isOpen]);

    const handleIdentify = () => {
        window.electronAPI?.identifyDisplays();
    };

    const handleSave = () => {
        if (projectorDisplayId) localStorage.setItem('projectorDisplayId', projectorDisplayId);
        if (stageDisplayId) localStorage.setItem('stageDisplayId', stageDisplayId);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-8 border-b border-zinc-200 dark:border-white/5 bg-gradient-to-br from-indigo-600/5 dark:from-indigo-600/10 to-transparent">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-3 tracking-tight">
                                <Monitor className="text-indigo-400" /> Display Settings
                            </h2>
                            <p className="text-sm text-zinc-400 mt-1 uppercase tracking-widest font-bold opacity-60">Map Your Screens</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    {/* Identify Button */}
                    <div className="flex items-center justify-between p-4 bg-indigo-600/5 border border-indigo-500/20 rounded-2xl">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                <Monitor size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Identify Screens</h3>
                                <p className="text-[10px] text-zinc-500 mt-0.5">Show screen numbers on all connected displays.</p>
                            </div>
                        </div>
                        <button
                            onClick={handleIdentify}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
                        >
                            Start Identification
                        </button>
                    </div>

                    {/* Assignment Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Projector Assignment */}
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Tv2 size={12} className="text-indigo-400" /> Projector Screen
                            </h3>
                            <div className="space-y-2">
                                {displays.map(display => (
                                    <button
                                        key={display.id}
                                        onClick={() => setProjectorDisplayId(display.id)}
                                        className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${projectorDisplayId === display.id
                                            ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                                            : 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-white/10'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg font-black opacity-50">#{display.index}</span>
                                            <span className="text-xs font-bold">{display.label}</span>
                                        </div>
                                        {projectorDisplayId === display.id && <CheckCircle size={16} className="text-indigo-500" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Stage Assignment */}
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Layers size={12} className="text-amber-400" /> Confidence Monitor
                            </h3>
                            <div className="space-y-2">
                                {displays.map(display => (
                                    <button
                                        key={display.id}
                                        onClick={() => setStageDisplayId(display.id)}
                                        className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${stageDisplayId === display.id
                                            ? 'bg-amber-600/20 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                                            : 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-white/10'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg font-black opacity-50">#{display.index}</span>
                                            <span className="text-xs font-bold">{display.label}</span>
                                        </div>
                                        {stageDisplayId === display.id && <CheckCircle size={16} className="text-amber-500" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-8 bg-zinc-100 dark:bg-zinc-950/50 border-t border-zinc-200 dark:border-white/5 flex items-center justify-between">
                    <p className="text-[10px] text-zinc-500 italic max-w-xs">
                        Settings are saved locally to this computer.
                    </p>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 text-xs font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-8 py-3 bg-white text-black text-xs font-black uppercase tracking-widest rounded-full hover:bg-zinc-200 transition-all shadow-xl active:scale-95"
                        >
                            Save Configuration
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
