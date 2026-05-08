'use client';

import { useState, useMemo, useEffect } from 'react';
import { Sun, Loader2 } from 'lucide-react';
import { GoogleEvent, formatEventTime } from '@/lib/google';
import { TaskRecord } from '@/lib/cloudkit';

type EventItem = { type: 'event'; id: string; event: GoogleEvent };
type TaskItem  = { type: 'task';  id: string; task: TaskRecord };
type TodayItem = EventItem | TaskItem;

type Props = {
    todayEvents: GoogleEvent[];
    dueTodayTasks: TaskRecord[];
    loadingEvents: boolean;
    googleToken: string | null;
    onShowSettings: () => void;
    order: string[];
    onOrderChange: (ids: string[]) => void;
    renderTask: (task: TaskRecord) => React.ReactNode;
};

export function TodayView({ todayEvents, dueTodayTasks, loadingEvents, googleToken, onShowSettings, order, onOrderChange, renderTask }: Props) {
    const [dragId, setDragId]           = useState<string | null>(null);
    const [dragOverId, setDragOverId]   = useState<string | null>(null);
    const [dragOverPos, setDragOverPos] = useState<'top' | 'bottom'>('bottom');
    const [now, setNow]                 = useState(() => new Date());

    // Tick every 60 s so past events are removed reactively
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    // Past timed events are hidden; all-day events always stay visible
    const visibleEvents = useMemo(() =>
        todayEvents.filter(e => {
            if (!e.start.dateTime) return true;          // all-day
            if (!e.end?.dateTime)  return true;          // no end — keep
            return new Date(e.end.dateTime) > now;
        }),
    [todayEvents, now]);

    const orderedItems = useMemo((): TodayItem[] => {
        const taskItems = new Map<string, TaskItem>();
        dueTodayTasks.forEach(t => taskItems.set(t.recordName, { type: 'task' as const, id: t.recordName, task: t }));

        // Split visible events into all-day (pinned) and timed
        const allDayItems: EventItem[] = [];
        const timedEventItems = new Map<string, EventItem>();
        visibleEvents.forEach(e => {
            const item: EventItem = { type: 'event', id: e.id, event: e };
            if (!e.start.dateTime) allDayItems.push(item);
            else timedEventItems.set(e.id, item);
        });

        const seen = new Set<string>();
        const result: TodayItem[] = [];

        // 1. All-day events always first, sorted by date
        allDayItems
            .sort((a, b) => (a.event.start.date || '').localeCompare(b.event.start.date || ''))
            .forEach(e => { result.push(e); seen.add(e.id); });

        // 2. resolveSlots: follow persisted order for timed events + tasks
        for (const id of order) {
            if (seen.has(id)) continue;
            const item = taskItems.get(id) ?? timedEventItems.get(id);
            if (item) { result.push(item); seen.add(id); }
        }

        // 3. Re-sort tasks within their current slot positions by CD_order.
        //    This keeps the event-vs-task interleaving from the slots but always
        //    reflects the global task order (bidirectional sync with other views).
        const taskPositions: number[] = [];
        for (let i = 0; i < result.length; i++) {
            if (result[i].type === 'task') taskPositions.push(i);
        }
        const sortedByGlobalOrder = taskPositions
            .map(i => result[i] as TaskItem)
            .sort((a, b) => (a.task.fields.CD_order?.value ?? 0) - (b.task.fields.CD_order?.value ?? 0));
        taskPositions.forEach((pos, i) => { result[pos] = sortedByGlobalOrder[i]; });

        // 4. addNewItems — unseen timed events: insert chronologically among timed events
        const unseenTimed = [...timedEventItems.values()]
            .filter(e => !seen.has(e.id))
            .sort((a, b) => (a.event.start.dateTime || '').localeCompare(b.event.start.dateTime || ''));
        for (const evItem of unseenTimed) {
            const eTime = evItem.event.start.dateTime || '';
            let lastBeforeIdx = -1;
            for (let i = result.length - 1; i >= 0; i--) {
                const ri = result[i];
                if (ri.type === 'event' && ri.event.start.dateTime) {
                    if ((ri.event.start.dateTime || '') <= eTime) { lastBeforeIdx = i; break; }
                }
            }
            let insertIdx: number;
            if (lastBeforeIdx !== -1) {
                insertIdx = lastBeforeIdx + 1;
            } else {
                // No earlier timed event found — place after all-day block
                const firstTimed = result.findIndex(i => i.type === 'event' && i.event.start.dateTime);
                insertIdx = firstTimed !== -1 ? firstTimed : result.length;
            }
            result.splice(insertIdx, 0, evItem);
            seen.add(evItem.id);
        }

        // 5. addNewItems — unseen tasks: append at end in CD_order
        const unseenTasks = [...taskItems.values()]
            .filter(t => !seen.has(t.id))
            .sort((a, b) => (a.task.fields.CD_order?.value ?? 0) - (b.task.fields.CD_order?.value ?? 0));
        unseenTasks.forEach(t => result.push(t));

        return result;
    }, [visibleEvents, dueTodayTasks, order]);

    const handleDragOver = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setDragOverId(targetId);
        setDragOverPos(e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom');
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }

        const itemById = new Map(orderedItems.map(i => [i.id, i]));
        const isAllDay = (id: string) => {
            const item = itemById.get(id);
            return item?.type === 'event' && !item.event.start.dateTime;
        };

        // All-day events are pinned — never let them be dragged
        if (isAllDay(dragId)) { setDragId(null); setDragOverId(null); return; }

        const newIds = orderedItems.map(i => i.id);
        const fromIdx = newIds.indexOf(dragId);
        newIds.splice(fromIdx, 1);
        const toIdx = newIds.indexOf(targetId);
        let insertPos = dragOverPos === 'top' ? toIdx : toIdx + 1;

        // Clamp: never insert above the all-day block
        const firstNonAllDay = newIds.findIndex(id => !isAllDay(id));
        if (firstNonAllDay !== -1) insertPos = Math.max(insertPos, firstNonAllDay);

        newIds.splice(insertPos, 0, dragId);

        // enforceEventOrder: re-sort timed events chronologically within their positions.
        // All-day events stay in their fixed spots at the top.
        const sortedTimedIds = newIds
            .filter(id => { const item = itemById.get(id); return item?.type === 'event' && item.event.start.dateTime; })
            .sort((a, b) => {
                const ea = itemById.get(a); const eb = itemById.get(b);
                return ((ea?.type === 'event' ? ea.event.start.dateTime : '') || '')
                    .localeCompare((eb?.type === 'event' ? eb.event.start.dateTime : '') || '');
            });
        let ei = 0;
        const enforced = newIds.map(id => {
            const item = itemById.get(id);
            return (item?.type === 'event' && item.event.start.dateTime) ? sortedTimedIds[ei++] : id;
        });

        onOrderChange(enforced);
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
                            const isOver     = dragOverId === item.id;
                            const isDragging = dragId === item.id;
                            const isAllDay   = item.type === 'event' && !item.event.start.dateTime;
                            return (
                                <div
                                    key={item.id}
                                    draggable={!isAllDay}
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
                                    {isOver && dragOverPos === 'top' && !isAllDay && (
                                        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-400 rounded-full z-10 pointer-events-none" />
                                    )}
                                    {isOver && dragOverPos === 'bottom' && (
                                        <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-400 rounded-full z-10 pointer-events-none" />
                                    )}

                                    {item.type === 'event' ? (
                                        <div className={`relative group p-3 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-all flex items-center gap-3 select-none ${isAllDay ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}>
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
