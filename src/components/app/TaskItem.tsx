import { ProjectRecord, TaskRecord, TagRecord } from '@/lib/cloudkit';
import { SFSymbolMapper } from '@/components/SFSymbolMapper';
import {
    Check,
    RotateCcw,
    X,
    Calendar,
    Zap,
    Hourglass,
    Moon,
    Repeat,
    Plus,
    Info,
    ExternalLink,
    ArrowUpToLine,
    ArrowDownToLine,
    AlignLeft,
    FolderOpen
} from 'lucide-react';
import React from 'react';

type TaskItemProps = {
    task: TaskRecord;
    viewMode: string;
    editingTaskId: string | null;
    dragOverTaskId: string | null;
    dragOverPosition: 'top' | 'bottom' | null;
    projects: ProjectRecord[];
    tags: TagRecord[];
    taskTagMap: Record<string, string[]>;
    editTaskName: string;
    setEditTaskName: (name: string) => void;

    // Handlers
    onDragStart: (e: React.DragEvent, task: TaskRecord, type: 'task') => void;
    onDragOver: (e: React.DragEvent, task: TaskRecord) => void;
    onDragEnter: (task: TaskRecord) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent, task: TaskRecord) => void;
    onToggleComplete: (task: TaskRecord) => void;
    onTaskClick: (task: TaskRecord) => void;
    onSave: (task: TaskRecord) => void;
    onCancel: () => void;
    onInsertTask: (task: TaskRecord) => void;
    onEditClick: (task: TaskRecord) => void;
    onMoveToTop?: (task: TaskRecord) => void;
    onMoveToBottom?: (task: TaskRecord) => void;
    onNoteChange?: (task: TaskRecord, newNote: string) => void;
    onTagsAdd?: (task: TaskRecord, tagIds: string[]) => void;
};

