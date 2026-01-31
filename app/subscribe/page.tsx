'use client';
import Link from 'next/link';
import { Check, ArrowLeft, Zap, Star, Shield, HelpCircle } from 'lucide-react';

export default function SubscribePage() {
    return (
        <div className="min-h-screen bg-black text-white selection:bg-indigo-500/30 font-sans">
            {/* Nav */}
            <nav className="p-6 flex items-center justify-between">
                <Link href="/" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm font-medium group">
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Home
                </Link>
                <div className="flex items-center gap-1">
                    <img src="/logo.png" alt="Creenly Logo" className="w-10 h-10 object-contain translate-y-[2px]" />
                    <span className="text-xl font-black tracking-tighter text-white leading-none">CREENLY</span>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-20 pb-40">
                <div className="text-center mb-24">
                    <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500">
                        Choose Your Plan
                    </h1>
                    <p className="text-zinc-500 text-lg max-w-2xl mx-auto leading-relaxed">
                        Simple, transparent pricing for churches of all sizes.
                        No hidden fees, no per-user licensing, just unlimited worship.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto relative">
                    {/* Decorative glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[300px] bg-indigo-500/10 blur-[150px] -z-10 rounded-full" />

                    {/* Monthly Plan */}
                    <div className="p-10 rounded-[40px] bg-zinc-900/50 border border-white/5 flex flex-col items-start hover:border-white/10 transition-all">
                        <div className="px-4 py-1.5 rounded-full bg-zinc-800 text-zinc-400 text-xs font-bold mb-8 capitalize">Monthly</div>
                        <div className="flex items-baseline gap-2 mb-4">
                            <span className="text-6xl font-blacktracking-tighter">$15</span>
                            <span className="text-zinc-500">/month</span>
                        </div>
                        <p className="text-zinc-400 text-sm mb-10">Perfect for smaller ministries or trying out Creenly for the first time.</p>

                        <div className="space-y-4 mb-12 w-full">
                            {[
                                "AI Voice Recognition",
                                "Unlimited Bible Versions",
                                "Atem & MIDI Integration",
                                "Cloud Song Library",
                                "Priority Email Support"
                            ].map((feature, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                                        <Check size={12} />
                                    </div>
                                    <span className="text-sm text-zinc-300">{feature}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => window.location.href = 'https://creenly.lemonsqueezy.com/checkout/buy/2ee312d4-cbab-464f-8707-50f0ecd872cc'}
                            className="w-full py-5 rounded-full bg-white text-black font-black text-lg hover:bg-zinc-200 transition-all shadow-xl active:scale-95"
                        >
                            Get Monthly Access
                        </button>
                    </div>

                    {/* Yearly Plan - Featured */}
                    <div className="p-10 rounded-[40px] bg-zinc-900 border-2 border-indigo-500 relative flex flex-col items-start shadow-[0_0_60px_rgba(99,102,241,0.2)]">
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-indigo-500 text-white text-xs font-black uppercase tracking-widest shadow-xl">
                            Best Value - Save $30
                        </div>

                        <div className="px-4 py-1.5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold mb-8">Annual</div>
                        <div className="flex items-baseline gap-2 mb-4">
                            <span className="text-6xl font-black tracking-tighter">$150</span>
                            <span className="text-indigo-500/50">/year</span>
                        </div>
                        <p className="text-indigo-200/50 text-sm mb-10">The ultimate choice for established churches looking for long-term power.</p>

                        <div className="space-y-4 mb-12 w-full">
                            {[
                                "Everything in Monthly",
                                "2 Months Free Access",
                                "Early Access to AI Beta",
                                "Direct Phone Support",
                                "1:1 Onboarding Session",
                                "Custom Theme Design"
                            ].map((feature, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                                        <Check size={12} />
                                    </div>
                                    <span className="text-sm text-white font-medium">{feature}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => window.location.href = 'https://creenly.lemonsqueezy.com/checkout/buy/d9aa88d0-4c95-481c-9d56-a7831a1279fb'}
                            className="w-full py-5 rounded-full bg-indigo-600 text-white font-black text-lg hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-500/40 active:scale-95"
                        >
                            Get Annual Access
                        </button>
                    </div>
                </div>

                {/* FAQ or Trust Section */}
                <div className="mt-40 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
                    <div>
                        <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center mx-auto mb-6 text-indigo-500">
                            <Shield size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3">Safe & Secure</h3>
                        <p className="text-zinc-500 text-sm">We use bank-grade encryption for all payments and data storage.</p>
                    </div>
                    <div>
                        <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center mx-auto mb-6 text-emerald-500">
                            <Star size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3">Top-Rated Support</h3>
                        <p className="text-zinc-500 text-sm">Our team is available 24/7. We’re here to help you succeed on Sundays.</p>
                    </div>
                    <div>
                        <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center mx-auto mb-6 text-amber-500">
                            <HelpCircle size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-3">30-Day Guarantee</h3>
                        <p className="text-zinc-500 text-sm">Not happy? We’ll refund your first month, no questions asked.</p>
                    </div>
                </div>
            </main>

            {/* Simple Footer */}
            <footer className="py-10 border-t border-white/5 opacity-50 text-center">
                <p className="text-xs text-zinc-500">Questions? Email us at hello@creenly.com</p>
            </footer>
        </div>
    );
}

