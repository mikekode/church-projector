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
    async redirects() {
        return [
            {
                source: '/download/windows',
                destination: 'https://github.com/mikekode/church-projector/releases/download/v2.0.9/Creenly-Setup-2.0.9.exe',
                permanent: false,
            },
            {
                source: '/download/mac',
                destination: 'https://github.com/mikekode/church-projector/releases/download/v2.0.9/Creenly-2.0.9-arm64.dmg',
                permanent: false,
            },
        ]
    }
}
