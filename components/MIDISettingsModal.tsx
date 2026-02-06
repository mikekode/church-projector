"use client";

import { useState, useEffect } from 'react';
import { X, Music, Radio, Save, RotateCcw, Server, Monitor, AlertCircle, CheckCircle } from 'lucide-react';
import { useMIDI, MidiMapping, MidiAction } from '@/hooks/useMIDI';



interface MIDISettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    midi: ReturnType<typeof useMIDI>;
}

export default function MIDISettingsModal({ isOpen, onClose, midi }: MIDISettingsModalProps) {
    // Tab State
    const [activeTab, setActiveTab] = useState<'midi' | 'hardware'>('midi');

    // MIDI State
    const { isEnabled, setIsEnabled, inputs, mappings, setMappings, lastMsg } = midi;

    // Hardware (ATEM) State
    const [atemIp, setAtemIp] = useState('192.168.1.10');
    const [atemStatus, setAtemStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [statusMessage, setStatusMessage] = useState('');

    // Hardware Effects
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

    const handleLearn = (action: MidiAction) => {
        // Simple "Learn Mode" - could be enhanced
        if (lastMsg) {
            const newMapping: MidiMapping = {
                note: lastMsg.note,
                channel: lastMsg.channel,
                type: lastMsg.type,
                action
            };
            // Remove existing for this action
            const filtered = mappings.filter(m => m.action !== action);
            setMappings([...filtered, newMapping]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-zinc-900 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                            <Server className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">System Settings</h2>
                            <p className="text-xs text-zinc-400">Configure Hardware & Controllers</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/5 bg-zinc-950/30 flex-shrink-0">
                    <button
                        onClick={() => setActiveTab('midi')}
                        className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'midi' ? 'border-purple-500 text-purple-400 bg-purple-500/5' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
                    >
                        MIDI Control
                    </button>
                    <button
                        onClick={() => setActiveTab('hardware')}
                        className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'hardware' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
                    >
                        Hardware Integration
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {activeTab === 'midi' && (
                        <div className="animate-in fade-in slide-in-from-left-4 duration-200">
                            {/* Toggle Switch */}
                            <div className="flex items-center justify-between mb-8 p-4 bg-zinc-800 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <Radio className={`w-5 h-5 ${isEnabled ? 'text-green-400 animate-pulse' : 'text-zinc-500'}`} />
                                    <span className="font-medium">Enable MIDI Input</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={isEnabled}
                                        onChange={(e) => setIsEnabled(e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                </label>
                            </div>

                            {/* Device Status */}
                            <div className="mb-8">
                                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">Connected Devices</h3>
                                {inputs.length === 0 ? (
                                    <div className="text-zinc-500 italic text-sm">No MIDI devices detected. Plug one in to start.</div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {inputs.map(input => (
                                            <span key={input.id} className="px-3 py-1 bg-green-900/30 text-green-400 border border-green-500/30 rounded-full text-sm flex items-center gap-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                {input.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Last Received Signal (Debugger) */}
                            <div className="mb-8 p-4 bg-zinc-950 rounded-lg border border-zinc-800 font-mono text-sm">
                                <div className="text-zinc-500 mb-1 text-xs uppercase">Last Received Signal</div>
                                {lastMsg ? (
                                    <div className="flex gap-4 text-purple-400">
                                        <span>Note: {lastMsg.note}</span>
                                        <span>Channel: {lastMsg.channel}</span>
                                        <span>Type: {lastMsg.type.toUpperCase()}</span>
                                        <span>Value: {lastMsg.value}</span>
                                    </div>
                                ) : (
                                    <span className="text-zinc-600">Waiting for input...</span>
                                )}
                            </div>

                            {/* Mappings */}
                            <div>
                                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Command Mappings</h3>
                                <div className="grid gap-3">
                                    {[
                                        { id: 'next', label: 'Next Slide / Verse' },
                                        { id: 'prev', label: 'Previous Slide / Verse' },
                                        { id: 'clear', label: 'Clear Screen' },
                                        { id: 'black', label: 'Blackout' },
                                    ].map((cmd) => {
                                        const map = mappings.find(m => m.action === cmd.id);
                                        return (
                                            <div key={cmd.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-white/5">
                                                <span className="font-medium text-zinc-300">{cmd.label}</span>
                                                <div className="flex items-center gap-3">
                                                    {map ? (
                                                        <span className="px-2 py-1 bg-zinc-700 rounded text-xs font-mono text-zinc-300">
                                                            Ch:{map.channel} | {map.type === 'note' ? 'Note' : 'CC'}:{map.note}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-zinc-600 italic">Unmapped</span>
                                                    )}
                                                    <button
                                                        onClick={() => handleLearn(cmd.id as MidiAction)}
                                                        disabled={!lastMsg}
                                                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:bg-zinc-700 rounded text-xs font-bold transition-colors"
                                                    >
                                                        Assign Last Signal
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="mt-8 text-right">
                                <button
                                    onClick={() => setMappings([])}
                                    className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                                >
                                    Reset All Mappings
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'hardware' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-200 space-y-6">
                            {/* ATEM Section */}
                            <div className="bg-zinc-950/50 rounded-xl p-6 border border-white/5">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-bold text-zinc-300 flex items-center gap-2">
                                        <Monitor size={18} className="text-indigo-500" /> ATEM Switcher
                                    </h4>
                                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${atemStatus === 'connected' ? 'bg-green-500/20 text-green-400' :
                                        atemStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-zinc-800 text-zinc-500'
                                        }`}>
                                        {atemStatus}
                                    </div>
                                </div>

                                <p className="text-xs text-zinc-500 mb-4">
                                    Connect to Blackmagic ATEM switchers to automatically switch scenes when content changes.
                                </p>

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
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-white/10 bg-zinc-900 text-right flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white text-black font-bold rounded-lg hover:scale-105 transition-transform"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
