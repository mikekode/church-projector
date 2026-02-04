import { createClient } from '@supabase/supabase-js';

// Supabase Configuration
const supabaseUrl = 'https://ejqzexdkoqbvgmjtbbwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXpleGRrb3FidmdtanRiYndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2ODQ2ODgsImV4cCI6MjA4NTI2MDY4OH0.4YXGoTou1abHjT06zS4a338linJmO7an1X2MKX_bV_Y';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// License Types
export type LicenseStatus = 'active' | 'expired' | 'cancelled' | 'demo';

export type License = {
    status: LicenseStatus;
    licenseKey?: string;
    email?: string;
    expiresAt?: string;
    daysRemaining?: number;
    // Usage tracking fields
    usageHoursLimit?: number | null;
    usageHoursUsed?: number;
    hoursRemaining?: number | null;
};

// Local Storage Keys
const LICENSE_KEY_STORAGE = 'creenly_license_key';
const LICENSE_CACHE_STORAGE = 'creenly_license_cache';
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days offline grace period

/**
 * Generate a unique device fingerprint
 * Hardened: Uses native Hardware ID link when running in Electron.
 */
export async function getDeviceId(): Promise<string> {
    const stored = localStorage.getItem('creenly_device_id');
    if (stored) return stored;

    // Try Native Electron Machine ID first (Secure)
    try {
        if ((window as any).electronAPI?.getMachineId) {
            const hwId = await (window as any).electronAPI.getMachineId();
            if (hwId) {
                localStorage.setItem('creenly_device_id', hwId);
                return hwId;
            }
        }
    } catch (e) {
        console.warn('Native HWID check failed, using fingerprinting');
    }

    // Fingerprinting fallback (Less secure, but works in browser)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('CREENLY', 10, 10);
    const canvasHash = canvas.toDataURL().slice(-50);

    const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width,
        screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        canvasHash
    ].join('|');

    // Simple hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const deviceId = 'FPR-' + Math.abs(hash).toString(36).toUpperCase();

    localStorage.setItem('creenly_device_id', deviceId);
    return deviceId;
}

/**
 * Activate a license key (first time setup)
 * Links the key to this device
 */
export async function activateLicenseKey(keyCode: string): Promise<{ success: boolean; error?: string }> {
    const deviceId = await getDeviceId();

    // Check if license exists and is valid
    const { data: license, error: fetchError } = await supabase
        .from('licenses')
        .select('*')
        .eq('license_key', keyCode.toUpperCase())
        .single();

    if (fetchError || !license) {
        return { success: false, error: 'Invalid license key' };
    }

    // Check if already bound to a different device
    if (license.device_id && license.device_id !== deviceId) {
        return { success: false, error: 'This key is already activated on another device' };
    }

    // Check if subscription is active
    if (license.status !== 'active') {
        return { success: false, error: `License is ${license.status}. Please renew your subscription.` };
    }

    // Check if subscription has expired
    if (license.current_period_end && new Date(license.current_period_end) < new Date()) {
        return { success: false, error: 'Subscription has expired. Please renew at creenly.com' };
    }

    // Bind to this device if not already
    if (!license.device_id) {
        const { error: updateError } = await supabase
            .from('licenses')
            .update({ device_id: deviceId, updated_at: new Date().toISOString() })
            .eq('license_key', keyCode.toUpperCase());

        if (updateError) {
            return { success: false, error: 'Failed to activate. Please try again.' };
        }
    }

    // Store license key locally
    localStorage.setItem(LICENSE_KEY_STORAGE, keyCode.toUpperCase());

    // Cache the license info
    const cacheData = {
        status: 'active',
        licenseKey: keyCode.toUpperCase(),
        email: license.email,
        expiresAt: license.current_period_end,
        cachedAt: Date.now()
    };
    localStorage.setItem(LICENSE_CACHE_STORAGE, JSON.stringify(cacheData));

    return { success: true };
}

/**
 * Validate license online
 * Checks if subscription is still active
 */
