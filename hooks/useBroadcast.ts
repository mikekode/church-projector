
"use client";

import React, { useEffect, useState, useRef } from 'react';

export function useBroadcastChannel<T>(channelName: string, onMessage: (msg: T) => void) {
    const savedCallback = React.useRef(onMessage);

    useEffect(() => {
        savedCallback.current = onMessage;
    }, [onMessage]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const channel = new BroadcastChannel(channelName);

        channel.onmessage = (event) => {
            if (savedCallback.current) {
                savedCallback.current(event.data);
            }
        };

        return () => {
            channel.close();
        };
    }, [channelName]);

    const postMessage = (msg: T) => {
        const channel = new BroadcastChannel(channelName);
        channel.postMessage(msg);
        channel.close(); // Close after sending to avoid keeping multiple instances? 
        // Actually, creating a new one each time is fine for low frequency, 
        // but better to keep one open if we send often. 
        // For this helper, we'll just open-send-close for simplicity of the sender function.
    };

    return postMessage;
}
