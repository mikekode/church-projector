import { useState, useEffect } from 'react';
import { X, Server, Radio, Monitor, CheckCircle, AlertCircle } from 'lucide-react';

declare global {
    interface Window {
        electronAPI?: {
            connectAtem: (ip: string) => Promise<{ success: boolean; error?: string }>;
            performAtemAction: (action: string, input?: number) => Promise<{ success: boolean; error?: string }>;
        };
    }
}

interface HardwareModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function HardwareModal({ isOpen, onClose }: HardwareModalProps) {
    const [atemIp, setAtemIp] = useState('192.168.1.10');
    const [atemStatus, setAtemStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [statusMessage, setStatusMessage] = useState('');

    const handleConnectAtem = async () => {
        if (!window.electronAPI) {
            setStatusMessage('Electron API not found. Please run in Desktop App.');
            return;
        }

        setAtemStatus('connecting');
        setStatusMessage('Connecting...');

        try {
            const res = await window.electronAPI.connectAtem(atemIp);
            if (res.success) {
                // Status will be updated via IPC event normally, but we can set tentative here
                setStatusMessage('Connection initiated...');
            } else {
                setAtemStatus('disconnected');
                setStatusMessage('Error: ' + res.error);
            }
        } catch (e: any) {
            setAtemStatus('disconnected');
            setStatusMessage('Error: ' + e.message);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Server className="text-indigo-500" /> Hardware Integration
                    </h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* ATEM Section */}
                    <div className="bg-zinc-950/50 rounded-xl p-4 border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-zinc-300 flex items-center gap-2">
                                <Monitor size={16} /> ATEM Switcher
                            </h4>
                            <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${atemStatus === 'connected' ? 'bg-green-500/20 text-green-400' :
                                    atemStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-zinc-800 text-zinc-500'
                                }`}>
                                {atemStatus}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <input
                                className="flex-1 bg-zinc-900 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none font-mono"
                                value={atemIp}
                                onChange={(e) => setAtemIp(e.target.value)}
                                placeholder="192.168.1.10"
                            />
                            <button
                                onClick={handleConnectAtem}
                                disabled={atemStatus === 'connecting' || atemStatus === 'connected'}
                                className={`px-4 py-2 rounded text-sm font-bold transition-all ${atemStatus === 'connected'
                                        ? 'bg-green-600 text-white opacity-50 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                    }`}
                            >
                                {atemStatus === 'connected' ? 'Connected' : 'Connect'}
                            </button>
                        </div>
                        {statusMessage && (
                            <p className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
                                <AlertCircle size={10} /> {statusMessage}
                            </p>
                        )}
                    </div>

                    {/* MIDI Info */}
                    <div className="bg-zinc-950/50 rounded-xl p-4 border border-white/5 opacity-75">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold text-zinc-300 flex items-center gap-2">
                                <Radio size={16} /> MIDI Control
                            </h4>
                            <span className="text-[10px] bg-green-500/20 text-green-400 px-2 rounded">Active</span>
                        </div>
                        <p className="text-[10px] text-zinc-500">
                            MIDI is automatically enabled. Connect any controller.<br />
                            <span className="text-zinc-400">Note 60: Next | Note 59: Prev | Note 62: Clear</span>
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button onClick={onClose} className="text-sm text-zinc-400 hover:text-white">Close</button>
                </div>
            </div>
        </div>
    );
}
