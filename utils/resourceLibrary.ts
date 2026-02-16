import { ScheduleItem } from '@/utils/scheduleManager';

const DB_NAME = 'church-projector-library';
const STORE_NAME = 'resources';

const DB_VERSION = 4;

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            db.onversionchange = () => {
                db.close();
                if (typeof window !== 'undefined') {
                    // Page refresh might be needed, but at least we close the connection to allow the upgrade
                    console.warn("Database connection closed due to version change. Please refresh.");
                }
            };
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const db = (event.target as any).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('collections')) {
                db.createObjectStore('collections', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('themes')) {
                db.createObjectStore('themes', { keyPath: 'id' });
            }
        };
        request.onblocked = () => {
            console.warn("Database upgrade blocked. Please close other tabs.");
            // We can't strictly reject here because it might unblock later,
            // but for user experience, a warning is good.
        };
    });
}

export interface ResourceCollection {
    id: string;
    name: string;
    type: 'song' | 'media' | 'presentation' | 'scripture' | 'theme' | 'live_feed';
    createdAt: number;
}

export interface ResourceItem extends ScheduleItem {
    category: 'song' | 'media' | 'presentation' | 'scripture' | 'theme' | 'live_feed';
    dateAdded: number;
    tags?: string[];
    collectionId?: string;
}

export async function saveResource(item: ResourceItem): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(item);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error("Failed to save resource", e);
    }
}

export async function saveResourcesBatch(
    items: ResourceItem[],
    onProgress?: (saved: number, total: number) => void
): Promise<void> {
    if (typeof window === 'undefined' || items.length === 0) return;

    const BATCH_SIZE = 100;
    const total = items.length;

    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        for (const item of batch) {
            store.put(item);
        }

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        onProgress?.(Math.min(i + batch.length, total), total);
        await new Promise(resolve => setTimeout(resolve, 0));
    }
}

export async function getResources(): Promise<ResourceItem[]> {
    if (typeof window === 'undefined') return [];
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).getAll();
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error("Failed to get resources", e);
        return [];
    }
}

export async function deleteResource(id: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// Collection CRUD
export async function saveCollection(collection: ResourceCollection): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
        const db = await openDB();
        const tx = db.transaction('collections', 'readwrite');
        tx.objectStore('collections').put(collection);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error("Failed to save collection", e);
    }
}

export async function getCollections(): Promise<ResourceCollection[]> {
    if (typeof window === 'undefined') return [];
    try {
        const db = await openDB();
        const tx = db.transaction('collections', 'readonly');
        const request = tx.objectStore('collections').getAll();
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error("Failed to get collections", e);
        return [];
    }
}

export async function deleteCollection(id: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction('collections', 'readwrite');
    tx.objectStore('collections').delete(id);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
// Themes CRUD
export interface ProjectorTheme {
    id: string;
    name: string;
    isCustom?: boolean;
    styles: {
        fontFamily: string;
        fontSize: string;
        fontWeight: string;
        color: string;
        textAlign: 'left' | 'center' | 'right';
        justifyContent: 'center' | 'flex-start' | 'flex-end';
        alignItems: 'center' | 'flex-start' | 'flex-end';
        textShadow?: string;
        textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
        letterSpacing?: string;
        lineHeight?: string;
    };
    background: {
        type: 'color' | 'image' | 'gradient';
        value: string;
        overlayOpacity: number;
        blur: number;
        brightness?: number;
    };
    layout?: {
        referencePosition: 'top' | 'bottom';
        referenceScale: number;
        showVerseNumbers: boolean;
        referenceColor?: string;
        versionColor?: string;
        versionScale?: number;
        verseNumberColor?: string;
        verseNumberScale?: number;
        contentPadding?: number;
        textScale?: number;
    };
}

export async function saveTheme(theme: ProjectorTheme): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
        const db = await openDB();
        if (!db.objectStoreNames.contains('themes')) {
            throw new Error("Themes storage not initialized (DB upgrade might be blocked)");
        }
        const tx = db.transaction('themes', 'readwrite');
        const store = tx.objectStore('themes');
        store.put(theme);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error("Failed to save theme:", e);
        throw e; // Throw so UI can catch and show alert
    }
}

export async function getThemes(): Promise<ProjectorTheme[]> {
    if (typeof window === 'undefined') return [];
    try {
        const db = await openDB();
        const tx = db.transaction('themes', 'readonly');
        const request = tx.objectStore('themes').getAll();
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        // Fallback for if object store doesn't exist yet
        console.warn("Failed to get themes (store might not exist yet)", e);
        return [];
    }
}

export async function deleteTheme(id: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction('themes', 'readwrite');
    tx.objectStore('themes').delete(id);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
