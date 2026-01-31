"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Maximize2, Maximize, Mic, MicOff, Search, Settings, Monitor, CheckCircle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Key, Download, X, Tv2, Music, Clock } from 'lucide-react';
import Fuse from 'fuse.js';

import LicenseModal from '@/components/LicenseModal';
import MIDISettingsModal from '@/components/MIDISettingsModal';
import { useMIDI, MidiAction } from '@/hooks/useMIDI';
import { useBroadcastChannel } from '@/hooks/useBroadcast';
import { useSmartDetection, type DetectionSignal } from '@/hooks/useSmartDetection';
import DeepgramRecognizer from '@/components/DeepgramRecognizer';
import { detectVersesInText, lookupVerseAsync, SUPPORTED_VERSIONS } from '@/utils/bible';
import { DEFAULT_THEMES, ProjectorTheme } from '@/utils/themes';
import Link from 'next/link';
import OmniSearch from '@/components/OmniSearch';
import ServiceSchedulePanel from '@/components/ServiceSchedulePanel';
import ResourceLibraryPanel from '@/components/ResourceLibraryPanel';
import { ScheduleItem, ServiceSchedule, createBlankSchedule, loadSchedule, saveSchedule } from '@/utils/scheduleManager';
import { ResourceItem } from '@/utils/resourceLibrary';

type DetectedItem = {
    id: string;
    reference: string;
    text: string;
    version: string;
    chapter: number;
    verseNum: number;
    verseEnd?: number;
    book: string;
    timestamp: Date;
    confidence?: number;
    matchType?: 'exact' | 'partial' | 'paraphrase';
    songData?: any; // Full song object for slide navigation
    // Multi-verse support
    additionalVerses?: { verseNum: number; text: string; reference: string }[];
};

// Pulsating Voice Wave Component
const VoiceWave = ({ level, active }: { level: number, active: boolean }) => {
    // 5 bars with different sensitivities
    // We use CSS transitions for smooth motion
    return (
        <div className="flex items-center gap-1 h-4">
            {[0.5, 0.8, 1.0, 0.8, 0.5].map((sensitivity, i) => {
                // Calculate height: Base 2px + Level * Multiplier
                // When not active (mic off), flat line.
                const height = active ? Math.max(3, level * 24 * sensitivity) : 2;
                return (
                    <div
                        key={i}
                        className={`w-1 bg-indigo-500 rounded-full transition-all duration-75 ease-out ${active ? 'opacity-100' : 'opacity-20'}`}
                        style={{ height: `${height}px` }}
                    />
                );
            })}
        </div>
    );
};

export const metadata = {
    title: "Creenly Dashboard",
    robots: { index: false }
};

