"use client";

import { useEffect, useState } from 'react';
import { getCurrentLicense, getCachedLicense, License } from '@/lib/supabase';

/**
 * Hook to check license status
 * Returns license info and loading state
 */
export function useLicense() {
    // Optimistic initial state from cache (zero flicker)
    // Combined with suppressHydrationWarning in DashboardPage
    const initialLicense = typeof window !== 'undefined' ? getCachedLicense() : { status: 'demo' };
    const [license, setLicense] = useState<License>(initialLicense as License);
    // Only show loading for demo/unknown state — active cache = instant unlock
    const [loading, setLoading] = useState(initialLicense.status !== 'active');

    useEffect(() => {
        let resolved = false;

        const finish = (result?: License) => {
            if (resolved) return;
            resolved = true;
            if (result) setLicense(result);
            setLoading(false);
        };

        // Background verification
        getCurrentLicense()
            .then((result) => finish(result))
            .catch(() => finish());

        // Hard timeout — 2s fallback to stop spinner
        const timer = setTimeout(() => finish(), 2000);

        // Chromium throttles timers in unfocused windows (Electron opens unfocused).
        // When the window gains visibility, resolve immediately if still loading.
        const onVisibility = () => {
            if (document.visibilityState === 'visible') finish();
        };
        document.addEventListener('visibilitychange', onVisibility);

        // Re-check every 5 minutes
        const interval = setInterval(async () => {
            const freshLicense = await getCurrentLicense();
            setLicense(freshLicense);
        }, 5 * 60 * 1000);

        return () => {
            clearTimeout(timer);
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);

    const isLicensed = license.status === 'active';
    const isDemo = license.status === 'demo';
    const isExpired = license.status === 'expired';

    // Usage tracking helpers
    const hoursRemaining = license.hoursRemaining ?? null;
    const usagePercentage = license.usageHoursLimit
        ? Math.round(((license.usageHoursUsed || 0) / license.usageHoursLimit) * 100)
        : null;
    const isUsageExhausted = hoursRemaining !== null && hoursRemaining <= 0;
    const isLowHours = hoursRemaining !== null && hoursRemaining > 0 && hoursRemaining <= 5;

    return {
        license,
        loading,
        isLicensed,
        isDemo,
        isExpired,
        // Usage tracking
        hoursRemaining,
        usagePercentage,
        isUsageExhausted,
        isLowHours
    };
}
