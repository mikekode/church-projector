"use client";

import { useEffect, useRef } from 'react';

interface LiveFeedStreamProps {
    sourceId: string;
    className?: string;
    style?: React.CSSProperties;
    muted?: boolean;
}

/**
 * Shared component to render a live desktop capture stream
 */
export default function LiveFeedStream({ sourceId, className, style, muted = true }: LiveFeedStreamProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        let stream: MediaStream | null = null;

        const startStream = async () => {
            try {
                // Ensure electronAPI is available
                if (!(window as any).navigator?.mediaDevices?.getUserMedia) {
                    console.error("[LiveFeed] getUserMedia not supported");
                    return;
                }

                stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: sourceId,
                            minWidth: 1280,
                            maxWidth: 1920,
                            minHeight: 720,
                            maxHeight: 1080,
                            maxFrameRate: 60
                        }
                    }
                } as any);

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("[LiveFeed] Error starting stream:", err);
            }
        };

        if (sourceId) {
            startStream();
        }

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [sourceId]);

    return (
        <video
            ref={videoRef}
            className={className}
            style={style}
            autoPlay
            playsInline
            muted={muted}
        />
    );
}
