// Web MIDI API Types
declare namespace WebMidi {
    interface MIDIAccess extends EventTarget {
        readonly inputs: MIDIInputMap;
        readonly outputs: MIDIOutputMap;
        readonly sysexEnabled: boolean;
        onstatechange: ((event: MIDIConnectionEvent) => void) | null;
    }

    interface MIDIInputMap extends Map<string, MIDIInput> { }
    interface MIDIOutputMap extends Map<string, MIDIOutput> { }

    interface MIDIPort extends EventTarget {
        readonly id: string;
        readonly manufacturer?: string;
        readonly name?: string;
        readonly type: "input" | "output";
        readonly version?: string;
        readonly state: "disconnected" | "connected";
        readonly connection: "open" | "closed" | "pending";
        onstatechange: ((event: MIDIConnectionEvent) => void) | null;
        open(): Promise<MIDIPort>;
        close(): Promise<MIDIPort>;
    }

    interface MIDIInput extends MIDIPort {
        onmidimessage: ((event: MIDIMessageEvent) => void) | null;
    }

    interface MIDIOutput extends MIDIPort {
        send(data: Iterable<number>, timestamp?: number): void;
        clear(): void;
    }

    interface MIDIMessageEvent extends Event {
        readonly data: Uint8Array;
    }

    interface MIDIConnectionEvent extends Event {
        readonly port: MIDIPort;
    }
}

interface Navigator {
    requestMIDIAccess(options?: { sysex: boolean }): Promise<WebMidi.MIDIAccess>;
}

// Electron API types
interface SemanticSearchResult {
    ref: string;
    text: string;
    confidence: number;
    type: 'semantic';
}

interface SemanticSearchResponse {
    results: SemanticSearchResult[];
    reason?: string;
    error?: string;
}

interface Window {
    electronAPI?: {
        // ATEM
        connectAtem: (ip: string) => Promise<any>;
        performAtemAction: (action: string, input?: number) => Promise<any>;
        onAtemStatus: (callback: (status: string) => void) => () => void;
        // NDI
        startNdi: () => Promise<any>;
        // System
        platform: string;
        version: string;
        getMachineId: () => Promise<string>;
        // Bible
        getVerse: (query: any) => Promise<any>;
        getVerseOnline: (query: any) => Promise<any>;
        // Window Management
        openProjectorWindow: (args?: { displayId: string | null }) => Promise<any>;
        openStageWindow: (args?: { displayId: string | null }) => Promise<any>;
        // Display Management
        getDisplays: () => Promise<any[]>;
        identifyDisplays: () => Promise<any>;
        // Desktop Capture
        getDesktopSources: () => Promise<any[]>;
        // Songs
        searchSongs: (query: string) => Promise<any>;
        getLyrics: (title: string, artist: string) => Promise<any>;
        // AI
        smartDetect: (payload: any) => Promise<any>;
        semanticSearch: (text: string, threshold?: number, maxResults?: number) => Promise<SemanticSearchResponse>;
        // Updates
        checkUpdate: () => Promise<any>;
        downloadUpdate: () => Promise<any>;
        installUpdate: () => Promise<any>;
        onUpdateAvailable: (cb: (info: any) => void) => () => void;
        onUpdateDownloaded: (cb: (info: any) => void) => () => void;
        onUpdateError: (cb: (err: string) => void) => () => void;
    };
}

declare module 'sql.js';
