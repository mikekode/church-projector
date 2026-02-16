"use client";

import { useState, useRef } from 'react';
import { X, Upload, Music, Check, AlertCircle, Database, Loader2, Search } from 'lucide-react';
import { ResourceItem, getResources, saveResourcesBatch } from '@/utils/resourceLibrary';
import { parseEasyWorshipDb, ewSongToResourceItem, EWParsedSong, EWImportProgress } from '@/utils/easyworship';

interface EasyWorshipImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: (importedCount: number) => void;
}

type ImportPhase = 'select-files' | 'preview' | 'importing' | 'complete';

export default function EasyWorshipImportModal({ isOpen, onClose, onImportComplete }: EasyWorshipImportModalProps) {
    const [songsFile, setSongsFile] = useState<File | null>(null);
    const [wordsFile, setWordsFile] = useState<File | null>(null);
    const [parsedSongs, setParsedSongs] = useState<EWParsedSong[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [phase, setPhase] = useState<ImportPhase>('select-files');
    const [progress, setProgress] = useState<EWImportProgress | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [duplicateIds, setDuplicateIds] = useState<Set<number>>(new Set());
    const [importedCount, setImportedCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [savingProgress, setSavingProgress] = useState<{ saved: number; total: number } | null>(null);

    const songsInputRef = useRef<HTMLInputElement>(null);
    const wordsInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleScanLibrary = async () => {
        if (!songsFile || !wordsFile) {
            setError('Please select both Songs.db and SongWords.db (or .dat) files');
            return;
        }
        setError(null);

        try {
            const [songsBuffer, wordsBuffer] = await Promise.all([
                songsFile.arrayBuffer(),
                wordsFile.arrayBuffer()
            ]);

            const songs = await parseEasyWorshipDb(songsBuffer, wordsBuffer, setProgress);

            if (songs.length === 0) {
                setError('No songs found in the database. Make sure you selected the correct EasyWorship files.');
                return;
            }

            // Duplicate detection
            const existing = await getResources();
            const titleSet = new Set(
                existing.filter(r => r.category === 'song').map(r => r.title.toLowerCase().trim())
            );

            const dupes = new Set<number>();
            const nonDuplicates = new Set<number>();
            for (const song of songs) {
                if (titleSet.has(song.raw.title.toLowerCase().trim())) {
                    dupes.add(song.raw.rowid);
                } else {
                    nonDuplicates.add(song.raw.rowid);
                }
            }

            setParsedSongs(songs);
            setSelectedIds(nonDuplicates);
            setDuplicateIds(dupes);
            setProgress(null);
            setPhase('preview');
        } catch (e: any) {
            setError(`Failed to read database: ${e.message}. Make sure you selected valid EasyWorship database files.`);
            setProgress(null);
        }
    };

    const handleImportSelected = async () => {
        const toImport = parsedSongs.filter(s => selectedIds.has(s.raw.rowid));
        if (toImport.length === 0) return;

        setPhase('importing');
        setError(null);

        try {
            const items: ResourceItem[] = toImport.map(ewSongToResourceItem);
            await saveResourcesBatch(items, (saved, total) => {
                setSavingProgress({ saved, total });
            });

            setImportedCount(items.length);
            setSavingProgress(null);
            setPhase('complete');
        } catch (e: any) {
            setError(`Import failed: ${e.message}`);
            setPhase('preview');
        }
    };

    const handleToggleSelect = (rowid: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(rowid)) next.delete(rowid);
            else next.add(rowid);
            return next;
        });
    };

    const handleSelectAll = () => setSelectedIds(new Set(parsedSongs.map(s => s.raw.rowid)));
    const handleDeselectAll = () => setSelectedIds(new Set());

    const handleClose = () => {
        if (phase === 'importing') return;
        if (phase === 'complete') onImportComplete(importedCount);
        setSongsFile(null);
        setWordsFile(null);
        setParsedSongs([]);
        setSelectedIds(new Set());
        setDuplicateIds(new Set());
        setPhase('select-files');
        setProgress(null);
        setSavingProgress(null);
        setError(null);
        setImportedCount(0);
        setSearchQuery('');
        onClose();
    };

    const filteredSongs = searchQuery
        ? parsedSongs.filter(s => s.raw.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.raw.author.toLowerCase().includes(searchQuery.toLowerCase()))
        : parsedSongs;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-white/10 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600/20 rounded-lg">
                            <Database className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Import from EasyWorship</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {phase === 'select-files' && 'Select your EasyWorship database files'}
                                {phase === 'preview' && `${parsedSongs.length} songs found • ${selectedIds.size} selected`}
                                {phase === 'importing' && 'Importing songs...'}
                                {phase === 'complete' && `${importedCount} songs imported successfully`}
                            </p>
                        </div>
                    </div>
                    {phase !== 'importing' && (
                        <button onClick={handleClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                            <X className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Phase: Select Files */}
                    {phase === 'select-files' && (
                        <div className="space-y-4">
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl text-sm text-indigo-700 dark:text-indigo-300">
                                <p className="font-bold mb-1">Where to find your files (EasyWorship 6 &amp; 7):</p>
                                <code className="text-xs bg-white/50 dark:bg-black/20 px-2 py-1 rounded block mt-1">
                                    C:\Users\Public\Documents\Softouch\EasyWorship\Default\v6.1\Databases\Data\
                                </code>
                                <p className="text-xs mt-1 opacity-75">If your profile is in a custom location, navigate to your EasyWorship profile's Databases\Data folder.</p>
                            </div>

                            {/* Songs.db picker */}
                            <div
                                onClick={() => songsInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${songsFile
                                    ? 'border-green-500/50 bg-green-50 dark:bg-green-500/10'
                                    : 'border-zinc-300 dark:border-zinc-700 hover:border-indigo-500/50 bg-white dark:bg-zinc-900/50'
                                    }`}
                            >
                                {songsFile ? (
                                    <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                                        <Check size={20} />
                                        <span className="font-bold">{songsFile.name}</span>
                                        <span className="text-xs text-zinc-500">({(songsFile.size / 1024).toFixed(0)} KB)</span>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="w-8 h-8 mx-auto mb-2 text-zinc-400" />
                                        <p className="font-bold text-zinc-600 dark:text-zinc-300">Songs.db</p>
                                        <p className="text-xs text-zinc-500 mt-1">Click to select the Songs database file</p>
                                    </>
                                )}
                                <input ref={songsInputRef} type="file" accept=".db,.dat" className="hidden" onChange={e => setSongsFile(e.target.files?.[0] || null)} />
                            </div>

                            {/* SongWords.db picker */}
                            <div
                                onClick={() => wordsInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${wordsFile
                                    ? 'border-green-500/50 bg-green-50 dark:bg-green-500/10'
                                    : 'border-zinc-300 dark:border-zinc-700 hover:border-indigo-500/50 bg-white dark:bg-zinc-900/50'
                                    }`}
                            >
                                {wordsFile ? (
                                    <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                                        <Check size={20} />
                                        <span className="font-bold">{wordsFile.name}</span>
                                        <span className="text-xs text-zinc-500">({(wordsFile.size / 1024).toFixed(0)} KB)</span>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="w-8 h-8 mx-auto mb-2 text-zinc-400" />
                                        <p className="font-bold text-zinc-600 dark:text-zinc-300">SongWords.db / .dat</p>
                                        <p className="text-xs text-zinc-500 mt-1">Click to select the SongWords database file</p>
                                    </>
                                )}
                                <input ref={wordsInputRef} type="file" accept=".db,.dat" className="hidden" onChange={e => setWordsFile(e.target.files?.[0] || null)} />
                            </div>

                            {progress && (
                                <div className="flex items-center gap-3 text-sm text-zinc-500">
                                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                                    {progress.phase === 'loading' && 'Loading database engine...'}
                                    {progress.phase === 'parsing' && `Parsing song ${progress.current}/${progress.total}: ${progress.currentTitle || ''}`}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Phase: Preview */}
                    {phase === 'preview' && (
                        <div className="space-y-3">
                            {/* Controls */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1 relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                    <input
                                        type="text"
                                        placeholder="Search songs..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <button onClick={handleSelectAll} className="px-3 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors">
                                    Select All
                                </button>
                                <button onClick={handleDeselectAll} className="px-3 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                                    Deselect
                                </button>
                            </div>

                            {duplicateIds.size > 0 && (
                                <div className="p-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-300">
                                    {duplicateIds.size} song{duplicateIds.size > 1 ? 's' : ''} already in your library (shown with yellow badge, deselected by default)
                                </div>
                            )}

                            {/* Song List */}
                            <div className="max-h-[45vh] overflow-y-auto space-y-1 rounded-xl border border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-zinc-950/50 p-2">
                                {filteredSongs.map(song => {
                                    const isDuplicate = duplicateIds.has(song.raw.rowid);
                                    const isSelected = selectedIds.has(song.raw.rowid);
                                    return (
                                        <div
                                            key={song.raw.rowid}
                                            onClick={() => handleToggleSelect(song.raw.rowid)}
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${isSelected
                                                ? 'bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20'
                                                : 'hover:bg-white dark:hover:bg-zinc-800 border border-transparent'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                                                {isSelected && <Check size={12} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{song.raw.title}</p>
                                                {song.raw.author && <p className="text-xs text-zinc-500 truncate">{song.raw.author}</p>}
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {isDuplicate && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                                                        EXISTS
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-zinc-400">
                                                    {song.slides.length} slide{song.slides.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Phase: Importing */}
                    {phase === 'importing' && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <Loader2 className="w-12 h-12 animate-spin text-indigo-400" />
                            <p className="text-sm text-zinc-500">
                                {savingProgress
                                    ? `Saving to library: ${savingProgress.saved} / ${savingProgress.total}`
                                    : 'Preparing songs...'
                                }
                            </p>
                            {savingProgress && (
                                <div className="w-full max-w-xs bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                                        style={{ width: `${(savingProgress.saved / savingProgress.total) * 100}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Phase: Complete */}
                    {phase === 'complete' && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-bold text-zinc-900 dark:text-white">{importedCount} Songs Imported</p>
                                <p className="text-sm text-zinc-500 mt-1">Your EasyWorship songs are now in your Creenly library</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-zinc-200 dark:border-white/10 rounded-b-2xl flex justify-end gap-3">
                    {phase === 'select-files' && (
                        <>
                            <button onClick={handleClose} className="px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleScanLibrary}
                                disabled={!songsFile || !wordsFile}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Database size={16} />
                                Scan Library
                            </button>
                        </>
                    )}
                    {phase === 'preview' && (
                        <>
                            <button onClick={() => { setPhase('select-files'); setParsedSongs([]); setProgress(null); }} className="px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                                Back
                            </button>
                            <button
                                onClick={handleImportSelected}
                                disabled={selectedIds.size === 0}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Music size={16} />
                                Import {selectedIds.size} Song{selectedIds.size !== 1 ? 's' : ''}
                            </button>
                        </>
                    )}
                    {phase === 'complete' && (
                        <button onClick={handleClose} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors">
                            Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
