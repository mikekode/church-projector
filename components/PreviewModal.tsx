"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { ScheduleItem } from '@/utils/scheduleManager';

interface PreviewModalProps {
    item: ScheduleItem;
    isOpen: boolean;
    onClose: () => void;
    onSlideSelect: (slideIndex: number) => void;
    onUpdateItem: (updatedItem: ScheduleItem) => void;
    onGoLive: (slideIndex: number) => void;
}

export default function PreviewModal({
    item,
    isOpen,
    onClose,
    onSlideSelect,
    onUpdateItem,
    onGoLive
}: PreviewModalProps) {
    const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
    const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (isOpen) {
            setSelectedSlideIndex(item.activeSlideIndex || 0);
        }
    }, [isOpen, item]);

    if (!isOpen || !mounted) return null;

    const currentSlide = item.slides[selectedSlideIndex];
    const isImage = item.type === 'media';

    const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                // Update the item's background
                onUpdateItem({
                    ...item,
                    meta: {
                        ...item.meta,
                        background: dataUrl
                    }
                });
            };
            reader.readAsDataURL(file);
        }
        setShowBackgroundPicker(false);
    };

    const handleSlideClick = (index: number) => {
        setSelectedSlideIndex(index);
        onSlideSelect(index);
    };

    const handleGoLive = () => {
        onGoLive(selectedSlideIndex);
        onClose();
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-8"
            onClick={onClose}
        >
            <div
                className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 fade-in duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${item.type === 'song' ? 'bg-purple-500/20 text-purple-400' :
                            item.type === 'media' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-amber-500/20 text-amber-400'
                            }`}>
                            {item.type === 'song' ? '♪' : item.type === 'media' ? '◼' : '✝'}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">{item.title}</h2>
                            <p className="text-xs text-zinc-500 uppercase">{item.type} • {item.slides.length} slides</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isImage && (
                            <div className="flex bg-zinc-800 rounded-lg p-1 mr-2">
                                <button
                                    onClick={() => onUpdateItem({ ...item, meta: { ...item.meta, imageMode: 'contain' } })}
                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${(!item.meta?.imageMode || item.meta.imageMode === 'contain')
                                        ? 'bg-zinc-600 text-white shadow-sm'
                                        : 'text-zinc-400 hover:text-white'}`}
                                >
                                    FIT
                                </button>
                                <button
                                    onClick={() => onUpdateItem({ ...item, meta: { ...item.meta, imageMode: 'cover' } })}
                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${item.meta?.imageMode === 'cover'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-zinc-400 hover:text-white'}`}
                                >
                                    FILL
                                </button>
                            </div>
                        )}
                        <button
                            onClick={() => setShowBackgroundPicker(true)}
                            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium text-zinc-300 flex items-center gap-2"
                        >
                            <ImageIcon size={14} />
                            Set Background
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Slide Thumbnails (Left Sidebar) */}
                    {!isImage && item.slides.length > 1 && (
                        <div className="w-32 border-r border-white/5 overflow-y-auto p-2 space-y-2 bg-zinc-950/50">
                            {item.slides.map((slide, idx) => (
                                <div
                                    key={slide.id}
                                    onClick={() => handleSlideClick(idx)}
                                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${selectedSlideIndex === idx
                                        ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
                                        : 'border-transparent hover:border-white/20'
                                        }`}
                                >
                                    {/* Slide Number Badge */}
                                    <div className="absolute top-1 left-1 w-5 h-5 bg-black/80 rounded text-[10px] font-bold flex items-center justify-center text-white z-10">
                                        {idx + 1}
                                    </div>

                                    {/* Thumbnail */}
                                    <div
                                        className="aspect-video bg-zinc-900 p-2 flex items-center justify-center"
                                        style={{
                                            backgroundImage: item.meta?.background ? `url(${item.meta.background})` : undefined,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center'
                                        }}
                                    >
                                        <p className="text-[8px] text-center text-white/80 line-clamp-3 leading-tight">
                                            {slide.content.substring(0, 60)}...
                                        </p>
                                    </div>

                                    {/* Label */}
                                    <div className="text-[9px] text-zinc-500 text-center py-1 bg-zinc-900 truncate px-1">
                                        {slide.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Main Preview Card */}
                    <div className="flex-1 p-6 flex flex-col items-center justify-center bg-black/50">
                        <div
                            className="w-full max-w-2xl aspect-video rounded-xl overflow-hidden shadow-2xl flex items-center justify-center relative"
                            style={{
                                backgroundImage: item.meta?.background ? `url(${item.meta.background})` : 'linear-gradient(to br, #1e1b4b, #0f172a)',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                            }}
                        >
                            {/* Overlay for text readability */}
                            <div className="absolute inset-0 bg-black/40" />

                            {/* Content */}
                            <div className="relative z-10 text-center p-8 max-w-full">
                                {isImage ? (
                                    <img
                                        src={currentSlide?.content}
                                        alt={item.title}
                                        className={`rounded-lg transition-all duration-300 ${item.meta?.imageMode === 'cover'
                                            ? 'w-full h-full object-cover absolute inset-0'
                                            : 'max-w-full max-h-[50vh] object-contain relative'
                                            }`}
                                    />
                                ) : (
                                    <>
                                        <p className="text-2xl md:text-3xl font-serif text-white leading-relaxed whitespace-pre-wrap drop-shadow-lg">
                                            {currentSlide?.content}
                                        </p>
                                        <p className="text-amber-300/80 mt-6 text-sm uppercase tracking-widest">
                                            {currentSlide?.label}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Navigation */}
                        {!isImage && item.slides.length > 1 && (
                            <div className="flex items-center gap-4 mt-6">
                                <button
                                    onClick={() => handleSlideClick(Math.max(0, selectedSlideIndex - 1))}
                                    disabled={selectedSlideIndex === 0}
                                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <span className="text-sm text-zinc-400">
                                    Slide {selectedSlideIndex + 1} of {item.slides.length}
                                </span>
                                <button
                                    onClick={() => handleSlideClick(Math.min(item.slides.length - 1, selectedSlideIndex + 1))}
                                    disabled={selectedSlideIndex === item.slides.length - 1}
                                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-white/5 flex justify-between items-center bg-zinc-950/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-zinc-400 hover:text-white text-sm"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleGoLive}
                        className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg shadow-green-500/20 transition-all"
                    >
                        GO LIVE →
                    </button>
                </div>
            </div>

            {/* Background Picker Modal */}
            {showBackgroundPicker && (
                <div
                    className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center"
                    onClick={() => setShowBackgroundPicker(false)}
                >
                    <div
                        className="bg-zinc-900 border border-white/10 rounded-xl p-6 w-96"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-white mb-4">Set Slide Background</h3>
                        <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-zinc-700 hover:border-indigo-500 rounded-xl cursor-pointer transition-colors">
                            <Upload size={32} className="text-zinc-500 mb-2" />
                            <span className="text-sm text-zinc-400">Click to upload image</span>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleBackgroundUpload}
                            />
                        </label>
                        {item.meta?.background && (
                            <button
                                onClick={() => {
                                    onUpdateItem({
                                        ...item,
                                        meta: { ...item.meta, background: undefined }
                                    });
                                    setShowBackgroundPicker(false);
                                }}
                                className="w-full mt-4 py-2 text-red-400 hover:text-red-300 text-sm flex items-center justify-center gap-2"
                            >
                                <Trash2 size={14} />
                                Remove Background
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}
