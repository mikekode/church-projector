import { useState, useEffect, useCallback, useRef } from 'react';

export type MidiAction = 'next' | 'prev' | 'clear' | 'black' | 'logo' | 'stage_toggle';

export interface MidiMapping {
    note: number;
    channel: number;
    action: MidiAction;
    type: 'note' | 'cc'; // Note On or Control Change
}

const DEFAULT_MAPPINGS: MidiMapping[] = [
    { note: 59, channel: 1, action: 'prev', type: 'note' }, // B2
    { note: 60, channel: 1, action: 'next', type: 'note' }, // Middle C
    { note: 62, channel: 1, action: 'clear', type: 'note' }, // D3
    { note: 64, channel: 1, action: 'stage_toggle', type: 'note' }, // E3
];

// Local Type Definitions for Web MIDI
interface MIDIAccess extends EventTarget {
    readonly inputs: Map<string, MIDIInput>;
    readonly outputs: Map<string, MIDIOutput>;
    onstatechange: ((event: any) => void) | null;
}

interface MIDIInput extends EventTarget {
    readonly id: string;
    readonly name?: string;
    readonly state: string;
    readonly type: "input";
    onmidimessage: ((event: any) => void) | null;
}

interface MIDIOutput extends EventTarget {
    send(data: Iterable<number>, timestamp?: number): void;
}

interface MIDIMessageEvent extends Event {
    readonly data: Uint8Array;
}

export function useMIDI(onAction: (action: MidiAction) => void) {
    const [isEnabled, setIsEnabled] = useState(false);
    const [inputs, setInputs] = useState<MIDIInput[]>([]);
    const [mappings, setMappings] = useState<MidiMapping[]>(DEFAULT_MAPPINGS);
    const [lastMsg, setLastMsg] = useState<{ note: number; channel: number; type: 'note' | 'cc', value: number } | null>(null);

    // Initialize MIDI
    useEffect(() => {
        if (!isEnabled) return;
        if (typeof navigator === 'undefined' || !(navigator as any).requestMIDIAccess) {
            console.warn("[MIDI] Web MIDI API not supported in this browser.");
            return;
        }

        let midiAccess: MIDIAccess | null = null;

        const onMIDIMessage = (event: any) => {
            const data = event.data;
            if (!data) return;

            const [status, note, velocity] = data;
            const command = status >> 4;
            const channel = (status & 0xf) + 1;

            // Note On (144) or Control Change (176)
            let type: 'note' | 'cc' | null = null;
            if (command === 0x9 && velocity > 0) type = 'note';
            if (command === 0xB) type = 'cc';

            if (!type) return;

            // Update debug info
            setLastMsg({ note, channel, type, value: velocity });

            // Check mappings
            const mapping = mappings.find(m =>
                m.note === note &&
                m.channel === channel &&
                m.type === type
            );

            if (mapping) {
                console.log(`[MIDI] Triggered: ${mapping.action}`);
                onAction(mapping.action);
            }
        };

        (navigator as any).requestMIDIAccess({ sysex: true }).then((access: MIDIAccess) => {
            midiAccess = access;

            // Get inputs
            const updateInputs = () => {
                const inputList: MIDIInput[] = [];
                access.inputs.forEach((input) => {
                    inputList.push(input);
                    input.onmidimessage = onMIDIMessage;
                });
                setInputs(inputList);
            };

            updateInputs();

            // Listen for connection changes
            access.onstatechange = (e: any) => {
                console.log("[MIDI] State Change:", e.port?.name, e.port?.state);
                updateInputs();
            };

        }).catch((err: any) => console.error("[MIDI] Access Failed:", err));

        return () => {
            if (midiAccess) {
                midiAccess.inputs.forEach(input => input.onmidimessage = null);
            }
        };
    }, [isEnabled, mappings, onAction]);

    return {
        isEnabled,
        setIsEnabled,
        inputs,
        mappings,
        setMappings,
        lastMsg
    };
}
