"use client";

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Settings, X, Plus, Trash2, Clock, Calendar, MapPin, Bell } from 'lucide-react';

interface Announcement {
    id: string;
    title: string;
    body: string;
    image?: string;
    date?: string;
    location?: string;
    type: 'announcement' | 'event' | 'welcome' | 'verse';
    backgroundColor?: string;
}

const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
    {
        id: '1',
        title: 'Welcome to Our Church',
        body: 'We\'re so glad you\'re here! Please visit our welcome center after the service.',
        type: 'welcome',
        backgroundColor: '#1e1b4b'
    },
    {
        id: '2',
        title: 'Wednesday Bible Study',
        body: 'Join us every Wednesday at 7:00 PM for in-depth Bible study and fellowship.',
        date: 'Wednesdays, 7:00 PM',
        location: 'Fellowship Hall',
        type: 'event',
        backgroundColor: '#14532d'
    },
    {
        id: '3',
        title: 'Youth Group',
        body: 'All teens welcome! Games, worship, and a powerful message every Friday night.',
        date: 'Fridays, 6:30 PM',
        type: 'event',
        backgroundColor: '#7c2d12'
    },
    {
        id: '4',
        title: 'Sunday Service Times',
        body: '8:00 AM - Traditional Service\n10:30 AM - Contemporary Service\n6:00 PM - Evening Worship',
        type: 'announcement',
        backgroundColor: '#1e3a8a'
    }
];

