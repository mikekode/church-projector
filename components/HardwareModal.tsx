import { useState, useEffect } from 'react';
import { X, Server, Radio, Monitor, CheckCircle, AlertCircle } from 'lucide-react';
import DisplaySettingsModal from './DisplaySettingsModal';



interface HardwareModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function HardwareModal({ isOpen, onClose }: HardwareModalProps) {
    const [atemIp, setAtemIp] = useState('192.168.1.10');
    const [atemStatus, setAtemStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [statusMessage, setStatusMessage] = useState('');
    const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState(false);

    useEffect(() => {
        if (window.electronAPI?.onAtemStatus) {
            const cleanup = window.electronAPI.onAtemStatus((status) => {
                setAtemStatus(status as any);
                if (status === 'connected') setStatusMessage('Ready to switch');
                if (status === 'disconnected') setStatusMessage('Lost connection');
            });
            return () => cleanup();
        }
    }, []);

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
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <Server className="text-indigo-500" /> Hardware Integration
                    </h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* ATEM Section */}
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-xl p-4 border border-zinc-200 dark:border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                <Monitor size={16} /> ATEM Switcher
                            </h4>
                            <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${atemStatus === 'connected' ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                                atemStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                                    'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-500'
                                }`}>
                                {atemStatus}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <input
                                className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/10 rounded px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-indigo-500 outline-none font-mono"
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

                    {/* Display Mapping Section */}
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-xl p-4 border border-zinc-200 dark:border-white/5">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                <Monitor size={16} /> Display Mapping
                            </h4>
                        </div>
                        <p className="text-[10px] text-zinc-500 mb-4">
                            Configure which monitors are used for projection and confidence monitoring.
                        </p>
                        <button
                            onClick={() => setIsDisplaySettingsOpen(true)}
                            className="w-full py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            Open Display Settings
                        </button>
                    </div>

                    {isDisplaySettingsOpen && (
                        <DisplaySettingsModal
                            isOpen={isDisplaySettingsOpen}
                            onClose={() => setIsDisplaySettingsOpen(false)}
                        />
                    )}

                    {/* MIDI Info */}
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-xl p-4 border border-zinc-200 dark:border-white/5 opacity-75">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
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
                    <button onClick={onClose} className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">Close</button>
                </div>
            </div>
        </div>
    );
}
