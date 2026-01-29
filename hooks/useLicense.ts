"use client";

import { useEffect, useState } from 'react';
import { getCurrentLicense, type License } from '@/lib/supabase';

/**
 * Hook to check license status
 * Returns license info and loading state
 */
export function useLicense() {
    const [license, setLicense] = useState<License>({ status: 'demo' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function checkLicense() {
            try {
                const result = await getCurrentLicense();
                setLicense(result);
            } catch (error) {
                console.error('License check failed:', error);
                setLicense({ status: 'demo' });
            } finally {
                setLoading(false);
            }
        }

        checkLicense();

        // Re-check every 5 minutes
        const interval = setInterval(checkLicense, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const isLicensed = license.status === 'active';
    const isDemo = license.status === 'demo' || license.status === 'expired' || license.status === 'cancelled';

    return { license, loading, isLicensed, isDemo };
}
