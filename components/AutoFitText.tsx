"use client";

import { useRef, useEffect, useState, CSSProperties, ReactNode } from 'react';

type AutoFitTextProps = {
    children: ReactNode;
    minFontSize?: number;      // Minimum font size in pixels (default: 16)
    maxFontSize?: number;      // Maximum font size in pixels (default: 120)
    style?: CSSProperties;     // Additional styles to apply
    className?: string;        // Additional classes
    padding?: number;          // Padding to account for (default: 40)
};

/**
 * AutoFitText - Automatically scales text to fit container
 *
 * Uses binary search to find the optimal font size that makes
 * the text fit within its container without overflow.
 */
export default function AutoFitText({
    children,
    minFontSize = 16,
    maxFontSize = 120,
    style = {},
    className = '',
    padding = 40
}: AutoFitTextProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const [fontSize, setFontSize] = useState(maxFontSize);
    const [isCalculating, setIsCalculating] = useState(true);

    useEffect(() => {
        const calculateFontSize = () => {
            const container = containerRef.current;
            const text = textRef.current;

            if (!container || !text) return;

            // Get container dimensions (accounting for padding)
            const containerWidth = container.clientWidth - padding * 2;
            const containerHeight = container.clientHeight - padding * 2;

            if (containerWidth <= 0 || containerHeight <= 0) return;

            // Binary search for optimal font size
            let low = minFontSize;
            let high = maxFontSize;
            let optimalSize = minFontSize;

            // Temporarily make text visible for measurement
            text.style.visibility = 'hidden';
            text.style.position = 'absolute';
            text.style.whiteSpace = 'pre-wrap';
            text.style.wordWrap = 'break-word';
            text.style.width = `${containerWidth}px`;

            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                text.style.fontSize = `${mid}px`;

                // Check if text fits
                const textHeight = text.scrollHeight;
                const textWidth = text.scrollWidth;

                if (textHeight <= containerHeight && textWidth <= containerWidth) {
                    optimalSize = mid;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }

            // Reset positioning
            text.style.visibility = 'visible';
            text.style.position = 'relative';
            text.style.width = '100%';

            setFontSize(optimalSize);
            setIsCalculating(false);
        };

        // Initial calculation
        calculateFontSize();

        // Recalculate on resize
        const resizeObserver = new ResizeObserver(() => {
            setIsCalculating(true);
            calculateFontSize();
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, [children, minFontSize, maxFontSize, padding]);

    // Also recalculate when children change
    useEffect(() => {
        setIsCalculating(true);
        const timer = setTimeout(() => {
            const container = containerRef.current;
            const text = textRef.current;

            if (!container || !text) return;

            const containerWidth = container.clientWidth - padding * 2;
            const containerHeight = container.clientHeight - padding * 2;

            if (containerWidth <= 0 || containerHeight <= 0) return;

            let low = minFontSize;
            let high = maxFontSize;
            let optimalSize = minFontSize;

            text.style.visibility = 'hidden';
            text.style.position = 'absolute';
            text.style.width = `${containerWidth}px`;

            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                text.style.fontSize = `${mid}px`;

                if (text.scrollHeight <= containerHeight && text.scrollWidth <= containerWidth) {
                    optimalSize = mid;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }

            text.style.visibility = 'visible';
            text.style.position = 'relative';
            text.style.width = '100%';

            setFontSize(optimalSize);
            setIsCalculating(false);
        }, 50);

        return () => clearTimeout(timer);
    }, [children, minFontSize, maxFontSize, padding]);

    return (
        <div
            ref={containerRef}
            className={`w-full h-full overflow-hidden ${className}`}
            style={{ padding: `${padding}px` }}
        >
            <div
                ref={textRef}
                style={{
                    ...style,
                    fontSize: `${fontSize}px`,
                    opacity: isCalculating ? 0 : 1,
                    transition: 'opacity 0.2s ease-in-out, font-size 0.3s ease-out',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    width: '100%'
                }}
            >
                {children}
            </div>
        </div>
    );
}

/**
 * Hook version for more control
 */
export function useAutoFitFontSize(
    containerRef: React.RefObject<HTMLElement>,
    textContent: string,
    options: { min?: number; max?: number; padding?: number } = {}
): number {
    const { min = 16, max = 120, padding = 40 } = options;
    const [fontSize, setFontSize] = useState(max);

    useEffect(() => {
        const calculate = () => {
            const container = containerRef.current;
            if (!container || !textContent) return;

            const containerWidth = container.clientWidth - padding * 2;
            const containerHeight = container.clientHeight - padding * 2;

            if (containerWidth <= 0 || containerHeight <= 0) return;

            // Create temporary element for measurement
            const temp = document.createElement('div');
            temp.style.cssText = `
                position: absolute;
                visibility: hidden;
                white-space: pre-wrap;
                word-wrap: break-word;
                width: ${containerWidth}px;
                font-family: inherit;
                line-height: 1.2;
            `;
            temp.textContent = textContent;
            document.body.appendChild(temp);

            // Binary search
            let low = min;
            let high = max;
            let optimal = min;

            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                temp.style.fontSize = `${mid}px`;

                if (temp.scrollHeight <= containerHeight) {
                    optimal = mid;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }

            document.body.removeChild(temp);
            setFontSize(optimal);
        };

        calculate();

        const resizeObserver = new ResizeObserver(calculate);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, [containerRef, textContent, min, max, padding]);

    return fontSize;
}
