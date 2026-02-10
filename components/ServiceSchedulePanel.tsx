"use client";

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Music, BookOpen, Image, Play, Trash2, Eye, Upload, FileText, ImageIcon } from 'lucide-react';
import { ScheduleItem, ServiceSchedule, loadSchedule, saveSchedule, createBlankSchedule } from '@/utils/scheduleManager';
import { parseLyrics, extractTextFromFile, parsePresentationFile } from '@/utils/lyricsParser';
import PreviewModal from './PreviewModal';
import AdvancedSongEditor from './AdvancedSongEditor';
import { ResourceItem } from '@/utils/resourceLibrary';
import PlanManagerModal from './PlanManagerModal';
import { FolderOpen } from 'lucide-react';

interface ServiceScheduleProps {
    onGoLive: (item: ScheduleItem, slideIndex: number) => void;
    schedule?: ServiceSchedule;
    onScheduleChange?: (schedule: ServiceSchedule) => void;
}

// Sortable Item Component
function SortableScheduleItem({
    item,
    isActive,
    onSelect,
    onRemove,
    onPreview
}: {
    item: ScheduleItem;
    isActive: boolean;
    onSelect: () => void;
    onRemove: () => void;
    onPreview: () => void;
}) {
    const [isHovered, setIsHovered] = useState(false);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    // Determine Thumbnail
    const getThumbnail = () => {
        // 1. Background Image (Song/Scripture)
        // Handle complex object { type: 'image', value: 'url' }
        if (typeof item.meta?.background === 'object' && item.meta.background !== null && 'type' in item.meta.background && (item.meta.background as any).type === 'image') {
            return `url(${(item.meta.background as any).value})`;
        }
        // Handle simple string URL
        if (typeof item.meta?.background === 'string') {
            return `url(${item.meta.background})`;
        }

        // 2. Slide Content (Image Item)
        if (item.type === 'media' && item.slides[0]?.content?.startsWith('data:image')) {
            return `url(${item.slides[0].content})`;
        }
        // 3. Fallback
        return null;
    };

    const thumbnailUrl = getThumbnail();

    const getIcon = () => {
        switch (item.type) {
            case 'song': return <Music size={14} className="text-purple-400" />;
            case 'scripture': return <BookOpen size={14} className="text-amber-400" />;
            case 'media': return <ImageIcon size={14} className="text-blue-400" />;
            default: return <FileText size={14} className="text-zinc-500 dark:text-zinc-400" />;
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group relative flex items-center gap-3 p-2 rounded-xl border transition-all ${isDragging ? 'opacity-50 scale-105 z-50 bg-white ring-2 ring-indigo-500 shadow-xl' : ''
                } ${isActive
                    ? 'bg-indigo-50/80 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-500/50 shadow-sm'
                    : 'bg-white dark:bg-zinc-900/40 border-zinc-100 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10 hover:shadow-md hover:-translate-y-0.5'
                }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-white/5 cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-300 flex-shrink-0 transition-colors"
            >
                <GripVertical size={14} />
            </div>

            {/* Thumbnail / Card Preview */}
            <div
                className="relative w-16 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden border border-zinc-200 dark:border-white/5 flex items-center justify-center cursor-pointer hover:border-indigo-500/50 transition-colors"
                onClick={(e) => { e.stopPropagation(); onPreview(); }}
                title="Click to Preview"
            >
                {thumbnailUrl ? (
                    <div className="absolute inset-0 bg-cover bg-center opacity-80" style={{ backgroundImage: thumbnailUrl }} />
                ) : (
                    <div className="opacity-50">{getIcon()}</div>
                )}

                {/* Type Badge (Tiny) */}
                <div className="absolute bottom-0 right-0 px-1 py-0.5 bg-black/60 rounded-tl text-[6px] font-bold text-zinc-600 dark:text-zinc-300 uppercase">
                    {item.type.slice(0, 3)}
                </div>
            </div>

            {/* Content Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h4 className={`text-xs font-semibold truncate leading-tight ${isActive ? 'text-indigo-700 dark:text-indigo-200' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {item.title}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-zinc-500 truncate">
                        {item.slides.length} slides
                    </span>
                    {isActive && <span className="text-[8px] bg-red-500/20 text-red-400 px-1 rounded animate-pulse">LIVE</span>}
                </div>
            </div>

            {/* Quick Actions (Always visible on hover, or prominent Go Live) */}
            <div className={`flex items-center gap-1 ${isHovered || isActive ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
                <button
                    onClick={(e) => { e.stopPropagation(); onPreview(); }}
                    className="p-2 rounded-full bg-white dark:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all shadow-sm border border-zinc-200 dark:border-white/5"
                    title="Preview"
                >
                    <Eye size={12} />
                </button>

                <button
                    onClick={(e) => { e.stopPropagation(); onSelect(); }}
                    className={`p-2 rounded-full transition-all shadow-lg ${isActive ? 'bg-red-500 text-white animate-pulse' : 'bg-green-600 text-white hover:scale-110'}`}
                    title="Go Live"
                >
                    <Play size={12} fill="currentColor" />
                </button>

                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="p-2 rounded-full bg-white dark:bg-zinc-800 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-zinc-700 transition-all ml-1 shadow-sm border border-zinc-200 dark:border-white/5"
                    title="Remove"
                >
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );
}

export default function ServiceSchedulePanel({ onGoLive, schedule: controlledSchedule, onScheduleChange }: ServiceScheduleProps) {
    const [internalSchedule, setInternalSchedule] = useState<ServiceSchedule>(createBlankSchedule());

    const isControlled = typeof controlledSchedule !== 'undefined';
    const schedule = isControlled ? controlledSchedule : internalSchedule;

    const setSchedule = (value: ServiceSchedule | ((prev: ServiceSchedule) => ServiceSchedule)) => {
        const newSchedule = typeof value === 'function'
            ? (value as (prev: ServiceSchedule) => ServiceSchedule)(schedule)
            : value;

        if (isControlled && onScheduleChange) {
            onScheduleChange(newSchedule);
        } else {
            setInternalSchedule(newSchedule);
        }
    };
    const [activeItemId, setActiveItemId] = useState<string | null>(null);
    const [previewItem, setPreviewItem] = useState<ScheduleItem | null>(null);
    const [editingItem, setEditingItem] = useState<ResourceItem | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isPlanManagerOpen, setIsPlanManagerOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Load schedule on mount (Only if uncontrolled)
    useEffect(() => {
        if (!isControlled) {
            const init = async () => {
                const saved = await loadSchedule();
                if (saved) setInternalSchedule(saved);
            };
            init();
        }
    }, [isControlled]);

    // Save schedule on change (Only if uncontrolled)
    useEffect(() => {
        if (!isControlled) {
            saveSchedule(schedule);
        }
    }, [schedule, isControlled]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setSchedule(prev => {
                const oldIndex = prev.items.findIndex(i => i.id === active.id);
                const newIndex = prev.items.findIndex(i => i.id === over.id);
                return {
                    ...prev,
                    items: arrayMove(prev.items, oldIndex, newIndex)
                };
            });
        }
    };

    const handleSelectItem = (item: ScheduleItem) => {
        setActiveItemId(item.id);
        onGoLive(item, item.activeSlideIndex);
    };

    const handleRemoveItem = (itemId: string) => {
        setSchedule(prev => ({
            ...prev,
            items: prev.items.filter(i => i.id !== itemId)
        }));
        if (activeItemId === itemId) setActiveItemId(null);
    };

    const handleUpdateItem = (updatedItem: ScheduleItem) => {
        setSchedule(prev => ({
            ...prev,
            items: prev.items.map(i => i.id === updatedItem.id ? updatedItem : i)
        }));
        setPreviewItem(updatedItem);
    };

    const handlePreviewGoLive = (slideIndex: number) => {
        if (previewItem) {
            const updatedItem = { ...previewItem, activeSlideIndex: slideIndex };
            handleUpdateItem(updatedItem);
            setActiveItemId(previewItem.id);
            onGoLive(updatedItem, slideIndex);
        }
    };

    // File Upload Handler
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);

        for (const file of Array.from(files)) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            const baseName = file.name.replace(/\.[^/.]+$/, '');

            try {
                // Handle Images
                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
                    const dataUrl = await readFileAsDataURL(file);
                    const newItem: ScheduleItem = {
                        id: `img-${Date.now()}-${Math.random()}`,
                        type: 'media',
                        title: baseName,
                        slides: [{
                            id: `slide-1-${Date.now()}`,
                            content: dataUrl,
                            label: 'Image'
                        }],
                        activeSlideIndex: 0
                    };
                    addItem(newItem);
                }
                // Handle PDF files - render as images
                else if (ext === 'pdf') {
                    const slides = await parsePresentationFile(file);
                    const newItem: ScheduleItem = {
                        id: `pdf-${Date.now()}-${Math.random()}`,
                        type: 'media',
                        title: baseName,
                        slides: slides.map((s, i) => ({
                            id: s.id,
                            content: s.content,
                            label: `Page ${i + 1}`
                        })),
                        activeSlideIndex: 0
                    };
                    addItem(newItem);
                }
                // Handle Text/Lyrics/Docs (txt, docx)
                else if (['txt', 'docx'].includes(ext || '')) {
                    const text = await extractTextFromFile(file);
                    // Use parseLyrics which now handles generic text chunks too
                    const slides = parseLyrics(text);
                    const newItem: ScheduleItem = {
                        id: `song-${Date.now()}-${Math.random()}`,
                        type: 'song',
                        title: baseName,
                        slides: slides.map(s => ({
                            id: s.id,
                            content: s.content,
                            label: s.label
                        })),
                        activeSlideIndex: 0,
                        meta: { author: 'Imported' }
                    };
                    addItem(newItem);
                }
            } catch (err) {
                console.error('Error processing file:', file.name, err);
            }
        }

        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const readFileAsDataURL = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const addItem = (item: ScheduleItem) => {
        setSchedule(prev => ({
            ...prev,
            items: [...prev.items, item]
        }));
    };

    return (
        <div className="flex flex-col h-full bg-transparent">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-950 backdrop-blur-sm">
                <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">{schedule.name}</h3>
                    <p className="text-[10px] text-zinc-500">{schedule.items.length} items</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsPlanManagerOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-colors"
                    >
                        <FolderOpen size={14} />
                        <span>Manage Schedule</span>
                    </button>
                </div>
            </div>

            {/* Upload Button */}
            <div className="p-2 border-b border-zinc-200 dark:border-white/5">
                <label className={`flex items-center justify-center gap-2 w-full py-2 border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 rounded-lg cursor-pointer transition-colors ${isUploading ? 'opacity-50' : ''}`}>
                    <Upload size={14} className="text-zinc-500" />
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {isUploading ? 'Uploading...' : 'Upload (Images, Songs, Slides)'}
                    </span>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".jpg,.jpeg,.png,.gif,.webp,.txt,.docx,.pdf"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                    />
                </label>
            </div>

            {/* Schedule List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {schedule.items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-2 py-8 bg-zinc-50/50 dark:bg-zinc-950/20">
                        <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-black flex items-center justify-center">
                            <Music size={20} />
                        </div>
                        <p className="text-[10px] text-center">No items in schedule</p>
                        <p className="text-[9px] text-zinc-400 dark:text-zinc-700 text-center">
                            Ctrl+K to add songs<br />or upload files above
                        </p>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={schedule.items.map(i => i.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {schedule.items.map(item => (
                                <SortableScheduleItem
                                    key={item.id}
                                    item={item}
                                    isActive={activeItemId === item.id}
                                    onSelect={() => handleSelectItem(item)}
                                    onRemove={() => handleRemoveItem(item.id)}
                                    onPreview={() => setPreviewItem(item)}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            {/* Preview Modal */}
            {previewItem && (
                <PreviewModal
                    item={previewItem}
                    isOpen={!!previewItem}
                    onClose={() => setPreviewItem(null)}
                    onSlideSelect={(idx) => {
                        handleUpdateItem({ ...previewItem, activeSlideIndex: idx });
                    }}
                    onUpdateItem={handleUpdateItem}
                    onGoLive={handlePreviewGoLive}
                    onEdit={() => {
                        // Upgrade ScheduleItem to ResourceItem for editor
                        const resource: ResourceItem = {
                            ...previewItem,
                            category: previewItem.type as any,
                            dateAdded: Date.now(),
                            // Ensure meta exists if needed
                            meta: previewItem.meta || {}
                        };
                        setEditingItem(resource);
                        setPreviewItem(null);
                    }}
                />
            )}

            {/* Song Editor (for Schedule Items) */}
            {editingItem && createPortal(
                <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                    <AdvancedSongEditor
                        resource={editingItem}
                        onSave={(updated) => {
                            // Convert back to ScheduleItem (mostly compatible)
                            const updatedScheduleItem: ScheduleItem = {
                                ...updated,
                                // Keep original ID if it was a schedule item
                            };
                            handleUpdateItem(updatedScheduleItem);
                            setEditingItem(null);
                        }}
                        onCancel={() => setEditingItem(null)}
                    />
                </div>,
                document.body
            )}

            {/* Plan Manager Modal */}
            <PlanManagerModal
                isOpen={isPlanManagerOpen}
                onClose={() => setIsPlanManagerOpen(false)}
                currentSchedule={schedule}
                onLoadPlan={(loadedPlan) => {
                    setSchedule(loadedPlan);
                    // Since we updated the schedule, the local effect will kick in and save it to the "current" slot automatically
                }}
            />
        </div>
    );
}
