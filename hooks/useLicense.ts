"use client";

import { useEffect, useState } from 'react';
import { getCurrentLicense, License } from '@/lib/supabase';

/**
 * Hook to check license status
 * Returns license info and loading state
 */
export function useLicense() {
    const [license, setLicense] = useState<License>({ status: 'demo' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Initial check
        getCurrentLicense().then((result) => {
            setLicense(result);
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
