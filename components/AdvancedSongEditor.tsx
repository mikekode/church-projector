"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, GripVertical, Type, Palette, Music, User, Layout, Eye, ChevronUp, ChevronDown, Check, Save, Bold, Italic, ArrowLeft } from 'lucide-react';
import { ResourceItem } from '@/utils/resourceLibrary';

interface AdvancedSongEditorProps {
    resource: ResourceItem;
    onSave: (updatedResource: ResourceItem) => void;
    onCancel: () => void;
}

const SECTION_TEMPLATES = [
    { label: 'Verse 1', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { label: 'Verse 2', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { label: 'Verse 3', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { label: 'Chorus', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
    { label: 'Bridge', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    { label: 'Intro', color: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-700' },
    { label: 'Outro', color: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-700' },
    { label: 'Pre-Chorus', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
];

export default function AdvancedSongEditor({ resource, onSave, onCancel }: AdvancedSongEditorProps) {
    const [title, setTitle] = useState(resource.title);
    const [author, setAuthor] = useState(resource.meta?.author || '');
    const [slides, setSlides] = useState(resource.slides);
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);
    const [selectedColor, setSelectedColor] = useState('#ffffff');
    const [activeContent, setActiveContent] = useState(resource.slides[activeSlideIndex]?.content || '');

    // We use a ref to track the editor's DOM elements to apply formatting
    const editorRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Sync active content when slide index changes
    useEffect(() => {
        if (slides[activeSlideIndex]) {
            setActiveContent(slides[activeSlideIndex].content || '');
        }
    }, [activeSlideIndex, slides]);

    const handleAddSlide = () => {
        const newSlide = {
            id: `slide-${Date.now()}`,
            content: '',
            label: `Verse ${slides.length + 1}`
        };
        const newSlides = [...slides];
        newSlides.splice(activeSlideIndex + 1, 0, newSlide);
        setSlides(newSlides);
        setActiveSlideIndex(activeSlideIndex + 1);
    };

    const handleDeleteSlide = (index: number) => {
        if (slides.length <= 1) return;
        const newSlides = slides.filter((_, i) => i !== index);
        setSlides(newSlides);
        const nextIndex = Math.min(activeSlideIndex, newSlides.length - 1);
        setActiveSlideIndex(nextIndex);
    };

    const updateSlideContent = (index: number, content: string) => {
        if (slides[index] && slides[index].content === content) return;

        const newSlides = [...slides];
        newSlides[index] = { ...newSlides[index], content };
        setSlides(newSlides);
        if (index === activeSlideIndex) {
            setActiveContent(content);
        }
    };

    const updateSlideLabel = (index: number, label: string) => {
        const newSlides = [...slides];
        newSlides[index] = { ...newSlides[index], label };
        setSlides(newSlides);
    };

    const handleSave = () => {
        const updatedResource: ResourceItem = {
            ...resource,
            title,
            slides,
            meta: {
                ...resource.meta,
                author
            },
            dateAdded: Date.now()
        };
        onSave(updatedResource);
    };

    const applyFormat = (command: string, value?: string) => {
        const slideId = slides[activeSlideIndex]?.id;
        if (!slideId) return;

        const editor = editorRefs.current[slideId];
        if (editor) {
            editor.focus();
            document.execCommand(command, false, value);
            updateSlideContent(activeSlideIndex, editor.innerHTML);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-300">

            {/* Toolbar Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-950/50">
                <div className="flex items-center gap-6 flex-1">
                    <button
                        onClick={onCancel}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-xl transition-colors group text-zinc-500 hover:text-zinc-900 dark:text-white"
                        title="Back to Dashboard"
                    >
                        <ArrowLeft size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
                    </button>

                    <div className="flex flex-col gap-1 flex-1 max-w-sm">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="bg-transparent text-lg font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-b border-indigo-500/50 w-full"
                            placeholder="Song Title"
                        />
                        <div className="flex items-center gap-2 text-zinc-500">
                            <User size={12} />
                            <input
                                type="text"
                                value={author}
                                onChange={(e) => setAuthor(e.target.value)}
                                className="bg-transparent text-[10px] uppercase font-bold tracking-widest focus:outline-none focus:border-b border-indigo-500/30"
                                placeholder="AUTHOR / ARTIST"
                            />
                        </div>
                    </div>

                    {/* Formatting Controls */}
                    <div className="flex items-center gap-1 px-4 border-l border-r border-zinc-200 dark:border-white/5">
                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applyFormat('bold')}
                            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                            title="Bold"
                        >
                            <Bold size={18} />
                        </button>
                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applyFormat('italic')}
                            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                            title="Italic"
                        >
                            <Italic size={18} />
                        </button>
                        <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-2" />
                        <div className="flex items-center gap-2 group relative">
                            <Palette size={16} className="text-zinc-500" />
                            <input
                                type="color"
                                value={selectedColor}
                                onChange={(e) => {
                                    const color = e.target.value;
                                    setSelectedColor(color);
                                    applyFormat('foreColor', color);
                                }}
                                className="w-6 h-6 rounded-full overflow-hidden bg-transparent border-0 cursor-pointer p-0"
                            />
                        </div>
                    </div>

                    {/* Section Templates */}
                    <div className="flex flex-wrap gap-1 max-w-xs">
                        {SECTION_TEMPLATES.map((tpl) => (
                            <button
                                key={tpl.label}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => updateSlideLabel(activeSlideIndex, tpl.label)}
                                className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border transition-all hover:scale-105 active:scale-95 ${tpl.color}`}
                            >
                                {tpl.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-zinc-900 dark:text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all">
                        <Save size={16} /> SAVE SONG
                    </button>
                    <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-lg transition-colors border border-zinc-200 dark:border-white/5" title="Discard Changes">
                        <X size={20} className="text-zinc-500 hover:text-red-400" />
                    </button>
                </div>
            </div>

            {/* Main Editor Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Slide Cards List */}
                <div className="w-1/2 overflow-y-auto p-4 space-y-4 bg-zinc-100 dark:bg-black/20 border-r border-zinc-200 dark:border-white/5 custom-scrollbar">
                    {slides.map((slide, index) => (
                        <div
                            key={slide.id}
                            onClick={() => setActiveSlideIndex(index)}
                            className={`group border rounded-2xl overflow-hidden transition-all duration-300 relative ${activeSlideIndex === index
                                ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-500/5'
                                : 'border-zinc-200 dark:border-white/5 bg-zinc-900/50 hover:border-white/20'
                                }`}
                        >
                            {/* Slide Header */}
                            <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-white/5 bg-zinc-100 dark:bg-black/20">
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[11px] font-black text-zinc-500">
                                        {index + 1}
                                    </div>
                                    <input
                                        type="text"
                                        value={slide.label || ''}
                                        onChange={(e) => updateSlideLabel(index, e.target.value)}
                                        className="bg-transparent text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 focus:outline-none"
                                        placeholder="LABEL"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteSlide(index); }}
                                        className="p-1.5 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                                        title="Delete Slide"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Slide Content (Editable) */}
                            <div className="p-5">
                                <div
                                    ref={(el) => {
                                        editorRefs.current[slide.id] = el;
                                        // CRITICAL: Only sync State -> DOM if NOT focused
                                        // This prevents fighting the cursor while typing
                                        if (el && document.activeElement !== el && el.innerHTML !== slide.content) {
                                            el.innerHTML = slide.content;
                                        }
                                    }}
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => updateSlideContent(index, e.currentTarget.innerHTML)}
                                    // Update state on input to drive live preview, relying on ref guard to prevent cursor jumps
                                    onInput={(e) => updateSlideContent(index, e.currentTarget.innerHTML)}
                                    className="min-h-[120px] text-xl leading-relaxed text-zinc-900 dark:text-white focus:outline-none whitespace-pre-wrap"
                                />
                            </div>

                            {activeSlideIndex === index && (
                                <div className="absolute top-0 right-0 p-2 pointer-events-none">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                                </div>
                            )}
                        </div>
                    ))}

                    <button
                        onClick={handleAddSlide}
                        className="w-full py-6 border-2 border-dashed border-zinc-200 dark:border-white/5 hover:border-indigo-500/30 rounded-2xl flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all group"
                    >
                        <Plus size={24} className="group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Insert New Slide Here</span>
                    </button>
                </div>

                {/* Right: Premium Preview Panel */}
                <div className="w-1/2 p-8 bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none select-none">
                        <Music size={400} />
                    </div>

                    <div className="w-full max-w-[560px] aspect-video bg-[#0a0a0a] rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col relative z-10 overflow-hidden ring-1 ring-white/5">
                        <header className="p-4 border-b border-zinc-200 dark:border-white/5 bg-black/60 flex justify-between items-center backdrop-blur-md">
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                                <div className="w-3 h-3 rounded-full bg-green-500/50" />
                            </div>
                            <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Eye size={12} className="text-indigo-500" /> LIVE PROJECTOR PREVIEW
                            </span>
                            <div className="w-12" />
                        </header>

                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center relative overflow-hidden bg-black">
                            {/* Slide Label in Preview */}
                            <span className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-indigo-500/15 text-indigo-400 text-[11px] font-black uppercase tracking-[0.4em] rounded-full border border-indigo-500/20 shadow-lg backdrop-blur-md">
                                {slides[activeSlideIndex]?.label || 'PREVIEW'}
                            </span>

                            <div
                                className="text-4xl font-bold text-white transition-all duration-300 leading-[1.4] drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
                                dangerouslySetInnerHTML={{ __html: activeContent || '<span class="opacity-20 italic">No lyrics content</span>' }}
                            />
                        </div>

                        <footer className="p-4 border-t border-zinc-200 dark:border-white/5 bg-black/60 flex justify-center gap-6 backdrop-blur-md">
                            <div className="flex gap-2">
                                {slides.map((_, i) => (
                                    <div
                                        key={i}
                                        className={`w-2 h-2 rounded-full transition-all duration-500 ${i === activeSlideIndex ? 'bg-indigo-500 w-8' : 'bg-zinc-200 dark:bg-zinc-800'}`}
                                    />
                                ))}
                            </div>
                        </footer>
                    </div>

                    <div className="mt-12 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-[0.3em] text-center max-w-xs leading-loose bg-white/5 px-6 py-3 rounded-2xl border border-zinc-200 dark:border-white/5">
                            Real-time Projection Sync
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-600 font-medium italic">
                            <Type size={12} /> Click anywhere on a slide card to edit and see it live.
                        </div>
                    </div>
                </div>
            </div>

            {/* Remove custom scrollbar styles if they cause issues, or use tailwind classes if available */}
        </div>
    );
}
