"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Maximize2, Maximize, Mic, MicOff, Search, Settings, Monitor, CheckCircle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Key, Download, X, Tv2, Music, Clock, Lock, PanelLeftOpen, PanelLeftClose, Sun, Moon, Book, User, Library } from 'lucide-react';
import Fuse from 'fuse.js';

import LicenseModal from '@/components/LicenseModal';
import MIDISettingsModal from '@/components/MIDISettingsModal';
import DisplaySettingsModal from '@/components/DisplaySettingsModal';
import { useMIDI, MidiAction } from '@/hooks/useMIDI';
import { useBroadcastChannel } from '@/hooks/useBroadcast';
import { useSmartDetection, type DetectionSignal } from '@/hooks/useSmartDetection';
import { useLicense } from '@/hooks/useLicense';
import { useUsageTracker } from '@/hooks/useUsageTracker';
import DeepgramRecognizer from '@/components/DeepgramRecognizer';
import TranscriptMonitor from '@/components/TranscriptMonitor';
import { detectVersesInText, lookupVerseAsync, SUPPORTED_VERSIONS } from '@/utils/bible';
import { DEFAULT_THEMES, ProjectorTheme } from '@/utils/themes';
import { parseLyrics } from '@/utils/lyricsParser';
import Link from 'next/link';
import OmniSearch from '@/components/OmniSearch';
import ServiceSchedulePanel from '@/components/ServiceSchedulePanel';
import ResourceLibraryPanel from '@/components/ResourceLibraryPanel';
import AudioModePrompt from '@/components/AudioModePrompt';
import MediaControls from '@/components/MediaControls';
import LiveFeedStream from '@/components/projector/LiveFeedStream';
import { ScheduleItem, ServiceSchedule, createBlankSchedule, loadSchedule, saveSchedule } from '@/utils/scheduleManager';
import { getThemes, ResourceItem } from '@/utils/resourceLibrary';
import { loadPastorProfile, PastorProfile, savePastorProfile } from '@/lib/pastorProfile';
import { useBibleOfflineSync } from '@/hooks/useBibleOfflineSync';

/**
 * Render formatted text with allowed HTML tags (b, i, font/span with color)
 */
function renderFormattedText(text: string): string {
    if (!text) return '';
    let safe = text
        .replace(/<b>/gi, '___BOLD_OPEN___')
        .replace(/<\/b>/gi, '___BOLD_CLOSE___')
        .replace(/<i>/gi, '___ITALIC_OPEN___')
        .replace(/<\/i>/gi, '___ITALIC_CLOSE___')
        .replace(/<font color="([^"]+)">/gi, (_, color) => '___FONT_' + color + '___')
        .replace(/<\/font>/gi, '___FONT_CLOSE___')
        .replace(/<span style="color:([^"]+)">/gi, (_, color) => '___SPAN_' + color + '___')
        .replace(/<\/span>/gi, '___SPAN_CLOSE___');

    safe = safe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    safe = safe
        .replace(/___BOLD_OPEN___/g, '<b>')
        .replace(/___BOLD_CLOSE___/g, '</b>')
        .replace(/___ITALIC_OPEN___/g, '<i>')
        .replace(/___ITALIC_CLOSE___/g, '</i>')
        .replace(/___FONT_([^_]+)___/g, '<span style="color:$1">')
        .replace(/___FONT_CLOSE___/g, '</span>')
        .replace(/___SPAN_([^_]+)___/g, '<span style="color:$1">')
        .replace(/___SPAN_CLOSE___/g, '</span>');

    safe = safe.replace(/\n/g, '<br>');
    return safe;
}

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
    // Source type for semantic detection (never auto-push)
    sourceType?: 'regex' | 'ai' | 'song' | 'semantic';
    options?: any;
};




/**
 * Calculate optimal font size for Dashboard Preview based on text length
 */
function calculateDashboardFontScale(text: string, verseCount: number = 1): string {
    const charCount = text.length;
    let baseSize = 1.5; // Default rem

    if (verseCount === 1) {
        if (charCount < 100) baseSize = 1.5;
        else if (charCount < 200) baseSize = 1.3;
        else if (charCount < 350) baseSize = 1.1;
        else if (charCount < 500) baseSize = 0.9;
        else baseSize = 0.75;
    } else if (verseCount === 2) {
        if (charCount < 200) baseSize = 1.1;
        else if (charCount < 400) baseSize = 0.9;
        else if (charCount < 600) baseSize = 0.75;
        else if (charCount < 800) baseSize = 0.65;
        else baseSize = 0.55;
    } else {
        // 3 verses - most aggressive scaling
        if (charCount < 300) baseSize = 0.9;
        else if (charCount < 500) baseSize = 0.75;
        else if (charCount < 700) baseSize = 0.65;
        else if (charCount < 900) baseSize = 0.55;
        else if (charCount < 1200) baseSize = 0.48;
        else baseSize = 0.4;
    }

    return `${baseSize}rem`;
}

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
    if (!confidence) return 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400';
    if (confidence >= 90) return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/30';
    if (confidence >= 70) return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30';
    return 'bg-zinc-200 dark:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-600';
};

