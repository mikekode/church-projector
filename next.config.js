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
                destination: 'https://github.com/mikekode/church-projector/releases/download/untagged-a09de5605ee65864410a/Creenly-Setup-2.1.6.exe',
                permanent: false,
            },
            {
                source: '/download/mac',
                destination: 'https://github.com/mikekode/church-projector/releases/download/untagged-a09de5605ee65864410a/Creenly-2.1.6-arm64.dmg',
                permanent: false,
            },
        ]
    }
}