export default function DashboardPage() {
    const [isListening, setIsListening] = useState(false);
    const [isMicLoading, setIsMicLoading] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [interim, setInterim] = useState("");
    const [voiceLevel, setVoiceLevel] = useState(0); // Audio RMS level (0-1)
    const [detectedQueue, setDetectedQueue] = useState<DetectedItem[]>([]);
    const [activeItem, setActiveItem] = useState<DetectedItem | null>(null);
    const [autoMode, setAutoMode] = useState(false);
    const [aiStatus, setAiStatus] = useState<'idle' | 'processing' | 'loading'>('idle');
    const [lastSignal, setLastSignal] = useState<DetectionSignal>('WAIT');
    const [confidenceThreshold, setConfidenceThreshold] = useState(85);


    // WebSocket (Deepgram) Status Management
    const [deepgramStatus, setDeepgramStatus] = useState<{ status: string; error?: string | null }>({ status: 'idle' });
    const [selectedVersion, setSelectedVersion] = useState<string>('KJV');
    const [verseCount, setVerseCount] = useState<1 | 2 | 3>(1);
    const [showBibleBrowser, setShowBibleBrowser] = useState(false);
    const [showVersionMenu, setShowVersionMenu] = useState(false);

    const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = useState(true);
    const [isMidiSettingsOpen, setIsMidiSettingsOpen] = useState(false);
    const [showTimerSettings, setShowTimerSettings] = useState(false);
    const [timerDuration, setTimerDuration] = useState(30); // Minutes
    const [timerState, setTimerState] = useState({ isRunning: false, isPaused: false });
    const [resetFlash, setResetFlash] = useState(false);
    const [libraryResources, setLibraryResources] = useState<ResourceItem[]>([]);

    // Initialize Fuse for Song Detection
    const fuseRef = useRef<Fuse<any> | null>(null);

    const { broadcast, subscribe } = useBroadcastChannel('projector_channel', (msg: any) => {
        // Handle incoming messages if needed
    });

    // Sync Timer Status
    useEffect(() => {
        const unsubscribe = subscribe((msg: any) => {
            if (msg.type === 'TIMER_STATUS') {
                setTimerState({
                    isRunning: msg.payload.isRunning,
                    isPaused: msg.payload.isPaused
                });
            }
        });
        return unsubscribe;
    }, [subscribe]);

    // Re-initialize Fuse when libraryResources changes
    useEffect(() => {
        fuseRef.current = new Fuse(libraryResources.filter(r => r.type === 'song'), {
            keys: ['title', 'slides.content'],
            threshold: 0.4,
            ignoreLocation: true,
            includeScore: true
        });
    }, [libraryResources]);

    // Resizable Layout State
    const [topPanelHeight, setTopPanelHeight] = useState(65);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const isNavigatingRef = useRef(false); // Prevents race condition with version sync

    // Auto Update State
    const [updateStatus, setUpdateStatus] = useState<{ type: 'idle' | 'available' | 'downloading' | 'ready' | 'error', version?: string, error?: string }>({ type: 'idle' });

    useEffect(() => {
        if ((window as any).electronAPI?.onUpdateAvailable) {
            (window as any).electronAPI.onUpdateAvailable((info: any) => {
                console.log("Update Available:", info);
                setUpdateStatus({ type: 'available', version: info.version });
            });
            (window as any).electronAPI.onUpdateDownloaded((info: any) => {
                console.log("Update Ready:", info);
                setUpdateStatus({ type: 'ready', version: info.version });
            });
            (window as any).electronAPI.onUpdateError((err: any) => {
                console.error(err);
                if (updateStatus.type !== 'idle') setUpdateStatus({ type: 'error', error: String(err) });
            });
        }
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault(); // Prevent text selection
        isDraggingRef.current = true;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
    }, []);

    const handleMouseUp = useCallback(() => {
        isDraggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDraggingRef.current || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const relativeY = e.clientY - containerRect.top;
        const percentage = (relativeY / containerRect.height) * 100;

        // Clamp between 20% and 85%
        const clamped = Math.min(Math.max(percentage, 20), 85);
        setTopPanelHeight(clamped);
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    // Schedule State (Lifted from ServiceSchedulePanel)
    const [schedule, setSchedule] = useState<ServiceSchedule>(createBlankSchedule());

    // Track Live Presentation (Slides) for remote control
    const [livePresentation, setLivePresentation] = useState<{
        item: ScheduleItem;
        slideIndex: number;
    } | null>(null);

    const [currentTheme, setCurrentTheme] = useState<ProjectorTheme>(DEFAULT_THEMES[0]);

    const BIBLE_VERSIONS = SUPPORTED_VERSIONS;
    const VERSE_COUNT_OPTIONS = [1, 2, 3] as const;

    // Load Schedule
    useEffect(() => {
        const init = async () => {
            const saved = await loadSchedule();
            if (saved) setSchedule(saved);
        };
        init();
    }, []);

    // Save Schedule
    useEffect(() => {
        saveSchedule(schedule);
    }, [schedule]);

    const handleAddToSchedule = (resource: ResourceItem) => {
        const newItem: ScheduleItem = {
            id: `sch-res - ${Date.now()} `,
            type: resource.type,
            title: resource.title,
            slides: resource.slides,
            activeSlideIndex: 0,
            meta: resource.meta
        };

        setSchedule(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
    };

    const transcriptRef = useRef(transcript);
    const detectedQueueRef = useRef(detectedQueue);
    const autoModeRef = useRef(autoMode);
    const activeItemRef = useRef(activeItem);
    const selectedVersionRef = useRef(selectedVersion);
    const verseCountRef = useRef(verseCount);
    const transcriptScrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll transcript to bottom
    useEffect(() => {
        if (transcriptScrollRef.current) {
            transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
        }
    }, [transcript, interim]);

    // Keep refs in sync
    useEffect(() => {
        transcriptRef.current = transcript;
        detectedQueueRef.current = detectedQueue;
        autoModeRef.current = autoMode;
        activeItemRef.current = activeItem;
        selectedVersionRef.current = selectedVersion;
        verseCountRef.current = verseCount;
    }, [transcript, detectedQueue, autoMode, activeItem, selectedVersion, verseCount]);

    // Broadcast Theme Changes
    useEffect(() => {
        broadcast({ type: 'APPLY_THEME', payload: currentTheme });
    }, [currentTheme, broadcast]);

    // Fetch multiple verses for multi-verse display
    const fetchMultipleVerses = useCallback(async (
        book: string,
        chapter: number,
        startVerse: number,
        count: number,
        version: string
    ): Promise<{ verseNum: number; text: string; reference: string }[]> => {
        const verses: { verseNum: number; text: string; reference: string }[] = [];

        for (let i = 0; i < count; i++) {
            const verseNum = startVerse + i;
            const text = await lookupVerseAsync(book, chapter, verseNum, version);
            if (text) {
                verses.push({
                    verseNum,
                    text,
                    reference: `${book} ${chapter}:${verseNum} `
                });
            } else {
                // Stop if verse doesn't exist (end of chapter)
                break;
            }
        }

        return verses;
    }, []);

    const handleSlideNavigation = useCallback((direction: 'next' | 'prev') => {
        if (!livePresentation) return;

        const { item, slideIndex } = livePresentation;
        const newIndex = direction === 'next' ? slideIndex + 1 : slideIndex - 1;

        if (newIndex >= 0 && newIndex < item.slides.length) {
            const slide = item.slides[newIndex];
            setLivePresentation({ ...livePresentation, slideIndex: newIndex });

            // Broadcast new slide content
            broadcast({
                type: 'SHOW_CONTENT',
                payload: {
                    type: item.type === 'media' ? 'media' : 'song',
                    title: item.title,
                    body: slide.content,
                    meta: item.type === 'media' ? 'Image' : item.meta?.author,
                    background: item.meta?.background,
                    options: item.type === 'media' ? { imageMode: item.meta?.imageMode } : undefined
                }
            });

            // Update local preview text
            setActiveItem(prev => prev ? ({
                ...prev,
                text: slide.content,
                // Ensure version is set to preserve context
                version: item.type === 'media' ? 'MEDIA' : 'SONG'
            }) : null);
        }
    }, [livePresentation, broadcast]);

    // Re-fetch current verse(s) when version, verseCount, or the active item itself changes
    useEffect(() => {
        const current = activeItem;
        if (!current) return;

        // CRITICAL: Skip if navigation is in progress to prevent race condition
        // where this effect overwrites the navigated verse with the old verse text
        if (isNavigatingRef.current) {
            console.log('[SYNC] Skipped: Navigation in progress');
            return;
        }

        // Skip if already in the correct version and count (prevents loops)
        const currentCount = (current.additionalVerses?.length || 0) + 1;
        if (current.version === selectedVersion && currentCount === verseCount) {
            return;
        }

        const fetchNewVersion = async () => {
            console.log(`[SYNC] Updating ${current.reference} to ${selectedVersion} (${verseCount} verses)`);

            // Fetch all requested verses in the new version
            const allVerses = await fetchMultipleVerses(
                current.book,
                current.chapter,
                current.verseNum,
                verseCount,
                selectedVersion
            );

            if (allVerses.length > 0) {
                const mainText = allVerses[0].text;
                const extraVerses = allVerses.slice(1);

                // IMPORTANT: Only update if THIS verse is still the one on screen
                if (activeItemRef.current?.id === current.id) {
                    const updatedItem: DetectedItem = {
                        ...current,
                        text: mainText,
                        version: selectedVersion,
                        additionalVerses: extraVerses.length > 0 ? extraVerses : undefined,
                    };

                    setActiveItem(updatedItem);

                    // Build display metadata
                    const allTexts = allVerses.map(v => v.text);
                    const lastVerseNum = allVerses[allVerses.length - 1].verseNum;
                    const displayReference = allVerses.length > 1
                        ? `${current.book} ${current.chapter}:${current.verseNum} -${lastVerseNum} `
                        : current.reference;

                    broadcast({
                        type: 'SHOW_VERSE',
                        payload: {
                            reference: displayReference,
                            text: allTexts.join(' '),
                            version: selectedVersion,
                            verses: allVerses
                        }
                    });
                }

                // Sync the queue so the new text is reflected there too
                setDetectedQueue(prev =>
                    prev.map(item =>
                        item.id === current.id
                            ? { ...item, text: mainText, version: selectedVersion }
                            : item
                    )
                );
            }
        };

        fetchNewVersion();
    }, [selectedVersion, verseCount, activeItem?.id, fetchMultipleVerses, broadcast]);

    const goLive = useCallback(async (item: DetectedItem) => {
        // Handle Songs with Navigation Controls
        if (item.version === 'SONG' && item.songData) {
            // User request: Always start detected songs at the FIRST slide (index 0)
            // regardless of which specific line was matched.
            const initialSlideIndex = 0;
            const initialSlide = item.songData.slides[initialSlideIndex];

            // Set state for navigation
            setLivePresentation({
                item: item.songData,
                slideIndex: initialSlideIndex
            });

            // Update active item to reflect First Slide content
            setActiveItem({
                ...item,
                text: initialSlide.content
            });

            // Broadcast content to Projector
            // Using SHOW_CONTENT matches the format used by handleSlideNavigation for songs
            broadcast({
                type: 'SHOW_CONTENT',
                payload: {
                    type: 'song',
                    title: item.reference, // item.reference holds the Title for songs in detectedQueue
                    body: initialSlide.content,
                    slideIndex: initialSlideIndex,
                    totalSlides: item.songData.slides.length,
                    meta: item.songData.author,
                    nextSlide: item.songData.slides[initialSlideIndex + 1]?.content
                }
            });
            return;
        }

        const currentVerseCount = verseCountRef.current;
        const currentVersion = selectedVersionRef.current;

        // If multi-verse mode, fetch additional verses
        let additionalVerses: { verseNum: number; text: string; reference: string }[] = [];

        if (currentVerseCount > 1) {
            const allVerses = await fetchMultipleVerses(
                item.book,
                item.chapter,
                item.verseNum,
                currentVerseCount,
                currentVersion
            );
            // Skip the first verse since it's already in item.text
            additionalVerses = allVerses.slice(1);
        }

        const updatedItem: DetectedItem = {
            ...item,
            additionalVerses: additionalVerses.length > 0 ? additionalVerses : undefined
        };

        setActiveItem(updatedItem);

        // Build combined text for broadcast
        const allTexts = [item.text, ...additionalVerses.map(v => v.text)];
        const lastVerse = additionalVerses.length > 0
            ? additionalVerses[additionalVerses.length - 1].verseNum
            : item.verseNum;
        const displayReference = additionalVerses.length > 0
            ? `${item.book} ${item.chapter}:${item.verseNum} -${lastVerse} `
            : item.reference;

        broadcast({
            type: 'SHOW_VERSE',
            payload: {
                reference: displayReference,
                text: allTexts.join(' '),
                version: currentVersion,
                verses: [{ verseNum: item.verseNum, text: item.text }, ...additionalVerses]
            }
        });
    }, [broadcast, fetchMultipleVerses]);

    const clearProjector = useCallback(() => {
        setActiveItem(null);
        broadcast({ type: 'CLEAR' });
    }, [broadcast]);

    // Helper to add detected scripture/song to queue
    const addToQueue = useCallback((data: {
        book: string;
        chapter: number;
        verse: number;
        verseEnd?: number;
        text: string;
        reference: string;
        confidence?: number;
        matchType?: 'exact' | 'partial' | 'paraphrase';
        version?: string;
        songData?: any;
    }, source: 'regex' | 'ai' | 'song') => {
        const isDuplicate = detectedQueueRef.current.length > 0 &&
            detectedQueueRef.current[0].reference === data.reference;

        if (!isDuplicate) {
            const newItem: DetectedItem = {
                id: Date.now().toString() + Math.random(),
                reference: data.reference,
                text: data.text,
                version: data.version || selectedVersionRef.current,
                book: data.book,
                chapter: data.chapter,
                verseNum: data.verse,
                verseEnd: data.verseEnd,
                timestamp: new Date(),
                confidence: data.confidence,
                matchType: data.matchType,
                songData: data.songData
            };

            console.log(`[${source.toUpperCase()}] Detected: `, data.reference, data.confidence ? `(${data.confidence} %)` : '');
            setDetectedQueue(prev => [newItem, ...prev].slice(0, 50));

            // Auto-push logic: Only Bible verses go live automatically
            const isSong = newItem.version === 'SONG';
            if (autoModeRef.current && !isSong) {
                goLive(newItem);
            }
        }
    }, [goLive]);

    // Navigation lock is now declared at top of component

    // Navigate to next/previous verse (accounts for multi-verse display)
    const navigateVerse = useCallback(async (direction: 'next' | 'prev' | 'jump', targetVerse?: number, overrideCount?: number) => {
        if (isNavigatingRef.current) return;

        const current = activeItemRef.current;
        if (!current) return;

        isNavigatingRef.current = true;
        setAiStatus('loading'); // Show loading indicator

        try {
            const currentVerseCount = overrideCount || verseCountRef.current;
            let newVerse: number;

            if (direction === 'next') {
                const lastDisplayedVerse = current.additionalVerses?.length
                    ? current.additionalVerses[current.additionalVerses.length - 1].verseNum
                    : current.verseNum;
                newVerse = lastDisplayedVerse + 1;
            } else if (direction === 'prev') {
                newVerse = current.verseNum - currentVerseCount;
            } else {
                newVerse = targetVerse || current.verseNum;
            }

            if (newVerse < 1) newVerse = 1;

            const currentVersion = selectedVersionRef.current;
            const verseText = await lookupVerseAsync(current.book, current.chapter, newVerse, currentVersion);

            if (verseText) {
                // Sanity Check: If text is identical to previous, and it's not a common repetition, warning
                if (verseText === current.text && verseText.length > 20) {
                    console.warn("Duplicate text detected for next verse. API might be returning same verse.");
                }

                const newItem: DetectedItem = {
                    id: Date.now().toString() + Math.random(),
                    reference: `${current.book} ${current.chapter}:${newVerse}`,
                    text: verseText,
                    version: currentVersion,
                    book: current.book,
                    chapter: current.chapter,
                    verseNum: newVerse,
                    timestamp: new Date()
                };
                console.log(`[NAV] ${direction === 'next' ? 'Next' : 'Previous'} verse: `, newItem.reference);
                setDetectedQueue(prev => [newItem, ...prev].slice(0, 50));
                goLive(newItem);
            } else if (direction === 'next') {
                console.log('[NAV] End of chapter or lookup failed');
            }
        } catch (e) {
            console.error("Navigation Error:", e);
        } finally {
            isNavigatingRef.current = false;
            setAiStatus('idle');
        }
    }, [goLive]);

    // Navigate to next/previous chapter
    const navigateChapter = useCallback(async (direction: 'next' | 'prev') => {
        const current = activeItemRef.current;
        if (!current) {
            console.log('[NAV] No active item to navigate from');
            return;
        }

        const newChapter = direction === 'next' ? current.chapter + 1 : current.chapter - 1;
        if (newChapter < 1) return;

        const currentVersion = selectedVersionRef.current;
        const verseText = await lookupVerseAsync(current.book, newChapter, 1, currentVersion);

        if (verseText) {
            const newItem: DetectedItem = {
                id: Date.now().toString() + Math.random(),
                reference: `${current.book} ${newChapter}: 1`,
                text: verseText,
                version: currentVersion,
                book: current.book,
                chapter: newChapter,
                verseNum: 1,
                timestamp: new Date()
            };
            console.log(`[NAV] ${direction === 'next' ? 'Next' : 'Previous'} chapter: `, newItem.reference);
            setDetectedQueue(prev => [newItem, ...prev].slice(0, 50));
            goLive(newItem);
        }
    }, [goLive]);

    // MIDI Control Handler
    const handleMidiAction = useCallback((action: MidiAction) => {
        switch (action) {
            case 'next':
                navigateVerse('next');
                break;
            case 'prev':
                navigateVerse('prev');
                break;
            case 'clear':
                // Clear active item (keep background)
                setActiveItem(null);
                broadcast({ type: 'CLEAR' });
                break;
            case 'black':
                // Basic blackout implementation
                setActiveItem(null);
                broadcast({ type: 'CLEAR' });
                // TODO: Add true blackout overlay
                break;
            case 'stage_toggle':
                setIsListening(prev => !prev);
                break;
            default:
                break;
        }
    }, [navigateVerse, broadcast]);

    const midi = useMIDI(handleMidiAction);

    // Smart AI-based scripture detection (PersonaPlex-style)
    const { addText: addToSmartDetection, reset: resetSmartDetection, updateSermonContext } = useSmartDetection(
        useCallback((scriptures, commands, signal, detectedVerseCount) => {
            setAiStatus('idle');
            setLastSignal(signal);

            // Handle verse count change
            if (detectedVerseCount && detectedVerseCount >= 1 && detectedVerseCount <= 3) {
                console.log('[AI] Auto-switching verse count to:', detectedVerseCount);
                setVerseCount(detectedVerseCount as 1 | 2 | 3);
            }

            // Handle navigation commands-only execute the FIRST command
            if (commands.length > 0) {
                const cmd = commands[0];
                console.log('[AI COMMAND] Executing:', cmd.type, `(${commands.length} total detected, executing first only)`);
                switch (cmd.type) {
                    case 'next_verse':
                        navigateVerse('next', undefined, detectedVerseCount);
                        break;
                    case 'prev_verse':
                        navigateVerse('prev', undefined, detectedVerseCount);
                        break;
                    case 'jump_to_verse':
                        if (cmd.verse) navigateVerse('jump', cmd.verse, detectedVerseCount);
                        break;
                    case 'next_chapter':
                        navigateChapter('next');
                        break;
                    case 'prev_chapter':
                        navigateChapter('prev');
                        break;
                    case 'switch_translation':
                        if (cmd.version && BIBLE_VERSIONS.includes(cmd.version as any)) {
                            console.log('[AI] Switching translation to:', cmd.version);
                            setSelectedVersion(cmd.version);
                        }
                        break;
                    case 'clear':
                        clearProjector();
                        break;
                }
            }

            // Handle scripture detections - ALWAYS push first scripture to live when SWITCH signal
            if (scriptures.length > 0) {
                const topScripture = scriptures[0]; // Already sorted by confidence

                // Create item for queue and live
                const newItem: DetectedItem = {
                    id: Date.now().toString() + Math.random(),
                    reference: topScripture.reference,
                    text: topScripture.text,
                    version: topScripture.version || selectedVersionRef.current,
                    book: topScripture.book,
                    chapter: topScripture.chapter,
                    verseNum: topScripture.verse,
                    verseEnd: topScripture.verseEnd,
                    timestamp: new Date(),
                    confidence: topScripture.confidence,
                    matchType: topScripture.matchType,
                    songData: topScripture.songData,
                };

                // Add to queue
                setDetectedQueue(prev => [newItem, ...prev].slice(0, 50));
                console.log('[AI] Detected:', topScripture.reference, `(${topScripture.confidence} %) - Signal: ${signal} `);

                // Auto-push to live ONLY if auto mode is ON (SCRIPTURES ONLY)
                const isSong = newItem.version === 'SONG';
                if (autoModeRef.current && !isSong) {
                    console.log('[AUTO-LIVE] Pushing to projector:', topScripture.reference);
                    goLive(newItem);
                }
            }
        }, [navigateVerse, navigateChapter, clearProjector, goLive]),
        activeItem?.reference || null,
        { confidenceThreshold, version: selectedVersion }
    );

    const processTranscript = useCallback(async (text: string) => {
        setTranscript(prev => (prev + " " + text).slice(-1000));

        // 1. Fast regex detection - ONLY on the new text to prevent re-triggering old verses
        const matches = detectVersesInText(text);

        for (const match of matches) {
            // For non-KJV, fetch the verse in the selected translation
            let verseText = match.text;
            const currentVersion = selectedVersionRef.current;

            if (currentVersion !== 'KJV') {
                const fetchedText = await lookupVerseAsync(
                    match.book,
                    match.chapter,
                    match.verse,
                    currentVersion
                );
                if (fetchedText) {
                    verseText = fetchedText;
                }
            }

            addToQueue({
                book: match.book,
                chapter: match.chapter,
                verse: match.verse,
                text: verseText,
                reference: match.reference,
                confidence: 100, // Regex = exact match
                matchType: 'exact',
            }, 'regex');
        }

        // 2. Song Detection (Fuzzy Match) - Requires Context (10+ words)
        // Combine history with new text to get context
        const fullHistory = transcriptRef.current + " " + text;
        const recentWords = fullHistory.trim().split(/\s+/).slice(-20); // Look at last 20 words
        const searchPhrase = recentWords.join(" ");

        if (recentWords.length >= 10 && fuseRef.current) {
            const songMatches = fuseRef.current.search(searchPhrase);
            if (songMatches.length > 0) {
                const best = songMatches[0];
                if (best.score && best.score < 0.4) { // Lower is better
                    const song = best.item;

                    // PREVENT DUPLICATES: Check if already active or at top of queue
                    // Use refs because this callback might have stale state
                    const isAlreadyActive = activeItemRef.current?.reference === song.title;
                    const isLastDetected = detectedQueueRef.current[0]?.reference === song.title;

                    if (isAlreadyActive || isLastDetected) {
                        return;
                    }

                    // Find matching slide using the search phrase
                    const matchingSlide = song.slides.find((s: any) =>
                        s.content.toLowerCase().includes(searchPhrase.toLowerCase()) ||
                        searchPhrase.toLowerCase().includes(s.content.toLowerCase().substring(0, 20)) // Partial match
                    ) || song.slides[0];

                    console.log('[AI] Detected Song:', song.title, 'Phrase:', searchPhrase);

                    addToQueue({
                        book: 'Song',
                        chapter: 0,
                        verse: 0,
                        text: matchingSlide.content,
                        reference: song.title,
                        confidence: Math.round((1 - (best.score || 0)) * 100),
                        matchType: 'partial',
                        version: 'SONG', // Marker for Songs
                        songData: song // Pass full data
                    }, 'song');
                }
            }
        }

        // 3. Smart AI detection (debounced, catches natural language + paraphrases)
        setAiStatus('processing');
        addToSmartDetection(text);

    }, [addToQueue, addToSmartDetection]);

    // Reset smart detection when stopping
    useEffect(() => {
        if (!isListening) {
            resetSmartDetection();
            setAiStatus('idle');
            setLastSignal('WAIT');
        }
    }, [isListening, resetSmartDetection]);



    // UI HELPER: Handle Manual Lookup (Debug / Override)
    const handleManualLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        const input = (e.target as any).verseInput.value;
        const matches = detectVersesInText(input);

        if (matches.length > 0) {
            const match = matches[0];

            // Fetch verse in selected translation
            let verseText = match.text;
            if (selectedVersion !== 'KJV') {
                const fetchedText = await lookupVerseAsync(
                    match.book,
                    match.chapter,
                    match.verse,
                    selectedVersion
                );
                if (fetchedText) {
                    verseText = fetchedText;
                }
            }

            goLive({
                ...match,
                id: Date.now().toString(),
                text: verseText,
                version: selectedVersion,
                verseNum: match.verse,
                timestamp: new Date()
            });
        }
    };

    // Get signal color
    const getSignalColor = (signal: DetectionSignal) => {
        switch (signal) {
            case 'SWITCH': return 'bg-green-500';
            case 'HOLD': return 'bg-amber-500';
            case 'WAIT': return 'bg-zinc-600';
        }
    };

    // Get confidence badge color
    const getConfidenceBadgeColor = (confidence?: number) => {
        if (!confidence) return 'bg-zinc-700 text-zinc-400';
        if (confidence >= 90) return 'bg-green-500/20 text-green-400 border-green-500/30';
        if (confidence >= 70) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
        return 'bg-zinc-700/50 text-zinc-400 border-zinc-600';
    };

    // Get match type badge
    const getMatchTypeBadge = (matchType?: string) => {
        switch (matchType) {
            case 'exact': return { text: 'EXACT', color: 'bg-green-500/20 text-green-400' };
            case 'partial': return { text: 'PARTIAL', color: 'bg-amber-500/20 text-amber-400' };
            case 'paraphrase': return { text: 'PARAPHRASE', color: 'bg-purple-500/20 text-purple-400' };
            default: return null;
        }
    };



    return (
        <main className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
            {/* TOP BAR */}
            <header className="h-12 border-b border-white/5 bg-black/40 backdrop-blur-md flex items-center justify-between px-4 fixed top-0 w-full z-50">
                <div className="flex items-center gap-1">
                    <div className="relative group flex items-center">
                        <img
                            src="logo.png"
                            alt="Creenly Logo"
                            className="w-10 h-10 object-contain transition-transform group-hover:scale-110 duration-300 translate-y-[2px]"
                        />
                        <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="w-px h-6 bg-white/10 mx-2" />
                    {/* License Button */}
                    <button
                        onClick={() => setIsLicenseModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 shadow-lg shadow-indigo-500/5"
                    >
                        <Key size={12} strokeWidth={3} />
                        License
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    {/* Signal Indicator */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${lastSignal === 'SWITCH' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                        lastSignal === 'HOLD' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-zinc-900 text-zinc-600'
                        } `}>
                        <div className={`w-2 h-2 rounded-full ${getSignalColor(lastSignal)} ${lastSignal !== 'WAIT' ? 'animate-pulse' : ''} `}></div>
                        {lastSignal}
                    </div>
                    {/* Status */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${aiStatus === 'processing' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-zinc-900 text-zinc-600'} `}>
                        <div className={`w-2 h-2 rounded-full ${aiStatus === 'processing' ? 'bg-green-500 animate-pulse' : 'bg-zinc-700'} `}></div>
                        {aiStatus === 'processing' ? 'DETECTING' : 'READY'}
                    </div>
                    {/* Mic Status */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isListening ? 'bg-green-500/10 text-green-400 border border-green-500/20 animate-pulse' : 'bg-zinc-900 text-zinc-500'} `}>
                        <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-500' : 'bg-zinc-600'} `}></div>
                        {isListening ? 'LISTENING ON' : 'MIC OFF'}
                    </div>
                    {/* MIDI Button */}
                    <button
                        onClick={() => setIsMidiSettingsOpen(true)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${midi.isEnabled ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                        title="MIDI Settings"
                    >
                        <Music size={12} />
                        MIDI
                    </button>
                    {/* Stage Display Button */}
                    <button
                        onClick={() => {
                            if ((window as any).electronAPI?.openStageWindow) {
                                (window as any).electronAPI.openStageWindow();
                            } else {
                                window.open('/stage', 'stageDisplay', 'width=1280,height=720');
                            }
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20"
                        title="Open Stage Display (Confidence Monitor)"
                    >
                        <Tv2 size={12} />
                        Stage
                    </button>

                </div>
            </header>

            {/* VERSION SELECTOR BAR (Redesigned) */}
            <div className="fixed top-12 left-0 right-0 z-40 bg-zinc-900/90 backdrop-blur-md border-b border-white/5 px-4 py-2 flex items-center justify-between">

                {/* Version Dropdown (Custom) */}
                <div className="flex items-center gap-3 relative">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Version</span>

                    <button
                        onClick={() => setShowVersionMenu(!showVersionMenu)}
                        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-3 py-1.5 rounded-md border border-white/10 transition-all outline-none focus:ring-2 ring-indigo-500/50"
                    >
                        {selectedVersion}
                        <ChevronDown size={14} className={`text-zinc-400 transition-transform ${showVersionMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {showVersionMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowVersionMenu(false)} />
                            <div className="absolute top-full left-14 mt-2 w-48 max-h-[60vh] overflow-y-auto bg-zinc-900 border border-white/10 rounded-lg shadow-2xl z-50 py-1 no-scrollbar animate-in fade-in zoom-in-95 duration-100">
                                {BIBLE_VERSIONS.map((version) => (
                                    <button
                                        key={version}
                                        onClick={() => {
                                            setSelectedVersion(version);
                                            selectedVersionRef.current = version;
                                            setShowVersionMenu(false);
                                            if (activeItemRef.current?.book && activeItemRef.current.book !== 'Song') {
                                                navigateVerse('jump');
                                            }
                                        }}
                                        className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-white/5 transition-colors flex items-center justify-between group ${selectedVersion === version ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-300'
                                            }`}
                                    >
                                        {version}
                                        {selectedVersion === version && <CheckCircle size={12} />}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Verse Count (Clean Segmented Control) */}
                <div className="flex items-center gap-3 bg-zinc-950/50 p-1 rounded-lg border border-white/5">
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider ml-2">Display</span>
                    {VERSE_COUNT_OPTIONS.map((count) => (
                        <button
                            key={count}
                            onClick={() => {
                                setVerseCount(count as any);
                                verseCountRef.current = count as any;
                            }}
                            className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${verseCount === count
                                ? 'bg-zinc-800 text-white shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                        >
                            {count} Verse{count > 1 ? 's' : ''}
                        </button>
                    ))}
                </div>
            </div>

            <div
                ref={containerRef}
                className="fixed top-24 left-0 right-0 bottom-0 px-4 pb-4 flex flex-col gap-0 overflow-hidden"
            >

                <div
                    className="grid grid-cols-12 gap-2 min-h-0 transition-[height] ease-out duration-300"
                    style={{
                        height: isLibraryOpen ? `${topPanelHeight}% ` : 'calc(100% - 3.5rem)',
                        transitionDuration: isDraggingRef.current ? '0ms' : '300ms',
                        marginBottom: isLibraryOpen ? '0' : '0.5rem'
                    }}
                >

                    {/* FAR LEFT: SERVICE SCHEDULE */}
                    <section className="col-span-3 flex flex-col min-h-0 overflow-hidden">
                        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl flex-1 flex flex-col overflow-hidden">
                            <ServiceSchedulePanel
                                schedule={schedule}
                                onScheduleChange={setSchedule}
                                onGoLive={(item: ScheduleItem, slideIndex: number) => {
                                    const slide = item.slides[slideIndex];

                                    // Update Live Presentation State
                                    if (['song', 'media'].includes(item.type)) {
                                        setLivePresentation({ item, slideIndex });
                                    } else {
                                        setLivePresentation(null);
                                    }

                                    if (item.type === 'song') {
                                        // Set active item for Dashboard preview too
                                        setActiveItem({
                                            id: item.id,
                                            reference: item.title,
                                            text: slide.content,
                                            version: 'SONG',
                                            book: 'Song',
                                            chapter: 0,
                                            verseNum: 0,
                                            timestamp: new Date()
                                        });
                                        broadcast({
                                            type: 'SHOW_CONTENT',
                                            payload: {
                                                type: 'song',
                                                title: item.title,
                                                body: slide.content,
                                                meta: item.meta?.author,
                                                background: typeof item.meta?.background === 'object' ? (item.meta?.background as any)?.value : item.meta?.background
                                            }
                                        });
                                    } else if (item.type === 'scripture') {
                                        broadcast({
                                            type: 'SHOW_CONTENT',
                                            payload: {
                                                type: 'verse',
                                                title: item.title,
                                                body: slide.content,
                                                meta: item.meta?.version
                                            }
                                        });
                                    } else if (item.type === 'media') {
                                        // Handle Media/Image
                                        broadcast({
                                            type: 'SHOW_CONTENT',
                                            payload: {
                                                type: 'media',
                                                title: item.title,
                                                body: slide.content, // Data URL
                                                meta: 'Image',
                                                options: {
                                                    imageMode: item.meta?.imageMode
                                                }
                                            }
                                        });

                                        // Update local preview
                                        setActiveItem({
                                            id: item.id,
                                            reference: item.title,
                                            text: slide.content, // Store Data URL in text
                                            version: 'MEDIA',    // Use version as flag
                                            book: 'Media',
                                            chapter: 0,
                                            verseNum: 0,
                                            timestamp: new Date()
                                        });
                                    }
                                }}
                            />
                        </div>
                    </section>

                    {/* LEFT: LIVE FEED & CONTROLS */}
                    <section className="col-span-3 flex flex-col gap-3 min-h-0 overflow-hidden">
                        {/* TRANSCRIPT CARD */}
                        <div className="flex-1 bg-zinc-900/50 border border-white/5 rounded-2xl p-5 flex flex-col min-h-0 overflow-hidden shadow-sm" style={{ maxHeight: '450px' }}>
                            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Live Transcript
                                </h3>
                                <VoiceWave level={voiceLevel} active={isListening} />
                            </div>
                            <div
                                ref={transcriptScrollRef}
                                className="flex-1 overflow-y-auto font-mono text-[10px] text-zinc-400 leading-relaxed whitespace-pre-wrap transcript-scroll pr-2 scroll-smooth"
                                style={{
                                    scrollbarWidth: 'thin',
                                    scrollbarColor: '#71717a #27272a'
                                }}
                            >
                                {transcript || <span className="text-zinc-600 italic">Waiting for speech...</span>}
                                {deepgramStatus.error && (
                                    <div className="mt-2 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-[10px] font-bold">
                                        ERROR: {deepgramStatus.error}
                                    </div>
                                )}
                                <span className="text-indigo-400 animate-pulse block mt-1">{interim}</span>
                            </div>

                            {/* Mic Controls - Unified Premium Button */}
                            <div className="flex-shrink-0 pt-2 mt-2 border-t border-white/5">
                                <DeepgramRecognizer
                                    isListening={isListening}
                                    onTranscript={processTranscript}
                                    onStatusChange={(status, error) => setDeepgramStatus({ status, error })}
                                    onVolume={setVoiceLevel}
                                    onInterim={(text) => {
                                        setInterim(text);
                                        // Real-time FAST detection on interim results
                                        if (text.trim().length > 3) {
                                            // STRICT: Only look at the current interim text. Do NOT look at history.
                                            // This prevents "Ghosting" where an old verse in history pops up when interim fluctuates.
                                            const matches = detectVersesInText(text);

                                            if (matches.length > 0) {
                                                console.log('[INTERIM] Fast Match:', matches[matches.length - 1].reference);
                                                const match = matches[matches.length - 1];
                                                let verseText = match.text;
                                                const currentVersion = selectedVersionRef.current;

                                                (async () => {
                                                    if (currentVersion !== 'KJV') {
                                                        const fetchedText = await lookupVerseAsync(match.book, match.chapter, match.verse, currentVersion);
                                                        if (fetchedText) verseText = fetchedText;
                                                    }
                                                    addToQueue({
                                                        book: match.book,
                                                        chapter: match.chapter,
                                                        verse: match.verse,
                                                        text: verseText,
                                                        reference: match.reference,
                                                        confidence: 100,
                                                        matchType: 'exact'
                                                    }, 'regex');
                                                })();
                                            }
                                        }
                                    }}
                                />

                                <button
                                    onClick={() => {
                                        if (isMicLoading) return;
                                        setIsMicLoading(true);
                                        setIsListening(!isListening);
                                        // Auto-unlock after 1.5s to prevent toggle spamming
                                        setTimeout(() => setIsMicLoading(false), 1500);
                                    }}
                                    className={`w-full py-2 rounded-xl font-black text-xs tracking-wider shadow-xl transition-all flex items-center justify-center gap-3 relative overflow-hidden group
                                    ${deepgramStatus.status === 'listening'
                                            ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20'
                                            : deepgramStatus.status === 'connecting' || isMicLoading
                                                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/50 cursor-wait'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-[1.02] active:scale-[0.98]'
                                        } `}
                                >
                                    {deepgramStatus.status === 'listening' ? (
                                        <>
                                            <span className="relative flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                            </span>
                                            <span>LISTENING...</span>
                                            <span className="text-[10px] font-normal opacity-60 ml-2">CLICK TO STOP</span>
                                        </>
                                    ) : (deepgramStatus.status === 'connecting' || isMicLoading) ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                                            <span>STARTING MIC...</span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="p-1.5 bg-white/20 rounded-full group-hover:bg-white/30 transition-colors">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                                            </div>
                                            START LISTENING
                                        </>
                                    )}


                                </button>
                            </div>
                        </div>

                        {/* MANUAL INPUT */}
                        <div className="flex-shrink-0 bg-zinc-900/50 border border-white/5 rounded-xl p-3">
                            <form onSubmit={handleManualLookup} className="flex gap-2">
                                <input name="verseInput" placeholder="Type 'John 3:16'..." className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                                <button type="submit" className="bg-zinc-800 hover:bg-zinc-700 px-4 rounded-lg text-xs font-bold text-zinc-300">GO</button>
                            </form>
                        </div>

                        {/* CONFIDENCE THRESHOLD */}
                        <div className="flex-shrink-0 bg-zinc-900/50 border border-white/5 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-zinc-500 uppercase">Confidence Threshold</span>
                                <span className="text-xs font-mono text-indigo-400">{confidenceThreshold}%</span>
                            </div>
                            <input
                                type="range"
                                min="50"
                                max="95"
                                step="5"
                                value={confidenceThreshold}
                                onChange={(e) => setConfidenceThreshold(parseInt(e.target.value))}
                                className="w-full accent-indigo-500"
                            />
                            <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                                <span>Sensitive</span>
                                <span>Strict</span>
                            </div>
                        </div>
                    </section>

                    {/* MIDDLE: QUEUE & HISTORY */}
                    <section className="col-span-3 flex flex-col gap-4 min-h-0 overflow-hidden">
                        <div className="bg-zinc-900/30 border border-white/5 rounded-2xl flex-1 flex flex-col overflow-hidden">
                            <header className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Detection Queue</h3>
                                <div className="flex flex-col items-end">
                                    {autoMode && (
                                        <span className="text-[7px] font-black text-indigo-400 italic tracking-[0.2em] mb-0.5 animate-pulse">
                                            BETA
                                        </span>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold uppercase transition-colors ${autoMode ? 'text-indigo-400' : 'text-zinc-600'}`}>
                                            Auto-Push
                                        </span>
                                        <button
                                            onClick={() => setAutoMode(!autoMode)}
                                            className={`w-9 h-5 rounded-full transition-colors relative focus:outline-none focus:ring-2 ring-indigo-500/50 ${autoMode ? 'bg-indigo-600' : 'bg-zinc-800 border border-zinc-700'}`}
                                            title={autoMode ? "Auto-Push Enabled" : "Auto-Push Disabled"}
                                        >
                                            <div className={`w-3 h-3 bg-white rounded-full absolute top-1 shadow-sm transition-transform duration-200 ${autoMode ? 'translate-x-5' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>
                            </header>
                            <div
                                className="flex-1 overflow-y-auto p-2 space-y-2 pr-2"
                                style={{
                                    scrollbarWidth: 'thin',
                                    scrollbarColor: '#71717a #27272a'
                                }}
                            >
                                {detectedQueue.map(item => {
                                    const matchBadge = getMatchTypeBadge(item.matchType);
                                    return (
                                        <div key={item.id} className="p-4 rounded-xl bg-zinc-950 border border-white/5 hover:border-indigo-500/30 transition-all group flex gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-1 mb-1 flex-wrap">
                                                    <span className="font-bold text-indigo-400 text-sm">{item.reference}</span>
                                                    <span className="text-[10px] bg-zinc-900 text-zinc-500 px-1.5 py-0.5 rounded">{item.version}</span>
                                                    {item.confidence && (
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getConfidenceBadgeColor(item.confidence)} `}>
                                                            {item.confidence}%
                                                        </span>
                                                    )}
                                                    {matchBadge && (
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${matchBadge.color} `}>
                                                            {matchBadge.text}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-zinc-600">{item.timestamp.toLocaleTimeString()}</span>
                                                </div>
                                                <p className="text-zinc-400 text-sm line-clamp-2 leading-snug">"{item.text}"</p>
                                            </div>
                                            <button onClick={() => goLive(item)} className="self-center px-4 py-2 bg-zinc-800 hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-bold text-zinc-500 transition-all opacity-0 group-hover:opacity-100">
                                                PUSH
                                            </button>
                                        </div>
                                    );
                                })}
                                {detectedQueue.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-zinc-700 space-y-2 opacity-50">
                                        <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center">?</div>
                                        <p className="text-xs">Waiting for scripture...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* RIGHT: LIVE PREVIEW */}
                    <section className="col-span-3 flex flex-col gap-4 min-h-0">
                        <div className="bg-zinc-900 border border-white/5 rounded-2xl flex-1 flex flex-col relative">
                            <header className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-950 rounded-t-2xl">
                                <h3 className="text-xs font-bold text-green-500 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live Output
                                </h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowTimerSettings(!showTimerSettings)}
                                        className={`p-2 hover:bg-white/10 rounded-full transition-colors relative ${showTimerSettings ? 'text-white bg-white/10' : 'text-zinc-400'}`}
                                        title="Service Timer Controls"
                                    >
                                        <Clock size={20} />
                                        {showTimerSettings && (
                                            <>
                                                <div className="fixed inset-0 z-[59]" onClick={() => setShowTimerSettings(false)} />
                                                <div className="absolute top-full right-0 mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-4 w-64 z-[60]" onClick={e => e.stopPropagation()}>
                                                    <h4 className="text-xs font-bold text-zinc-500 uppercase mb-3">Timer Settings</h4>

                                                    {/* Mode & Time */}
                                                    <div className="space-y-3 mb-4">
                                                        <div>
                                                            <label className="text-xs text-zinc-400 block mb-1">Duration (Minutes)</label>
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="number"
                                                                    value={timerDuration}
                                                                    onChange={e => setTimerDuration(parseInt(e.target.value) || 0)}
                                                                    className="flex-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white"
                                                                />
                                                                <button
                                                                    onClick={() => broadcast({ type: 'TIMER_ACTION', payload: { action: 'set', mode: 'countdown', value: timerDuration * 60 } })}
                                                                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 rounded"
                                                                >
                                                                    SET
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Controls */}
                                                    <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
                                                        <button
                                                            onClick={() => broadcast({ type: 'TIMER_ACTION', payload: { action: 'start' } })}
                                                            className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all ${timerState.isRunning
                                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                                : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 border border-white/5'
                                                                }`}
                                                        >
                                                            <Play size={16} fill={timerState.isRunning ? "currentColor" : "none"} />
                                                            <span className="text-[10px] font-bold">START</span>
                                                        </button>
                                                        <button
                                                            onClick={() => broadcast({ type: 'TIMER_ACTION', payload: { action: 'pause' } })}
                                                            className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all ${timerState.isPaused
                                                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                                : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 border border-white/5'
                                                                }`}
                                                        >
                                                            <Pause size={16} fill={timerState.isPaused ? "currentColor" : "none"} />
                                                            <span className="text-[10px] font-bold">PAUSE</span>
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setResetFlash(true);
                                                                broadcast({ type: 'TIMER_ACTION', payload: { action: 'reset' } });
                                                                setTimeout(() => setResetFlash(false), 300);
                                                            }}
                                                            className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all ${resetFlash
                                                                ? 'bg-red-500/20 text-red-500 border border-red-500/50 scale-95'
                                                                : 'bg-zinc-800 text-zinc-500 hover:text-red-400 hover:bg-zinc-700 border border-white/5'
                                                                }`}
                                                        >
                                                            <Square size={16} />
                                                            <span className="text-[10px] font-bold">RESET</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </button>



                                    {/* Electron Multi-Window Trigger */}
                                    <button
                                        onClick={() => {
                                            if ((window as any).electronAPI?.openProjectorWindow) {
                                                (window as any).electronAPI.openProjectorWindow();
                                            } else {
                                                window.open('/projector', '_blank', 'width=1280,height=720');
                                            }
                                        }}
                                        className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-green-400 transition-colors"
                                        title="Open Projector Window"
                                    >
                                        <Maximize size={20} />
                                    </button>
                                    {livePresentation ? (
                                        <div className="flex bg-zinc-800 rounded-lg p-0.5 border border-white/5">
                                            <button
                                                onClick={() => handleSlideNavigation('prev')}
                                                disabled={livePresentation.slideIndex <= 0}
                                                className="p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Previous Slide"
                                            >
                                                <ChevronLeft size={14} />
                                            </button>
                                            <div className="w-px h-4 bg-white/10 mx-0.5 my-auto" />
                                            <button
                                                onClick={() => handleSlideNavigation('next')}
                                                disabled={livePresentation.slideIndex >= livePresentation.item.slides.length - 1}
                                                className="p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Next Slide"
                                            >
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    ) : activeItem && activeItem.version !== 'MEDIA' && activeItem.version !== 'SONG' && (
                                        <div className="flex bg-zinc-800 rounded-lg p-0.5 border border-white/5">
                                            <button
                                                onClick={() => navigateVerse('prev')}
                                                className="p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-md transition-colors"
                                                title="Previous Verse"
                                            >
                                                <ChevronLeft size={14} />
                                            </button>
                                            <div className="w-px h-4 bg-white/10 mx-0.5 my-auto" />
                                            <button
                                                onClick={() => navigateVerse('next')}
                                                className="p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-md transition-colors"
                                                title="Next Verse"
                                            >
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    )}
                                    <button onClick={clearProjector} className="text-[10px] font-bold text-red-400 hover:text-red-300">CLEAR</button>
                                </div>
                            </header>

                            {/* PREVIEW CONTAINER */}
                            <div
                                className="flex-1 flex items-center justify-center p-8 relative group overflow-y-auto rounded-b-2xl"
                                style={{
                                    scrollbarWidth: 'thin',
                                    scrollbarColor: '#71717a #000000',
                                    background: currentTheme?.background?.type === 'image'
                                        ? `url(${currentTheme.background.value}) center / cover no-repeat`
                                        : currentTheme?.background?.value || '#000000'
                                }}
                            >
                                <div className="absolute inset-0 bg-black/20 pointer-events-none" /> {/* Overlay for readability */}
                                {activeItem ? (
                                    activeItem.version === 'MEDIA' ? (
                                        <div className="text-center w-full h-full flex flex-col items-center justify-center relative z-10">
                                            <img
                                                src={activeItem.text}
                                                alt={activeItem.reference}
                                                className="max-h-full max-w-full object-contain"
                                            />
                                        </div>
                                    ) : (
                                        <div
                                            className="text-center max-w-full relative z-10 flex flex-col"
                                            style={{
                                                fontFamily: currentTheme?.styles.fontFamily,
                                                color: currentTheme?.styles.color,
                                                textAlign: currentTheme?.styles.textAlign || 'center',
                                                alignItems: currentTheme?.styles.alignItems || 'center',
                                                justifyContent: currentTheme?.styles.justifyContent || 'center',
                                            }}
                                        >
                                            {/* Reference (Top) */}
                                            {(currentTheme?.layout?.referencePosition === 'top' || !currentTheme?.layout) && (
                                                <div className="opacity-90 mb-8 uppercase tracking-wider font-bold" style={{
                                                    fontSize: `${0.6 * (currentTheme?.layout?.referenceScale || 1.5)} em`,
                                                    textAlign: currentTheme?.styles.textAlign
                                                }}>
                                                    {activeItem.additionalVerses?.length
                                                        ? `${activeItem.book} ${activeItem.chapter}:${activeItem.verseNum} -${activeItem.additionalVerses[activeItem.additionalVerses.length - 1].verseNum} `
                                                        : activeItem.reference
                                                    }
                                                </div>
                                            )}

                                            <div className="flex flex-col gap-4">
                                                {/* Primary verse */}
                                                <div style={{
                                                    display: 'flex',
                                                    gap: '0.5rem',
                                                    justifyContent: currentTheme?.styles.textAlign === 'left' ? 'flex-start' : currentTheme?.styles.textAlign === 'right' ? 'flex-end' : 'center'
                                                }}>
                                                    {(currentTheme?.layout?.showVerseNumbers !== false) && (
                                                        <span className="opacity-60 font-mono text-xs mt-1">{activeItem.verseNum}</span>
                                                    )}
                                                    <span style={{
                                                        fontWeight: currentTheme?.styles.fontWeight,
                                                        fontSize: '1.5rem', // Force smaller size for preview
                                                        textShadow: currentTheme?.styles.textShadow,
                                                        lineHeight: 1.2
                                                    }}>{activeItem.text}</span>
                                                </div>

                                                {/* Additional verses */}
                                                {activeItem.additionalVerses?.map((v) => (
                                                    <div key={v.verseNum} style={{
                                                        display: 'flex',
                                                        gap: '0.5rem',
                                                        justifyContent: currentTheme?.styles.textAlign === 'left' ? 'flex-start' : currentTheme?.styles.textAlign === 'right' ? 'flex-end' : 'center'
                                                    }}>
                                                        {(currentTheme?.layout?.showVerseNumbers !== false) && (
                                                            <span className="opacity-60 font-mono text-xs mt-1">{v.verseNum}</span>
                                                        )}
                                                        <span style={{
                                                            fontWeight: currentTheme?.styles.fontWeight,
                                                            fontSize: '1.5rem', // Force smaller size for preview
                                                            textShadow: currentTheme?.styles.textShadow,
                                                            lineHeight: 1.2
                                                        }}>{v.text}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Reference (Bottom) */}
                                            {currentTheme?.layout?.referencePosition === 'bottom' && (
                                                <div className="opacity-90 mt-8 uppercase tracking-wider font-bold" style={{
                                                    fontSize: `${0.6 * (currentTheme?.layout?.referenceScale || 1)} em`,
                                                    textAlign: currentTheme?.styles.textAlign
                                                }}>
                                                    {activeItem.additionalVerses?.length
                                                        ? `${activeItem.book} ${activeItem.chapter}:${activeItem.verseNum} -${activeItem.additionalVerses[activeItem.additionalVerses.length - 1].verseNum} `
                                                        : activeItem.reference
                                                    }
                                                </div>
                                            )}
                                        </div>
                                    )
                                ) : (
                                    <div className="text-zinc-800 text-sm font-mono">BLACK SCREEN</div>
                                )}

                                {
                                    /* OVERLAY ACTIONS */
                                }
                                <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                                    <button
                                        onClick={() => {
                                            if ((window as any).electronAPI?.openProjectorWindow) {
                                                (window as any).electronAPI.openProjectorWindow();
                                            } else {
                                                window.open('/projector', '_blank', 'width=1280,height=720');
                                            }
                                        }}
                                        className="px-6 py-2 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform"
                                    >
                                        Open Projector Window ↗
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                </div> {/* End Grid */}

                {/* Resizer Handle */}
                {isLibraryOpen && (
                    <div
                        onMouseDown={handleMouseDown}
                        className="h-4 -my-2 flex items-center justify-center cursor-row-resize z-50 group shrink-0 select-none"
                    >
                        <div className="w-24 h-1 bg-zinc-800 rounded-full group-hover:bg-indigo-500 transition-colors" />
                    </div>
                )}

                {/* Resource Library (Bottom) */}
                <div
                    className={`flex-1 min-h-0 rounded-2xl overflow-hidden border border-white/10 shadow-3xl transition-all duration-300 ease-in-out relative z-[60] bg-zinc-900 ${isLibraryOpen ? 'flex-[4]' : 'bg-zinc-900/50 border-dashed border-white/20 h-14'} `}
                    style={{
                        boxShadow: isLibraryOpen ? '0 -20px 50px -12px rgba(0, 0, 0, 0.5)' : 'none'
                    }}
                >
                    {/* Toggle Button */}
                    <button
                        onClick={() => setIsLibraryOpen(!isLibraryOpen)}
                        className="absolute right-0 bottom-0 z-50 p-2.5 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-tl-xl shadow-lg border-t border-l border-white/10 transition-colors"
                        title={isLibraryOpen ? "Collapse Library" : "Expand Library"}
                    >
                        {isLibraryOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>

                    {/* Collapsed Placeholder Title */}
                    {!isLibraryOpen && (
                        <div
                            className="absolute inset-0 flex items-center px-4 cursor-pointer hover:bg-white/5 transition-colors"
                            onClick={() => setIsLibraryOpen(true)}
                        >
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Resource Library
                            </span>
                        </div>
                    )}

                    <div className={`h-full ${!isLibraryOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'} transition-opacity duration-200`}>
                        <ResourceLibraryPanel
                            onResourcesChanged={setLibraryResources}
                            onAddToSchedule={handleAddToSchedule}
                            onGoLive={(item: ScheduleItem) => {
                                const slide = item.slides[0];

                                // Support all types for live presentation handling (slide nav)
                                if (['song', 'media', 'scripture'].includes(item.type)) {
                                    setLivePresentation({ item, slideIndex: 0 });
                                } else {
                                    setLivePresentation(null);
                                }

                                if (item.type === 'scripture') {
                                    // Parse Scripture Reference (e.g., "Genesis 1:1")
                                    // Handle cases where title might be "1 John 3:16" or "Genesis 1:1"
                                    // Regex: Last part is verse, separation by colon
                                    // Then last part is chapter, separation by space
                                    let book = 'Bible';
                                    let chapter = 0;
                                    let verseNum = 0;

                                    // Robust parsing attempt
                                    try {
                                        const lastColon = item.title.lastIndexOf(':');
                                        if (lastColon !== -1) {
                                            verseNum = parseInt(item.title.substring(lastColon + 1));
                                            const refPart = item.title.substring(0, lastColon);
                                            const lastSpace = refPart.lastIndexOf(' ');
                                            if (lastSpace !== -1) {
                                                chapter = parseInt(refPart.substring(lastSpace + 1));
                                                book = refPart.substring(0, lastSpace);
                                            }
                                        }
                                    } catch (e) {
                                        console.error('Error parsing scripture title:', item.title);
                                    }

                                    setActiveItem({
                                        id: item.id,
                                        reference: item.title,
                                        text: slide.content,
                                        version: (item.meta?.version as string) || 'KJV',
                                        book: book,
                                        chapter: chapter,
                                        verseNum: verseNum,
                                        timestamp: new Date()
                                    });
                                } else {
                                    // Song / Media
                                    setActiveItem({
                                        id: item.id,
                                        reference: item.title,
                                        text: slide.content,
                                        version: item.type === 'media' ? 'MEDIA' : 'SONG',
                                        book: item.type === 'media' ? 'Media' : 'Song',
                                        chapter: 0,
                                        verseNum: 0,
                                        timestamp: new Date()
                                    });
                                }

                                if (item.type === 'scripture') {
                                    broadcast({
                                        type: 'SHOW_VERSE',
                                        payload: {
                                            reference: item.title,
                                            text: slide.content,
                                            version: (item.meta?.version as string) || 'KJV',
                                            verses: [{ verseNum: 1, text: slide.content }]
                                        }
                                    });
                                } else {
                                    broadcast({
                                        type: 'SHOW_CONTENT',
                                        payload: {
                                            type: item.type === 'media' ? 'media' : 'song',
                                            title: item.title,
                                            body: slide.content,
                                            meta: item.type === 'media' ? 'Image' : item.meta?.author,
                                            background: typeof item.meta?.background === 'object' ? (item.meta?.background as any)?.value : item.meta?.background,
                                            options: item.type === 'media' ? { imageMode: item.meta?.imageMode } : undefined
                                        }
                                    });
                                }
                            }}
                            onApplyTheme={setCurrentTheme}
                            activeThemeId={currentTheme?.id}
                        />
                    </div>
                </div>

            </div>

            <OmniSearch
                onGoLive={(item: any) => {
                    if (item.type === 'bible') {
                        // Adapt to detected item format
                        const bibleItem: DetectedItem = {
                            id: Date.now().toString(),
                            reference: item.content.reference,
                            text: item.content.text,
                            version: selectedVersionRef.current,
                            book: item.content.book,
                            chapter: item.content.chapter,
                            verseNum: item.content.verse,
                            timestamp: new Date()
                        };
                        setDetectedQueue(prev => [bibleItem, ...prev].slice(0, 50));
                        goLive(bibleItem);
                    } else if (item.type === 'song') {
                        // Broadcast generic content for Song
                        // Find first verse or chorus
                        const firstSlide = item.content.lyrics[0];
                        broadcast({
                            type: 'SHOW_CONTENT',
                            payload: {
                                type: 'song',
                                title: item.title,
                                body: firstSlide.content,
                                meta: item.subtitle, // Author
                            }
                        });

                        // Set active item locally for reference (allows "Clear" to work)
                        setActiveItem({
                            id: item.id,
                            reference: item.title,
                            text: firstSlide.content,
                            version: 'SONG',
                            book: 'SONG',
                            chapter: 0,
                            verseNum: 0,
                            timestamp: new Date()
                        });
                    }
                }}
                onAddToSchedule={(item: any) => {
                    if (item.type === 'bible') {
                        const bibleItem: DetectedItem = {
                            id: Date.now().toString(),
                            reference: item.content.reference,
                            text: item.content.text,
                            version: selectedVersionRef.current,
                            book: item.content.book,
                            chapter: item.content.chapter,
                            verseNum: item.content.verse,
                            timestamp: new Date()
                        };
                        setDetectedQueue(prev => [bibleItem, ...prev].slice(0, 50));
                    }
                    // TODO: Handle Song Schedule Addition properly in Phase 2
                    console.log("Added to schedule:", item);
                }}
            />

            {/* License Modal */}
            <LicenseModal
                isOpen={isLicenseModalOpen}
                onClose={() => setIsLicenseModalOpen(false)}
            />
            {/* MIDI Settings Modal */}
            <MIDISettingsModal
                isOpen={isMidiSettingsOpen}
                onClose={() => setIsMidiSettingsOpen(false)}
                midi={midi}
            />
            {/* Update Banner */}
            {updateStatus.type !== 'idle' && updateStatus.type !== 'error' && (
                <div className="fixed bottom-4 right-4 bg-indigo-600 text-white p-4 rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom-5 border border-white/10 max-w-sm">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-white/20 rounded-full">
                            <Download size={24} className="animate-pulse" />
                        </div>
                        <div>
                            <h4 className="font-bold text-sm">New Update Available</h4>
                            <p className="text-xs text-indigo-200 mt-1">
                                {updateStatus.type === 'available' ? `Version ${updateStatus.version} is available.` :
                                    updateStatus.type === 'downloading' ? 'Downloading update...' : 'Update ready to install!'}
                            </p>

                            {updateStatus.type === 'available' && (
                                <button
                                    onClick={() => {
                                        setUpdateStatus(prev => ({ ...prev, type: 'downloading' }));
                                        (window as any).electronAPI.downloadUpdate();
                                    }}
                                    className="mt-3 w-full py-1.5 bg-white text-indigo-600 font-bold rounded text-xs hover:bg-indigo-50 transition-colors"
                                >
                                    Update Now
                                </button>
                            )}
                            {updateStatus.type === 'ready' && (
                                <button
                                    onClick={() => (window as any).electronAPI.installUpdate()}
                                    className="mt-3 w-full py-1.5 bg-green-500 text-white font-bold rounded text-xs hover:bg-green-600 transition-colors"
                                >
                                    Restart & Install
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setUpdateStatus({ type: 'idle' })}
                            className="text-white/50 hover:text-white"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}
        </main >
    );
}
