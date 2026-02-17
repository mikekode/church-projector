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
    const [loading, setLoading] = useState(initialLicense.status === 'demo');

    useEffect(() => {
        // Create a promise that rejects after 2 seconds to prevent hanging on "VERIFYING..."
        const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 2000)
        );

        // Background verification with timeout fallback
        Promise.race([getCurrentLicense(), timeout])
            .then((result) => {
                setLicense(result);
                setLoading(false);
            })
            .catch((err) => {
                console.warn('[useLicense] Online check failed or timed out, falling back to cache:', err);
                // On timeout or failure, we stay with the initialLicense (from cache) but stop loading
                setLoading(false);
            });

        // Re-check every 5 minutes
        const interval = setInterval(async () => {
            const freshLicense = await getCurrentLicense();
            setLicense(freshLicense);
        }, 5 * 60 * 1000);

        return () => clearInterval(interval);
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
