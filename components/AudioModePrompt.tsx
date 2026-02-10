"use client";

import { Video, Headphones, X } from 'lucide-react';

interface AudioModePromptProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (isAudioOnly: boolean) => void;
    title?: string;
}

export default function AudioModePrompt({ isOpen, onClose, onConfirm, title = "Select Playback Mode" }: AudioModePromptProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                <p className="text-zinc-400 text-sm mb-6">
                    How would you like to play this content?
                </p>

                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => onConfirm(false)}
                        className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-zinc-800 hover:bg-zinc-700 hover:ring-2 hover:ring-indigo-500 transition-all group"
                    >
                        <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white flex items-center justify-center transition-colors">
                            <Video size={24} />
                        </div>
                        <span className="font-semibold text-zinc-200 group-hover:text-white">Video</span>
                    </button>

                    <button
                        onClick={() => onConfirm(true)}
                        className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-zinc-800 hover:bg-zinc-700 hover:ring-2 hover:ring-amber-500 transition-all group"
                    >
                        <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 group-hover:bg-amber-500 group-hover:text-white flex items-center justify-center transition-colors">
                            <Headphones size={24} />
                        </div>
                        <span className="font-semibold text-zinc-200 group-hover:text-white">Audio Only</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
