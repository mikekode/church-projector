"use client";

import { useState } from 'react';
import { useLicense } from '@/hooks/useLicense';
import { activateLicenseKey, clearLicense } from '@/lib/supabase';
import { X, Key, CreditCard, CheckCircle, AlertCircle, Loader2, Calendar, Clock } from 'lucide-react';

interface LicenseModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function LicenseModal({ isOpen, onClose }: LicenseModalProps) {
    const { license, loading, isLicensed, isDemo, hoursRemaining, isExpired } = useLicense();
    const [keyInput, setKeyInput] = useState('');
    const [activating, setActivating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleActivateKey = async () => {
        if (!keyInput.trim()) return;

        setActivating(true);
        setError(null);
        setSuccess(null);

        const result = await activateLicenseKey(keyInput);

        if (result.success) {
            setSuccess(`License activated! Please restart the app.`);
            setKeyInput('');
            // Reload after a short delay
            setTimeout(() => window.location.reload(), 2000);
        } else {
            setError(result.error || 'Failed to activate key');
        }

        setActivating(false);
    };

    const handleReset = () => {
        clearLicense();
        window.location.reload();
    };

    if (!isOpen) return null;

    // Format expiry date nicely
    const formatExpiry = (dateStr?: string) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600/20 rounded-lg">
                            <Key className="w-5 h-5 text-indigo-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white">License & Billing</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Current Status */}
                    <div className={`p-4 rounded-xl border ${isLicensed ? 'bg-green-500/10 border-green-500/30' :
                        license.status === 'expired' ? 'bg-red-500/10 border-red-500/30' :
                            'bg-amber-500/10 border-amber-500/30'
                        }`}>
                        <div className="flex items-center gap-3">
                            {loading ? (
                                <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
                            ) : isLicensed ? (
                                <CheckCircle className="w-6 h-6 text-green-400" />
                            ) : (
                                <AlertCircle className={`w-6 h-6 ${license.status === 'expired' ? 'text-red-400' : 'text-amber-400'}`} />
                            )}
                            <div className="flex-1">
                                <p className={`font-bold ${isLicensed ? 'text-green-400' :
                                    license.status === 'expired' ? 'text-red-400' :
                                        'text-amber-400'
                                    }`}>
                                    {loading ? 'Checking license...' :
                                        isLicensed ? 'Licensed' :
                                            license.status === 'expired' ? 'Subscription Expired' :
                                                license.status === 'cancelled' ? 'Subscription Cancelled' :
                                                    'Demo Mode'}
                                </p>
                                <p className="text-sm text-zinc-400">
                                    {isLicensed
                                        ? 'Your subscription is active'
                                        : license.status === 'expired'
                                            ? 'Renew your subscription to continue'
                                            : 'Activate a license to remove watermark'}
                                </p>
                            </div>
                        </div>

                        {/* Subscription Details */}
                        {isLicensed && license.expiresAt && (
                            <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
                                <Calendar className="w-4 h-4 text-zinc-500" />
                                <div>
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Next billing date</p>
                                    <p className="text-white font-medium">{formatExpiry(license.expiresAt)}</p>
                                </div>
                                {license.daysRemaining && license.daysRemaining <= 7 && (
                                    <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full">
                                        {license.daysRemaining} days left
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Hours Remaining for licensed users */}
                        {isLicensed && hoursRemaining !== null && (
                            <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
                                <Clock className="w-4 h-4 text-zinc-500" />
                                <div>
                                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Listening hours remaining</p>
                                    <p className="text-white font-medium">{hoursRemaining.toFixed(1)} hours</p>
                                </div>
                                {hoursRemaining <= 5 && (
                                    <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full">
                                        Low hours
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Expired notice */}
                        {license.status === 'expired' && license.expiresAt && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <p className="text-sm text-zinc-400">
                                    Expired on <span className="text-red-400 font-medium">{formatExpiry(license.expiresAt)}</span>
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Pricing - Show for demo/expired/cancelled */}
                    {(isDemo || isExpired) && (
                        <div className="p-4 bg-indigo-600/10 border border-indigo-500/30 rounded-xl">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="font-bold text-white">CREENLY Pro</p>
                                    <p className="text-sm text-zinc-400">Usage-based pricing</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center mb-4">
                                <div className="p-2 bg-black/30 rounded-lg">
                                    <p className="text-lg font-bold text-white">$15</p>
                                    <p className="text-[10px] text-zinc-500">40 hrs/mo</p>
                                </div>
                                <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                                    <p className="text-lg font-bold text-indigo-400">$90</p>
                                    <p className="text-[10px] text-indigo-300">240 hrs/6mo</p>
                                </div>
                                <div className="p-2 bg-black/30 rounded-lg">
                                    <p className="text-lg font-bold text-white">$180</p>
                                    <p className="text-[10px] text-zinc-500">480 hrs/yr</p>
                                </div>
                            </div>
                            <button
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-white transition-colors flex items-center justify-center gap-2"
                                onClick={() => window.open('https://creenly.com/subscribe', '_blank')}
                            >
                                <CreditCard className="w-4 h-4" />
                                {isExpired ? 'Renew Subscription' : 'View Plans'}
                            </button>
                        </div>
                    )}

                    {/* Access Key Input */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-zinc-400">
                            {isLicensed ? 'Activate a different key' : 'Have a license key?'}
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={keyInput}
                                onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                                placeholder="CRN-XXXX-XXXX-XXXX-XXXX"
                                className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 font-mono tracking-wider"
                            />
                            <button
                                onClick={handleActivateKey}
                                disabled={activating || !keyInput.trim()}
                                className="px-6 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-white transition-colors"
                            >
                                {activating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Activate'}
                            </button>
                        </div>

                        {error && (
                            <p className="text-sm text-red-400 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> {error}
                            </p>
                        )}
                        {success && (
                            <p className="text-sm text-green-400 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" /> {success}
                            </p>
                        )}
                    </div>


                </div>
            </div>
        </div>
    );
}
