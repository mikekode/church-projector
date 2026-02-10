export type ScheduleItemType = 'song' | 'scripture' | 'media' | 'blank' | 'live_feed';

export type ScheduleItem = {
    id: string;
    type: ScheduleItemType;
    title: string;
    subtitle?: string;
    // For songs: slides are the verses/choruses
    // For scriptures: slides are the verses
    slides: {
        id: string;
        content: string;
        label?: string; // e.g., "Verse 1", "Chorus"
    }[];
    // Currently active slide index
    activeSlideIndex: number;
    // Metadata
    meta?: {
        version?: string;      // For scriptures
        author?: string;       // For songs
        copyright?: string;    // For songs
        ccli?: string;         // For songs
        background?: string | { type: string; value: string };   // Custom background for this item
        imageMode?: 'contain' | 'cover' | 'stretch'; // For media
    };
};

export type ServiceSchedule = {
    id: string;
    name: string;
    date: string;
    items: ScheduleItem[];
};

// Saved Plan Interface (Metadata + Data)
export type SavedPlan = {
    id: string;
    name: string;
    date: string;       // Date intended for the service
    updatedAt: number;  // Timestamp of last save
    items: ScheduleItem[];
};

// Create a blank schedule
export const createBlankSchedule = (): ServiceSchedule => ({
    id: Date.now().toString(),
    name: 'New Service',
    date: new Date().toISOString().split('T')[0],
    items: []
});

// Local Storage Key (Legacy)
const SCHEDULE_KEY = 'church-projector-schedule';
const DB_NAME = 'church-projector-db';
const STORE_NAME = 'schedules';     // Stores the CURRENT active schedule
const PLANS_STORE = 'saved_plans';  // Stores named, saved plans

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2); // Increment version for new store
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as any).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
            if (!db.objectStoreNames.contains(PLANS_STORE)) {
                const plansStore = db.createObjectStore(PLANS_STORE, { keyPath: 'id' });
                plansStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }
        };
    });
}

// --- CURRENT ACTIVE SCHEDULE (Auto-save) ---

// Save schedule to IndexedDB
export const saveSchedule = async (schedule: ServiceSchedule): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(schedule, SCHEDULE_KEY);
    } catch (e) {
        console.error('Failed to save schedule to DB', e);
    }
};

// Load schedule from IndexedDB
export const loadSchedule = async (): Promise<ServiceSchedule | null> => {
    if (typeof window === 'undefined') return null;

    // 1. Try migration from LocalStorage first
    try {
        const localData = localStorage.getItem(SCHEDULE_KEY);
        if (localData) {
            console.log('Migrating schedule from LocalStorage to IndexedDB...');
            const schedule = JSON.parse(localData);
            await saveSchedule(schedule);
            localStorage.removeItem(SCHEDULE_KEY);
            return schedule;
        }
    } catch (e) {
        console.error('Migration failed', e);
    }

    // 2. Load from IndexedDB
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(SCHEDULE_KEY);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('Failed to load schedule from DB', e);
        return null;
    }
};

// --- SAVED PLANS MANAGEMENT ---

// Save a named plan
export const savePlan = async (schedule: ServiceSchedule): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
        const db = await openDB();
        const tx = db.transaction(PLANS_STORE, 'readwrite');
        const store = tx.objectStore(PLANS_STORE);

        const plan: SavedPlan = {
            id: schedule.id, // Use schedule ID as key, or generate new? Ideally schedule ID persists.
            name: schedule.name,
            date: schedule.date,
            updatedAt: Date.now(),
            items: schedule.items
        };

        store.put(plan);
    } catch (e) {
        console.error('Failed to save plan', e);
        throw e;
    }
};

// Get all saved plans (metadata)
export const getPlans = async (): Promise<SavedPlan[]> => {
    if (typeof window === 'undefined') return [];
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(PLANS_STORE, 'readonly');
            const store = tx.objectStore(PLANS_STORE);
            const index = store.index('updatedAt');
            const request = index.getAll(); // get all, sorted by date if possible? Default index order.

            request.onsuccess = () => {
                // Sort by updatedAt descending (newest first)
                const plans = (request.result as SavedPlan[]).sort((a, b) => b.updatedAt - a.updatedAt);
                resolve(plans);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('Failed to get plans', e);
        return [];
    }
};

// Load a specific plan (returns full schedule object)
export const loadPlan = async (id: string): Promise<ServiceSchedule | null> => {
    if (typeof window === 'undefined') return null;
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(PLANS_STORE, 'readonly');
            const store = tx.objectStore(PLANS_STORE);
            const request = store.get(id);

            request.onsuccess = () => {
                const plan = request.result as SavedPlan;
                if (!plan) {
                    resolve(null);
                    return;
                }
                // Convert back to ServiceSchedule structure
                resolve({
                    id: plan.id,
                    name: plan.name,
                    date: plan.date,
                    items: plan.items
                });
            };
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('Failed to load plan', e);
        return null;
    }
};

// Delete a plan
export const deletePlan = async (id: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
        const db = await openDB();
        const tx = db.transaction(PLANS_STORE, 'readwrite');
        const store = tx.objectStore(PLANS_STORE);
        store.delete(id);
    } catch (e) {
        console.error('Failed to delete plan', e);
        throw e;
    }
};