export default function SignagePage() {
    const [mounted, setMounted] = useState(false);
    const [announcements, setAnnouncements] = useState<Announcement[]>(DEFAULT_ANNOUNCEMENTS);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [slideInterval, setSlideInterval] = useState(8); // seconds
    const [currentTime, setCurrentTime] = useState(new Date());
    const [transition, setTransition] = useState<'slide-in' | 'slide-out' | 'none'>('none');

    // Handle hydration mismatch
    useEffect(() => {
        setMounted(true);
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!mounted) return null;

    // Auto-advance slides
    useEffect(() => {
        if (isEditing || announcements.length <= 1) return;

        const timer = setInterval(() => {
            setTransition('slide-out');
            setTimeout(() => {
                setCurrentIndex(prev => (prev + 1) % announcements.length);
                setTransition('slide-in');
                setTimeout(() => setTransition('none'), 500);
            }, 500);
        }, slideInterval * 1000);

        return () => clearInterval(timer);
    }, [announcements.length, slideInterval, isEditing]);

    const currentAnnouncement = announcements[currentIndex];

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
    };

    const goToSlide = (direction: 'prev' | 'next') => {
        setTransition('slide-out');
        setTimeout(() => {
            setCurrentIndex(prev => {
                if (direction === 'next') {
                    return (prev + 1) % announcements.length;
                } else {
                    return prev === 0 ? announcements.length - 1 : prev - 1;
                }
            });
            setTransition('slide-in');
            setTimeout(() => setTransition('none'), 500);
        }, 300);
    };

    const addAnnouncement = () => {
        const newAnnouncement: Announcement = {
            id: Date.now().toString(),
            title: 'New Announcement',
            body: 'Click to edit this announcement.',
            type: 'announcement',
            backgroundColor: '#1f2937'
        };
        setAnnouncements([...announcements, newAnnouncement]);
    };

    const updateAnnouncement = (id: string, updates: Partial<Announcement>) => {
        setAnnouncements(prev =>
            prev.map(a => a.id === id ? { ...a, ...updates } : a)
        );
    };

    const deleteAnnouncement = (id: string) => {
        setAnnouncements(prev => prev.filter(a => a.id !== id));
        if (currentIndex >= announcements.length - 1) {
            setCurrentIndex(Math.max(0, announcements.length - 2));
        }
    };

    return (
        <div className="min-h-screen bg-black text-white overflow-hidden">
            {/* Main Display */}
            <div
                className={`min-h-screen flex flex-col transition-all duration-500 ${transition === 'slide-out' ? 'opacity-0 translate-x-8' :
                    transition === 'slide-in' ? 'opacity-100 translate-x-0' : ''
                    }`}
                style={{ backgroundColor: currentAnnouncement?.backgroundColor || '#0a0a0a' }}
            >
                {/* Top Bar - Clock */}
                <div className="flex justify-between items-center px-12 py-8">
                    <div>
                        <p className="text-6xl font-light tracking-tight">{formatTime(currentTime)}</p>
                        <p className="text-xl text-white/60 mt-1">{formatDate(currentTime)}</p>
                    </div>

                    {/* Logo area */}
                    <div className="text-right">
                        <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur px-6 py-3 rounded-2xl">
                            <img src="/logo.png" alt="Creenly Logo" className="w-12 h-12 object-contain" />
                            <span className="text-2xl font-semibold tracking-tight">CREENLY</span>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex items-center justify-center px-16 pb-16">
                    {currentAnnouncement && (
                        <div className="max-w-5xl text-center">
                            {/* Type Badge */}
                            <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full mb-8">
                                {currentAnnouncement.type === 'event' && <Calendar size={18} />}
                                {currentAnnouncement.type === 'announcement' && <Bell size={18} />}
                                {currentAnnouncement.type === 'welcome' && <span>👋</span>}
                                <span className="text-sm font-medium uppercase tracking-wider">
                                    {currentAnnouncement.type}
                                </span>
                            </div>

                            {/* Title */}
                            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold leading-tight mb-8">
                                {currentAnnouncement.title}
                            </h1>

                            {/* Body */}
                            <p className="text-2xl md:text-3xl text-white/80 leading-relaxed whitespace-pre-line max-w-3xl mx-auto">
                                {currentAnnouncement.body}
                            </p>

                            {/* Event Details */}
                            {(currentAnnouncement.date || currentAnnouncement.location) && (
                                <div className="flex items-center justify-center gap-8 mt-12 text-xl text-white/60">
                                    {currentAnnouncement.date && (
                                        <div className="flex items-center gap-3">
                                            <Clock size={24} />
                                            <span>{currentAnnouncement.date}</span>
                                        </div>
                                    )}
                                    {currentAnnouncement.location && (
                                        <div className="flex items-center gap-3">
                                            <MapPin size={24} />
                                            <span>{currentAnnouncement.location}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Slide Indicators */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
                    {announcements.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrentIndex(i)}
                            className={`w-3 h-3 rounded-full transition-all ${i === currentIndex
                                ? 'bg-white w-8'
                                : 'bg-white/30 hover:bg-white/50'
                                }`}
                        />
                    ))}
                </div>

                {/* Navigation Arrows (visible on hover) */}
                <button
                    onClick={() => goToSlide('prev')}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 rounded-full opacity-0 hover:opacity-100 transition-all group"
                >
                    <ChevronLeft size={32} />
                </button>
                <button
                    onClick={() => goToSlide('next')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 rounded-full opacity-0 hover:opacity-100 transition-all group"
                >
                    <ChevronRight size={32} />
                </button>
            </div>

            {/* Edit Mode Toggle */}
            <button
                onClick={() => setIsEditing(!isEditing)}
                className="fixed bottom-4 right-4 p-4 bg-zinc-800 hover:bg-zinc-700 rounded-full shadow-2xl z-50 transition-all"
                title="Edit Announcements"
            >
                {isEditing ? <X size={24} /> : <Settings size={24} />}
            </button>

            {/* Edit Panel */}
            {isEditing && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 overflow-y-auto">
                    <div className="max-w-4xl mx-auto p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-3xl font-bold">Edit Announcements</h2>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="p-2 hover:bg-white/10 rounded-lg"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Settings */}
                        <div className="bg-zinc-900 rounded-xl p-6 mb-6">
                            <label className="block text-sm text-zinc-400 mb-2">
                                Slide Duration (seconds)
                            </label>
                            <input
                                type="range"
                                min="3"
                                max="30"
                                value={slideInterval}
                                onChange={(e) => setSlideInterval(Number(e.target.value))}
                                className="w-full"
                            />
                            <p className="text-center text-xl font-bold mt-2">{slideInterval}s</p>
                        </div>

                        {/* Announcement List */}
                        <div className="space-y-4">
                            {announcements.map((a, i) => (
                                <div
                                    key={a.id}
                                    className="bg-zinc-900 rounded-xl p-6 border border-white/10"
                                    style={{ borderLeftColor: a.backgroundColor, borderLeftWidth: 4 }}
                                >
                                    <div className="flex gap-4">
                                        <div className="flex-1 space-y-4">
                                            <input
                                                type="text"
                                                value={a.title}
                                                onChange={(e) => updateAnnouncement(a.id, { title: e.target.value })}
                                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-xl font-bold"
                                                placeholder="Title"
                                            />
                                            <textarea
                                                value={a.body}
                                                onChange={(e) => updateAnnouncement(a.id, { body: e.target.value })}
                                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 min-h-[100px]"
                                                placeholder="Body text"
                                            />
                                            <div className="grid grid-cols-3 gap-4">
                                                <input
                                                    type="text"
                                                    value={a.date || ''}
                                                    onChange={(e) => updateAnnouncement(a.id, { date: e.target.value })}
                                                    className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm"
                                                    placeholder="Date/Time"
                                                />
                                                <input
                                                    type="text"
                                                    value={a.location || ''}
                                                    onChange={(e) => updateAnnouncement(a.id, { location: e.target.value })}
                                                    className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm"
                                                    placeholder="Location"
                                                />
                                                <input
                                                    type="color"
                                                    value={a.backgroundColor || '#1f2937'}
                                                    onChange={(e) => updateAnnouncement(a.id, { backgroundColor: e.target.value })}
                                                    className="w-full h-10 rounded-lg cursor-pointer"
                                                    title="Background Color"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => deleteAnnouncement(a.id)}
                                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg h-fit"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Add Button */}
                        <button
                            onClick={addAnnouncement}
                            className="w-full mt-6 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl flex items-center justify-center gap-2 font-semibold"
                        >
                            <Plus size={20} />
                            Add Announcement
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
