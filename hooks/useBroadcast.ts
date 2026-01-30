"use client";

import React, { useEffect, useCallback, useRef } from 'react';

export function useBroadcastChannel<T>(channelName: string, onMessage?: (msg: T) => void) {
    // Internal channel for implicit listener (if onMessage provided)
    useEffect(() => {
        if (typeof window === 'undefined' || !onMessage) return;

        const channel = new BroadcastChannel(channelName);
        const handler = (event: MessageEvent) => onMessage(event.data);
        channel.addEventListener('message', handler);

        return () => {
            channel.removeEventListener('message', handler);
            channel.close();
        };
    }, [channelName, onMessage]);

    const broadcast = useCallback((msg: T) => {
        if (typeof window === 'undefined') return;
        const channel = new BroadcastChannel(channelName);
        channel.postMessage(msg);
        channel.close();
    }, [channelName]);

    const subscribe = useCallback((callback: (msg: T) => void) => {
        if (typeof window === 'undefined') return () => { };

        const channel = new BroadcastChannel(channelName);
        const handler = (event: MessageEvent) => callback(event.data);
        channel.addEventListener('message', handler);

        return () => {
            channel.removeEventListener('message', handler);
            channel.close();
        };
    }, [channelName]);

    return { broadcast, subscribe };
}
