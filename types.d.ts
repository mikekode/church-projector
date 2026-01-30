// Web MIDI API Types
declare namespace WebMidi {
    interface MIDIAccess extends EventTarget {
        readonly inputs: MIDIInputMap;
        readonly outputs: MIDIOutputMap;
        readonly sysexEnabled: boolean;
        onstatechange: ((event: MIDIConnectionEvent) => void) | null;
    }

    interface MIDIInputMap extends Map<string, MIDIInput> { }
    interface MIDIOutputMap extends Map<string, MIDIOutput> { }

    interface MIDIPort extends EventTarget {
        readonly id: string;
        readonly manufacturer?: string;
        readonly name?: string;
        readonly type: "input" | "output";
        readonly version?: string;
        readonly state: "disconnected" | "connected";
        readonly connection: "open" | "closed" | "pending";
        onstatechange: ((event: MIDIConnectionEvent) => void) | null;
        open(): Promise<MIDIPort>;
        close(): Promise<MIDIPort>;
    }

    interface MIDIInput extends MIDIPort {
        onmidimessage: ((event: MIDIMessageEvent) => void) | null;
    }

    interface MIDIOutput extends MIDIPort {
        send(data: Iterable<number>, timestamp?: number): void;
        clear(): void;
    }

    interface MIDIMessageEvent extends Event {
        readonly data: Uint8Array;
    }

    interface MIDIConnectionEvent extends Event {
        readonly port: MIDIPort;
    }
}

interface Navigator {
    requestMIDIAccess(options?: { sysex: boolean }): Promise<WebMidi.MIDIAccess>;
}
