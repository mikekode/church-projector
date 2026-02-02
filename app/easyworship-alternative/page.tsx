'use client';
import Link from 'next/link';
import { Check, X, ArrowRight, Monitor, Laptop, Mic, Zap, Shield } from 'lucide-react';

export default function EasyWorshipAlternativePage() {
    return (
        <div className="min-h-screen bg-black text-white font-sans">
            {/* Nav */}
            <nav className="sticky top-0 w-full z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-1">
                        <img src="/logo.png" alt="Creenly Logo" className="w-10 h-10 object-contain" />
                        <span className="text-xl font-black tracking-tighter">CREENLY</span>
                    </Link>
                    <Link href="/#download-section" className="px-6 py-2 rounded-full bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-500 transition-all">
                        Download Free
                    </Link>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-6 py-20">
                {/* Hero */}
                <section className="text-center mb-24">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-widest uppercase mb-8">
                        EasyWorship Alternative
                    </div>
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter mb-8 leading-tight">
                        The Smarter <span className="text-emerald-500">EasyWorship Alternative</span>
                    </h1>
                    <p className="text-xl text-zinc-400 max-w-3xl mx-auto mb-12 leading-relaxed">
                        EasyWorship is easy, but <strong className="text-white">Creenly is smarter</strong>. Our AI listens to your pastor and projects Bible verses automatically. No more manual searching during sermons.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/#download-section" className="px-8 py-4 rounded-2xl bg-emerald-600 font-bold text-lg hover:bg-emerald-500 transition-all flex items-center justify-center gap-2">
                            <Monitor size={20} /> Download for Windows
                        </Link>
                        <Link href="/#download-section" className="px-8 py-4 rounded-2xl bg-zinc-900 border border-white/10 font-bold text-lg hover:bg-zinc-800 transition-all flex items-center justify-center gap-2">
                            <Laptop size={20} /> Download for Mac
                        </Link>
                    </div>
                </section>

                {/* Comparison Table */}
                <section className="mb-24">
                    <h2 className="text-3xl font-black text-center mb-12">Creenly vs EasyWorship Comparison</h2>
                    <div className="bg-zinc-900/50 border border-white/10 rounded-3xl overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="py-6 px-6 text-left text-sm font-bold text-zinc-500 uppercase tracking-wider">Feature</th>
                                    <th className="py-6 px-6 text-center bg-emerald-500/10">
                                        <span className="text-emerald-400 font-black">Creenly</span>
                                    </th>
                                    <th className="py-6 px-6 text-center text-zinc-500 font-bold">EasyWorship</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { feature: 'AI Voice Recognition', creenly: true, easyworship: false },
                                    { feature: 'Auto Bible Verse Detection', creenly: true, easyworship: false },
                                    { feature: 'Monthly Price', creenly: '$15', easyworship: '$20+' },
                                    { feature: 'Mac Support', creenly: true, easyworship: false },
                                    { feature: 'Windows Support', creenly: true, easyworship: true },
                                    { feature: 'Modern UI', creenly: true, easyworship: 'Dated' },
                                    { feature: 'MIDI Integration', creenly: true, easyworship: true },
                                    { feature: 'ATEM Integration', creenly: true, easyworship: false },
                                    { feature: 'Multiple Bible Versions', creenly: '15+', easyworship: '10+' },
                                    { feature: 'Zero-Click Operation', creenly: true, easyworship: false },
                                ].map((row, i) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                                        <td className="py-5 px-6 text-sm text-zinc-300">{row.feature}</td>
                                        <td className="py-5 px-6 text-center bg-emerald-500/5">
                                            {typeof row.creenly === 'boolean' ? (
                                                row.creenly ? <Check className="text-green-400 mx-auto" size={20} /> : <X className="text-red-400 mx-auto" size={20} />
                                            ) : (
                                                <span className="font-bold text-white">{row.creenly}</span>
                                            )}
                                        </td>
                                        <td className="py-5 px-6 text-center">
                                            {typeof row.easyworship === 'boolean' ? (
                                                row.easyworship ? <Check className="text-zinc-500 mx-auto" size={20} /> : <X className="text-zinc-600 mx-auto" size={20} />
                                            ) : (
                                                <span className="text-zinc-400">{row.easyworship}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Benefits */}
                <section className="mb-24">
                    <h2 className="text-3xl font-black text-center mb-12">Why Creenly Beats EasyWorship</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: <Mic size={28} />,
                                title: 'AI-Powered',
                                desc: 'While EasyWorship requires manual searching, Creenly\'s AI listens and projects verses automatically during the sermon.'
                            },
                            {
                                icon: <Laptop size={28} />,
                                title: 'Works on Mac',
                                desc: 'EasyWorship is Windows-only. Creenly works beautifully on both Mac and Windows, giving your team flexibility.'
                            },
                            {
                                icon: <Zap size={28} />,
                                title: 'Modern & Fast',
                                desc: 'Built with modern technology, Creenly is faster, more stable, and has a cleaner interface than EasyWorship.'
                            },
                        ].map((item, i) => (
                            <div key={i} className="p-8 rounded-3xl bg-zinc-900/50 border border-white/5">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6">
                                    {item.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                                <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* CTA */}
                <section className="text-center py-20 px-8 rounded-[40px] bg-gradient-to-b from-emerald-500/10 to-transparent border border-emerald-500/20">
                    <h2 className="text-4xl font-black mb-6">Upgrade from EasyWorship Today</h2>
                    <p className="text-zinc-400 mb-10 max-w-xl mx-auto">
                        Experience the future of church presentation. AI-powered, cross-platform, and volunteer-friendly.
                    </p>
                    <Link href="/#download-section" className="inline-flex items-center gap-2 px-10 py-5 rounded-2xl bg-emerald-600 font-black text-lg hover:bg-emerald-500 transition-all">
                        Download Free <ArrowRight size={20} />
                    </Link>
                </section>
            </main>

            {/* Footer */}
            <footer className="py-10 border-t border-white/5 text-center">
                <p className="text-xs text-zinc-600">&copy; {new Date().getFullYear()} Creenly. The smarter EasyWorship alternative.</p>
            </footer>
        </div>
    );
}
