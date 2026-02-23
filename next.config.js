const webpack = require('webpack');

module.exports = {
    output: process.env.VERCEL ? undefined : 'export',
    assetPrefix: process.env.VERCEL ? undefined : './',
    trailingSlash: false,
    images: {
        unoptimized: true
    },
    typescript: {
        ignoreBuildErrors: true
    },
    eslint: {
        ignoreDuringBuilds: true
    },
    webpack: (config, { isServer }) => {
        // Replace onnxruntime-node (native Node bindings) with an empty module.
        // @xenova/transformers tries to import it when `process` exists (Electron),
        // but we only use onnxruntime-web. resolve.alias: false provides an empty
        // module so the import resolves gracefully and the library falls back.
        // NOTE: Do NOT combine with IgnorePlugin — it strips the import entirely,
        // causing an uncaught "Cannot find module" error at runtime.
        config.resolve.alias = {
            ...config.resolve.alias,
            'onnxruntime-node': false,
        };

        // Ignore .node native binary files
        config.module.rules.push({
            test: /\.node$/,
            use: 'null-loader',
        });

        // Polyfill window=self for Web Workers. @xenova/transformers and
        // onnxruntime-web reference `window` at module init, but Workers
        // only have `self`. BannerPlugin injects this at the very top of
        // every output file — before any webpack runtime or module code.
        // Safe everywhere: browser (window exists → no-op), server (no self → no-op).
        config.plugins.push(
            new webpack.BannerPlugin({
                banner: 'if(typeof window==="undefined"&&typeof self!=="undefined"){self.window=self;}',
                raw: true,
                test: /\.js$/,
            })
        );

        if (!isServer) {
            config.output.globalObject = 'self';
        }
        return config;
    },
    async redirects() {
        if (process.env.NEXT_EXPORT || !process.env.VERCEL) return [];
        return [
            {
                source: '/download/windows',
                destination: 'https://github.com/mikekode/church-projector/releases/download/v2.1.30/Creenly.Setup.exe',
                permanent: false,
            },
            {
                source: '/download/mac',
                destination: 'https://github.com/mikekode/church-projector/releases/download/v2.1.30/Creenly-Setup-arm64.dmg',
                permanent: false,
            },
        ]
    }
}