export const TaskItem: React.FC<TaskItemProps> = ({
    task,
    viewMode,
    editingTaskId,
    dragOverTaskId,
    dragOverPosition,
    projects,
    tags,
    taskTagMap,
    editTaskName,
    setEditTaskName,
    onDragStart,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,
    onToggleComplete,
    onTaskClick,
    onSave,
    onCancel,
    onInsertTask,
    onEditClick,
    onMoveToTop,
    onMoveToBottom,
    onNoteChange,
    onTagsAdd
}) => {

    // Track whether the user cancelled editing (Escape / ✗ button)
    // so onBlur doesn't trigger a save when cancelling.
    const cancelledRef = React.useRef(false);

    const [isNoteExpanded, setIsNoteExpanded] = React.useState(false); // Collapsed by default
    const [localNote, setLocalNote] = React.useState(task.fields.CD_note?.value || '');
    const noteDebounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    // Project picker state
    const [projectPickerQuery, setProjectPickerQuery] = React.useState<string | null>(null);
    const [projectPickerIndex, setProjectPickerIndex] = React.useState(0);
    const [pendingProjectId, setPendingProjectId] = React.useState<string | null>(null);

    // Tag picker state
    const [tagPickerQuery, setTagPickerQuery] = React.useState<string | null>(null);
    const [tagPickerIndex, setTagPickerIndex] = React.useState(0);
    const [pendingTagIds, setPendingTagIds] = React.useState<string[]>([]);

    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        setLocalNote(task.fields.CD_note?.value || '');
    }, [task.fields.CD_note?.value]);

    // Debounced Note Save matching Details Panel
    React.useEffect(() => {
        const currentNote = task.fields.CD_note?.value || '';
        if (localNote === currentNote) return;

        const timeoutId = setTimeout(() => {
            if (onNoteChange) {
                onNoteChange(task, localNote);
            }
        }, 1500);

        noteDebounceTimerRef.current = timeoutId;
        return () => {
            clearTimeout(timeoutId);
            noteDebounceTimerRef.current = null;
        };
    }, [localNote, task.fields.CD_note?.value, onNoteChange, task]);

    // Find associated tags
    const taskTags = taskTagMap[task.recordName]?.map(tagId => tags.find(t => t.recordName === tagId)).filter(Boolean) as TagRecord[] || [];

    const formatDate = (dateTimestamp: number) => {
        const date = new Date(dateTimestamp);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        if (taskDate.getTime() === today.getTime()) {
            return { text: 'Today', className: 'text-blue-500 bg-blue-50' };
        } else if (taskDate.getTime() === tomorrow.getTime()) {
            return { text: 'Tomorrow', className: 'text-green-500 bg-green-50' };
        } else if (taskDate < today) {
            return { text: date.toLocaleDateString(), className: 'text-red-500 bg-red-50' };
        } else {
            return { text: date.toLocaleDateString(), className: 'text-green-500 bg-green-50' };
        }
    };

    // Helper to determine if we should enable drag
    const canDrag = (viewMode === 'project' || viewMode === 'all_tasks' || viewMode === 'inbox' || viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'waiting' || viewMode === 'deferred' || viewMode === 'due') && editingTaskId !== task.recordName;

    // Helper to determine if we should show actions
    const showActions = (viewMode === 'project' || viewMode === 'all_tasks' || viewMode === 'inbox' || viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'waiting' || viewMode === 'deferred' || viewMode === 'due');

    const hasNote = localNote.trim().length > 0;

    return (
        <div
            draggable={canDrag}
            onDragStart={(e) => onDragStart(e, task, 'task')}
            onDragOver={(e) => onDragOver(e, task)}
            onDragEnter={() => onDragEnter(task)}
            onDragLeave={(e) => {
                // Prevent clearing if moving into a child element
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                onDragLeave();
            }}
            onDrop={(e) => onDrop(e, task)}
            className={`relative group p-3 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-all flex items-center gap-3 ${canDrag ? 'cursor-grab active:cursor-grabbing' : (editingTaskId === task.recordName ? '' : 'opacity-75')} ${editingTaskId === task.recordName ? 'z-20' : ''}`}
        >
            {dragOverTaskId === task.recordName && (!dragOverPosition || dragOverPosition === 'top') && (
                <div className="absolute -top-[2px] left-0 right-0 h-1 bg-blue-500 rounded-full z-10 pointer-events-none" />
            )}
            {dragOverTaskId === task.recordName && dragOverPosition === 'bottom' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full z-10 pointer-events-none" />
            )}
            <div
                className={`w-5 h-5 rounded-full border-2 cursor-pointer flex items-center justify-center transition-colors ${task.fields.CD_completed?.value === 1
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300 hover:border-blue-400'
                    }`}
                onClick={() => onToggleComplete(task)}
                title={viewMode === 'history' ? "Restore Task" : "Complete Task"}
            >
                {task.fields.CD_completed?.value === 1 && (
                    viewMode === 'history' ? <RotateCcw className="w-3 h-3 text-white" /> : <Check className="w-3.5 h-3.5 text-white" />
                )}
            </div>

            <div className="flex-1 min-w-0" onClick={() => onEditClick(task)}>
                {editingTaskId === task.recordName ? (
                    <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                        {/* Pickers meta row: project badge + pending tag badges */}
                        {(() => {
                            const pickedProject = projects.find(p => p.recordName === (pendingProjectId ?? task.fields.CD_project?.value));
                            const pendingTags = pendingTagIds.map(id => tags.find(t => t.recordName === id)).filter(Boolean) as TagRecord[];
                            if (!pickedProject && pendingTags.length === 0) return null;
                            return (
                                <div className="flex items-center gap-1 flex-wrap">
                                    {pickedProject && projectPickerQuery === null && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                                            style={{
                                                backgroundColor: pickedProject.fields.CD_color?.value ? `${pickedProject.fields.CD_color.value}20` : '#e5e7eb',
                                                color: pickedProject.fields.CD_color?.value || '#6b7280'
                                            }}
                                        >
                                            <SFSymbolMapper symbol={pickedProject.fields.CD_icon?.value} color={pickedProject.fields.CD_color?.value} size={11} />
                                            {pickedProject.fields.CD_name?.value}
                                        </span>
                                    )}
                                    {pendingTags.map(tag => (
                                        <span
                                            key={tag.recordName}
                                            className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md cursor-pointer"
                                            style={{
                                                backgroundColor: tag.fields.CD_color?.value ? `${tag.fields.CD_color.value}20` : '#e5e7eb',
                                                color: tag.fields.CD_color?.value || '#6b7280'
                                            }}
                                            onClick={() => setPendingTagIds(prev => prev.filter(id => id !== tag.recordName))}
                                            title="Click to remove"
                                        >
                                            #{tag.fields.CD_name.value} ×
                                        </span>
                                    ))}
                                </div>
                            );
                        })()}
                        <div className="flex items-center gap-2 relative">
                            <input
                                ref={inputRef}
                                type="text"
                                value={editTaskName}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setEditTaskName(val);
                                    // Detect active trigger: whichever of & or @ appears last
                                    const ampIdx = val.lastIndexOf('&');
                                    const atIdx = val.lastIndexOf('@');
                                    if (atIdx > ampIdx && atIdx !== -1) {
                                        setTagPickerQuery(val.slice(atIdx + 1));
                                        setTagPickerIndex(0);
                                        setProjectPickerQuery(null);
                                    } else if (ampIdx !== -1) {
                                        setProjectPickerQuery(val.slice(ampIdx + 1));
                                        setProjectPickerIndex(0);
                                        setTagPickerQuery(null);
                                    } else {
                                        setProjectPickerQuery(null);
                                        setTagPickerQuery(null);
                                    }
                                }}
                                className="flex-1 text-sm rounded border-gray-300 px-2 py-1"
                                autoFocus
                                onBlur={() => {
                                    if (!document.hasFocus()) return;
                                    setTimeout(() => {
                                        if (!cancelledRef.current && !projectPickerQuery && !tagPickerQuery) {
                                            const taskToSave = pendingProjectId
                                                ? { ...task, fields: { ...task.fields, CD_project: { value: pendingProjectId } } }
                                                : task;
                                            if (pendingTagIds.length > 0) onTagsAdd?.(taskToSave, pendingTagIds);
                                            onSave(taskToSave);
                                        }
                                        cancelledRef.current = false;
                                    }, 150);
                                }}
                                onKeyDown={(e) => {
                                    if (projectPickerQuery !== null) {
                                        const filtered = projects.filter(p =>
                                            p.fields.CD_name?.value.toLowerCase().includes(projectPickerQuery.toLowerCase())
                                        );
                                        if (e.key === 'ArrowDown') { e.preventDefault(); setProjectPickerIndex(i => Math.min(i + 1, filtered.length - 1)); return; }
                                        if (e.key === 'ArrowUp') { e.preventDefault(); setProjectPickerIndex(i => Math.max(i - 1, 0)); return; }
                                        if (e.key === 'Enter' && filtered.length > 0) {
                                            e.preventDefault();
                                            const chosen = filtered[projectPickerIndex] || filtered[0];
                                            const ampIdx = editTaskName.lastIndexOf('&');
                                            setEditTaskName(editTaskName.slice(0, ampIdx).trimEnd());
                                            setProjectPickerQuery(null);
                                            setPendingProjectId(chosen.recordName);
                                            return;
                                        }
                                        if (e.key === 'Escape') { setProjectPickerQuery(null); return; }
                                    } else if (tagPickerQuery !== null) {
                                        const filtered = tags.filter(t =>
                                            t.fields.CD_name.value.toLowerCase().includes(tagPickerQuery.toLowerCase()) &&
                                            !pendingTagIds.includes(t.recordName)
                                        );
                                        if (e.key === 'ArrowDown') { e.preventDefault(); setTagPickerIndex(i => Math.min(i + 1, filtered.length - 1)); return; }
                                        if (e.key === 'ArrowUp') { e.preventDefault(); setTagPickerIndex(i => Math.max(i - 1, 0)); return; }
                                        if (e.key === 'Enter' && filtered.length > 0) {
                                            e.preventDefault();
                                            const chosen = filtered[tagPickerIndex] || filtered[0];
                                            const atIdx = editTaskName.lastIndexOf('@');
                                            setEditTaskName(editTaskName.slice(0, atIdx).trimEnd());
                                            setTagPickerQuery(null);
                                            setPendingTagIds(prev => [...prev, chosen.recordName]);
                                            return;
                                        }
                                        if (e.key === 'Escape') { setTagPickerQuery(null); return; }
                                    } else {
                                        if (e.key === 'Enter') {
                                            const taskToSave = pendingProjectId
                                                ? { ...task, fields: { ...task.fields, CD_project: { value: pendingProjectId } } }
                                                : task;
                                            if (pendingTagIds.length > 0) onTagsAdd?.(taskToSave, pendingTagIds);
                                            onSave(taskToSave);
                                        }
                                        if (e.key === 'Escape') { cancelledRef.current = true; onCancel(); }
                                    }
                                }}
                            />
                            <button onMouseDown={(e) => e.preventDefault()} onClick={() => {
                                const taskToSave = pendingProjectId
                                    ? { ...task, fields: { ...task.fields, CD_project: { value: pendingProjectId } } }
                                    : task;
                                if (pendingTagIds.length > 0) onTagsAdd?.(taskToSave, pendingTagIds);
                                onSave(taskToSave);
                            }} className="text-green-600 p-1 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                            <button onMouseDown={(e) => { e.preventDefault(); cancelledRef.current = true; }} onClick={() => { setProjectPickerQuery(null); setTagPickerQuery(null); onCancel(); }} className="text-red-600 p-1 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>

                            {/* Project Picker Dropdown */}
                            {projectPickerQuery !== null && (() => {
                                const filtered = projects.filter(p =>
                                    p.fields.CD_name?.value.toLowerCase().includes(projectPickerQuery.toLowerCase())
                                );
                                return filtered.length > 0 ? (
                                    <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[220px] py-1 overflow-hidden">
                                        {filtered.map((proj, idx) => (
                                            <button
                                                key={proj.recordName}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    const ampIdx = editTaskName.lastIndexOf('&');
                                                    setEditTaskName(editTaskName.slice(0, ampIdx).trimEnd());
                                                    setProjectPickerQuery(null);
                                                    setPendingProjectId(proj.recordName);
                                                    inputRef.current?.focus();
                                                }}
                                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                                                    idx === projectPickerIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                                                }`}
                                            >
                                                <SFSymbolMapper symbol={proj.fields.CD_icon?.value} color={proj.fields.CD_color?.value} size={14} />
                                                <span className="truncate">{proj.fields.CD_name?.value}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : null;
                            })()}

                            {/* Tag Picker Dropdown */}
                            {tagPickerQuery !== null && (() => {
                                const filtered = tags.filter(t =>
                                    t.fields.CD_name.value.toLowerCase().includes(tagPickerQuery.toLowerCase()) &&
                                    !pendingTagIds.includes(t.recordName)
                                );
                                return filtered.length > 0 ? (
                                    <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[200px] py-1 overflow-hidden">
                                        {filtered.map((tag, idx) => (
                                            <button
                                                key={tag.recordName}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    const atIdx = editTaskName.lastIndexOf('@');
                                                    setEditTaskName(editTaskName.slice(0, atIdx).trimEnd());
                                                    setTagPickerQuery(null);
                                                    setPendingTagIds(prev => [...prev, tag.recordName]);
                                                    inputRef.current?.focus();
                                                }}
                                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                                                    idx === tagPickerIndex ? 'bg-purple-50 text-purple-700' : 'hover:bg-gray-50 text-gray-700'
                                                }`}
                                            >
                                                <span
                                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: tag.fields.CD_color?.value || '#9ca3af' }}
                                                />
                                                <span className="truncate">#{tag.fields.CD_name.value}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : null;
                            })()}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col w-full relative cursor-pointer">
                        <div className="flex items-center w-full">
                            <span className={`text-gray-900 ${task.fields.CD_completed?.value === 1 ? 'line-through text-gray-400' : ''}`}>
                                {task.fields.CD_name?.value}
                            </span>
                            {/* Meta Icons */}
                            <div className="flex items-center gap-1 ml-2">
                                {task.fields.CD_date?.value && task.fields.CD_dateactive?.value === 1 ? (() => {
                                    const { text, className } = formatDate(task.fields.CD_date.value);
                                    const hasTime = task.fields.CD_reminderactive?.value === 1;
                                    const timeText = hasTime ? new Date(task.fields.CD_date.value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
                                    return (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${className}`}>
                                            <Calendar className="w-3 h-3" /> {text}{hasTime ? ` at ${timeText}` : ''}
                                        </span>
                                    );
                                })() : null}

                                {task.fields.CD_recurring?.value === 1 && <span title="Recurring" className="text-blue-400"><Repeat className="w-3 h-3" /></span>}
                            </div>

                            {/* Actions: Right next to name/meta, larger icons */}
                            {showActions && (
                                <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onInsertTask(task); }}
                                        className="p-1.5 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg cursor-pointer"
                                        title="Insert Task Below"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>

                                    {onMoveToTop && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onMoveToTop(task); }}
                                            className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg ml-0.5 cursor-pointer"
                                            title="Move to Top"
                                        >
                                            <ArrowUpToLine className="w-4 h-4" />
                                        </button>
                                    )}

                                    {onMoveToBottom && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onMoveToBottom(task); }}
                                            className="p-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg ml-0.5 cursor-pointer"
                                            title="Move to Bottom"
                                        >
                                            <ArrowDownToLine className="w-4 h-4" />
                                        </button>
                                    )}

                                    <button
                                        onClick={(e) => { e.stopPropagation(); setIsNoteExpanded(!isNoteExpanded); }}
                                        className="p-1.5 text-yellow-600 bg-yellow-50 hover:bg-yellow-100 rounded-lg ml-0.5 cursor-pointer"
                                        title={!hasNote ? "Add Note" : (isNoteExpanded ? "Hide Note" : "Show Note")}
                                    >
                                        <AlignLeft className="w-4 h-4" />
                                    </button>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                                        className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg ml-0.5 cursor-pointer"
                                        title="Task Details"
                                    >
                                        <Info className="w-4 h-4" />
                                    </button>

                                    {task.fields.CD_link?.value && (
                                        <a
                                            href={task.fields.CD_link.value.startsWith('http') ? task.fields.CD_link.value : `https://${task.fields.CD_link.value}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-1.5 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg ml-0.5 cursor-pointer flex items-center justify-center"
                                            title="Open Link"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Project Name and Tags */}
                        {(viewMode !== 'project' && task.fields.CD_project?.value || taskTags.length > 0) && (
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {viewMode !== 'project' && task.fields.CD_project?.value && (() => {
                                    const proj = projects.find(p => p.recordName === task.fields.CD_project?.value);
                                    return proj ? (
                                        <span className="flex items-center gap-1 text-xs text-gray-400">
                                            <SFSymbolMapper
                                                symbol={proj.fields.CD_icon?.value}
                                                color={proj.fields.CD_color?.value}
                                                size={14}
                                            />
                                            {proj.fields.CD_name?.value}
                                        </span>
                                    ) : null;
                                })()}

                                {taskTags.length > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        {taskTags.map(tag => (
                                            <span
                                                key={tag.recordName}
                                                className="text-[10px] px-1.5 py-0.5 rounded-md font-medium whitespace-nowrap"
                                                style={{
                                                    backgroundColor: tag.fields.CD_color?.value ? `${tag.fields.CD_color.value}20` : '#e5e7eb',
                                                    color: tag.fields.CD_color?.value || '#6b7280'
                                                }}
                                            >
                                                #{tag.fields.CD_name.value}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Note Expansion */}
                        {(hasNote || isNoteExpanded) && (
                            <div className="w-full mt-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsNoteExpanded(!isNoteExpanded); }}
                                    className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <AlignLeft className="w-3.5 h-3.5" />
                                    <span>{isNoteExpanded ? 'Hide Note' : 'Show Note'}</span>
                                </button>
                                {isNoteExpanded && (
                                    <div className="mt-1.5 w-full">
                                        <textarea
                                            autoFocus={!hasNote}
                                            value={localNote}
                                            onChange={(e) => setLocalNote(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => {
                                                // Optional: allow escaping out of note
                                                if (e.key === 'Escape') {
                                                    e.currentTarget.blur();
                                                }
                                            }}
                                            className="p-2.5 bg-gray-50 text-gray-600 rounded-lg whitespace-pre-wrap text-[11px] border border-gray-100 max-h-60 overflow-y-auto w-full outline-none focus:ring-1 focus:ring-blue-300 resize-none font-mono"
                                            rows={Math.max(2, localNote.split('\n').length)}
                                            placeholder="Add a note..."
                                        />
                                        <div className="flex justify-end mt-1">
                                            <span className="text-[10px] text-gray-400">
                                                {localNote === (task.fields.CD_note?.value || '') ? 'Saved' : 'Typing...'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
