module.exports = {
    output: process.env.VERCEL ? undefined : 'export', // Enable static export for Electron, disable for Vercel
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
                destination: 'https://github.com/mikekode/church-projector/releases/download/v2.0.4/Church-Projector-AI-Setup-2.0.4.exe',
                permanent: false,
            },
            {
                source: '/download/mac',
                destination: 'https://github.com/mikekode/church-projector/releases/download/v2.0.4/Church-Projector-AI-2.0.4-arm64.dmg',
                permanent: false,
            },
        ]
    }
}
