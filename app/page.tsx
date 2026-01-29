import Link from 'next/link';

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-neutral-950 text-white">
            <h1 className="text-4xl font-bold mb-12 text-center">
                Church Projector <span className="text-blue-500">Hub</span>
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
                {/* Operator Card */}
                <Link href="/dashboard" className="group relative block p-8 border border-neutral-800 rounded-2xl bg-neutral-900 hover:border-blue-500 transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                    <h2 className="text-2xl font-bold mb-2 group-hover:text-blue-400">Operator Dashboard &rarr;</h2>
                    <p className="text-neutral-400">
                        The control center. Use this screen to detect speech, manage verses, and control what shows on screen.
                    </p>
                    <div className="mt-4 inline-block px-3 py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs font-mono">
                        OPEN ON LAPTOP
                    </div>
                </Link>

                {/* Projector Card */}
                <Link href="/projector" className="group relative block p-8 border border-neutral-800 rounded-2xl bg-neutral-900 hover:border-purple-500 transition-all hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                    <h2 className="text-2xl font-bold mb-2 group-hover:text-purple-400">Projector View &rarr;</h2>
                    <p className="text-neutral-400">
                        The public display. Drag this window to the projector screen and make it fullscreen.
                    </p>
                    <div className="mt-4 inline-block px-3 py-1 bg-purple-900/30 text-purple-400 rounded-full text-xs font-mono">
                        OPEN ON PROJECTOR
                    </div>
                </Link>
            </div>
        </main>
    );
}
