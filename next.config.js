module.exports = {
    // output: 'export', // Removed to allow API routes on Vercel
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
                destination: 'https://github.com/mikekode/church-projector/releases/download/v2.0.3/Church-Projector-Setup-2.0.3.exe',
                permanent: false,
            },
            {
                source: '/download/mac',
                destination: 'https://github.com/mikekode/church-projector/releases/download/v2.0.3/Church-Projector-2.0.3.dmg',
                permanent: false,
            },
        ]
    }
}
