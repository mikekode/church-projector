"use client";

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const SYNC_INTERVAL_MS = 60 * 1000; // Sync every 1 minute
const MIN_SECONDS_TO_SYNC = 30; // Minimum 30 seconds before syncing

/**
 * Hook to track usage time when "Start Listening" is active.
 * Syncs accumulated time to Supabase every minute.
 * 
 * @param isListening - Whether transcription is currently active
 * @param licenseKey - The user's license key (null if demo mode)
 */
export function useUsageTracker(isListening: boolean, licenseKey: string | null) {
    const startTimeRef = useRef<number | null>(null);
    const accumulatedSecondsRef = useRef(0);
    const lastSyncRef = useRef<number>(Date.now());

    // Sync usage to database
    const syncUsage = useCallback(async () => {
        if (!licenseKey) return;

        // Add any currently running session to accumulated
        if (startTimeRef.current) {
            const elapsed = (Date.now() - startTimeRef.current) / 1000;
            accumulatedSecondsRef.current += elapsed;
            startTimeRef.current = Date.now(); // Reset start time
        }

        const secondsToSync = accumulatedSecondsRef.current;
        if (secondsToSync < MIN_SECONDS_TO_SYNC) return;

        const hoursToSync = secondsToSync / 3600;

        console.log(`[UsageTracker] Syncing ${hoursToSync.toFixed(4)} hours to database`);

        try {
            // Local Sync: Update the cache first so offline calculation is accurate immediately
            const LICENSE_CACHE_STORAGE = 'creenly_license_cache';
            const cachedData = localStorage.getItem(LICENSE_CACHE_STORAGE);
            if (cachedData) {
                const cached = JSON.parse(cachedData);
                cached.usageHoursUsed = (cached.usageHoursUsed || 0) + hoursToSync;
                if (cached.hoursRemaining !== null) {
                    cached.hoursRemaining = Math.max(0, cached.hoursRemaining - hoursToSync);
                }
                localStorage.setItem(LICENSE_CACHE_STORAGE, JSON.stringify(cached));
            }

            const { data, error } = await supabase.rpc('increment_usage', {
                p_license_key: licenseKey,
                p_hours: hoursToSync
            });

            if (error) {
                console.error('[UsageTracker] Online sync failed:', error.message);
                // We DON'T return here because we already updated the local cache. 
                // The local cache is now the source of truth for offline mode.
            } else if (data === false) {
                console.warn('[UsageTracker] Usage limit may be reached');
            }

            // Reset accumulated time on successful (or local) sync
            accumulatedSecondsRef.current = 0;
            lastSyncRef.current = Date.now();
        } catch (err) {
            console.error('[UsageTracker] Sync error:', err);
        }
    }, [licenseKey]);

    // Start/stop tracking based on isListening
    useEffect(() => {
        if (isListening && licenseKey) {
            // Started listening
            startTimeRef.current = Date.now();
            console.log('[UsageTracker] Started tracking');
        } else if (startTimeRef.current) {
            // Stopped listening - accumulate time
            const elapsed = (Date.now() - startTimeRef.current) / 1000;
            accumulatedSecondsRef.current += elapsed;
            startTimeRef.current = null;
            console.log(`[UsageTracker] Stopped. Accumulated: ${accumulatedSecondsRef.current.toFixed(1)}s`);

            // Sync immediately when stopping
            syncUsage();
        }
    }, [isListening, licenseKey, syncUsage]);

    // Periodic sync while listening
    useEffect(() => {
        if (!licenseKey || !isListening) return;

        const interval = setInterval(syncUsage, SYNC_INTERVAL_MS);

        return () => {
            clearInterval(interval);
        };
    }, [licenseKey, isListening, syncUsage]);

    // Sync on page unload
    useEffect(() => {
        const handleUnload = () => {
            if (accumulatedSecondsRef.current > 0 || startTimeRef.current) {
                // Use sendBeacon for reliable unload sync
                if (startTimeRef.current) {
                    const elapsed = (Date.now() - startTimeRef.current) / 1000;
                    accumulatedSecondsRef.current += elapsed;
                }

                const hoursToSync = accumulatedSecondsRef.current / 3600;
                if (hoursToSync > 0 && licenseKey) {
                    // Note: sendBeacon with Supabase would require a custom endpoint
                    // For now, we rely on the periodic sync
                    console.log('[UsageTracker] Page unload - usage may need manual sync');
                }
            }
        };

        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, [licenseKey]);

    return {
        // Expose for debugging/display
        getAccumulatedSeconds: () => {
            let total = accumulatedSecondsRef.current;
            if (startTimeRef.current) {
                total += (Date.now() - startTimeRef.current) / 1000;
            }
            return total;
        }
    };
}