// Get match type badge
const getMatchTypeBadge = (matchType?: string) => {
    switch (matchType) {
        case 'exact': return { text: 'EXACT', color: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' };
        case 'partial': return { text: 'PARTIAL', color: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' };
        case 'paraphrase': return { text: 'PARAPHRASE', color: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400' };
        default: return null;
    }
};

export default function DashboardPage() {
    const [isListening, setIsListening] = useState(false);
    const [isMicLoading, setIsMicLoading] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [interim, setInterim] = useState("");
    const [voiceLevel, setVoiceLevel] = useState(0); // Audio RMS level (0-1)

    // License and usage tracking
    const { license, isLicensed, hoursRemaining, isLowHours, loading: licenseLoading } = useLicense();
    useUsageTracker(isListening, license?.licenseKey || null);
    useBibleOfflineSync(); // Background-download public-domain Bibles when online
    const [detectedQueue, setDetectedQueue] = useState<DetectedItem[]>([]);
    const [activeItem, setActiveItem] = useState<DetectedItem | null>(null);
    const [autoMode, setAutoMode] = useState(true);
    const [aiStatus, setAiStatus] = useState<'idle' | 'processing' | 'loading'>('idle');
    const [lastSignal, setLastSignal] = useState<DetectionSignal>('WAIT');
    const [confidenceThreshold, setConfidenceThreshold] = useState(85);
    const [isScheduleCollapsed, setIsScheduleCollapsed] = useState(false);

    // Background Preload Status (Offline Engine)
    const [preloadPercent, setPreloadPercent] = useState<number | null>(null);
    const [isPreloadReady, setIsPreloadReady] = useState(false);

    useEffect(() => {
        const onProgress = (e: any) => setPreloadPercent(e.detail);
        const onReady = () => {
            setIsPreloadReady(true);
            setPreloadPercent(null);
        };
        window.addEventListener('whisper-preload-progress', onProgress);
        window.addEventListener('whisper-preload-ready', onReady);
        return () => {
            window.removeEventListener('whisper-preload-progress', onProgress);
            window.removeEventListener('whisper-preload-ready', onReady);
        };
    }, []);


    // WebSocket (Deepgram) Status Management
    const [deepgramStatus, setDeepgramStatus] = useState<{ status: string; error?: string | null }>({ status: 'idle' });
    const [deepgramError, setDeepgramError] = useState<string | null>(null);
    const [selectedVersion, setSelectedVersion] = useState<string>('KJV');
    const [verseCount, setVerseCount] = useState<1 | 2 | 3>(1);
    // Audio Prompt State
    const [showAudioPrompt, setShowAudioPrompt] = useState(false);
    const [pendingLiveItem, setPendingLiveItem] = useState<{ item: ScheduleItem, slideIndex?: number } | null>(null);
    const [showBibleBrowser, setShowBibleBrowser] = useState(false);
    const [showVersionMenu, setShowVersionMenu] = useState(false);

    const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
    const [selectedLiveFeed, setSelectedLiveFeed] = useState<string | null>(null);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [announcement, setAnnouncement] = useState({ text: '', isActive: false, bgColor: '#ef4444', textColor: '#ffffff', speed: 20 });
    const [isMidiSettingsOpen, setIsMidiSettingsOpen] = useState(false);
    const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState(false);
    const [isSourceLibraryOpen, setIsSourceLibraryOpen] = useState(false);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark'); // Always start dark

    // Theme Effect
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('creenly-theme', theme);
    }, [theme]);
    const [showTimerSettings, setShowTimerSettings] = useState(false);
    const [timerDuration, setTimerDuration] = useState(30); // Minutes
    const [timerState, setTimerState] = useState({ isRunning: false, isPaused: false });
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [resetFlash, setResetFlash] = useState(false);
    const [libraryResources, setLibraryResources] = useState<ResourceItem[]>([]);
    const [pastorProfile, setPastorProfile] = useState<PastorProfile | null>(null);

    // Initialize Fuse for Song Detection
    const fuseRef = useRef<Fuse<any> | null>(null);

    const { broadcast, subscribe } = useBroadcastChannel('projector_channel', (message: any) => {
        if (message.type === 'REQUEST_STATE') {
            console.log('[Dashboard] Received REQUEST_STATE from new window');
            // Resend current theme
            if (currentTheme) {
                broadcast({ type: 'APPLY_THEME', payload: currentTheme });
            }
            // Resend current active item if it exists
            if (activeItemRef.current) {
                const item = activeItemRef.current;
                if (item.version === 'SONG' || item.version === 'MEDIA') {
                    // It's a persistent presentation (song/media)
                    if (livePresentationRef.current) {
                        const lp = livePresentationRef.current;
                        broadcast({
                            type: 'SHOW_CONTENT',
                            payload: {
                                type: lp.item.type === 'media' ? 'media' : 'song',
                                title: lp.item.title,
                                body: lp.item.slides[lp.slideIndex].content,
                                meta: lp.item.type === 'media' ? 'Image' : lp.item.meta?.author,
                                background: lp.item.meta?.background,
                                options: lp.item.type === 'media' ? { imageMode: lp.item.meta?.imageMode } : undefined,
                                slideIndex: lp.slideIndex,
                                totalSlides: lp.item.slides.length,
                                nextSlide: lp.item.slides[lp.slideIndex + 1]?.content
                            }
                        });
                    }
                } else {
                    // It's a verse
                    const allVerses = item.additionalVerses || [];
                    const allTexts = [item.text, ...allVerses.map(v => v.text)];
                    const lastVerse = allVerses.length > 0
                        ? allVerses[allVerses.length - 1].verseNum
                        : item.verseNum;
                    const displayReference = allVerses.length > 0
                        ? `${item.book} ${item.chapter}:${item.verseNum}-${lastVerse}`
                        : item.reference;

                    broadcast({
                        type: 'SHOW_VERSE',
                        payload: {
                            reference: displayReference,
                            text: allTexts.join(' '),
                            version: item.version,
                            verses: [{ verseNum: item.verseNum, text: item.text }, ...allVerses]
                        }
                    });
                }
            }
            // Resend current announcement state
            broadcast({ type: 'UPDATE_ANNOUNCEMENT', payload: announcementRef.current });
        }
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

    // Load Schedule, Pastor Profile, and Active Theme
    useEffect(() => {
        const init = async () => {
            const saved = await loadSchedule();
            if (saved) setSchedule(saved);

            const profile = loadPastorProfile();
            setPastorProfile(profile);
            console.log('[Dashboard] Loaded Pastor Profile:', profile.name);

            // Restore Active Theme
            const savedThemeId = localStorage.getItem('activeThemeId');
            if (savedThemeId) {
                const themes = await getThemes();
                const allThemes = [...DEFAULT_THEMES, ...themes];
                const active = allThemes.find(t => t.id === savedThemeId);
                if (active) setCurrentTheme(active);
            }
        };
        init();
    }, []);

    // Save Active Theme ID
    useEffect(() => {
        if (currentTheme.id) {
            localStorage.setItem('activeThemeId', currentTheme.id);
        }
    }, [currentTheme]);

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
    const livePresentationRef = useRef(livePresentation);
    const selectedVersionRef = useRef(selectedVersion);
    const verseCountRef = useRef(verseCount);
    const confidenceThresholdRef = useRef(confidenceThreshold);
    const announcementRef = useRef(announcement);

    // Keep refs in sync
    useEffect(() => {
        transcriptRef.current = transcript;
        detectedQueueRef.current = detectedQueue;
        autoModeRef.current = autoMode;
        activeItemRef.current = activeItem;
        livePresentationRef.current = livePresentation;
        selectedVersionRef.current = selectedVersion;
        verseCountRef.current = verseCount;
        confidenceThresholdRef.current = confidenceThreshold;
        announcementRef.current = announcement;

        // Broadcast announcement updates immediately when state changes
        broadcast({ type: 'UPDATE_ANNOUNCEMENT', payload: announcement });
    }, [transcript, detectedQueue, autoMode, activeItem, livePresentation, selectedVersion, verseCount, confidenceThreshold, announcement, broadcast]);

    // Broadcast Theme Changes
    useEffect(() => {
        if (currentTheme) {
            console.log('[Dashboard] Broadcasting APPLY_THEME:', currentTheme.name, currentTheme.layout);
            broadcast({ type: 'APPLY_THEME', payload: currentTheme });
        }
    }, [currentTheme, broadcast]);

    // Fetch multiple verses for multi-verse display
    const fetchMultipleVerses = useCallback(async (
        book: string,
        chapter: number,
        startVerse: number,
        count: number,
        version: string
    ): Promise<{ verseNum: number; text: string; reference: string }[]> => {
        // Parallelize for zero-latency
        const verseNumbers = Array.from({ length: count }, (_, i) => startVerse + i);

        const versePromises = verseNumbers.map(v =>
            lookupVerseAsync(book, chapter, v, version).then(text => ({
                verseNum: v,
                text,
                reference: `${book} ${chapter}:${v}`
            }))
        );

        const results = await Promise.all(versePromises);

        // Filter out nulls (verses that don't exist)
        return results.filter(r => r.text !== null) as { verseNum: number; text: string; reference: string }[];
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
                    options: item.type === 'media' ? { imageMode: item.meta?.imageMode } : undefined,
                    slideIndex: newIndex,
                    totalSlides: item.slides.length,
                    nextSlide: item.slides[newIndex + 1]?.content
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
            // Safety: Ensure all slides in songData respect the 6-line limit
            // This fixes existing songs that were imported before the limit was enforced
            const needsReParsing = item.songData.slides.some((s: any) => s.content.split('\n').filter((l: string) => l.trim()).length > 6);

            let songToUse = item.songData;
            if (needsReParsing) {
                console.log('[Safety] Re-parsing song to enforce 6-line limit');
                const fullText = item.songData.slides.map((s: any) => s.content).join('\n\n');
                const newSlides = parseLyrics(fullText);
                songToUse = { ...item.songData, slides: newSlides };
            }

            // User request: Always start detected songs at the FIRST slide (index 0)
            const initialSlideIndex = 0;
            const initialSlide = songToUse.slides[initialSlideIndex];

            // Set state for navigation
            setLivePresentation({
                item: songToUse,
                slideIndex: initialSlideIndex
            });

            // Update active item to reflect First Slide content
            setActiveItem({
                ...item,
                songData: songToUse,
                text: initialSlide.content
            });

            // Broadcast content to Projector
            broadcast({
                type: 'SHOW_CONTENT',
                payload: {
                    type: 'song',
                    title: item.reference,
                    body: initialSlide.content,
                    slideIndex: initialSlideIndex,
                    totalSlides: songToUse.slides.length,
                    meta: songToUse.author,
                    nextSlide: songToUse.slides[initialSlideIndex + 1]?.content
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
        setLivePresentation(null);
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
    }, source: 'regex' | 'ai' | 'song' | 'semantic') => {
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
                songData: data.songData,
                sourceType: source
            };

            console.log(`[${source.toUpperCase()}] Detected: `, data.reference, data.confidence ? `(${data.confidence}%)` : '');
            setDetectedQueue(prev => [newItem, ...prev].slice(0, 50));

            // Auto-push logic: Only Bible verses go live automatically
            // NEVER auto-push semantic detections (paraphrases) or songs
            const isSong = newItem.version === 'SONG';
            const isSemantic = source === 'semantic' || newItem.matchType === 'paraphrase';
            const isPartialLowConfidence = newItem.matchType === 'partial' && (newItem.confidence || 0) < 90;

            if (autoModeRef.current && !isSong && !isSemantic && !isPartialLowConfidence) {
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
                            selectedVersionRef.current = cmd.version; // Keep ref in sync
                            if (activeItemRef.current?.book && activeItemRef.current.book !== 'Song') {
                                navigateVerse('jump');
                            }
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
                // Add to queue (handles duplicate checking and auto-push logic)
                addToQueue({
                    book: topScripture.book,
                    chapter: topScripture.chapter,
                    verse: topScripture.verse,
                    verseEnd: topScripture.verseEnd,
                    text: topScripture.text,
                    reference: topScripture.reference,
                    confidence: topScripture.confidence,
                    matchType: topScripture.matchType,
                    version: topScripture.version,
                    songData: topScripture.songData,
                }, 'ai');
            }
        }, [navigateVerse, navigateChapter, clearProjector, goLive, addToQueue]),
        activeItem?.reference || null,
        {
            confidenceThreshold,
            version: selectedVersion,
            theme: pastorProfile?.sermonContext?.theme,
            strictMode: pastorProfile?.strictCommandMode
        }
    );

    const processTranscript = useCallback(async (text: string) => {
        if (!text) return; // Basic safety check
        setTranscript(prev => (prev + " " + text).slice(-1000));

        // 0. Feed to Smart Detection for fuzzy matching and auto-navigation
        // Pass true for isFinal as this is called for final results
        addToSmartDetection(text, true);

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

            // Auto-switch verse count tab if a range is detected
            if (match.verseEnd && match.verseEnd > match.verse) {
                const detectedCount = Math.min(match.verseEnd - match.verse + 1, 3) as 1 | 2 | 3;
                console.log('[REGEX] Detected verse range, auto-switching to', detectedCount, 'verse tab');
                setVerseCount(detectedCount);
            }

            addToQueue({
                book: match.book,
                chapter: match.chapter,
                verse: match.verse,
                verseEnd: match.verseEnd,
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

        // 4. Semantic search for paraphrased scriptures (requires 15+ words of context)
        if (recentWords.length >= 15 && window.electronAPI?.semanticSearch) {
            try {
                // Incorporate sermon theme if available to bias semantic matching
                const theme = pastorProfile?.sermonContext?.theme;
                const baseText = recentWords.slice(-30).join(' ');
                const semanticText = theme ? `[Theme: ${theme}] ${baseText}` : baseText;

                // Convert threshold from percentage (e.g., 85) to decimal (0.85) for API
                // Use a lower API threshold to get candidates, then filter by user threshold
                const apiThreshold = Math.max(0.40, (confidenceThresholdRef.current - 10) / 100);
                const result = await window.electronAPI.semanticSearch(semanticText, apiThreshold, 5);

                if (result?.results?.length > 0) {
                    // Filter by user's confidence threshold and take top 2 (User requested limit)
                    const filteredResults = result.results
                        .filter(m => m.confidence >= confidenceThresholdRef.current)
                        .slice(0, 2);

                    // Add semantic matches to queue (1-2 results, highest confidence first)
                    for (const match of filteredResults) {
                        // Parse the reference (e.g., "John 3:16" -> book: John, chapter: 3, verse: 16)
                        const refMatch = match.ref.match(/^(.+?)\s+(\d+):(\d+)$/);
                        if (refMatch) {
                            const [, book, chapter, verse] = refMatch;

                            // Check for duplicates (don't add if already in queue)
                            const isDupe = detectedQueueRef.current.some(
                                item => item.reference === match.ref
                            );
                            if (isDupe) continue;

                            addToQueue({
                                book: book,
                                chapter: parseInt(chapter),
                                verse: parseInt(verse),
                                text: match.text,
                                reference: match.ref,
                                confidence: match.confidence,
                                matchType: 'paraphrase',
                            }, 'semantic');
                        }
                    }
                }
            } catch (err) {
                console.error('[SEMANTIC] Search error:', err);
            }
        }

    }, [addToQueue, addToSmartDetection]);

    // Reset smart detection when stopping
    useEffect(() => {
        if (!isListening) {
            resetSmartDetection();
            setAiStatus('idle');
            setLastSignal('WAIT');
        }
    }, [isListening, resetSmartDetection]);

    // Auto-Theme Analysis (Analyze transcript every 60s to detect sermon theme)
    useEffect(() => {
        if (!isListening || !transcript) return;

        const interval = setInterval(async () => {
            if (!window.electronAPI?.smartDetect) return;

            // Analyze the last 200 words for theming
            const words = transcript.trim().split(/\s+/);
            if (words.length < 50) return; // Need enough context

            const sample = words.slice(-200).join(' ');
            console.log('[Theme] Analyzing sermon theme from recent transcript...');

            try {
                // Use smartDetect with a special thematic signal
                const result = await window.electronAPI.smartDetect({
                    text: sample,
                    context: 'extract_sermon_theme',
                    pastorHints: 'Return ONLY the core theme of this sermon in 1-3 words (e.g., "Power of God", "Faithfulness", "The Cross"). No other text.'
                });

                if (result && result.theme && result.theme !== pastorProfile?.sermonContext?.theme) {
                    console.log('[Theme] Auto-detected new sermon theme:', result.theme);
                    setPastorProfile(prev => {
                        if (!prev) return prev;
                        const updated = {
                            ...prev,
                            sermonContext: {
                                ...prev.sermonContext,
                                theme: result.theme
                            }
                        };
                        savePastorProfile(updated);
                        return updated;
                    });
                }
            } catch (err) {
                console.error('[Theme] Auto-analysis failed:', err);
            }
        }, 60000); // Every 60 seconds

        return () => clearInterval(interval);
    }, [isListening, transcript, pastorProfile?.sermonContext?.theme]);




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

    return (
        <main className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-indigo-500/30">
            <div
                ref={containerRef}
                className="fixed inset-0 px-4 pt-4 pb-20 flex flex-col gap-4 overflow-hidden"
            >
                {/* UNIFIED SIDEBAR CONTAINER */}
                <div className={`absolute top-4 left-4 z-[50] flex flex-col pointer-events-none bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-2xl shadow-lg dark:shadow-2xl transition-all duration-300 ${isScheduleCollapsed ? 'w-fit h-fit' : 'w-[320px] 2xl:w-[400px] bottom-20'}`}>
                    {/* FIGMA PILL (AS HEADER) */}
                    <div className="flex items-center gap-2 text-zinc-900 dark:text-white px-3 py-2 pointer-events-auto shrink-0 border-b border-zinc-200 dark:border-white/5">
                        {/* VERSION DROPDOWN TRIGGER */}
                        <div className="flex items-center gap-2 relative">
                            <button
                                onClick={() => setShowVersionMenu(!showVersionMenu)}
                                className="flex items-center gap-2 text-zinc-700 dark:text-white/90 hover:text-zinc-900 dark:hover:text-white text-[11px] font-bold tracking-tight py-0.5 outline-none transition-colors"
                            >
                                <Book size={12} className="text-indigo-400" />
                                <span>{selectedVersion}</span>
                                <ChevronDown size={10} className={`text-zinc-500 transition-transform ${showVersionMenu ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown Menu (Relative to Pill) */}
                            {showVersionMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowVersionMenu(false)} />
                                    <div className="absolute top-full left-0 mt-3 w-48 max-h-[60vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/10 rounded-lg shadow-2xl z-50 py-1 no-scrollbar animate-in fade-in zoom-in-95 duration-100">
                                        {SUPPORTED_VERSIONS.map((version) => (
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
                                                className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors flex items-center justify-between group ${selectedVersion === version ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-600 dark:text-zinc-300'}`}
                                            >
                                                {version}
                                                {selectedVersion === version && <CheckCircle size={12} />}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="w-px h-3 bg-zinc-300 dark:bg-white/10 mx-1" />

                        <div className="relative">
                            <button
                                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                className={`p-1 rounded transition-colors ${isSettingsOpen ? 'text-indigo-500 dark:text-indigo-400 bg-zinc-200 dark:bg-white/10' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10'}`}
                                title="Settings"
                            >
                                <Settings size={14} />
                            </button>

                            {/* Settings Dropdown Menu (Relative to Pill) - OPEN RIGHT to avoid clipping */}
                            {isSettingsOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)} />
                                    <div className="absolute top-full left-0 mt-3 w-64 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/10 rounded-xl shadow-2xl z-50 py-2 no-scrollbar animate-in fade-in zoom-in-95 duration-100">
                                        <div className="px-3 py-2 border-b border-zinc-100 dark:border-white/5 mb-1">
                                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Preferences</span>
                                        </div>

                                        {/* Theme Toggle */}
                                        <button
                                            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                                            className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors flex items-center gap-3 text-zinc-600 dark:text-zinc-300"
                                        >
                                            <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                                {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
                                            </div>
                                            <span>{theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}</span>
                                        </button>

                                        {/* License Button */}
                                        <button
                                            onClick={() => {
                                                setIsLicenseModalOpen(true);
                                                setIsSettingsOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors flex items-center gap-3 text-zinc-600 dark:text-zinc-300"
                                        >
                                            <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                                <Key size={14} />
                                            </div>
                                            <span>License Key Settings</span>
                                        </button>

                                        {/* Display Settings */}
                                        <button
                                            onClick={() => {
                                                setIsDisplaySettingsOpen(true);
                                                setIsSettingsOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors flex items-center gap-3 text-zinc-600 dark:text-zinc-300"
                                        >
                                            <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                                <Monitor size={14} className="text-zinc-500" />
                                            </div>
                                            <span>Display Mapping (Screens)</span>
                                        </button>

                                        {/* MIDI Settings */}
                                        <button
                                            onClick={() => {
                                                setIsMidiSettingsOpen(true);
                                                setIsSettingsOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors flex items-center gap-3 text-zinc-600 dark:text-zinc-300"
                                        >
                                            <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                                <Music size={14} className={midi.isEnabled ? 'text-blue-500' : ''} />
                                            </div>
                                            <span>MIDI Configuration</span>
                                        </button>


                                        <div className="mx-2 my-2 border-t border-zinc-100 dark:border-white/5 pt-2">
                                            <div className="px-2 py-1 flex items-center gap-2 mb-2">
                                                <Clock size={12} className="text-zinc-500" />
                                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Service Timer</span>
                                            </div>

                                            <div className="px-2 space-y-3">
                                                <div>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="number"
                                                            value={timerDuration}
                                                            onChange={e => setTimerDuration(parseInt(e.target.value) || 0)}
                                                            className="flex-1 bg-zinc-50 dark:bg-black/50 border border-zinc-300 dark:border-white/10 rounded px-2 py-1 text-sm text-zinc-900 dark:text-white"
                                                            placeholder="Mins"
                                                        />
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                broadcast({ type: 'TIMER_ACTION', payload: { action: 'set', mode: 'countdown', value: timerDuration * 60 } });
                                                            }}
                                                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 rounded py-1"
                                                        >
                                                            SET
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-1">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            broadcast({ type: 'TIMER_ACTION', payload: { action: 'start' } });
                                                        }}
                                                        className={`flex flex-col items-center justify-center gap-1 p-1.5 rounded-lg transition-all ${timerState.isRunning
                                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-white/5'
                                                            }`}
                                                    >
                                                        <Play size={14} fill={timerState.isRunning ? "currentColor" : "none"} />
                                                        <span className="text-[9px] font-bold uppercase">Start</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            broadcast({ type: 'TIMER_ACTION', payload: { action: 'pause' } });
                                                        }}
                                                        className="flex flex-col items-center justify-center gap-1 p-1.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20 transition-all font-bold text-[9px] uppercase"
                                                    >
                                                        <Pause size={14} fill="currentColor" />
                                                        <span>Pause</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            broadcast({ type: 'TIMER_ACTION', payload: { action: 'stop' } });
                                                        }}
                                                        className="flex flex-col items-center justify-center gap-1 p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition-all font-bold text-[9px] uppercase"
                                                    >
                                                        <Square size={14} fill="currentColor" />
                                                        <span>Stop</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="w-px h-3 bg-zinc-300 dark:bg-white/10 mx-1" />

                        <button
                            onClick={() => setIsScheduleCollapsed(!isScheduleCollapsed)}
                            className="p-1 hover:bg-zinc-100 dark:hover:bg-white/10 rounded transition-colors"
                            title={isScheduleCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                        >
                            <PanelLeftOpen size={14} className="text-zinc-700 dark:text-white" />
                        </button>
                    </div>

                    <div
                        className={`flex-1 flex flex-col min-h-0 transition-all duration-300 ease-in-out pointer-events-auto overflow-hidden rounded-2xl bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 shadow-sm dark:shadow-none ${isScheduleCollapsed ? 'opacity-0 hidden' : 'opacity-100'
                            }`}
                    >
                        <div className="flex-1 overflow-y-auto no-scrollbar">
                            <ServiceSchedulePanel
                                schedule={schedule}
                                onScheduleChange={setSchedule}
                                onGoLive={(item: ScheduleItem, slideIndex: number) => {
                                    const slide = item.slides[slideIndex];
                                    const content = slide?.content || '';

                                    // Check if this is actually a video (not an image)
                                    const isVideo = item.type === 'live_feed' ||
                                        content.startsWith('data:video') ||
                                        content.match(/\.(mp4|webm|mov|ogg)(\?|$)/i) !== null;

                                    // Intercept ONLY Live Feed and Video items for Audio Mode Selection
                                    if (isVideo) {
                                        setPendingLiveItem({ item, slideIndex });
                                        setShowAudioPrompt(true);
                                        return;
                                    }



                                    if (item.type === 'song') {
                                        // Safety: Enforce 6-line limit even for items in schedule
                                        const needsReParsing = item.slides.some(s => s.content.split('\n').filter(l => l.trim()).length > 6);
                                        let songToUse = item;
                                        let activeSlide = slide;
                                        let activeIdx = slideIndex;

                                        if (needsReParsing) {
                                            console.log('[Safety] Re-parsing schedule song to enforce 6-line limit');
                                            const fullText = item.slides.map(s => s.content).join('\n\n');
                                            const newSlides = parseLyrics(fullText);
                                            songToUse = { ...item, slides: newSlides };

                                            // Try to find the closest slide index if possible, otherwise reset to 0
                                            // For simplicity and since user usually clicks the first slide or a specific slide, 
                                            // we'll use activeIdx but pin it to the new slide count.
                                            activeIdx = Math.min(activeIdx, newSlides.length - 1);
                                            activeSlide = newSlides[activeIdx];
                                        }

                                        // Update Live Presentation State with re-parsed item
                                        setLivePresentation({ item: songToUse, slideIndex: activeIdx });

                                        // Set active item for Dashboard preview too
                                        setActiveItem({
                                            id: item.id,
                                            reference: item.title,
                                            text: activeSlide.content,
                                            version: 'SONG',
                                            book: 'Song',
                                            chapter: 0,
                                            verseNum: 0,
                                            timestamp: new Date(),
                                            songData: {
                                                id: songToUse.id,
                                                title: songToUse.title,
                                                author: songToUse.meta?.author || 'Unknown',
                                                slides: songToUse.slides
                                            }
                                        });

                                        broadcast({
                                            type: 'SHOW_CONTENT',
                                            payload: {
                                                type: 'song',
                                                title: songToUse.title,
                                                body: activeSlide.content,
                                                meta: songToUse.meta?.author,
                                                background: typeof songToUse.meta?.background === 'object' ? (songToUse.meta?.background as any)?.value : songToUse.meta?.background,
                                                slideIndex: activeIdx,
                                                totalSlides: songToUse.slides.length,
                                                nextSlide: songToUse.slides[activeIdx + 1]?.content
                                            }
                                        });
                                    }
                                    else if (item.type === 'scripture') {
                                        // Update local preview immediately so handshake works
                                        setActiveItem({
                                            id: item.id,
                                            reference: item.title,
                                            text: slide.content,
                                            version: item.meta?.version || 'KJV',
                                            book: item.title.split(' ')[0],
                                            chapter: parseInt(item.title.split(' ')[1]?.split(':')[0]) || 0,
                                            verseNum: parseInt(item.title.split(':')[1]) || 0,
                                            timestamp: new Date()
                                        });

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
                                        // Update Live Presentation State for media navigation
                                        setLivePresentation({ item, slideIndex });

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

                        {/* ANNOUNCEMENT CONTROLS */}
                        <div className="p-3 border-t border-zinc-200 dark:border-white/5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live Announcement</span>
                                <button
                                    onClick={() => setAnnouncement(prev => ({ ...prev, isActive: !prev.isActive }))}
                                    className={`w-10 h-5 rounded-full transition-all relative ${announcement.isActive ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                                >
                                    <div className={`w-3 h-3 rounded-full bg-white absolute top-1 transition-all ${announcement.isActive ? 'right-1' : 'left-1'}`} />
                                </button>
                            </div>

                            <input
                                value={announcement.text}
                                onChange={(e) => setAnnouncement(prev => ({ ...prev, text: e.target.value }))}
                                placeholder="TYPE SCROLLING ANNOUNCEMENT..."
                                className="w-full bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold tracking-wider focus:outline-none focus:border-red-500/50"
                            />

                            <div className="flex gap-2">
                                <div className="flex-1 flex gap-1 items-center">
                                    {['#ef4444', '#10b981', '#3b82f6', '#f59e0b'].map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setAnnouncement(prev => ({ ...prev, bgColor: color }))}
                                            className={`w-4 h-4 rounded-full border border-white/10 ${announcement.bgColor === color ? 'ring-2 ring-white/50 scale-110' : 'hover:scale-110'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                                <select
                                    value={announcement.speed}
                                    onChange={(e) => setAnnouncement(prev => ({ ...prev, speed: parseInt(e.target.value) }))}
                                    className="bg-transparent text-[9px] font-bold text-zinc-500 focus:outline-none"
                                >
                                    <option value="30">Slow</option>
                                    <option value="20">Med</option>
                                    <option value="10">Fast</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    className={`flex gap-2 min-h-0 h-full transition-all duration-300 ${isScheduleCollapsed ? 'pl-0' : 'pl-[336px] 2xl:pl-[416px]'}`}
                >
                    {/* LEFT: LIVE FEED & CONTROLS */}
                    <section className="flex-1 flex flex-col gap-3 min-h-0 min-w-[200px] shrink transition-all duration-300">
                        {/* TRANSCRIPT CARD */}
                        <div className={`flex-1 bg-white dark:bg-zinc-900/50 border rounded-2xl p-6 flex flex-col min-h-0 overflow-hidden shadow-sm dark:shadow-none transition-all duration-700 ${isListening ? 'animate-glow-green border-green-500/30' : 'animate-glow-red border-zinc-200 dark:border-white/5'} ${isScheduleCollapsed ? 'pt-14' : 'pt-6'}`}>
                            <TranscriptMonitor
                                isListening={isListening}
                                onTranscript={(text) => {
                                    processTranscript(text);
                                }}
                                onInterim={(text, isFinal) => {
                                    setInterim(text);
                                    if (text.trim().length > 5) {
                                        addToSmartDetection(text, isFinal);
                                    }
                                }}
                                onStatusChange={(status, error) => {
                                    setDeepgramStatus({ status, error });
                                    if (error) setDeepgramError(error);
                                }}
                                voiceLevel={voiceLevel}
                                setVoiceLevel={setVoiceLevel}
                                transcript={transcript}
                                interim={interim}
                                deepgramError={deepgramError || deepgramStatus.error}
                            />
                        </div>

                        <button
                            suppressHydrationWarning={true}
                            onClick={() => {
                                if (!isLicensed) {
                                    setIsLicenseModalOpen(true);
                                    return;
                                }
                                if (isMicLoading) return;
                                setIsMicLoading(true);
                                if (!isListening) {
                                    setDeepgramError(null);
                                    setDeepgramStatus({ status: 'connecting', error: null });
                                }
                                setIsListening(!isListening);
                                // Auto-unlock after 800ms to prevent toggle spamming
                                setTimeout(() => setIsMicLoading(false), 800);
                            }}
                            className={`w-full py-2 rounded-xl font-black text-xs tracking-wider shadow-xl transition-all flex items-center justify-center gap-3 relative overflow-hidden group
                                    ${deepgramStatus.status === 'listening'
                                    ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20'
                                    : deepgramStatus.status === 'connecting' || isMicLoading
                                        ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/50 cursor-wait'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-[1.02] active:scale-[0.98]'
                                } `}
                        >
                            {/* HYDRATION SAFE WRAPPER: Matches DOM structure on Server & Client */}
                            <div className="flex items-center justify-center gap-3" suppressHydrationWarning={true}>
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
                                        <div className="p-1.5 bg-white/20 rounded-full group-hover:bg-white/30 transition-colors flex items-center justify-center relative w-8 h-8 overflow-hidden">
                                            <div className="grid grid-cols-1 grid-rows-1 place-items-center w-full h-full">
                                                <div className={`col-start-1 row-start-1 ${(!isLicensed && !licenseLoading) ? "block" : "hidden"}`}>
                                                    <Lock size={16} strokeWidth={3} />
                                                </div>
                                                <div className={`col-start-1 row-start-1 ${(licenseLoading && !isLicensed) ? "block" : "hidden"}`}>
                                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                </div>
                                                <div className={`col-start-1 row-start-1 ${(isLicensed) ? "block" : "hidden"}`}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 grid-rows-1 place-items-center">
                                            <span className={`col-start-1 row-start-1 text-[10px] font-bold uppercase ${(!isLicensed && !licenseLoading) ? "block" : "hidden"}`}>
                                                ACTIVATE TO START LISTENING
                                            </span>
                                            <span className={`col-start-1 row-start-1 text-[10px] font-bold uppercase ${(licenseLoading && !isLicensed) ? "block" : "hidden"}`}>
                                                VERIFYING LICENSE...
                                            </span>
                                            <span className={`col-start-1 row-start-1 text-[10px] font-bold uppercase ${(isLicensed) ? "block" : "hidden"}`}>
                                                START LISTENING
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </button>

                        {/* MANUAL INPUT */}
                        <div className={`flex-shrink-0 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 rounded-2xl ${isScheduleCollapsed ? 'p-4' : 'p-3'} shadow-sm dark:shadow-none transition-all duration-300`}>
                            <form onSubmit={handleManualLookup} className="flex gap-2">
                                <input name="verseInput" placeholder="Type 'John 3:16'..." className="flex-1 min-w-0 bg-white dark:bg-black/50 border border-zinc-300 dark:border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 font-medium" />
                                <button type="submit" className={`bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center ${isScheduleCollapsed ? 'px-6' : 'px-4'}`}>GO</button>
                            </form>
                        </div>

                        {/* CONFIDENCE THRESHOLD */}
                        <div className="flex-shrink-0 bg-white dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5 rounded-xl p-3 space-y-3 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-none ring-1 ring-black/5 dark:ring-white/5">
                            <div>
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
                        </div>
                    </section>

                    {/* MIDDLE: QUEUE & HISTORY */}
                    <section className="flex-1 flex flex-col gap-4 min-h-0 min-w-[200px] shrink transition-all duration-300">
                        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-100 dark:border-white/5 rounded-2xl flex-1 flex flex-col min-h-0 overflow-hidden shadow-none">
                            <header className="p-4 border-b border-zinc-200/50 dark:border-white/5 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm shrink-0">
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider shrink-0 whitespace-nowrap">Detection Queue</h3>
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`text-[9px] font-black uppercase tracking-[0.1em] transition-colors ${autoMode ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>
                                                Auto-Push
                                            </span>
                                            <button
                                                onClick={() => setAutoMode(!autoMode)}
                                                className={`w-8 h-4 rounded-full transition-all duration-300 relative focus:outline-none border ${autoMode ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white' : 'bg-transparent border-zinc-300 dark:border-zinc-700'}`}
                                                title={autoMode ? "Auto-Push Enabled" : "Auto-Push Disabled"}
                                            >
                                                <div className={`w-2.5 h-2.5 rounded-full absolute top-[1px] shadow-sm transition-transform duration-300 ${autoMode ? 'translate-x-[16px] bg-white dark:bg-black' : 'translate-x-[3px] bg-zinc-400'}`} />
                                            </button>
                                        </div>
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
                                        <div key={item.id} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/5 hover:border-indigo-500/30 transition-all group flex gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-1 mb-1 flex-wrap">
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{item.reference}</span>
                                                    <span className="text-[10px] bg-white dark:bg-zinc-900 text-zinc-500 px-1.5 py-0.5 rounded">{item.version}</span>
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
                                                    {item.sourceType === 'semantic' && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-500/30">
                                                            semantic
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-zinc-600">{item.timestamp.toLocaleTimeString()}</span>
                                                </div>
                                                <p className="text-zinc-700 dark:text-zinc-400 text-sm line-clamp-2 leading-snug">"{item.text}"</p>
                                            </div>
                                            <button onClick={() => goLive(item)} className="self-center px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-indigo-600 text-zinc-700 dark:text-white hover:text-white rounded-lg text-xs font-bold transition-all opacity-0 group-hover:opacity-100">
                                                PUSH
                                            </button>
                                        </div>
                                    );
                                })}
                                {detectedQueue.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-zinc-700 space-y-2 opacity-50">
                                        <div className="w-12 h-12 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center">?</div>
                                        <p className="text-xs">Waiting for scripture...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* RIGHT: LIVE PREVIEW (ALWAYS DARK) */}
                    <section className="flex-1 flex flex-col gap-4 min-h-0 min-w-[200px] shrink transition-all duration-300 relative">
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-2xl flex-1 flex flex-col min-h-0 relative shadow-sm dark:shadow-none">
                            <header className="px-3 py-2 border-b border-zinc-200 dark:border-white/5 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950 rounded-t-2xl shrink-0 overflow-visible">
                                <h3 className="text-xs font-bold text-green-500 uppercase tracking-wider flex items-center gap-2 shrink-0 whitespace-nowrap mr-4">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" /> Live Output
                                </h3>
                                {/* Media Controls (Only show if active item is video) */}

                                <div className="flex items-center gap-2 shrink-0">
                                    {/* Window controls: Icon-only to save space */}
                                    <button
                                        onClick={() => {
                                            if ((window as any).electronAPI?.openProjectorWindow) {
                                                const displayId = localStorage.getItem('projectorDisplayId');
                                                (window as any).electronAPI.openProjectorWindow({ displayId });
                                            } else {
                                                window.open('/projector', '_blank', 'width=1280,height=720');
                                            }
                                        }}
                                        className="p-1.5 hover:bg-white/10 text-zinc-400 hover:text-indigo-400 rounded-lg transition-colors shrink-0"
                                        title="Projector"
                                    >
                                        <Monitor size={16} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if ((window as any).electronAPI?.openStageWindow) {
                                                const displayId = localStorage.getItem('stageDisplayId');
                                                (window as any).electronAPI.openStageWindow({ displayId });
                                            } else {
                                                window.open('/stage', '_blank', 'width=1280,height=720');
                                            }
                                        }}
                                        className="p-1.5 hover:bg-white/10 text-zinc-400 hover:text-indigo-400 rounded-lg transition-colors shrink-0 mr-1"
                                        title="Stage"
                                    >
                                        <Tv2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => setAnnouncement(prev => ({ ...prev, isActive: !prev.isActive }))}
                                        className={`p-1.5 rounded-lg transition-colors shrink-0 ${announcement.isActive ? 'text-red-500 bg-red-500/10' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
                                        title="Toggle Announcement Ticker"
                                    >
                                        <Mic size={14} className={announcement.isActive ? 'animate-pulse' : ''} />
                                    </button>
                                    <button onClick={clearProjector} className="text-[10px] font-bold text-red-500 border border-red-500/30 px-2 py-0.5 rounded hover:bg-red-500 hover:text-white transition-all shrink-0">CLEAR</button>
                                </div>
                            </header>

                            {/* PREVIEW CONTAINER */}
                            <div
                                className="flex-1 flex items-center justify-center p-4 relative group overflow-y-auto rounded-b-2xl"
                                style={{
                                    scrollbarWidth: 'thin',
                                    scrollbarColor: '#71717a #000000',
                                    background: currentTheme?.background?.type === 'image'
                                        ? `url(${currentTheme.background.value}) center / cover no-repeat`
                                        : currentTheme?.background?.value || '#000000'
                                }}
                            >
                                <div className="absolute inset-0 bg-black/20 pointer-events-none" /> {/* Overlay for readability */}

                                {/* Floating Nav Buttons - Left */}
                                {(livePresentation || (activeItem && activeItem.version !== 'MEDIA' && activeItem.version !== 'SONG')) && (
                                    <button
                                        onClick={() => livePresentation ? handleSlideNavigation('prev') : navigateVerse('prev')}
                                        disabled={livePresentation ? livePresentation.slideIndex <= 0 : false}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 z-50 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full transition-all opacity-0 group-hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
                                        title={livePresentation ? "Previous Slide" : "Previous Verse"}
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                )}

                                {/* Floating Nav Buttons - Right */}
                                {(livePresentation || (activeItem && activeItem.version !== 'MEDIA' && activeItem.version !== 'SONG')) && (
                                    <button
                                        onClick={() => livePresentation ? handleSlideNavigation('next') : navigateVerse('next')}
                                        disabled={livePresentation ? livePresentation.slideIndex >= livePresentation.item.slides.length - 1 : false}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 z-50 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full transition-all opacity-0 group-hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
                                        title={livePresentation ? "Next Slide" : "Next Verse"}
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                )}
                                {activeItem ? (
                                    activeItem.version === 'MEDIA' ? (
                                        <div className="text-center w-full h-full flex flex-col items-center justify-center relative z-10 overflow-hidden">
                                            {(() => {
                                                const mode = (activeItem as any).options?.imageMode || 'contain';
                                                const isFillMode = mode === 'cover' || mode === 'stretch';
                                                const objectFitClass = mode === 'cover' ? 'object-cover' : mode === 'stretch' ? 'object-fill' : 'object-contain';

                                                return (activeItem.book === 'LIVE') ? (
                                                    <LiveFeedStream
                                                        sourceId={activeItem.text}
                                                        className={`max-w-full max-h-full ${isFillMode ? 'w-full h-full' : 'max-h-full'} ${objectFitClass} transition-transform duration-200`}
                                                        style={{ transform: `scale(${(activeItem as any).options?.scale || 1})` }}
                                                    />
                                                ) : (activeItem.text?.startsWith('data:video') || activeItem.text?.endsWith('.mp4') || activeItem.text?.endsWith('.webm')) ? (
                                                    <video
                                                        src={activeItem.text}
                                                        className={`max-w-full max-h-full ${isFillMode ? 'w-full h-full' : 'max-h-full'} ${objectFitClass} transition-transform duration-200`}
                                                        style={{ transform: `scale(${(activeItem as any).options?.scale || 1})` }}
                                                        autoPlay
                                                        loop
                                                        muted
                                                    />
                                                ) : (
                                                    <img
                                                        src={activeItem.text}
                                                        alt={activeItem.reference}
                                                        className={`max-w-full max-h-full ${isFillMode ? 'w-full h-full' : 'max-h-full'} ${objectFitClass} transition-transform duration-200`}
                                                        style={{ transform: `scale(${(activeItem as any).options?.scale || 1})` }}
                                                    />
                                                );
                                            })()}
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
                                                    fontSize: `${0.6 * (currentTheme?.layout?.referenceScale || 1.5)}em`,
                                                    textAlign: currentTheme?.styles.textAlign
                                                }}>
                                                    <span style={{ color: currentTheme?.layout?.referenceColor || currentTheme?.styles.color }}>
                                                        {activeItem.additionalVerses?.length
                                                            ? `${activeItem.book} ${activeItem.chapter}:${activeItem.verseNum}-${activeItem.additionalVerses[activeItem.additionalVerses.length - 1].verseNum}`
                                                            : activeItem.reference
                                                        }
                                                    </span>
                                                    <span className="ml-2" style={{ color: currentTheme?.layout?.versionColor || currentTheme?.styles.color, opacity: 0.7 }}>
                                                        [{activeItem.version}]
                                                    </span>
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
                                                        <span className="opacity-60 font-mono mt-1" style={{
                                                            color: currentTheme?.layout?.verseNumberColor || currentTheme?.styles.color,
                                                            fontSize: `${(currentTheme?.layout?.verseNumberScale || 0.5) * 100}%`
                                                        }}>
                                                            {activeItem.verseNum}
                                                        </span>
                                                    )}
                                                    <span style={{
                                                        fontWeight: currentTheme?.styles.fontWeight,
                                                        fontSize: calculateDashboardFontScale(activeItem.text + (activeItem.additionalVerses?.map(v => v.text).join('') || ''), (activeItem.additionalVerses?.length || 0) + 1), // Use total text for sizing
                                                        textShadow: currentTheme?.styles.textShadow,
                                                        lineHeight: 1.2
                                                    }} dangerouslySetInnerHTML={{ __html: renderFormattedText(activeItem.text) }} />
                                                </div>

                                                {/* Additional verses */}
                                                {activeItem.additionalVerses?.map((v) => (
                                                    <div key={v.verseNum} style={{
                                                        display: 'flex',
                                                        gap: '0.5rem',
                                                        justifyContent: currentTheme?.styles.textAlign === 'left' ? 'flex-start' : currentTheme?.styles.textAlign === 'right' ? 'flex-end' : 'center'
                                                    }}>
                                                        {(currentTheme?.layout?.showVerseNumbers !== false) && (
                                                            <span className="opacity-60 font-mono mt-1" style={{
                                                                color: currentTheme?.layout?.verseNumberColor || currentTheme?.styles.color,
                                                                fontSize: `${(currentTheme?.layout?.verseNumberScale || 0.5) * 100}%`
                                                            }}>
                                                                {v.verseNum}
                                                            </span>
                                                        )}
                                                        <span style={{
                                                            fontWeight: currentTheme?.styles.fontWeight,
                                                            fontSize: calculateDashboardFontScale(activeItem.text + (activeItem.additionalVerses?.map(v => v.text).join('') || ''), (activeItem.additionalVerses?.length || 0) + 1), // Use total text for sizing
                                                            textShadow: currentTheme?.styles.textShadow,
                                                            lineHeight: 1.2
                                                        }} dangerouslySetInnerHTML={{ __html: renderFormattedText(v.text) }} />
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Reference (Bottom) */}
                                            {currentTheme?.layout?.referencePosition === 'bottom' && (
                                                <div className="opacity-90 mt-8 uppercase tracking-wider font-bold" style={{
                                                    fontSize: `${0.6 * (currentTheme?.layout?.referenceScale || 1.5)}em`,
                                                    textAlign: currentTheme?.styles.textAlign
                                                }}>
                                                    <span style={{ color: currentTheme?.layout?.referenceColor || currentTheme?.styles.color }}>
                                                        {activeItem.additionalVerses?.length
                                                            ? `${activeItem.book} ${activeItem.chapter}:${activeItem.verseNum}-${activeItem.additionalVerses[activeItem.additionalVerses.length - 1].verseNum}`
                                                            : activeItem.reference
                                                        }
                                                    </span>
                                                    <span className="ml-2" style={{ color: currentTheme?.layout?.versionColor || currentTheme?.styles.color, opacity: 0.7 }}>
                                                        [{activeItem.version}]
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                ) : (
                                    <div className="text-zinc-800 text-sm font-mono">BLACK SCREEN</div>
                                )}

                                {
                                    /* OVERLAY ACTIONS (Removed as redundant) */
                                }

                                {/* Floating Media Controls - Show for any MEDIA type (Video, Image, PDF Slide) */}
                                {(activeItem?.version === 'MEDIA' || activeItem?.text?.startsWith('data:video')) && (
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-[90%] overflow-visible flex justify-center">
                                        <div className="scale-90 origin-bottom">
                                            <MediaControls
                                                isVideo={activeItem?.text?.startsWith('data:video') || activeItem?.text?.match(/\.(mp4|webm|mov|ogg)(\?|$)/i) !== null}
                                                isAudioOnly={(activeItem as any).options?.isAudioOnly}
                                                onAction={(action, value) => {
                                                    // Broadcast to Projector
                                                    broadcast({
                                                        type: 'MEDIA_ACTION',
                                                        payload: { action, value }
                                                    });

                                                    // Update Local State for Preview
                                                    if (action === 'set_audio_only') {
                                                        setActiveItem(prev => {
                                                            if (!prev) return null;
                                                            return {
                                                                ...prev,
                                                                options: {
                                                                    ...(prev as any).options,
                                                                    isAudioOnly: value
                                                                }
                                                            } as any;
                                                        });
                                                    } else if (action === 'set_scale') {
                                                        setActiveItem(prev => {
                                                            if (!prev) return null;
                                                            return {
                                                                ...prev,
                                                                options: {
                                                                    ...(prev as any).options,
                                                                    scale: value
                                                                }
                                                            } as any;
                                                        });
                                                    } else if (action === 'set_mode') {
                                                        setActiveItem(prev => {
                                                            if (!prev) return null;
                                                            return {
                                                                ...prev,
                                                                options: {
                                                                    ...(prev as any).options,
                                                                    imageMode: value
                                                                }
                                                            } as any;
                                                        });
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Verse Count Circles - Below preview box, only for scriptures */}
                        {activeItem && activeItem.version !== 'MEDIA' && activeItem.version !== 'SONG' && !livePresentation && (
                            <div className="absolute -bottom-12 left-0 right-0 flex justify-center gap-2 z-10">
                                {[1, 2, 3].map((num) => (
                                    <button
                                        key={num}
                                        onClick={() => setVerseCount(num as 1 | 2 | 3)}
                                        className={`w-8 h-8 rounded-full text-xs font-bold transition-all shadow-lg ring-1 ring-black/5 dark:ring-white/10 ${verseCount === num
                                            ? 'bg-indigo-600 text-white transform scale-110'
                                            : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                                            }`}
                                        title={`Show ${num} verse${num > 1 ? 's' : ''}`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>

                </div > {/* End Grid */}

                {/* Resource Library Overlay (Full Height) */}
                <div
                    className={`fixed inset-x-0 z-[100] transition-all duration-500 ease-in-out ${isLibraryOpen ? 'top-14 bottom-14 opacity-100 scale-100' : 'top-[100%] bottom-[-100%] opacity-0 pointer-events-none scale-95'}`}
                >
                    <div className="h-full bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col">
                        <ResourceLibraryPanel
                            onResourcesChanged={setLibraryResources}
                            onAddToSchedule={handleAddToSchedule}
                            onToggleLibrary={() => setIsLibraryOpen(false)}
                            onApplyTheme={setCurrentTheme}
                            activeThemeId={currentTheme?.id}
                            onGoLive={(item: ScheduleItem) => {
                                console.log('[Dashboard] onGoLive for library item:', item.type, item.title);

                                const slide = item.slides?.[0];
                                const content = slide?.content || '';

                                // Check if this is actually a video (not an image)
                                const isVideo = item.type === 'live_feed' ||
                                    content.startsWith('data:video') ||
                                    content.match(/\.(mp4|webm|mov|ogg)(\?|$)/i) !== null;

                                // Intercept ONLY Live Feed and Video items for Audio Mode Selection
                                if (isVideo) {
                                    setPendingLiveItem({ item, slideIndex: 0 });
                                    setShowAudioPrompt(true);
                                    return;
                                }

                                if (!slide) return;

                                const meta = (item as any).meta || {};

                                // Handle incoming broadcast messages (from other windows if needed)
                                // Handle Media/Image directly if not intercepted above
                                if (item.type === 'media') {
                                    broadcast({
                                        type: 'SHOW_CONTENT',
                                        payload: {
                                            type: 'media',
                                            title: item.title,
                                            body: slide.content,
                                            options: {
                                                imageMode: meta.imageMode || 'contain',
                                                scale: meta.scale || 1
                                            }
                                        }
                                    });
                                    setActiveItem({
                                        id: item.id,
                                        reference: item.title,
                                        text: slide.content,
                                        version: 'MEDIA',
                                        book: 'Media',
                                        chapter: 0,
                                        verseNum: 0,
                                        timestamp: new Date()
                                    } as any);
                                    return;
                                }

                                // Handle Scripture Items
                                if (item.type === 'scripture') {
                                    // Parse "Book Chapter:Verse" from title
                                    // Default fallback
                                    let book = item.title.split(' ')[0];
                                    let chapter = 1;
                                    let verse = 1;

                                    // Try robust regex match "1 John 1:9" or "John 3:16"
                                    const match = item.title.match(/(.+) (\d+):(\d+)/);
                                    if (match) {
                                        book = match[1];
                                        chapter = parseInt(match[2]);
                                        verse = parseInt(match[3]);
                                    }

                                    goLive({
                                        id: item.id,
                                        reference: item.title,
                                        text: slide.content,
                                        version: item.meta?.version || 'KJV',
                                        book: book,
                                        chapter: chapter,
                                        verseNum: verse,
                                        timestamp: new Date()
                                    });
                                    return;
                                }

                                // Fallback for songs and other existing types
                                goLive({
                                    id: item.id,
                                    reference: item.title,
                                    text: slide.content,
                                    version: 'SONG',
                                    book: 'Song',
                                    chapter: 0,
                                    verseNum: 0,
                                    timestamp: new Date(),
                                    songData: item.type === 'song' ? {
                                        id: item.id,
                                        title: item.title,
                                        author: item.meta?.author || 'Unknown',
                                        slides: item.slides
                                    } : undefined
                                });
                            }}
                            isLibraryOpen={isLibraryOpen}
                        />
                    </div>
                </div>

                {/* Restore Library Trigger (Floating at bottom when closed) */}
                {
                    !isLibraryOpen && (
                        <div className="absolute bottom-0 left-0 right-0 h-20 flex items-center justify-center z-[70] animate-in slide-in-from-bottom-5 duration-300 pointer-events-none">
                            <button
                                onClick={() => setIsLibraryOpen(true)}
                                className="bg-indigo-600 dark:bg-zinc-900 border border-indigo-500 dark:border-white/10 text-white px-6 py-2 rounded-full shadow-2xl hover:bg-indigo-500 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 group font-bold text-xs pointer-events-auto"
                            >
                                <Library size={14} className="group-hover:text-indigo-400" />
                                RESOURCE LIBRARY
                                <ChevronUp size={14} className="text-zinc-500" />
                            </button>
                        </div>
                    )
                }

                {/* Collapse Library Trigger (Fixed at bottom when open) - Moves out of panel for better positioning */}
                {
                    isLibraryOpen && (
                        <div className="fixed bottom-0 left-0 right-0 h-14 flex items-center justify-center z-[110] animate-in slide-in-from-bottom-5 duration-300 pointer-events-none">
                            <button
                                onClick={() => setIsLibraryOpen(false)}
                                className="bg-indigo-600 dark:bg-zinc-900 border border-indigo-500 dark:border-white/10 text-white px-8 py-2 rounded-full shadow-2xl hover:bg-indigo-500 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 group font-black text-[10px] tracking-widest uppercase pointer-events-auto"
                            >
                                <ChevronDown size={14} className="text-zinc-500 group-hover:text-white transition-transform group-hover:translate-y-0.5" />
                                COLLAPSE LIBRARY
                            </button>
                        </div>
                    )
                }
            </div >

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
                        // Ensure lyrics are parsed correctly into 6-line segments
                        // OmniSearch might return raw blocks in item.content.lyrics[0].content
                        const rawLyrics = item.content.lyrics.map((l: any) => l.content).join('\n\n');
                        const parsedSlides = parseLyrics(rawLyrics);
                        const firstSlide = parsedSlides[0];

                        // Set up presentation for navigation
                        setLivePresentation({
                            item: {
                                ...item.content,
                                slides: parsedSlides
                            } as any,
                            slideIndex: 0
                        });

                        broadcast({
                            type: 'SHOW_CONTENT',
                            payload: {
                                type: 'song',
                                title: item.title,
                                body: firstSlide.content,
                                meta: item.subtitle, // Author
                                slideIndex: 0,
                                totalSlides: parsedSlides.length,
                                nextSlide: parsedSlides[1]?.content
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
            {/* Display Settings Modal */}
            <DisplaySettingsModal
                isOpen={isDisplaySettingsOpen}
                onClose={() => setIsDisplaySettingsOpen(false)}
            />
            {/* MIDI Settings Modal */}
            <MIDISettingsModal
                isOpen={isMidiSettingsOpen}
                onClose={() => setIsMidiSettingsOpen(false)}
                midi={midi}
            />

            {/* Update Banner */}
            {
                updateStatus.type !== 'idle' && updateStatus.type !== 'error' && (
                    <div className="fixed bottom-4 right-4 bg-indigo-600 text-zinc-900 dark:text-white p-4 rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom-5 border border-zinc-300 dark:border-white/10 max-w-sm">
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
                                        className="mt-3 w-full py-1.5 bg-green-500 text-zinc-900 dark:text-white font-bold rounded text-xs hover:bg-green-600 transition-colors"
                                    >
                                        Restart & Install
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => setUpdateStatus({ type: 'idle' })}
                                className="text-zinc-900 dark:text-white/50 hover:text-zinc-900 dark:text-white"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Audio Mode Prompt */}
            <AudioModePrompt
                isOpen={showAudioPrompt}
                onClose={() => {
                    setShowAudioPrompt(false);
                    setPendingLiveItem(null);
                }}
                onConfirm={(isAudioOnly) => {
                    if (!pendingLiveItem) return;
                    const { item, slideIndex } = pendingLiveItem;
                    const slide = item.slides?.[slideIndex || 0];

                    if (slide) {
                        const isLiveFeed = item.type === 'live_feed';
                        const isMedia = item.type === 'media';

                        // Use correct content payload based on type
                        const payloadType = isLiveFeed ? 'live_feed' : 'media';
                        const body = slide.content;

                        broadcast({
                            type: 'SHOW_CONTENT',
                            payload: {
                                type: payloadType,
                                title: item.title,
                                body: body,
                                meta: isLiveFeed ? '[EXTERNAL]' : ((item as any).meta || {}),
                                options: {
                                    isAudioOnly: isAudioOnly,
                                    scale: 1,
                                    imageMode: 'contain'
                                }
                            }
                        });

                        // Set Active Item for Dashboard Preview
                        setActiveItem({
                            id: item.id,
                            reference: item.title,
                            text: body,
                            version: 'MEDIA',
                            book: isLiveFeed ? 'LIVE' : 'MEDIA',
                            chapter: 0,
                            verseNum: 0,
                            timestamp: new Date(),
                            options: {
                                isAudioOnly: isAudioOnly
                            }
                        });

                        // If it's a schedule item (not library), update live presentation state
                        if (slideIndex !== undefined) {
                            setLivePresentation({ item, slideIndex });
                        }
                    }

                    setShowAudioPrompt(false);
                    setPendingLiveItem(null);
                }}
            />
        </main >
    );
}
