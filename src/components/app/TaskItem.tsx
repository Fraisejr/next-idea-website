import { ProjectRecord, TaskRecord } from '@/lib/cloudkit';
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
    Info // Imported Info
} from 'lucide-react';
import React from 'react';

type TaskItemProps = {
    task: TaskRecord;
    viewMode: string;
    editingTaskId: string | null;
    dragOverTaskId: string | null;
    projects: ProjectRecord[];
    editTaskName: string;
    setEditTaskName: (name: string) => void;

    // Handlers
    onDragStart: (e: React.DragEvent, task: TaskRecord, type: 'task') => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragEnter: (task: TaskRecord) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent, task: TaskRecord) => void;
    onToggleComplete: (task: TaskRecord) => void;
    onTaskClick: (task: TaskRecord) => void;
    onSave: (task: TaskRecord) => void;
    onCancel: () => void;
    onInsertTask: (task: TaskRecord) => void;
    onEditClick: (task: TaskRecord) => void;
};

export const TaskItem: React.FC<TaskItemProps> = ({
    task,
    viewMode,
    editingTaskId,
    dragOverTaskId,
    projects,
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
    onEditClick
}) => {
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
    const canDrag = (viewMode === 'project' || viewMode === 'inbox' || viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'waiting' || viewMode === 'deferred' || viewMode === 'due') && editingTaskId !== task.recordName;

    // Helper to determine if we should show actions
    const showActions = (viewMode === 'project' || viewMode === 'inbox' || viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'waiting' || viewMode === 'deferred' || viewMode === 'due');

    return (
        <div
            draggable={canDrag}
            onDragStart={(e) => onDragStart(e, task, 'task')}
            onDragOver={onDragOver}
            onDragEnter={() => onDragEnter(task)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, task)}
            className={`group p-3 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-all flex items-center gap-3 ${canDrag ? 'cursor-grab active:cursor-grabbing hover:border-blue-100' : 'opacity-75'
                } ${dragOverTaskId === task.recordName
                    ? 'border-blue-400 border-t-4 border-t-blue-500'
                    : ''
                }`}
        >
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
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                            type="text"
                            value={editTaskName}
                            onChange={(e) => setEditTaskName(e.target.value)}
                            className="flex-1 text-sm rounded border-gray-300 px-2 py-1"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') onSave(task);
                                if (e.key === 'Escape') onCancel();
                            }}
                        />
                        <button onClick={() => onSave(task)} className="text-green-600 p-1 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                        <button onClick={() => onCancel()} className="text-red-600 p-1 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
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
                                    return (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${className}`}>
                                            <Calendar className="w-3 h-3" /> {text}
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

                                    <button
                                        onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                                        className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg ml-0.5 cursor-pointer"
                                        title="Task Details"
                                    >
                                        <Info className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                        {/* Project Name (Only if not in project view) */}
                        {viewMode !== 'project' && task.fields.CD_project?.value && (
                            <span className="text-xs text-gray-400 mt-0.5">
                                {projects.find(p => p.recordName === task.fields.CD_project?.value)?.fields.CD_name?.value}
                            </span>
                        )}
                        {/* Show Project Name in History Mode (redundant check but keeping logic similar to before if needed, actually removed separate history check as generic check covers it) */}
                    </div>
                )}
            </div>
        </div>
    );
};
