import { useState, useEffect, useRef } from 'react';
import { saveResource, getResources, deleteResource, ResourceItem, saveCollection, getCollections, deleteCollection, ResourceCollection } from '@/utils/resourceLibrary';
import { getBibleBooks, getChapterVerseCount, lookupVerseAsync, SUPPORTED_VERSIONS } from '@/utils/bible';
import { DEFAULT_THEMES, GOOGLE_FONTS, ProjectorTheme } from '@/utils/themes';
import { ScheduleItem } from '@/utils/scheduleManager';
import { extractTextFromFile, parseLyrics, isCcliCopy, parseCcliCopy, parsePresentationFile } from '@/utils/lyricsParser';
import { Search, Music, Monitor, FileText, Image as ImageIcon, Book, Plus, Play, Trash2, Folder, FolderPlus, X, Video, Check, Eye } from 'lucide-react';
import PreviewModal from './PreviewModal';
import SongImportModal from './SongImportModal';
import { MOTION_BACKGROUNDS } from '@/utils/motionBackgrounds';

const VersePreview = ({ book, chapter, verse, version }: { book: string, chapter: number, verse: number, version: string }) => {
    const [text, setText] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        lookupVerseAsync(book, chapter, verse, version).then(t => {
            if (active) setText(t);
        });
        return () => { active = false; };
    }, [book, chapter, verse, version]);

    if (!text) return <span className="animate-pulse bg-zinc-800 rounded h-3 w-12 inline-block" />;
    return <span className="line-clamp-2">{text}</span>;
}

interface ResourceLibraryPanelProps {
    onAddToSchedule?: (item: ResourceItem) => void;
    onGoLive: (item: ScheduleItem) => void;
    onApplyTheme: (theme: ProjectorTheme) => void;
    activeThemeId?: string;
    onResourcesChanged?: (items: ResourceItem[]) => void;
}

type TabType = 'song' | 'media' | 'presentation' | 'scripture' | 'theme';

