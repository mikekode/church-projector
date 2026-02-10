"use client";

import { useState, useEffect } from 'react';
import { X, Save, Trash2, Calendar, FileText, Check, AlertCircle, FolderOpen, Pencil } from 'lucide-react';
import { SavedPlan, getPlans, savePlan, deletePlan, ServiceSchedule } from '@/utils/scheduleManager';

interface PlanManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentSchedule: ServiceSchedule;
    onLoadPlan: (plan: ServiceSchedule) => void;
}

export default function PlanManagerModal({ isOpen, onClose, currentSchedule, onLoadPlan }: PlanManagerModalProps) {
    const [plans, setPlans] = useState<SavedPlan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Save New Plan State
    const [newPlanName, setNewPlanName] = useState(currentSchedule.name || '');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Inline Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadPlans();
            setNewPlanName(currentSchedule.name);
            setSaveSuccess(false);
            setError(null);
        }
    }, [isOpen, currentSchedule.name]);

    const loadPlans = async () => {
        setIsLoading(true);
        try {
            const loaded = await getPlans();
            setPlans(loaded);
        } catch (err) {
            setError('Failed to load plans');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!newPlanName.trim()) return;
        setIsSaving(true);
        setError(null);
        try {
            // Create a copy of the current schedule with the new name
            // We generate a NEW ID if the user intends to save as a new plan, 
            // but for simplicity, let's keep the ID if we are "updating" the active one, 
            // OR generate a new one if we want "Save As".

            // Logic: If the plan name matches an existing one, confirm overwrite? 
            // For now, let's just save. If we want "Save As", we should probably generate a new ID.
            // But if we want to update "Sunday Service", we keep the ID.
            // Let's rely on the ID. If the currentSchedule has an ID that matches a saved plan, it updates it.
            // If the user changes the name, do we create a new one?
            // Simplest approach: Always update the current schedule object with the new name, then save.

            const planToSave: ServiceSchedule = {
                ...currentSchedule,
                name: newPlanName,
                // Update date to today if it's old? Or keep as is? User can change date in main UI.
            };

            await savePlan(planToSave);
            setSaveSuccess(true);
            await loadPlans();

            // If we just saved (overwrote), the current schedule remains the same.
            // If we want to reflect that we are now "on" this plan, it's already true.

            // Reset success message after 2s
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (err) {
            setError('Failed to save plan');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveCopy = async () => {
        if (!newPlanName.trim()) return;
        setIsSaving(true);
        setError(null);
        try {
            // Generate NEW ID for the copy
            const newId = Date.now().toString();
            const planToSave: ServiceSchedule = {
                ...currentSchedule,
                id: newId,
                name: newPlanName, // User should probably change the name for clarity, but duplicate name is allowed
                date: currentSchedule.date // Keep the date
            };

            // Save the NEW plan
            await savePlan(planToSave);

            // IMPORTANT: Switch to the new plan? 
            // Usually "Save Copy" implies we are now working on the copy OR we just made a backup.
            // Let's decide to switch to it to avoid confusion (editing the old one thinking it's the new one).
            onLoadPlan(planToSave);

            setSaveSuccess(true);
            await loadPlans();
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (err) {
            setError('Failed to save copy');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this schedule?')) return;
        try {
            await deletePlan(id);
            await loadPlans();
        } catch (err) {
            setError('Failed to delete plan');
        }
    };

    const handleLoad = async (plan: SavedPlan) => {
        if (confirm(`Load "${plan.name}"? This will replace your current schedule.`)) {
            // Convert SavedPlan back to ServiceSchedule (types are compatible mostly)
            const schedule: ServiceSchedule = {
                id: plan.id,
                name: plan.name,
                date: plan.date,
                items: plan.items
            };
            onLoadPlan(schedule);
            onClose();
        }
    };

    const startEditing = (plan: SavedPlan) => {
        setEditingId(plan.id);
        setEditName(plan.name);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditName('');
    };

    const saveEditing = async (plan: SavedPlan) => {
        if (!editName.trim() || editName === plan.name) {
            cancelEditing();
            return;
        }

        try {
            await savePlan({
                ...plan,
                name: editName,
                // Ensure type compatibility if SavedPlan has extra fields. 
                // scheduleManager savePlan takes ServiceSchedule, but SavedPlan has all those fields + updatedAt.
                // It should be fine to pass the extra field or we can strip it if strict.
                // IndexedDB usually mimics the object passed.
            });
            await loadPlans();
            cancelEditing();
        } catch (err) {
            setError('Failed to rename plan');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl w-full max-w-2xl p-6 shadow-2xl flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <FolderOpen className="text-indigo-500" /> Schedule Manager
                    </h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Save Current Section */}
                <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-xl p-4 border border-zinc-200 dark:border-white/5 mb-6">
                    <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Save Current Schedule</h4>
                    <div className="flex gap-2">
                        <input
                            value={newPlanName}
                            onChange={(e) => setNewPlanName(e.target.value)}
                            placeholder="Schedule Name (e.g. Sunday Service)"
                            className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/10 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:border-indigo-500 outline-none"
                        />
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !newPlanName.trim()}
                            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${saveSuccess
                                ? 'bg-green-500 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                }`}
                        >
                            {saveSuccess ? <Check size={18} /> : <Save size={18} />}
                            {saveSuccess ? 'Saved' : 'Save'}
                        </button>
                        <button
                            onClick={handleSaveCopy}
                            disabled={isSaving || !newPlanName.trim()}
                            className="px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                            title="Save as a new schedule (Duplicate)"
                        >
                            <span className="text-xs">Save Copy</span>
                        </button>
                    </div>
                </div>

                {/* Saved Plans List */}
                <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Saved Schedules</h4>

                <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px]">
                    {isLoading ? (
                        <div className="text-center py-8 text-zinc-500">Loading schedules...</div>
                    ) : plans.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500 flex flex-col items-center gap-2">
                            <FolderOpen size={32} className="opacity-20" />
                            <p>No saved schedules yet.</p>
                        </div>
                    ) : (
                        plans.map(plan => (
                            <div key={plan.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 hover:border-indigo-500/30 transition-colors group">
                                <div className="flex-1 min-w-0 mr-4">
                                    {editingId === plan.id ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="flex-1 bg-white dark:bg-black border border-indigo-500 rounded px-2 py-1 text-sm text-zinc-900 dark:text-white outline-none"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveEditing(plan);
                                                    if (e.key === 'Escape') cancelEditing();
                                                }}
                                            />
                                            <button onClick={() => saveEditing(plan)} className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600">
                                                <Check size={14} />
                                            </button>
                                            <button onClick={cancelEditing} className="p-1.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-500 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 group/title">
                                                <h5
                                                    className="font-bold text-zinc-900 dark:text-white truncate cursor-pointer hover:text-indigo-500 transition-colors"
                                                    onClick={() => startEditing(plan)}
                                                    title="Click to rename"
                                                >
                                                    {plan.name}
                                                </h5>
                                                <button
                                                    onClick={() => startEditing(plan)}
                                                    className="opacity-0 group-hover/title:opacity-100 p-1 text-zinc-400 hover:text-indigo-500 transition-all"
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] text-zinc-500 mt-1">
                                                <span className="flex items-center gap-1"><Calendar size={10} /> {plan.date}</span>
                                                <span className="flex items-center gap-1"><FileText size={10} /> {plan.items.length} items</span>
                                                <span>• Last updated: {new Date(plan.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {editingId !== plan.id && (
                                    <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleLoad(plan)}
                                            className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-indigo-600 hover:text-white text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded transition-colors"
                                        >
                                            Load
                                        </button>
                                        <button
                                            onClick={() => handleDelete(plan.id)}
                                            className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                                            title="Delete Plan"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-500 text-sm">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

            </div>
        </div>
    );
}
