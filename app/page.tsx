// Creenly 2.0 - Optimized Deployment
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, ArrowRight, Zap, Shield, Mic, Monitor, Music, Clock, Users, Cloud, Star, Download, Laptop, LayoutGrid, Info } from 'lucide-react';

export default function Home() {
    const [showComingSoon, setShowComingSoon] = useState(false);

    const handleDownloadClick = (e: React.MouseEvent) => {
        e.preventDefault();




        return (
            <div className="min-h-screen bg-black text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden">
                {/* Top Announcement */}
                <div className="bg-indigo-600 px-4 py-2 text-center text-xs font-bold tracking-widest uppercase animate-pulse">
                    New: AI Voice Detection 2.0 is now live for Windows & Mac
                </div>

                {/* Navigation */}
                <nav className="sticky top-0 w-full z-[100] border-b border-white/5 bg-black/60 backdrop-blur-2xl">
                    <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                        <div className="flex items-center gap-1 group cursor-pointer">
                            <img src="/logo.png" alt="Creenly Logo" className="w-12 h-12 object-contain group-hover:rotate-12 transition-transform translate-y-[2px]" />
                            <span className="text-3xl font-black tracking-tighter leading-none">CREENLY</span>
                        </div>
                        <div className="hidden lg:flex items-center gap-10 text-sm font-bold text-zinc-400 uppercase tracking-widest">
                            <a href="#features" className="hover:text-white transition-colors">Features</a>
                            <a href="#comparison" className="hover:text-white transition-colors">Comparison</a>
                            <a href="/subscribe" className="hover:text-white transition-colors text-indigo-400">Pricing</a>
                        </div>
                        <div className="flex items-center gap-4">
                            <a href="https://github.com/mikekode/church-projector/releases/download/v1.0.3/Church-Projector-Setup-1.0.3.exe" className="px-6 py-3 rounded-full bg-white text-black text-sm font-black hover:bg-indigo-500 hover:text-white transition-all shadow-xl active:scale-95 flex items-center gap-2">
                                <Download size={16} />
                                DOWNLOAD
                            </a>
                        </div>
                    </div>
                </nav>

                {/* Hero Section */}
                <section className="relative pt-32 pb-40 px-6 overflow-hidden">
                    {/* Background Blobs */}
                    <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/10 blur-[150px] rounded-full -z-10 animate-pulse" />
                    <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 blur-[150px] rounded-full -z-10" />

                    <div className="max-w-7xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black tracking-[0.2em] mb-12 uppercase">
                            <Zap size={14} />
                            Professional Grade Projection • Windows & Mac
                        </div>

                        <h1 className="text-7xl md:text-[120px] font-black tracking-tighter leading-[0.85] mb-10 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-zinc-700">
                            Stop Searching.<br />
                            <span className="text-indigo-500 italic">Start Speaking.</span>
                        </h1>

                        <p className="max-w-3xl mx-auto text-xl md:text-2xl text-zinc-400 mb-16 font-medium leading-relaxed">
                            Creenly is the world's first AI-driven worship software for your computer.
                            It listens to your service and finds scriptures and songs automatically.
                            <span className="block mt-4 text-indigo-400 font-bold">Download the Free Demo and see it in action.</span>
                        </p>

                        <div className="flex flex-col items-center gap-8">
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full">
                                <a href="https://github.com/mikekode/church-projector/releases/download/v1.0.3/Church-Projector-Setup-1.0.3.exe" className="grow sm:grow-0 w-full sm:w-auto px-10 py-6 rounded-3xl bg-indigo-600 font-black text-xl hover:bg-indigo-500 transition-all shadow-[0_20px_50px_-12px_rgba(79,70,229,0.5)] flex items-center justify-center gap-3 group">
                                    <Monitor size={24} />
                                    Download for Windows
                                </a>
                                <a href="https://github.com/mikekode/church-projector/releases/download/v1.0.3/Church-Projector-1.0.3.dmg" className="grow sm:grow-0 w-full sm:w-auto px-10 py-6 rounded-3xl bg-zinc-900 border border-white/10 font-black text-xl hover:bg-zinc-800 transition-all flex items-center justify-center gap-3">
                                    <Laptop size={24} />
                                    Download for Mac
                                </a>
                            </div>

                            <div className="flex items-center gap-4 text-zinc-500 text-sm font-bold uppercase tracking-widest">
                                <Link href="/subscribe" className="text-white hover:text-indigo-400 underline decoration-indigo-500/50 underline-offset-8 transition-colors">
                                    Buy License Key to Unlock Full Version
                                </Link>
                            </div>
                        </div>

                        {/* Social Proof */}
                        <div className="mt-32 pt-12 border-t border-white/5 flex flex-wrap justify-center gap-12 opacity-30 grayscale hover:grayscale-0 transition-all">
                            <div className="font-bold text-2xl tracking-tighter">GRACE COMMUNITY</div>
                            <div className="font-bold text-2xl tracking-tighter underline">THE RIVER</div>
                            <div className="font-bold text-2xl tracking-tighter italic">Lighthouse</div>
                            <div className="font-bold text-2xl tracking-tighter uppercase">Zion Church</div>
                        </div>
                    </div>
                </section>

                {/* Killer Features */}
                <section id="features" className="py-40 px-6 bg-[#050505]">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                            <div>
                                <h2 className="text-5xl md:text-6xl font-black tracking-tighter mb-8 leading-tight">
                                    Built for the <br />
                                    Dynamic Service.
                                </h2>
                                <p className="text-zinc-500 text-lg mb-12">
                                    Traditional software requires a full-time operator clicking through slides.
                                    Creenly is native desktop software that frees your team to focus on the atmosphere.
                                </p>
                                <div className="space-y-6">
                                    {[
                                        { t: "AI Voice Tracking", d: "Instantly detect John 3:16 or 'Amazing Grace' as it is spoken." },
                                        { t: "Native Performance", d: "Built for Windows & Mac. Zero lag, high-fidelity graphics." },
                                        { t: "Offline Core", d: "Zero reliance on cloud during the service. 100% reliable." }
                                    ].map((item, i) => (
                                        <div key={i} className="flex gap-4">
                                            <div className="mt-1 w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                                                <Check size={14} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white mb-1">{item.t}</h4>
                                                <p className="text-sm text-zinc-500">{item.d}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="relative">
                                <div className="aspect-[4/3] bg-zinc-900 rounded-[40px] border border-white/10 shadow-2xl relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white cursor-pointer hover:scale-110 transition-transform">
                                            <Zap size={32} />
                                        </div>
                                    </div>
                                    <div className="absolute bottom-8 left-8 right-8 p-6 bg-black/60 backdrop-blur-xl border border-white/5 rounded-2xl">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Live Detection</span>
                                        </div>
                                        <p className="text-sm font-medium text-white text-center italic">"For God so loved the world that he gave his only begotten son..."</p>
                                    </div>
                                </div>
                                {/* Decorative elements */}
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 blur-3xl rounded-full" />
                                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-500/20 blur-3xl rounded-full" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Comparison Table */}
                <section id="comparison" className="py-40 px-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-24">
                            <h2 className="text-5xl font-black italic tracking-tighter mb-4">The Verdict.</h2>
                            <p className="text-zinc-500 uppercase tracking-[0.3em] text-xs font-black">Creenly vs the Legacy Giants</p>
                        </div>

                        <div className="bg-zinc-900/10 border border-white/5 rounded-[40px] overflow-hidden backdrop-blur-sm">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="py-8 px-8 text-[10px] font-black uppercase tracking-widest text-zinc-600">Feature</th>
                                        <th className="py-8 px-8 bg-indigo-600/10"><span className="text-xl font-black text-indigo-400">CREENLY</span></th>
                                        <th className="py-8 px-8 text-zinc-500 font-bold">ProPresenter</th>
                                        <th className="py-8 px-8 text-zinc-500 font-bold">Proclaim</th>
                                        <th className="py-8 px-8 text-zinc-500 font-bold">EasyWorship</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { f: "AI Voice Tracking", a: true, b: false, c: false, d: false },
                                        { f: "Smart Verse Lookup", a: true, b: false, c: false, d: false },
                                        { f: "Native Desktop App", a: true, b: true, c: true, d: true },
                                        { f: "Stage Display 2.0", a: true, b: true, c: true, d: false },
                                        { f: "Atem/MIDI Bridge", a: true, b: true, c: false, d: false },
                                        { f: "Pricing", a: "$15/mo", b: "$399+", c: "$19+/mo", d: "$180/yr" },
                                    ].map((row, i) => (
                                        <tr key={i} className="border-b border-white/5 group hover:bg-white/[0.01] transition-colors">
                                            <td className="py-6 px-8 text-sm font-bold text-zinc-400 group-hover:text-white transition-colors">{row.f}</td>
                                            <td className="py-6 px-8 bg-indigo-600/5 font-black text-white">
                                                {typeof row.a === 'boolean' ? (row.a ? <Check className="text-indigo-400" strokeWidth={4} /> : "—") : row.a}
                                            </td>
                                            <td className="py-6 px-8 text-sm text-zinc-600">
                                                {typeof row.b === 'boolean' ? (row.b ? <Check className="text-zinc-600 opacity-30" strokeWidth={3} /> : "—") : row.b}
                                            </td>
                                            <td className="py-6 px-8 text-sm text-zinc-600">
                                                {typeof row.c === 'boolean' ? (row.c ? <Check className="text-zinc-600 opacity-30" strokeWidth={3} /> : "—") : row.c}
                                            </td>
                                            <td className="py-6 px-8 text-sm text-zinc-600">
                                                {typeof row.d === 'boolean' ? (row.d ? <Check className="text-zinc-600 opacity-30" strokeWidth={3} /> : "—") : row.d}
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
                            { q: "Creenly has completely transformed how our small tech team operates. It's like having another volunteer in the booth.", a: "Pastor Mike G.", c: "Grace Chapel", i: "/pastor-mike.png" },
                            { q: "The AI verse detection is scarily accurate. Our congregation is always amazed how fast we pull up scriptures.", a: "Sarah L.", c: "Creative Director", i: "/sarah-creative.png" },
                        ].map((t, i) => (
                            <div key={i} className="flex-1 p-10 rounded-3xl bg-zinc-900/30 border border-white/5 italic text-zinc-400">
                                <p className="text-xl mb-8 leading-relaxed">"{t.q}"</p>
                                <div className="not-italic flex items-center gap-4">
                                    <img src={t.i} alt={t.a} className="w-12 h-12 rounded-full object-cover border border-indigo-500/20 shadow-lg" />
                                    <div>
                                        <div className="font-bold text-white text-sm">{t.a}</div>
                                        <div className="text-indigo-500 text-[10px] font-black uppercase tracking-widest">{t.c}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Final CTA */}
                <section className="py-60 px-6 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-indigo-600/5 -z-10" />
                    <h2 className="text-6xl md:text-[140px] font-black tracking-tighter mb-12 bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-800 leading-[0.8]">
                        Take the <br />
                        Stage.
                    </h2>
                    <div className="flex justify-center flex-wrap gap-6">
                        <button onClick={handleDownloadClick} className="px-12 py-6 rounded-full bg-white text-black font-black text-xl hover:bg-zinc-200 transition-all shadow-2xl active:scale-95 flex items-center gap-3">
                            <Download size={24} />
                            DOWNLOAD FREE DEMO
                        </button>
                        <Link href="/subscribe" className="px-12 py-6 rounded-full bg-indigo-600 text-white font-black text-xl hover:bg-indigo-500 transition-all shadow-2xl active:scale-95">
                            BUY PRO LICENSE
                        </Link>
                    </div>
                    <p className="mt-12 text-zinc-600 font-medium tracking-widest uppercase text-[10px]">Version 2.0 Now Available.</p>
                </section>

                {/* Footer */}
                <footer className="py-20 px-10 border-t border-white/5 bg-black">
                    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
                        <div className="col-span-2">
                            <div className="flex items-center gap-1 mb-6">
                                <img src="/logo.png" alt="Creenly Logo" className="w-10 h-10 object-contain translate-y-[1px]" />
                                <span className="text-2xl font-black tracking-tighter leading-none">CREENLY</span>
                            </div>
                            <p className="text-zinc-500 text-sm max-w-sm mb-6">
                                Next-generation worship software designed for the modern sanctuary.
                                Available for Windows and Mac.
                            </p>
                        </div>
                        <div>
                            <h5 className="font-black text-xs uppercase tracking-widest mb-6 text-white">Product</h5>
                            <ul className="space-y-4 text-sm text-zinc-500 font-medium">
                                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                                <li><a href="https://github.com/mikekode/church-projector/releases/download/v1.0.3/Church-Projector-Setup-1.0.3.exe" className="hover:text-white transition-colors">Download</a></li>
                                <li><a href="/subscribe" className="hover:text-white transition-colors text-indigo-400">Buy License</a></li>
                            </ul>
                        </div>
                        <div>
                            <h5 className="font-black text-xs uppercase tracking-widest mb-6 text-white">Legal</h5>
                            <ul className="space-y-4 text-sm text-zinc-500 font-medium">
                                <li>Terms of Service</li>
                                <li>Privacy Policy</li>
                                <li>CCLI Integration</li>
                            </ul>
                        </div>
                    </div>
                    <div className="max-w-7xl mx-auto mt-20 pt-10 border-t border-white/5 flex justify-between items-center flex-wrap gap-4">
                        <p className="text-xs text-zinc-700 font-bold tracking-widest uppercase">&copy; 2024 Creenly Media. Built for his glory.</p>
                    </div>
                </footer>
            </div>
        );
    }