export async function validateLicenseOnline(licenseKey: string): Promise<License> {
    const deviceId = await getDeviceId();

    const { data: license, error } = await supabase
        .from('licenses')
        .select('*')
        .eq('license_key', licenseKey)
        .single();

    if (error || !license) {
        return { status: 'demo' };
    }

    // Check if bound to this device
    if (license.device_id && license.device_id !== deviceId) {
        return { status: 'demo' }; // Wrong device
    }

    // Check subscription status
    if (license.status !== 'active') {
        return {
            status: license.status as LicenseStatus,
            licenseKey,
            email: license.email
        };
    }

    // Check expiry date
    const expiresAt = license.current_period_end ? new Date(license.current_period_end) : null;
    const now = new Date();

    if (expiresAt && expiresAt < now) {
        return {
            status: 'expired',
            licenseKey,
            email: license.email,
            expiresAt: license.current_period_end
        };
    }

    // Calculate days remaining
    const daysRemaining = expiresAt
        ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

    // Calculate hours remaining
    const usageHoursLimit = license.usage_hours_limit ?? null;
    const usageHoursUsed = license.usage_hours_used ?? 0;
    const hoursRemaining = usageHoursLimit !== null
        ? Math.max(0, usageHoursLimit - usageHoursUsed)
        : null;

    // Check if usage is exhausted
    if (usageHoursLimit !== null && usageHoursUsed >= usageHoursLimit) {
        return {
            status: 'expired',
            licenseKey,
            email: license.email,
            expiresAt: license.current_period_end,
            usageHoursLimit,
            usageHoursUsed,
            hoursRemaining: 0
        };
    }

    return {
        status: 'active',
        licenseKey,
        email: license.email,
        expiresAt: license.current_period_end,
        daysRemaining,
        usageHoursLimit,
        usageHoursUsed,
        hoursRemaining
    };
}

/**
 * Get current license status
 * Hardened: Forces a server-side check every app session to prevent LocalStorage injection.
 */
let sessionValidated = false;

export async function getCurrentLicense(): Promise<License> {
    const storedKey = localStorage.getItem(LICENSE_KEY_STORAGE);
    const cachedData = localStorage.getItem(LICENSE_CACHE_STORAGE);

    // No stored key = demo mode
    if (!storedKey) {
        return { status: 'demo' };
    }

    // Secure Check: If we haven't validated this SESSION yet, force an online check.
    // This prevents someone from manually editing localStorage while offline.
    const forceCheck = !sessionValidated;

    if (forceCheck || !cachedData) {
        try {
            const onlineResult = await validateLicenseOnline(storedKey);

            // Only mark session as valid if the server actually says 'active'
            if (onlineResult.status === 'active') {
                sessionValidated = true;
            }

            // Update cache with fresh data
            const cacheData = {
                ...onlineResult,
                cachedAt: Date.now()
            };
            localStorage.setItem(LICENSE_CACHE_STORAGE, JSON.stringify(cacheData));

            return onlineResult;
        } catch (error) {
            console.warn('Online license check failed, falling back to secure cache');
        }
    }

    // Offline Fallback: Use cached data ONLY if within strict grace period
    if (cachedData) {
        try {
            const cached = JSON.parse(cachedData);
            const cacheAge = Date.now() - cached.cachedAt;

            // Cache still valid (shortened to 3 days for higher security)
            const STRICT_CACHE_DURATION = 3 * 24 * 60 * 60 * 1000;
            if (cacheAge < STRICT_CACHE_DURATION) {
                return cached as License;
            }
        } catch (e) {
            console.error('Cache parse error:', e);
        }
    }

    // Default to demo if online fails and cache is old
    return { status: 'demo' };
}

/**
 * Clear license data (for switching keys)
 */
export function clearLicense(): void {
    localStorage.removeItem(LICENSE_KEY_STORAGE);
    localStorage.removeItem(LICENSE_CACHE_STORAGE);
    localStorage.removeItem('creenly_device_id');
}

/**
 * Check if currently licensed (helper)
 */
export async function isLicensed(): Promise<boolean> {
    const license = await getCurrentLicense();
    return license.status === 'active';
}