export default function ResourceLibraryPanel({
    onAddToSchedule,
    onGoLive,
    onApplyTheme,
    activeThemeId,
    onResourcesChanged
}: ResourceLibraryPanelProps) {
    const [resources, setResources] = useState<ResourceItem[]>([]);
    // ...

    // ... (keep intervening code if possible, but replace_file_content needs contiguous block)
    // I can't replace the interface AND loadData in one block unless they are close.
    // They are lines 26-40 vs 184. Too far.
    // I will do 2 chunks.

    const [collections, setCollections] = useState<ResourceCollection[]>([]);
    const [customThemes, setCustomThemes] = useState<ProjectorTheme[]>([]);
    const [editingTheme, setEditingTheme] = useState<ProjectorTheme | null>(null);
    const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('song');
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [previewItem, setPreviewItem] = useState<ScheduleItem | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Online Search State (SongSelect-like)
    const [isOnlineMode, setIsOnlineMode] = useState(false);
    const [onlineResults, setOnlineResults] = useState<{ id: string, title: string, artist: string, album: string, thumbnail: string }[]>([]);
    const [isSearchingOnline, setIsSearchingOnline] = useState(false);

    // Bible Browser State
    const [bibleNav, setBibleNav] = useState<{
        version: string;
        book: { key: string; name: string; chapters: number } | null;
        chapter: number | null;
    }>({
        version: 'KJV',
        book: null,
        chapter: null
    });

    const resetBibleNav = () => setBibleNav(prev => ({ ...prev, book: null, chapter: null }));

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleOnlineSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearchingOnline(true);
        try {
            let data;
            // 1. Electron IPC (Network-enabled Main Process)
            if ((window as any).electronAPI?.searchSongs) {
                console.log("[Electron] Searching Songs:", searchQuery);
                data = await (window as any).electronAPI.searchSongs(searchQuery);
            } else {
                // 2. Web Fallback (Direct iTunes Call)
                console.log("[Web] Searching iTunes Direct:", searchQuery);
                const url = `https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=music&entity=song&limit=300`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`iTunes Error ${res.status}`);

                const rawData = await res.json();

                // Map iTunes results to our format
                data = {
                    results: rawData.results.map((item: any) => ({
                        id: String(item.trackId),
                        title: item.trackName,
                        artist: item.artistName,
                        album: item.collectionName,
                        albumArt: item.artworkUrl100?.replace('100x100', '600x600'),
                        source: 'itunes'
                    }))
                };
            }

            if (data.results) {
                setOnlineResults(data.results);
            }
        } catch (e) {
            console.error(e);
            alert(`Search Failed. Error: ${(e as any).message}. ElectronAPI: ${!!(window as any).electronAPI}`);
        } finally {
            setIsSearchingOnline(false);
        }
    };

    const handleImportSong = async (song: typeof onlineResults[0]) => {
        // Show immediate feedback
        const btn = document.getElementById(`btn-import-${song.id}`);
        if (btn) btn.innerText = "Importing...";

        try {
            let data;
            // 1. Electron IPC
            if ((window as any).electronAPI?.getLyrics) {
                console.log("[Electron] Fetching Lyrics:", song.title);
                data = await (window as any).electronAPI.getLyrics(song.title, song.artist);
            } else {
                // 2. Web Fallback (Direct Lyrics Call)
                let lyrics = null;
                try {
                    // LrcLib
                    const res1 = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(song.artist)}&track_name=${encodeURIComponent(song.title)}`);
                    if (res1.ok) {
                        const d1 = await res1.json();
                        lyrics = d1.plainLyrics;
                    }
                } catch (e) { console.warn("LrcLib failed", e); }

                if (!lyrics) {
                    try {
                        // Lyrics.ovh
                        const res2 = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(song.artist)}/${encodeURIComponent(song.title)}`);
                        if (res2.ok) {
                            const d2 = await res2.json();
                            lyrics = d2.lyrics;
                        }
                    } catch (e) { console.warn("Lyrics.ovh failed", e); }
                }

                data = { lyrics };
            }

            let lyricsContent = '';

            if (data.lyrics) {
                lyricsContent = data.lyrics;
            } else {
                console.warn("Lyrics not found for", song.title);
                lyricsContent = `Title: ${song.title} \nArtist: ${song.artist} \n\n(Lyrics could not be found automatically.\nPlease edit this song to paste lyrics here.)`;
            }

            // Parse text into slides (simple paragraph split)
            const slidesStr = lyricsContent.split(/\n\n+/).filter(s => s.trim());
            const slides = slidesStr.map((txt, i) => ({
                id: String(i + 1),
                content: txt.trim()
            }));

            // Use Thumbnail as background?
            // song.thumbnail is usually small (60x60). Get bigger one?
            // "artworkUrl60" -> "artworkUrl600" hack
            const highResArt = song.thumbnail ? song.thumbnail.replace('60x60', '600x600') : undefined;

            const newItem: ResourceItem = {
                id: `res - ${Date.now()} `,
                type: 'song',
                title: song.title,
                slides: slides,
                activeSlideIndex: 0,
                category: 'song',
                dateAdded: Date.now(),
                collectionId: selectedCollectionId || undefined,
                meta: {
                    author: song.artist,
                    copyright: song.album,
                    background: highResArt ? { type: 'image', value: highResArt } : undefined
                }
            };

            await saveResource(newItem);

            // Reload and switch back
            await loadData();
            setIsOnlineMode(false);
            setSearchQuery(''); // Clear search to show list

            // Scroll to top?
        } catch (e) {
            console.error(e);
            alert('Import failed: ' + (e as any).message);
            if (btn) btn.innerText = "Import Lyrics";
        }
    };

    const toScheduleItem = (r: ResourceItem): ScheduleItem => ({
        id: `live - ${Date.now()} -${r.id} `,
        type: r.type,
        title: r.title,
        slides: r.slides,
        activeSlideIndex: 0,
        meta: r.meta
    });

    // Load resources & collections on mount
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [items, cols] = await Promise.all([getResources(), getCollections()]);
        items.sort((a, b) => b.dateAdded - a.dateAdded);
        setResources(items);
        onResourcesChanged?.(items);
        setCollections(cols.sort((a, b) => b.createdAt - a.createdAt));
        const savedThemes = localStorage.getItem('custom_themes');
        if (savedThemes) setCustomThemes(JSON.parse(savedThemes));
    };

    const saveCustomThemes = (themes: ProjectorTheme[]) => {
        setCustomThemes(themes);
        localStorage.setItem('custom_themes', JSON.stringify(themes));
    };

    const handleCreateCollection = async () => {
        if (!newCollectionName.trim()) return;
        const newCol: ResourceCollection = {
            id: `col - ${Date.now()} `,
            name: newCollectionName.trim(),
            type: activeTab,
            createdAt: Date.now()
        };
        await saveCollection(newCol);
        await loadData();
        setNewCollectionName('');
        setIsCreateCollectionOpen(false);
        setSelectedCollectionId(newCol.id);
    };

    const handleDeleteCollection = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Delete this collection? Items inside will remain in "All Items".')) {
            await deleteCollection(id);
            if (selectedCollectionId === id) setSelectedCollectionId(null);
            await loadData();
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const isDoc = file.name.match(/\.(pdf|docx|txt|pptx)$/i);

                const type = file.type.startsWith('image/') ? 'media' :
                    file.type.startsWith('video/') ? 'media' :
                        isDoc ? 'song' : 'song';

                let newItem: ResourceItem;

                if (type === 'media' && !isDoc) {
                    const reader = new FileReader();
                    await new Promise<void>((resolve) => {
                        reader.onload = async (e) => {
                            const result = e.target?.result as string;
                            newItem = {
                                id: `res - ${Date.now()} -${i} `,
                                type: 'media',
                                title: file.name,
                                slides: [{ id: '1', content: result }],
                                activeSlideIndex: 0,
                                category: 'media',
                                dateAdded: Date.now(),
                                meta: { imageMode: 'contain' },
                                collectionId: selectedCollectionId || undefined
                            };
                            await saveResource(newItem);
                            resolve();
                        };
                        reader.readAsDataURL(file);
                    });
                } else {
                    const slides = await parsePresentationFile(file);
                    const isPresentation = file.name.match(/\.(pdf|docx|pptx)$/i);

                    newItem = {
                        id: `res - ${Date.now()} -${i} `,
                        type: 'song',
                        title: file.name.replace(/\.[^/.]+$/, ""),
                        slides: slides,
                        activeSlideIndex: 0,
                        category: isPresentation ? 'presentation' : 'song',
                        dateAdded: Date.now(),
                        collectionId: selectedCollectionId || undefined
                    };
                    await saveResource(newItem);
                }
            }
            await loadData();
        } catch (err) {
            console.error(err);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const filteredResources = resources.filter(r => {
        const tabMatch = activeTab === 'presentation'
            ? (r.category === 'presentation' || (r.category === 'song' && (r.title.match(/\.(pdf|docx|pptx)$/i) !== null)))
            : r.category === activeTab;

        const collectionMatch = selectedCollectionId
            ? r.collectionId === selectedCollectionId
            : true;

        const searchMatch = r.title.toLowerCase().includes(searchQuery.toLowerCase());

        return tabMatch && collectionMatch && searchMatch;
    });

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Delete this resource?')) {
            await deleteResource(id);
            await loadData();
        }
    };

    // Resource Editing State
    const [editingResource, setEditingResource] = useState<ResourceItem | null>(null);
    const [editText, setEditText] = useState('');

    const openEditModal = (res: ResourceItem) => {
        setEditingResource(res);
        // Combine slides back into text for editing
        setEditText(res.slides.map(s => s.content).join('\n\n'));
    };

    const handleSaveResourceEdit = async () => {
        if (!editingResource) return;

        let newSlides: any[] = [];
        let newMeta = { ...editingResource.meta };
        let newTitle = editingResource.title;

        // Check for Smart Parsing (CCLI / SongSelect)
        if (isCcliCopy(editText)) {
            const { slides, meta } = parseCcliCopy(editText);
            newSlides = slides;

            // Update metadata if found
            if (meta.author) newMeta.author = meta.author;
            if (meta.ccliNumber) newMeta.ccli = meta.ccliNumber;
            // Only update title if the current title is placeholder or generic
            if (meta.title && (newTitle.startsWith('New Song') || newTitle.includes('Unknown'))) {
                newTitle = meta.title;
            }
        } else {
            // Standard Parser
            newSlides = parseLyrics(editText);
        }

        // Fallback if parser returns empty (shouldn't happen if text exists)
        if (newSlides.length === 0 && editText.trim()) {
            newSlides = editText.split(/\n\n+/).map((txt, i) => ({
                id: String(i + 1),
                content: txt.trim(),
                label: `Slide ${i + 1} `
            }));
        }

        const updatedRes: ResourceItem = {
            ...editingResource,
            title: newTitle,
            slides: newSlides,
            meta: newMeta,
            dateAdded: Date.now()
        };

        await saveResource(updatedRes);
        await loadData();
        setEditingResource(null);
        setEditText('');
    };

    const renderCard = (resource: ResourceItem) => {
        const isPlaceholder = resource.slides.length > 0 && resource.slides[0].content.includes("(Lyrics could not be found");

        return (
            <div
                key={resource.id}
                onClick={() => isPlaceholder ? openEditModal(resource) : onAddToSchedule?.(resource)}
                className={`group relative aspect-video bg-zinc-900 border border-white/5 hover:border-indigo-500/50 rounded-xl flex flex-col justify-between overflow-hidden transition-all hover:shadow-xl hover:shadow-indigo-500/10 cursor-pointer ${isPlaceholder ? 'border-yellow-500/30' : ''}`}
            >
                {/* Thumbnail / Preview */}
                <div className="flex-1 bg-zinc-950/50 relative overflow-hidden">
                    {typeof resource.meta?.background === 'object' && resource.meta.background.type === 'image' ? (
                        <div className="absolute inset-0 opacity-50 bg-cover bg-center" style={{ backgroundImage: `url(${resource.meta.background.value})` }} />
                    ) : resource.slides[0]?.content?.startsWith('data:image') ? (
                        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${resource.slides[0].content})` }} />
                    ) : (
                        <div className="absolute inset-0 p-3 text-[10px] text-zinc-500 opacity-50 select-none overflow-hidden leading-relaxed break-words">
                            {resource.slides[0]?.content.slice(0, 100)}...
                        </div>
                    )}

                    {/* Actions Overlay - Premium Album Style */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-4 backdrop-blur-[2px] z-10">
                        {isPlaceholder && (
                            <button
                                onClick={(e) => { e.stopPropagation(); openEditModal(resource); }}
                                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-full shadow-xl hover:scale-105 transition-transform flex items-center gap-2"
                            >
                                <Plus size={16} strokeWidth={3} /> ADD LYRICS
                            </button>
                        )}

                        {/* Secondary Actions Strip */}
                        {!isPlaceholder && (
                            <div className="flex items-center gap-2 mt-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onAddToSchedule?.(resource); }}
                                    className="p-2 bg-white/10 hover:bg-indigo-500 rounded-full text-white hover:scale-110 transition-all backdrop-blur-md"
                                    title="Add to Schedule"
                                >
                                    <Plus size={14} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); openEditModal(resource); }}
                                    className="p-2 bg-white/10 hover:bg-zinc-600 rounded-full text-white hover:scale-110 transition-all backdrop-blur-md"
                                    title="Edit"
                                >
                                    <FileText size={14} />
                                </button>
                                <button
                                    onClick={(e) => handleDelete(resource.id, e)}
                                    className="p-2 bg-white/10 hover:bg-red-500 rounded-full text-white hover:scale-110 transition-all backdrop-blur-md"
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Info */}
                <div className="p-3 bg-zinc-900 border-t border-white/5 relative group/info">
                    <div className="flex items-center justify-between gap-2">
                        <h4 className={`text-xs font-semibold truncate flex-1 ${isPlaceholder ? 'text-yellow-500 italic' : 'text-zinc-300'}`} title={resource.title}>
                            {resource.title}
                        </h4>

                        {/* Always visible 'Quick Actions' for non-drafts */}
                        {!isPlaceholder && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setPreviewItem(toScheduleItem(resource)); }}
                                    className="w-6 h-6 rounded-full bg-zinc-800 hover:bg-indigo-600 text-zinc-500 hover:text-white flex items-center justify-center transition-colors"
                                    title="Preview"
                                >
                                    <Eye size={10} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onGoLive?.(resource); }}
                                    className="w-6 h-6 rounded-full bg-zinc-800 hover:bg-green-500 text-zinc-500 hover:text-white flex items-center justify-center transition-colors"
                                    title="Go Live"
                                >
                                    <Play size={10} fill="currentColor" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1.5">
                        <p className="text-[9px] text-zinc-500 truncate">{resource.meta?.author || new Date(resource.dateAdded).toLocaleDateString()}</p>
                        <span className="text-[9px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded uppercase tracking-wider scale-90 origin-right ml-auto">
                            {resource.slides.length} SL
                        </span>
                    </div>
                </div>
            </div>
        )
    };

    const renderEditModal = () => (
        editingResource ? (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-zinc-950/50 rounded-t-2xl">
                        <h3 className="font-bold text-lg text-white">Edit Song: {editingResource.title}</h3>
                        <button onClick={() => setEditingResource(null)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
                    </div>
                    <div className="p-6 flex-1 overflow-y-auto">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Content (Lyrics)</label>
                                <p className="text-[10px] text-zinc-400 mb-2">Separate slides with double newlines (Enter key twice).</p>
                                <textarea
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="w-full h-96 bg-zinc-950 border border-white/10 rounded-xl p-4 text-sm font-mono leading-relaxed text-zinc-300 focus:outline-none focus:border-indigo-500 resize-none"
                                    placeholder="Paste lyrics here..."
                                />
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t border-white/10 bg-zinc-950/50 flex justify-end gap-3 rounded-b-2xl">
                        <button onClick={() => setEditingResource(null)} className="px-4 py-2 rounded text-sm font-bold text-zinc-400 hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleSaveResourceEdit} className="px-6 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/20">Save Changes</button>
                    </div>
                </div>
            </div>
        ) : null
    );


    const handleAddNew = () => {
        if (activeTab === 'song') {
            setEditingResource({
                id: String(Date.now()),
                type: 'song',
                title: 'New Song',
                slides: [],
                activeSlideIndex: 0,
                category: 'song',
                dateAdded: Date.now(),
                meta: { author: '', ccli: '' }
            });
            setEditText('');
        } else {
            fileInputRef.current?.click();
        }
    };

    const handleSongImport = (song: ResourceItem) => {
        saveResource(song);
        setResources(prev => [song, ...prev]);
        setIsImportModalOpen(false);
    };

    const renderAddCard = () => (
        <button
            onClick={handleAddNew}
            className="group relative aspect-video bg-zinc-900/50 border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-zinc-800 transition-all"
        >
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white text-zinc-500 transition-colors shadow-lg">
                <Plus size={16} />
            </div>
            <span className="text-[10px] font-bold text-zinc-500 group-hover:text-zinc-300 uppercase tracking-wider">Add New</span>
        </button>
    );

    const renderMediaContent = () => {
        // Map Motion Backgrounds
        const motionRes = MOTION_BACKGROUNDS.map(bg => ({
            id: bg.id,
            title: bg.name,
            type: 'media' as const,
            category: 'media' as const,
            activeSlideIndex: 0,
            slides: [{ id: bg.id, content: bg.videoUrl, label: 'Video', type: 'video' }],
            dateAdded: 0,
            meta: {
                background: { type: 'image', value: bg.thumbnail },
                imageMode: 'cover' as const
            }
        })) as ResourceItem[];

        // Combine (deduplicate by ID just in case)
        const combined = [...filteredResources];
        motionRes.forEach(m => {
            if (!combined.find(r => r.id === m.id)) {
                combined.push(m);
            }
        });

        const videos = combined.filter(r =>
            r.slides[0]?.content?.startsWith('data:video') ||
            r.title.match(/\.(mp4|webm|mov)$/i) ||
            r.title.match(/background/i) || // Loose match for motion backgrounds
            (r.type === 'media' && !r.slides[0]?.content?.startsWith('data:image'))
        );
        const videoIds = new Set(videos.map(v => v.id));
        const images = filteredResources.filter(r => !videoIds.has(r.id));

        return (
            <div className="space-y-8 animate-in fade-in duration-300">
                <div>
                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2 pb-2 border-b border-white/5">
                        <Video size={12} className="text-indigo-400" /> Videos
                        <span className="ml-auto bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">{videos.length}</span>
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {videos.map(renderCard)}
                        {renderAddCard()}
                    </div>
                </div>

                <div>
                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2 pb-2 border-b border-white/5">
                        <ImageIcon size={12} className="text-pink-400" /> Images
                        <span className="ml-auto bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">{images.length}</span>
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {images.map(renderCard)}
                        {renderAddCard()}
                    </div>
                </div>
            </div>
        );
    };

    const renderScriptureContent = () => {
        const books = getBibleBooks();

        const renderBreadcrumb = () => (
            <div className="flex items-center gap-2 mb-4 text-xs">
                <button
                    onClick={resetBibleNav}
                    className={`hover:text-white transition-colors ${!bibleNav.book ? 'text-white font-bold' : 'text-zinc-500'}`}
                >
                    Books
                </button>
                {bibleNav.book && (
                    <>
                        <span className="text-zinc-700">/</span>
                        <button
                            onClick={() => setBibleNav(prev => ({ ...prev, chapter: null }))}
                            className={`hover:text-white transition-colors ${!bibleNav.chapter ? 'text-white font-bold' : 'text-zinc-500'}`}
                        >
                            {bibleNav.book.name}
                        </button>
                    </>
                )}
                {bibleNav.chapter && (
                    <>
                        <span className="text-zinc-700">/</span>
                        <span className="text-white font-bold">Chapter {bibleNav.chapter}</span>
                    </>
                )}
            </div>
        );

        if (!bibleNav.book) {
            return (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Select Book</h3>
                        <select
                            value={bibleNav.version}
                            onChange={(e) => setBibleNav(prev => ({ ...prev, version: e.target.value }))}
                            className="bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] text-zinc-300 outline-none focus:border-indigo-500"
                        >
                            {SUPPORTED_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {books.map(book => (
                            <button
                                key={book.key}
                                onClick={() => setBibleNav(prev => ({ ...prev, book }))}
                                className="p-3 bg-zinc-900/50 hover:bg-zinc-800 border border-white/5 hover:border-indigo-500/50 rounded-lg text-left transition-all group"
                            >
                                <div className="font-bold text-xs text-zinc-300 group-hover:text-white truncate">{book.name}</div>
                                <div className="text-[10px] text-zinc-600 mt-1">{book.chapters} Ch</div>
                            </button>
                        ))}
                    </div>
                </div>
            );
        }

        if (!bibleNav.chapter) {
            return (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {renderBreadcrumb()}
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
                        {Array.from({ length: bibleNav.book.chapters }, (_, i) => i + 1).map(chap => (
                            <button
                                key={chap}
                                onClick={() => setBibleNav(prev => ({ ...prev, chapter: chap }))}
                                className="aspect-square flex items-center justify-center bg-zinc-900/50 hover:bg-zinc-800 border border-white/5 hover:border-indigo-500/50 rounded-lg font-bold text-sm text-zinc-400 hover:text-white transition-all"
                            >
                                {chap}
                            </button>
                        ))}
                    </div>
                </div>
            );
        }

        const verseCount = getChapterVerseCount(bibleNav.book.key, bibleNav.chapter);

        return (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {renderBreadcrumb()}
                <div className="space-y-2">
                    {Array.from({ length: verseCount }, (_, i) => i + 1).map(verse => (
                        <div
                            key={verse}
                            className="bg-zinc-900/30 border border-white/5 rounded-lg p-3 hover:bg-zinc-900 transition-colors group cursor-pointer flex gap-4 items-center"
                            onClick={async () => {
                                const text = await lookupVerseAsync(bibleNav.book!.key, bibleNav.chapter!, verse, bibleNav.version);
                                const resource: ResourceItem = {
                                    id: `bible - ${Date.now()} `,
                                    type: 'scripture',
                                    title: `${bibleNav.book!.name} ${bibleNav.chapter}:${verse} `,
                                    category: 'scripture',
                                    slides: [{ id: 'slide-1', content: text || '', label: 'Verse' }],
                                    dateAdded: Date.now(),
                                    activeSlideIndex: 0,
                                    meta: { version: bibleNav.version, author: bibleNav.version }
                                };
                                if (onGoLive) onGoLive(toScheduleItem(resource));
                            }}
                        >
                            <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors flex-shrink-0">
                                {verse}
                            </div>
                            <div className="flex-1">
                                <div className="text-xs text-zinc-400 group-hover:text-white transition-colors">
                                    <VersePreview book={bibleNav.book!.key} chapter={bibleNav.chapter!} verse={verse} version={bibleNav.version} />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        const text = await lookupVerseAsync(bibleNav.book!.key, bibleNav.chapter!, verse, bibleNav.version);
                                        const resource: ResourceItem = {
                                            id: `bible - ${Date.now()} `,
                                            type: 'scripture',
                                            title: `${bibleNav.book!.name} ${bibleNav.chapter}:${verse} `,
                                            category: 'scripture',
                                            slides: [{ id: 'slide-1', content: text || '', label: 'Verse' }],
                                            dateAdded: Date.now(),
                                            activeSlideIndex: 0,
                                            meta: { version: bibleNav.version, author: bibleNav.version }
                                        };
                                        onAddToSchedule?.(resource);
                                    }}
                                    className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors"
                                    title="Add to Schedule"
                                >
                                    <Plus size={14} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        lookupVerseAsync(bibleNav.book!.key, bibleNav.chapter!, verse, bibleNav.version).then(text => {
                                            const resource: ResourceItem = {
                                                id: `bible - ${Date.now()} `,
                                                type: 'scripture',
                                                title: `${bibleNav.book!.name} ${bibleNav.chapter}:${verse} `,
                                                category: 'scripture',
                                                slides: [{ id: 'slide-1', content: text || '', label: 'Verse' }],
                                                dateAdded: Date.now(),
                                                activeSlideIndex: 0,
                                                meta: { version: bibleNav.version, author: bibleNav.version }
                                            };
                                            onGoLive(toScheduleItem(resource));
                                        });
                                    }}
                                    className="p-1.5 hover:bg-indigo-600 rounded bg-indigo-600/20 text-indigo-400 hover:text-white transition-colors" title="Go Live">
                                    <Play size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div >
        );
    };

    const handleSaveTheme = (theme: ProjectorTheme) => {
        if (customThemes.some(t => t.id === theme.id)) {
            saveCustomThemes(customThemes.map(t => t.id === theme.id ? theme : t));
        } else {
            saveCustomThemes([...customThemes, theme]);
        }
        setIsThemeModalOpen(false);
        setEditingTheme(null);
    };

    const handleDeleteTheme = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Delete this theme?')) {
            saveCustomThemes(customThemes.filter(t => t.id !== id));
        }
    };

    const renderThemeContent = () => {
        const allThemes = [...DEFAULT_THEMES, ...customThemes];
        return (
            <div className="animate-in fade-in duration-300 pb-20">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Select Theme</h3>
                    <button
                        onClick={() => {
                            setEditingTheme({
                                id: `theme - ${Date.now()} `,
                                name: 'New Custom Theme',
                                isCustom: true,
                                styles: { fontFamily: 'Inter', fontSize: '4rem', fontWeight: '700', color: '#ffffff', textAlign: 'center', justifyContent: 'center', alignItems: 'center', textShadow: '0 2px 10px rgba(0,0,0,0.5)' },
                                background: { type: 'color', value: '#111827', overlayOpacity: 0, blur: 0 }
                            });
                            setIsThemeModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-white transition-colors"
                    >
                        <Plus size={12} /> Create Custom
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {allThemes.map(theme => (
                        <div
                            key={theme.id}
                            onClick={() => { onApplyTheme?.(theme); }}
                            className="group relative aspect-video rounded-xl overflow-hidden border border-white/10 hover:border-indigo-500 transition-all cursor-pointer bg-zinc-900 shadow-md"
                        >
                            {/* Preview */}
                            <div className="absolute inset-0 w-full h-full" style={{
                                background: theme.background.type === 'image' ? `url(${theme.background.value}) center/cover no-repeat` :
                                    theme.background.type === 'gradient' ? theme.background.value : theme.background.value
                            }}>
                                {/* Mini Content Preview */}
                                <div className="absolute inset-0 flex flex-col p-4 z-10" style={{
                                    alignItems: theme.styles.alignItems === 'flex-start' ? 'flex-start' : theme.styles.alignItems === 'flex-end' ? 'flex-end' : 'center',
                                    justifyContent: theme.styles.justifyContent === 'flex-start' ? 'flex-start' : theme.styles.justifyContent === 'flex-end' ? 'flex-end' : 'center',
                                }}>
                                    <h1 style={{
                                        fontFamily: theme.styles.fontFamily,
                                        color: theme.styles.color,
                                        textShadow: theme.styles.textShadow,
                                        fontWeight: theme.styles.fontWeight,
                                        textAlign: theme.styles.textAlign,
                                        fontSize: '12px', // Scale for preview
                                        lineHeight: 1.2,
                                        margin: 0
                                    }}>
                                        The Lord is my shepherd
                                    </h1>
                                </div>
                                {/* Overlay for readability if needed, usually inherent in theme logic but here implied */}
                            </div>

                            {/* Actions Overlay */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity backdrop-blur-sm z-20">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onApplyTheme?.(theme); }}
                                    className="p-1.5 bg-green-600 rounded-full text-white hover:scale-110 transition-transform shadow-lg"
                                    title="Apply Theme"
                                >
                                    <Play size={12} fill="currentColor" />
                                </button>
                                {activeThemeId === theme.id && (
                                    <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1 shadow-lg animate-in zoom-in spin-in-90 duration-300">
                                        <Check size={12} className="text-white" strokeWidth={3} />
                                    </div>
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingTheme({ ...theme, isCustom: true, id: theme.isCustom ? theme.id : `copy-${Date.now()}` });
                                        setIsThemeModalOpen(true);
                                    }}
                                    className="p-1.5 bg-indigo-600 rounded-full text-white hover:scale-110 transition-transform shadow-lg"
                                    title="Edit / Copy"
                                >
                                    <Monitor size={12} />
                                </button>
                                {theme.isCustom && (
                                    <button
                                        onClick={(e) => handleDeleteTheme(theme.id, e)}
                                        className="p-1.5 bg-red-600 rounded-full text-white hover:scale-110 transition-transform shadow-lg"
                                        title="Delete"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Label */}
                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent z-20">
                                <div className="text-[10px] font-bold text-white truncate shadow-black drop-shadow-md">{theme.name}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderThemeModal = () => {
        if (!editingTheme) return null;
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                    <div className="flex items-center justify-between p-4 border-b border-white/10 bg-zinc-950/50">
                        <h3 className="font-bold text-white">Theme Editor</h3>
                        <button onClick={() => setIsThemeModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Controls */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase">Theme Name</label>
                                <input
                                    className="w-full bg-zinc-950 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                                    value={editingTheme.name}
                                    onChange={e => setEditingTheme({ ...editingTheme, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase">Font Family</label>
                                <select
                                    className="w-full bg-zinc-950 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                                    value={editingTheme.styles.fontFamily}
                                    onChange={e => setEditingTheme({ ...editingTheme, styles: { ...editingTheme.styles, fontFamily: e.target.value } })}
                                >
                                    {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase">Text Color</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={editingTheme.styles.color}
                                            onChange={e => setEditingTheme({ ...editingTheme, styles: { ...editingTheme.styles, color: e.target.value } })}
                                            className="bg-transparent h-8 w-8 cursor-pointer border-none p-0 rounded-full overflow-hidden"
                                        />
                                        <input
                                            type="text"
                                            value={editingTheme.styles.color}
                                            onChange={e => setEditingTheme({ ...editingTheme, styles: { ...editingTheme.styles, color: e.target.value } })}
                                            className="bg-zinc-950 border border-white/10 rounded px-2 py-1 text-xs text-white w-24 focus:border-indigo-500 outline-none font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 uppercase">Alignment</label>
                                    <div className="flex bg-zinc-950 rounded border border-white/10 p-1">
                                        {['left', 'center', 'right'].map(align => (
                                            <button key={align}
                                                onClick={() => setEditingTheme({
                                                    ...editingTheme, styles: {
                                                        ...editingTheme.styles,
                                                        textAlign: align as any,
                                                        alignItems: align === 'center' ? 'center' : align === 'left' ? 'flex-start' : 'flex-end'
                                                    }
                                                })}
                                                className={`flex - 1 py - 1 rounded text - xs capitalize ${editingTheme.styles.textAlign === align ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-white'} `}
                                            >
                                                {align}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase">Background Type</label>
                                <div className="flex gap-2">
                                    {['color', 'gradient', 'image'].map(t => (
                                        <button key={t}
                                            onClick={() => setEditingTheme({ ...editingTheme, background: { ...editingTheme.background, type: t as any } })}
                                            className={`px - 3 py - 1 rounded text - xs font - bold uppercase transition - colors ${editingTheme.background.type === t ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'} `}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase">
                                    {editingTheme.background.type === 'color' ? 'Color Hex' : editingTheme.background.type === 'gradient' ? 'CSS Gradient' : 'Image URL'}
                                </label>
                                {editingTheme.background.type === 'color' ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={editingTheme.background.value}
                                            onChange={e => setEditingTheme({ ...editingTheme, background: { ...editingTheme.background, value: e.target.value } })}
                                            className="bg-transparent h-10 w-10 cursor-pointer border border-white/10 rounded p-1"
                                        />
                                        <input
                                            className="flex-1 bg-zinc-950 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none font-mono text-xs"
                                            value={editingTheme.background.value}
                                            placeholder="#000000"
                                            onChange={e => setEditingTheme({ ...editingTheme, background: { ...editingTheme.background, value: e.target.value } })}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            className="w-full bg-zinc-950 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none font-mono text-xs"
                                            value={editingTheme.background.value}
                                            placeholder={editingTheme.background.type === 'image' ? 'https://...' : 'linear-gradient(...)'}
                                            onChange={e => setEditingTheme({ ...editingTheme, background: { ...editingTheme.background, value: e.target.value } })}
                                        />
                                        {editingTheme.background.type === 'image' && (
                                            <p className="text-[10px] text-zinc-500">Paste an image URL above.</p>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="pt-4 mt-4 border-t border-white/10">
                                <h4 className="text-xs font-bold text-indigo-400 uppercase mb-3">Layout Settings</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-zinc-500 uppercase">Reference Position</label>
                                        <div className="flex bg-zinc-950 rounded border border-white/10 p-1">
                                            <button
                                                onClick={() => setEditingTheme({ ...editingTheme, layout: { ...(editingTheme.layout || { referenceScale: 1, showVerseNumbers: true }), referencePosition: 'top' } })}
                                                className={`flex - 1 py - 1 rounded text - xs ${(!editingTheme.layout || editingTheme.layout.referencePosition === 'top') ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-white'} `}
                                            >
                                                TOP
                                            </button>
                                            <button
                                                onClick={() => setEditingTheme({ ...editingTheme, layout: { ...(editingTheme.layout || { referenceScale: 1, showVerseNumbers: true }), referencePosition: 'bottom' } })}
                                                className={`flex - 1 py - 1 rounded text - xs ${(editingTheme.layout?.referencePosition === 'bottom') ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-white'} `}
                                            >
                                                BOTTOM
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-zinc-500 uppercase">Reference Size</label>
                                        <input
                                            type="range" min="0.5" max="3" step="0.1"
                                            value={editingTheme.layout?.referenceScale || 1.5}
                                            onChange={(e) => setEditingTheme({ ...editingTheme, layout: { ...(editingTheme.layout || { referencePosition: 'top', showVerseNumbers: true }), referenceScale: parseFloat(e.target.value) } })}
                                            className="w-full accent-indigo-500"
                                        />
                                        <div className="text-[10px] text-right text-zinc-500">{(editingTheme.layout?.referenceScale || 1.5).toFixed(1)}x</div>
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editingTheme.layout?.showVerseNumbers !== false}
                                            onChange={(e) => setEditingTheme({ ...editingTheme, layout: { ...(editingTheme.layout || { referencePosition: 'top', referenceScale: 1.5 }), showVerseNumbers: e.target.checked } })}
                                            className="rounded bg-zinc-800 border-zinc-700 text-indigo-500 focus:ring-indigo-500/20"
                                        />
                                        <span className="text-xs text-zinc-300">Show Verse Numbers</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Live Preview</label>
                            <div className="flex-1 rounded-xl overflow-hidden border border-white/10 relative shadow-2xl bg-zinc-950 select-none">
                                <div className="absolute inset-0 w-full h-full transition-all duration-300" style={{
                                    background: editingTheme.background.type === 'image' ? `url(${editingTheme.background.value}) center / cover no - repeat` :
                                        editingTheme.background.type === 'gradient' ? editingTheme.background.value : editingTheme.background.value
                                }}>
                                    <div className="absolute inset-0 flex flex-col p-8" style={{
                                        alignItems: editingTheme.styles.alignItems,
                                        justifyContent: editingTheme.styles.justifyContent
                                    }}>
                                        <div style={{
                                            fontFamily: editingTheme.styles.fontFamily,
                                            color: editingTheme.styles.color,
                                            textShadow: editingTheme.styles.textShadow,
                                            fontWeight: editingTheme.styles.fontWeight,
                                            textAlign: editingTheme.styles.textAlign,
                                        }}>
                                            <h1 className="text-4xl leading-tight mb-4">Amazing Grace</h1>
                                            <p className="text-2xl opacity-80">How sweet the sound<br />That saved a wretch like me</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-white/10 bg-zinc-950/50 flex justify-end gap-3">
                        <button onClick={() => setIsThemeModalOpen(false)} className="px-4 py-2 rounded text-sm font-bold text-zinc-400 hover:text-white transition-colors">Cancel</button>
                        <button onClick={() => handleSaveTheme(editingTheme)} className="px-6 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all transform hover:scale-105">Save Theme</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-zinc-950 border-t border-white/10">
            {/* Header / Tabs */}
            <div className="flex items-center justify-between p-2 border-b border-white/5 bg-zinc-900/50">
                <div className="flex gap-1">
                    {[
                        { id: 'song', label: 'Songs', icon: Music },
                        { id: 'scripture', label: 'Scriptures', icon: FileText },
                        { id: 'media', label: 'Media', icon: ImageIcon },
                        { id: 'presentation', label: 'Presentations', icon: FileText },
                        { id: 'theme', label: 'Themes', icon: Video }, // Placeholder icon
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                        >
                            <tab.icon size={12} />
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    {activeTab === 'song' && (
                        <div className="relative z-50">
                            <Search className="absolute left-2 top-1.5 text-zinc-500 pointer-events-none" size={12} />
                            <input
                                id="header-search-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && isOnlineMode) {
                                        handleOnlineSearch();
                                    }
                                }}
                                placeholder={isOnlineMode ? "Search Song/Artist..." : "Search library..."}
                                className={`bg-zinc-900 border border-white/10 rounded-lg pl-8 pr-3 py-1 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 w-48 transition-all relative z-10 ${isOnlineMode ? 'w-64 border-indigo-500 ring-1 ring-indigo-500/20' : ''}`}
                            />
                        </div>
                    )}
                    <button
                        onClick={() => {
                            setEditingResource({
                                id: String(Date.now()),
                                type: 'song',
                                title: 'New Song',
                                slides: [],
                                activeSlideIndex: 0,
                                category: 'song',
                                dateAdded: Date.now(),
                                meta: { author: '', ccli: '' }
                            });
                            setEditText('');
                        }}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-1.5 rounded-lg transition-colors mr-1"
                        title="Create Blank Song (or Paste CCLI)"
                    >
                        <FileText size={16} />
                    </button>
                    <button
                        onClick={() => setIsCreateCollectionOpen(true)} // Fix: Previously this was opening the collection input logic?
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-1.5 rounded-lg transition-colors mr-1"
                        title="New Collection"
                    >
                        <FolderPlus size={16} />
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white p-1.5 rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
                        title="Import File"
                    >
                        <Plus size={16} />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={activeTab === 'media' ? "image/*,video/*" : ".txt,.docx,.pdf,.pptx"}
                        className="hidden"
                        onChange={handleFileUpload}
                    />
                </div>
            </div>

            {/* Main Content Area: Sidebar + Grid */}
            <div className="flex flex-1 min-h-0">
                {/* Collections Sidebar */}
                <div className="w-48 border-r border-white/5 bg-zinc-900/30 flex flex-col min-h-0">
                    <div className="p-2 border-b border-white/5">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Collections</span>
                    </div>

                    {isCreateCollectionOpen && (
                        <div className="p-2 border-b border-white/5 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-1">
                                <input
                                    className="bg-zinc-950 border border-indigo-500/50 rounded text-xs px-2 py-1 w-full focus:outline-none"
                                    placeholder="Name..."
                                    autoFocus
                                    value={newCollectionName}
                                    onChange={e => setNewCollectionName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateCollection()}
                                />
                                <button onClick={() => setIsCreateCollectionOpen(false)}><X size={12} className="text-zinc-500 hover:text-white" /></button>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        <button
                            onClick={() => setSelectedCollectionId(null)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${!selectedCollectionId
                                ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                                : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                                }`}
                        >
                            <Folder size={12} className={!selectedCollectionId ? "fill-indigo-400/20" : ""} />
                            All Items
                        </button>

                        {collections.filter(c => c.type === activeTab).map(col => (
                            <div key={col.id} className="group relative">
                                <button
                                    onClick={() => setSelectedCollectionId(col.id)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${selectedCollectionId === col.id
                                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                                        : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                                        }`}
                                >
                                    <Folder size={12} className={selectedCollectionId === col.id ? "fill-indigo-400/20" : ""} />
                                    <span className="truncate flex-1">{col.name}</span>
                                </button>
                                <button
                                    onClick={(e) => handleDeleteCollection(col.id, e)}
                                    className="absolute right-1 top-2 p-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={10} />
                                </button>
                            </div>
                        ))}
                        {collections.filter(c => c.type === activeTab).length === 0 && (
                            <div className="px-4 py-8 text-center">
                                <p className="text-[10px] text-zinc-600 italic">No collections yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Grid */}
                <div className="flex-1 overflow-y-auto p-4 bg-zinc-950/50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <h3 className="text-xs font-bold text-zinc-400">
                                {activeTab === 'song' && isOnlineMode ? 'Online Search' :
                                    activeTab === 'song' ? 'Song Library' :
                                        activeTab === 'media' ? 'Media Library' :
                                            activeTab === 'scripture' && !searchQuery ? 'Bible Browser' :
                                                selectedCollectionId
                                                    ? collections.find(c => c.id === selectedCollectionId)?.name
                                                    : `All ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}s`
                                }
                                {!isOnlineMode && activeTab !== 'scripture' && <span className="ml-2 font-normal text-zinc-600">({filteredResources.length})</span>}
                            </h3>

                            {/* Toggle for Songs Tab */}

                            {activeTab === 'song' && (
                                <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-white/5 ml-auto">
                                    <button
                                        onClick={() => setIsOnlineMode(false)}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${!isOnlineMode ? 'bg-zinc-700 text-white shadow' : 'text-zinc-500 hover:text-white'}`}
                                    >
                                        Library
                                    </button>
                                    <button
                                        onClick={() => setIsOnlineMode(true)}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${isOnlineMode ? 'bg-indigo-600 text-white shadow' : 'text-zinc-500 hover:text-white'}`}
                                    >
                                        Online Search
                                    </button>
                                </div>
                            )}
                        </div>


                        {isOnlineMode && (
                            <div className="text-xs text-zinc-500 italic">
                                {isSearchingOnline ? 'Searching...' : `${onlineResults.length} results`}
                            </div>
                        )}
                    </div>

                    {activeTab === 'media' ? (
                        renderMediaContent()
                    ) : activeTab === 'scripture' && !searchQuery ? (
                        renderScriptureContent()
                    ) : activeTab === 'theme' ? (
                        renderThemeContent()
                    ) : (
                        isOnlineMode ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                {onlineResults.length === 0 && !isSearchingOnline && (
                                    <div className="col-span-full text-center py-10 text-zinc-500">
                                        <p>Search for a song title or artist above and press Enter.</p>
                                    </div>
                                )}
                                {onlineResults.map(song => (
                                    <div key={song.id} className="group relative aspect-square bg-zinc-900/50 border border-white/5 hover:border-indigo-500/50 rounded-xl flex flex-col overflow-hidden transition-all hover:shadow-xl hover:shadow-indigo-500/10">
                                        {song.thumbnail ? (
                                            <div className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity" style={{ backgroundImage: `url(${song.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-zinc-800 group-hover:text-indigo-900/50 transition-colors">
                                                <Music size={48} />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-3 flex flex-col justify-end">
                                            <h4 className="text-xs font-bold text-white truncate" title={song.title}>{song.title}</h4>
                                            <p className="text-[10px] text-zinc-400 truncate">{song.artist}</p>
                                            <button
                                                id={`btn-import-${song.id}`}
                                                onClick={() => handleImportSong(song)}
                                                className="mt-2 w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded uppercase tracking-wider shadow-lg opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0"
                                            >
                                                Import Lyrics
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                {filteredResources.map(renderCard)}
                                {/* Always show Add Card at the end of the grid */}
                                {renderAddCard()}
                            </div>
                        )
                    )}
                </div>
            </div>
            {isThemeModalOpen && renderThemeModal()}
            {editingResource && renderEditModal()}
            {previewItem && (
                <PreviewModal
                    item={previewItem}
                    isOpen={!!previewItem}
                    onClose={() => setPreviewItem(null)}
                    onSlideSelect={(idx) => {
                        // Optional: Update local preview item index if needed
                    }}
                    onUpdateItem={(updated) => setPreviewItem(updated)}
                    onGoLive={(idx) => {
                        onGoLive({ ...previewItem, activeSlideIndex: idx });
                        setPreviewItem(null);
                    }}
                />
            )}

        </div>
    );
}
