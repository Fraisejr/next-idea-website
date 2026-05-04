'use client';

import { useState, useMemo } from 'react';
import { Sun, Loader2 } from 'lucide-react';
import { GoogleEvent, formatEventTime } from '@/lib/google';
import { TaskRecord } from '@/lib/cloudkit';

type EventItem = { type: 'event'; id: string; event: GoogleEvent };
type TaskItem  = { type: 'task';  id: string; task: TaskRecord };
type TodayItem = EventItem | TaskItem;

function correctEventOrder(items: TodayItem[]): TodayItem[] {
    const positions: number[] = [];
    const sorted: EventItem[] = [];
    items.forEach((item, i) => {
        if (item.type === 'event') { positions.push(i); sorted.push(item); }
    });
    sorted.sort((a, b) => {
        const at = a.event.start.dateTime || a.event.start.date || '';
        const bt = b.event.start.dateTime || b.event.start.date || '';
        return at.localeCompare(bt);
    });
    const result = [...items];
    positions.forEach((pos, i) => { result[pos] = sorted[i]; });
    return result;
}

const STORAGE_KEY = 'today-order';

type Props = {
    todayEvents: GoogleEvent[];
    dueTodayTasks: TaskRecord[];
    loadingEvents: boolean;
    googleToken: string | null;
    onShowSettings: () => void;
    renderTask: (task: TaskRecord) => React.ReactNode;
};

export function TodayView({ todayEvents, dueTodayTasks, loadingEvents, googleToken, onShowSettings, renderTask }: Props) {
    const [order, setOrder] = useState<string[]>(() => {
        if (typeof window === 'undefined') return [];
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
    });
    const [dragId, setDragId]         = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [dragOverPos, setDragOverPos] = useState<'top' | 'bottom'>('bottom');

    const orderedItems = useMemo((): TodayItem[] => {
        const allItems = new Map<string, TodayItem>();
        todayEvents.forEach(e => allItems.set(e.id, { type: 'event', id: e.id, event: e }));
        dueTodayTasks.forEach(t => allItems.set(t.recordName, { type: 'task', id: t.recordName, task: t }));

        const result: TodayItem[] = [];
        const seen = new Set<string>();
        for (const id of order) {
            const item = allItems.get(id);
            if (item) { result.push(item); seen.add(id); }
        }
        for (const [id, item] of allItems) {
            if (!seen.has(id)) result.push(item);
        }
        return correctEventOrder(result);
    }, [todayEvents, dueTodayTasks, order]);

    const saveOrder = (ids: string[]) => {
        setOrder(ids);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch {}
    };

    const handleDragOver = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setDragOverId(targetId);
        setDragOverPos(e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom');
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
        const ids = orderedItems.map(i => i.id);
        const newIds = [...ids];
        const fromIdx = newIds.indexOf(dragId);
        newIds.splice(fromIdx, 1);
        const toIdx = newIds.indexOf(targetId);
        newIds.splice(dragOverPos === 'top' ? toIdx : toIdx + 1, 0, dragId);
        saveOrder(newIds);
        setDragId(null);
        setDragOverId(null);
    };

    const isEmpty = orderedItems.length === 0;

    return (
        <div className="pt-4">
            <p className="text-sm text-gray-400 mb-5">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>

            {isEmpty && !loadingEvents ? (
                <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <Sun className="w-12 h-12 text-yellow-200 mx-auto mb-4" />
                    {!googleToken ? (
                        <>
                            <p className="text-gray-500 mb-3">Connect Google Calendar to see today's events.</p>
                            <button onClick={onShowSettings} className="text-sm text-blue-600 hover:underline cursor-pointer">Open Settings</button>
                        </>
                    ) : (
                        <p className="text-gray-500">Nothing due today.</p>
                    )}
                </div>
            ) : isEmpty && loadingEvents ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                </div>
            ) : (
                <>
                    <div className="space-y-2">
                        {orderedItems.map(item => {
                            const isOver = dragOverId === item.id;
                            const isDragging = dragId === item.id;
                            return (
                                <div
                                    key={item.id}
                                    draggable
                                    onDragStart={(e) => {
                                        if (item.type === 'event') e.dataTransfer.setData('today-event', item.id);
                                        setDragId(item.id);
                                    }}
                                    onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                                    onDragOver={(e) => handleDragOver(e, item.id)}
                                    onDragLeave={(e) => {
                                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverId(null);
                                    }}
                                    onDrop={(e) => handleDrop(e, item.id)}
                                    className={`relative ${isDragging ? 'opacity-40' : ''}`}
                                >
                                    {isOver && dragOverPos === 'top' && (
                                        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-400 rounded-full z-10 pointer-events-none" />
                                    )}
                                    {isOver && dragOverPos === 'bottom' && (
                                        <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-400 rounded-full z-10 pointer-events-none" />
                                    )}

                                    {item.type === 'event' ? (
                                        <div className="relative group p-3 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-all flex items-center gap-3 cursor-grab active:cursor-grabbing select-none">
                                            <div
                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: item.event.calendarColor }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {item.event.summary || '(No title)'}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {formatEventTime(item.event)}
                                                </p>
                                            </div>
                                            <span className="text-[10px] text-gray-300 flex-shrink-0 uppercase tracking-wide">Cal</span>
                                        </div>
                                    ) : (
                                        renderTask(item.task)
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {loadingEvents && (
                        <div className="flex items-center justify-center gap-2 py-4 text-xs text-gray-400">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Loading calendar events…
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
