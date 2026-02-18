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
