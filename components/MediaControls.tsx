"use client";

import { useState } from 'react';
import { Play, Pause, FastForward, Rewind, Maximize, Minimize, Gauge, ZoomIn } from 'lucide-react';

interface MediaControlsProps {
    onAction: (action: string, value?: any) => void;
    currentSpeed?: number;
    isPaused?: boolean;
    isFullScreen?: boolean;
}

export default function MediaControls({ onAction, currentSpeed = 1, isPaused = false, isFullScreen = false, isVideo = true }: MediaControlsProps & { isVideo?: boolean }) {
    const [speed, setSpeed] = useState(currentSpeed);
    const [paused, setPaused] = useState(isPaused);
    const [fullScreen, setFullScreen] = useState(isFullScreen);

    const handlePlayPause = () => {
        const newPaused = !paused;
        setPaused(newPaused);
        onAction(newPaused ? 'pause' : 'play');
    };

    const handleSeek = (seconds: number) => {
        onAction('seek', seconds);
    };

    const handleSpeedChange = () => {
        const speeds = [0.5, 1, 1.5, 2];
        const currentIndex = speeds.indexOf(speed);
        const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
        setSpeed(nextSpeed);
        onAction('rate', nextSpeed);
    };

    const handleFullScreen = () => {
        // Cycle: contain -> cover -> stretch -> contain
        let nextMode: 'contain' | 'cover' | 'stretch';
        if (!fullScreen) { // Currently 'contain'
            nextMode = 'cover';
            setFullScreen(true);
            setIsStretch(false);
        } else if (fullScreen && !isStretch) { // Currently 'cover'
            nextMode = 'stretch';
            setIsStretch(true);
            setFullScreen(true);
        } else { // Currently 'stretch'
            nextMode = 'contain';
            setFullScreen(false);
            setIsStretch(false);
        }
        onAction('set_mode', nextMode);
    };

    const [isStretch, setIsStretch] = useState(false);

    const [zoom, setZoom] = useState(1);
    const handleZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        setZoom(value);
        onAction('set_scale', value);
    };

    return (
        <div className="flex items-center gap-1 bg-zinc-800/90 backdrop-blur border border-white/5 rounded-full p-1 shadow-lg">
            {isVideo && (
                <>
                    {/* Seek Backward */}
                    <button
                        onClick={() => handleSeek(-10)}
                        className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        title="Rewind 10s"
                    >
                        <Rewind size={14} />
                    </button>

                    {/* Play/Pause */}
                    <button
                        onClick={handlePlayPause}
                        className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${paused
                            ? 'bg-white/5 text-zinc-300 hover:bg-white/10'
                            : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/20 shadow-lg'
                            }`}
                        title={paused ? "Play" : "Pause"}
                    >
                        {paused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                    </button>

                    {/* Seek Forward */}
                    <button
                        onClick={() => handleSeek(10)}
                        className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        title="Forward 10s"
                    >
                        <FastForward size={14} />
                    </button>

                    <div className="w-px h-4 bg-white/10 mx-1" />

                    {/* Speed Toggle */}
                    <button
                        onClick={handleSpeedChange}
                        className="h-8 px-3 flex items-center gap-1.5 text-[10px] font-black tracking-wider text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        title="Playback Speed"
                    >
                        <Gauge size={12} />
                        <span>{speed}x</span>
                    </button>

                    <div className="w-px h-4 bg-white/10 mx-1" />
                </>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center gap-2 px-2">
                <ZoomIn size={14} className="text-zinc-400" />
                <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={zoom}
                    onChange={handleZoom}
                    className="w-16 h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                    title={`Zoom: ${Math.round(zoom * 100)}%`}
                />
            </div>

            <div className="w-px h-4 bg-white/10 mx-1" />

            {/* Full Screen / Fit Toggle - 3 States */}
            <button
                onClick={handleFullScreen}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${fullScreen
                    ? 'text-indigo-400 bg-indigo-500/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/10'
                    }`}
                title={!fullScreen ? "Fill Screen (Cover)" : isStretch ? "Reset to Contain" : "Stretch to Fill"}
            >
                {isStretch ? <Maximize className="rotate-45" size={14} /> : fullScreen ? <Minimize size={14} /> : <Maximize size={14} />}
            </button>
        </div>
    );
}
