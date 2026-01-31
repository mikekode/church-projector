// Creenly 2.0 - Optimized Deployment
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, ArrowRight, Zap, Shield, Mic, Monitor, Music, Clock, Users, Cloud, Star, Download, Laptop, LayoutGrid, Info, CheckCircle, ChevronRight } from 'lucide-react';

export default function Home() {
    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden">
            {/* Top Announcement */}
            <div className="bg-indigo-600 px-4 py-2 text-center text-xs font-bold tracking-widest uppercase animate-pulse">
                New: Creenly 2.1.1 "Growth" SEO Update is now live 🚀
            </div>

            {/* Navigation */}
            <nav className="sticky top-0 w-full z-[100] border-b border-white/5 bg-black/60 backdrop-blur-2xl">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-1 group cursor-pointer">
                        <img src="logo.png" alt="Creenly Logo" className="w-12 h-12 object-contain group-hover:rotate-12 transition-transform translate-y-[2px]" />
                        <span className="text-3xl font-black tracking-tighter leading-none">CREENLY</span>
                    </div>
                    <div className="hidden lg:flex items-center gap-10 text-sm font-bold text-zinc-400 uppercase tracking-widest">
                        <a href="#features" className="hover:text-white transition-colors">Features</a>
                        <a href="#comparison" className="hover:text-white transition-colors">Comparison</a>
                        <a href="/subscribe" className="hover:text-white transition-colors text-indigo-400 font-black">Get Pro</a>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="#download-section" className="px-6 py-3 rounded-full bg-white text-black text-sm font-black hover:bg-indigo-500 hover:text-white transition-all shadow-xl active:scale-95 flex items-center gap-2">
                            <Download size={16} />
                            DOWNLOAD
                        </a>
                    </div>
                </div>
            </nav>

            <main>
                {/* Hero Section */}
                <section className="relative pt-32 pb-40 px-6 overflow-hidden border-b border-white/5">
                    {/* Background Blobs */}
                    <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/10 blur-[150px] rounded-full -z-10" />
                    <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 blur-[150px] rounded-full -z-10" />

                    <div className="max-w-7xl mx-auto text-center space-y-12">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold tracking-widest uppercase mb-4">
                            Stop Stressing. Start Projecting.
                        </div>
                        <h1 className="text-7xl md:text-[140px] font-black tracking-tighter leading-[0.85] bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent italic">
                            PROJECTOR<br />WITHOUT<br />THE PREP.
                        </h1>
                        <div className="max-w-3xl mx-auto space-y-10">
                            <p className="text-xl md:text-2xl text-zinc-400 font-medium leading-relaxed">
                                ProPresenter is too complex. PowerPoint is too manual. <span className="text-white font-bold">Creenly is the only AI system</span> that listens to your Pastor and projects the right verse instantly. Finally, a worship tool that works as hard as you do.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-6 items-center justify-center">
                                <a href="#download-section" className="grow sm:grow-0 w-full sm:w-auto px-10 py-6 rounded-3xl bg-indigo-600 font-black text-xl hover:bg-indigo-500 transition-all shadow-[0_20px_50px_-12px_rgba(79,70,229,0.5)] flex items-center justify-center gap-3">
                                    <Monitor size={24} />
                                    Download for Windows
                                </a>
                                <a href="#download-section" className="grow sm:grow-0 w-full sm:w-auto px-10 py-6 rounded-3xl bg-zinc-900 border border-white/10 font-black text-xl hover:bg-zinc-800 transition-all flex items-center justify-center gap-3">
                                    <Laptop size={24} />
                                    Download for Mac
                                </a>
                            </div>

                            <div className="pt-8 flex justify-center items-center gap-8 opacity-40 hover:opacity-100 transition-opacity">
                                <div className="text-xs font-black tracking-widest uppercase text-zinc-500">Optimized For:</div>
                                <div className="font-bold text-sm tracking-tighter">GRACE COMMUNITY</div>
                                <div className="font-bold text-sm tracking-tighter">THE RIVER</div>
                                <div className="font-bold text-sm tracking-tighter italic">Lighthouse</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section id="features" className="max-w-7xl mx-auto px-6 py-32">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="p-10 rounded-[40px] bg-zinc-900/50 border border-white/5 space-y-6 hover:border-indigo-500/30 transition-all group">
                            <div className="w-14 h-14 bg-indigo-600/20 rounded-2xl flex items-center justify-center text-indigo-500 mb-6 group-hover:scale-110 transition-transform">
                                <Mic size={28} />
                            </div>
                            <h3 className="text-3xl font-black">Zero-Click AI</h3>
                            <p className="text-zinc-500 leading-relaxed font-medium">
                                Tired of missing cues? Our AI listens to the sermon and puts the scripture on screen automatically. Your volunteers can finally just enjoy the service.
                            </p>
                        </div>
                        <div className="p-10 rounded-[40px] bg-zinc-900/50 border border-white/5 space-y-6 hover:border-green-500/30 transition-all group">
                            <div className="w-14 h-14 bg-green-500/20 rounded-2xl flex items-center justify-center text-green-500 mb-6 group-hover:scale-110 transition-transform">
                                <Users size={28} />
                            </div>
                            <h3 className="text-3xl font-black">Volunteer-Proof</h3>
                            <p className="text-zinc-500 leading-relaxed font-medium">
                                If they can press an 'on' button, they can run Creenly. No steep learning curves, no complicated menus. Built for the tech-expert and the beginner.
                            </p>
                        </div>
                        <div className="p-10 rounded-[40px] bg-zinc-900/50 border border-white/5 space-y-6 hover:border-purple-500/30 transition-all group">
                            <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center text-purple-500 mb-6 group-hover:scale-110 transition-transform">
                                <Zap size={28} />
                            </div>
                            <h3 className="text-3xl font-black">Fast. Stable. Simple.</h3>
                            <p className="text-zinc-500 leading-relaxed font-medium">
                                Legacy software crashes when things get busy. Creenly is built on high-performance architecture that stays rock-solid even during 2-hour worship sets.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Comparison Table */}
                <section id="comparison" className="py-40 px-6 bg-zinc-950">
                    <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-24">
                            <h2 className="text-6xl font-black italic tracking-tighter mb-4">The Verdict.</h2>
                            <p className="text-zinc-500 uppercase tracking-[0.3em] text-xs font-black">Creenly vs the Legacy Giants</p>
                        </div>

                        <div className="bg-zinc-900/10 border border-white/5 rounded-[40px] overflow-hidden backdrop-blur-sm">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="py-8 px-8 text-[10px] font-black uppercase tracking-widest text-zinc-600">Feature</th>
                                        <th className="py-8 px-8 bg-indigo-600/10"><span className="text-xl font-black text-indigo-400">CREENLY</span></th>
                                        <th className="py-8 px-8 text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Legacy Pros</th>
                                        <th className="py-8 px-8 text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Small Alternatives</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { f: "AI Voice Tracking", a: true, b: false, c: false },
                                        { f: "Zero-Prep Scripture Search", a: true, b: "Manual", c: "Laggy" },
                                        { f: "Learning Curve", a: "Minutes", b: "Weeks", c: "Days" },
                                        { f: "Volunteer Satisfaction", a: "High", b: "Stressed", c: "Okay" },
                                        { f: "Monthly Cost", a: "$15", b: "$40+", c: "$20+" },
                                    ].map((row, i) => (
                                        <tr key={i} className="border-b border-white/5 group hover:bg-white/[0.01] transition-colors">
                                            <td className="py-8 px-8 text-sm font-bold text-zinc-400 group-hover:text-white transition-colors">{row.f}</td>
                                            <td className="py-8 px-8 bg-indigo-600/5 font-black text-white italic">
                                                {typeof row.a === 'boolean' ? (row.a ? <CheckCircle className="text-indigo-400" size={20} /> : "—") : row.a}
                                            </td>
                                            <td className="py-8 px-8 text-sm text-zinc-600 font-medium">
                                                {typeof row.b === 'boolean' ? (row.b ? <Check className="text-zinc-600 opacity-30" /> : "—") : row.b}
                                            </td>
                                            <td className="py-8 px-8 text-sm text-zinc-600 font-medium">
                                                {typeof row.c === 'boolean' ? (row.c ? <Check className="text-zinc-600 opacity-30" /> : "—") : row.c}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* Testimonials */}
                <section className="py-32 px-6">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-12">
                        {[
                            { q: "Creenly has completely transformed how our tech team operates. It's like having a pro volunteer in the booth for $15.", a: "Pastor Mike G.", c: "Grace Chapel", i: "pastor-mike.png" },
                            { q: "The AI verse detection is scarily accurate. Our congregation loves how fast we pull up scriptures.", a: "Sarah L.", c: "Creative Director", i: "sarah-creative.png" },
                        ].map((t, i) => (
                            <div key={i} className="flex-1 p-12 rounded-[40px] bg-zinc-900/30 border border-white/5 italic text-zinc-400 relative">
                                <div className="absolute top-8 left-8 text-6xl text-indigo-500/20 leading-none font-serif underline">"</div>
                                <p className="text-2xl mb-10 leading-relaxed relative z-10">"{t.q}"</p>
                                <div className="not-italic flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center overflow-hidden">
                                        <img src={t.i} alt={t.a} className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-white text-base">{t.a}</div>
                                        <div className="text-indigo-500 text-[10px] font-black uppercase tracking-widest">{t.c}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Download Section (ID targets) */}
                <section id="download-section" className="py-32 px-6 border-t border-white/5">
                    <div className="max-w-3xl mx-auto text-center space-y-12">
                        <h2 className="text-5xl font-black tracking-tighter italic">Ready to free your team?</h2>
                        <div className="flex flex-col sm:flex-row gap-6 justify-center">
                            <a href="/download/windows" className="px-10 py-5 rounded-2xl bg-indigo-600 font-black text-lg hover:bg-indigo-500 transition-all flex items-center justify-center gap-2">
                                <Monitor size={20} /> WINDOWS SETUP
                            </a>
                            <a href="/download/mac" className="px-10 py-5 rounded-2xl bg-zinc-900 border border-white/10 font-black text-lg hover:bg-zinc-800 transition-all flex items-center justify-center gap-2">
                                <Laptop size={20} /> APPLE MAC DMG
                            </a>
                        </div>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Version 2.1.1 • 100% Virus Free • Certified Build</p>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="py-60 px-6 text-center relative overflow-hidden bg-white/5">
                    <h2 className="text-6xl md:text-[160px] font-black tracking-tighter mb-12 bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-800 leading-[0.8] select-none opacity-5">
                        FAITH<br />AI
                    </h2>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <h2 className="text-6xl md:text-8xl font-black italic mb-12 tracking-tighter leading-none">
                            Take the <br /><span className="text-indigo-500">Stage.</span>
                        </h2>
                        <div className="flex justify-center flex-wrap gap-6">
                            <Link href="/subscribe" className="px-12 py-6 rounded-full bg-white text-black font-black text-xl hover:bg-zinc-200 transition-all shadow-2xl active:scale-95">
                                UNLOCK PRO VERSION
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="py-20 px-10 border-t border-white/5 bg-black">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
                    <div className="col-span-2">
                        <div className="flex items-center gap-1 mb-6">
                            <img src="logo.png" alt="Creenly Logo" className="w-10 h-10 object-contain translate-y-[1px]" />
                            <span className="text-2xl font-black tracking-tighter leading-none">CREENLY</span>
                        </div>
                        <p className="text-zinc-500 text-sm max-w-sm mb-6 font-medium">
                            Next-generation worship software designed for the modern sanctuary.
                            Built so you can focus on the Spirit, not the software.
                        </p>
                    </div>
                    <div>
                        <h5 className="font-black text-xs uppercase tracking-widest mb-6 text-white leading-none">Product</h5>
                        <ul className="space-y-4 text-sm text-zinc-500 font-medium">
                            <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                            <li><a href="#download-section" className="hover:text-white transition-colors">Download</a></li>
                            <li><Link href="/subscribe" className="hover:text-white transition-colors text-indigo-400">Upgrade to Pro</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h5 className="font-black text-xs uppercase tracking-widest mb-6 text-white leading-none">Support</h5>
                        <ul className="space-y-4 text-sm text-zinc-500 font-medium">
                            <li><Link href="/docs" className="hover:text-white transition-colors italic">Documentation</Link></li>
                            <li>Terms of Service</li>
                            <li>Privacy Policy</li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto mt-20 pt-10 border-t border-white/5 flex justify-between items-center flex-wrap gap-4">
                    <p className="text-xs text-zinc-700 font-bold tracking-widest uppercase">&copy; {new Date().getFullYear()} Creenly Systems. All Glory to God.</p>
                </div>
            </footer>
        </div>
    );
}
