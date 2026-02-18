// Polyfill `window` for libraries that expect a browser environment.
// Web Workers only have `self` / `globalThis` — @xenova/transformers
// and onnxruntime-web reference `window` at module init time.
if (typeof window === 'undefined') {
    (self as any).window = self;
}
