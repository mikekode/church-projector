import { ScheduleItem } from '@/utils/scheduleManager';

const DB_NAME = 'church-projector-library';
const STORE_NAME = 'resources';

const DB_VERSION = 3;

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
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
    });
}

export interface ResourceCollection {
    id: string;
    name: string;
    type: 'song' | 'media' | 'presentation' | 'scripture' | 'theme';
    createdAt: number;
}

export interface ResourceItem extends ScheduleItem {
    category: 'song' | 'media' | 'presentation' | 'scripture' | 'theme';
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
    styles: any;
    background: any;
    layout?: any;
}

export async function saveTheme(theme: ProjectorTheme): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
        const db = await openDB();
        const tx = db.transaction('themes', 'readwrite');
        tx.objectStore('themes').put(theme);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error("Failed to save theme", e);
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
