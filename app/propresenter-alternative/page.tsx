'use client';
import Link from 'next/link';
import { Check, X, ArrowRight, Monitor, Laptop, Mic, Users, Zap, DollarSign, WifiOff } from 'lucide-react';

export default function ProPresenterAlternativePage() {
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
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold tracking-widest uppercase mb-8">
                        ProPresenter Alternative
                    </div>
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter mb-8 leading-tight">
                        Looking for a <span className="text-indigo-500">ProPresenter Alternative</span>?
                    </h1>
                    <p className="text-xl text-zinc-400 max-w-3xl mx-auto mb-12 leading-relaxed">
                        ProPresenter is powerful but expensive and complex. <strong className="text-white">Creenly</strong> gives you AI-powered worship presentation that works <strong className="text-white">even without internet</strong> — for a fraction of the cost, with a learning curve measured in minutes, not weeks.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/#download-section" className="px-8 py-4 rounded-2xl bg-indigo-600 font-bold text-lg hover:bg-indigo-500 transition-all flex items-center justify-center gap-2">
                            <Monitor size={20} /> Download for Windows
                        </Link>
                        <Link href="/#download-section" className="px-8 py-4 rounded-2xl bg-zinc-900 border border-white/10 font-bold text-lg hover:bg-zinc-800 transition-all flex items-center justify-center gap-2">
                            <Laptop size={20} /> Download for Mac
                        </Link>
                    </div>
                </section>

                {/* Comparison Table */}
                <section className="mb-24">
                    <h2 className="text-3xl font-black text-center mb-12">Creenly vs ProPresenter Comparison</h2>
                    <div className="bg-zinc-900/50 border border-white/10 rounded-3xl overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="py-6 px-6 text-left text-sm font-bold text-zinc-500 uppercase tracking-wider">Feature</th>
                                    <th className="py-6 px-6 text-center bg-indigo-500/10">
                                        <span className="text-indigo-400 font-black">Creenly</span>
                                    </th>
                                    <th className="py-6 px-6 text-center text-zinc-500 font-bold">ProPresenter</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { feature: 'AI Voice Recognition', creenly: true, propresenter: false },
                                    { feature: 'Works Offline', creenly: true, propresenter: false },
                                    { feature: 'Semantic Bible Search', creenly: true, propresenter: false },
                                    { feature: 'Auto Bible Verse Detection', creenly: true, propresenter: false },
                                    { feature: 'Learning Curve', creenly: '5 minutes', propresenter: '2-4 weeks' },
                                    { feature: 'Monthly Price', creenly: '$15', propresenter: '$40+' },
                                    { feature: 'Windows Support', creenly: true, propresenter: true },
                                    { feature: 'Mac Support', creenly: true, propresenter: true },
                                    { feature: 'MIDI Integration', creenly: true, propresenter: true },
                                    { feature: 'ATEM Integration', creenly: true, propresenter: true },
                                    { feature: 'Multiple Bible Versions', creenly: '15+', propresenter: '10+' },
                                    { feature: 'Cloud Song Library', creenly: true, propresenter: true },
                                    { feature: 'Volunteer Friendly', creenly: true, propresenter: false },
                                ].map((row, i) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                                        <td className="py-5 px-6 text-sm text-zinc-300">{row.feature}</td>
                                        <td className="py-5 px-6 text-center bg-indigo-500/5">
                                            {typeof row.creenly === 'boolean' ? (
                                                row.creenly ? <Check className="text-green-400 mx-auto" size={20} /> : <X className="text-red-400 mx-auto" size={20} />
                                            ) : (
                                                <span className="font-bold text-white">{row.creenly}</span>
                                            )}
                                        </td>
                                        <td className="py-5 px-6 text-center">
                                            {typeof row.propresenter === 'boolean' ? (
                                                row.propresenter ? <Check className="text-zinc-500 mx-auto" size={20} /> : <X className="text-zinc-600 mx-auto" size={20} />
                                            ) : (
                                                <span className="text-zinc-400">{row.propresenter}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Why Switch */}
                <section className="mb-24">
                    <h2 className="text-3xl font-black text-center mb-12">Why Churches Switch from ProPresenter to Creenly</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: <DollarSign size={28} />,
                                title: 'Save $300+/Year',
                                desc: 'Creenly costs $15/month vs ProPresenter\'s $40+. That\'s over $300 saved annually for your church.'
                            },
                            {
                                icon: <Users size={28} />,
                                title: 'Train Volunteers in Minutes',
                                desc: 'No more weeks of training. Creenly\'s AI handles the hard part - volunteers just press play.'
                            },
                            {
                                icon: <Mic size={28} />,
                                title: 'AI Does the Work',
                                desc: 'Our AI listens to your pastor and projects verses automatically. No more missed cues or frantic searching.'
                            },
                            {
                                icon: <WifiOff size={28} />,
                                title: 'Works Without Internet',
                                desc: 'On-device Whisper AI, cached Bible verses, and semantic search all run locally. ProPresenter can\'t do that.'
                            },
                        ].map((item, i) => (
                            <div key={i} className="p-8 rounded-3xl bg-zinc-900/50 border border-white/5">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6">
                                    {item.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                                <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* CTA */}
                <section className="text-center py-20 px-8 rounded-[40px] bg-gradient-to-b from-indigo-500/10 to-transparent border border-indigo-500/20">
                    <h2 className="text-4xl font-black mb-6">Ready to Make the Switch?</h2>
                    <p className="text-zinc-400 mb-10 max-w-xl mx-auto">
                        Download Creenly free and see why hundreds of churches have switched from ProPresenter.
                    </p>
                    <Link href="/#download-section" className="inline-flex items-center gap-2 px-10 py-5 rounded-2xl bg-indigo-600 font-black text-lg hover:bg-indigo-500 transition-all">
                        Download Free <ArrowRight size={20} />
                    </Link>
                </section>
            </main>

            {/* Footer */}
            <footer className="py-10 border-t border-white/5 text-center">
                <p className="text-xs text-zinc-600">&copy; {new Date().getFullYear()} Creenly. The best ProPresenter alternative for churches.</p>
            </footer>
        </div>
    );
}
