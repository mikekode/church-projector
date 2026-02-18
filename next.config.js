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
        // Exclude onnxruntime-node entirely (native Node bindings) — we use onnxruntime-web.
        // IgnorePlugin strips it from the bundle; resolve.alias replaces it with an empty
        // module so dynamic import() calls in @xenova/transformers resolve gracefully
        // instead of throwing at runtime (especially in Electron where `process` exists).
        config.plugins.push(
            new webpack.IgnorePlugin({ resourceRegExp: /^onnxruntime-node$/ })
        );
        config.resolve.alias = {
            ...config.resolve.alias,
            'onnxruntime-node': false,
        };

        // Ignore .node native binary files
        config.module.rules.push({
            test: /\.node$/,
            use: 'null-loader',
        });

        if (!isServer) {
            config.output.globalObject = 'self';
        }
        return config;
    },
    async redirects() {
        return [
            {
                source: '/download/windows',
                destination: 'https://github.com/mikekode/church-projector/releases/download/v2.1.29/Creenly.Setup.exe',
                permanent: false,
            },
            {
                source: '/download/mac',
                destination: 'https://github.com/mikekode/church-projector/releases/download/v2.1.29/Creenly-Setup-arm64.dmg',
                permanent: false,
            },
        ]
    }
}
