'use client';

import { useEffect, useState } from 'react';
import { CloudKitProvider, useCloudKit } from '@/components/CloudKitProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ProjectRecord, TaskRecord } from '@/lib/cloudkit';
import { Loader2, ListTodo, CheckCircle2, Pencil, Check, X, ClipboardList, Plus, Clock, RotateCcw } from 'lucide-react';

function ProjectsList() {
    const { container, isAuthenticated, isLoading, login } = useCloudKit();
    const [projects, setProjects] = useState<ProjectRecord[]>([]);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    // Task Edit State
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editTaskName, setEditTaskName] = useState('');

    // Task & Selection State
    const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
    const [tasks, setTasks] = useState<TaskRecord[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);

    // View Mode
    const [viewMode, setViewMode] = useState<'project' | 'history'>('project');
    const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());

    const handleEditClick = (project: ProjectRecord) => {
        // Use recordName as ID for editing state
        setEditingId(project.recordName);
        setEditName(project.fields.CD_name?.value || '');
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditName('');
    };

    const handleSave = async (project: ProjectRecord) => {
        if (!editName.trim() || !container) return;

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };
            const recordID = {
                recordName: project.recordName,
                zoneID: zoneID
            };

            // 1. Fetch the full record to ensure we don't overwrite unseen fields
            // We typically need to pass the Record ID object correctly for custom zones
            // FIX: Must pass zoneID in the options object (second arg) for custom zones!
            const fetchResult = await privateDB.fetchRecords([project.recordName], { zoneID });

            if (fetchResult.hasErrors) {
                // Fallback: if fetching by ID logic fails (CloudKit JS ID structure is tricky), 
                // we might try just saving the partial with merge? 
                // But let's assume fetch works if ID is correct.
                throw new Error(fetchResult.errors[0].message);
            }

            const fullRecord = fetchResult.records[0];

            // 2. Update the field
            fullRecord.fields.CD_name = { value: editName };

            // 3. Save
            const saveResult = await privateDB.saveRecords([fullRecord], { zoneID });
            if (saveResult.hasErrors) {
                throw new Error(saveResult.errors[0].message);
            }

            // Success: Update local state with the new name
            // We keep our local partial fields but update the name and change tag
            const savedRecord = saveResult.records[0];
            setProjects(prev => prev.map(p =>
                p.recordName === savedRecord.recordName ?
                    {
                        ...p,
                        fields: { ...p.fields, CD_name: { value: editName } },
                        recordChangeTag: savedRecord.recordChangeTag
                    } : p
            ));

            setEditingId(null);
            setEditName('');

        } catch (err: any) {
            console.error('Save error:', err);
            alert('Failed to save changes: ' + err.message);
        }
    };

    const handleTaskSave = async (task: TaskRecord) => {
        if (!editTaskName.trim() || !container) return;

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            // Handle New Task Creation
            if (task.recordName === 'new-task') {
                const newRecord = {
                    recordType: 'CD_Task',
                    fields: {
                        CD_name: { value: editTaskName },
                        CD_id: { value: crypto.randomUUID() },
                        CD_project: { value: selectedProject?.recordName || '' }, // String ID
                        CD_completed: { value: 0 },
                        // Use the order we set in the local state object
                        CD_order: { value: task.fields.CD_order?.value || 0 },
                    }
                };

                const saveResult = await privateDB.saveRecords([newRecord], { zoneID });
                if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

                const savedRecord = saveResult.records[0];

                // Replace temp task with real one
                setTasks(prev => prev.map(t =>
                    t.recordName === 'new-task' ? savedRecord : t
                ));

                setEditingTaskId(null);
                setEditTaskName('');
                return;
            }

            // Handle Existing Task Update
            // 1. Fetch full record
            const fetchResult = await privateDB.fetchRecords([task.recordName], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);

            const fullRecord = fetchResult.records[0];

            // 2. Update field
            fullRecord.fields.CD_name = { value: editTaskName };

            // 3. Save
            const saveResult = await privateDB.saveRecords([fullRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            // Success: Update local state
            const savedRecord = saveResult.records[0];
            setTasks(prev => prev.map(t =>
                t.recordName === savedRecord.recordName ?
                    {
                        ...t,
                        fields: { ...t.fields, CD_name: { value: editTaskName } },
                        recordChangeTag: savedRecord.recordChangeTag
                    } : t
            ));

            setEditingTaskId(null);
            setEditTaskName('');

        } catch (err: any) {
            console.error('Save task error:', err);
            alert('Failed to save task: ' + err.message);
        }
    };

    const handleCreateTask = () => {
        if (!selectedProject || editingTaskId) return; // Don't start if already editing

        const newTask: TaskRecord = {
            recordName: 'new-task',
            recordChangeTag: '',
            recordType: 'CD_Task',
            fields: {
                CD_name: { value: '' },
                CD_id: { value: 'new-task' },
                CD_project: { value: selectedProject.recordName },
                CD_completed: { value: 0 },
                CD_order: { value: tasks.reduce((max, t) => Math.max(max, t.fields.CD_order?.value || 0), 0) + 1 }
            }
        };

        setTasks(prev => [...prev, newTask]);
        setEditingTaskId('new-task');
        setEditTaskName('');
    };

    const handleInsertTask = async (afterTask: TaskRecord) => {
        if (!selectedProject || editingTaskId || !container) return;

        // Find index of afterTask
        const index = tasks.findIndex(t => t.recordName === afterTask.recordName);
        if (index === -1) return;

        const currentOrder = afterTask.fields.CD_order?.value || 0;
        const newOrder = currentOrder + 1;

        // Prepare batch: New Task + Shifting Tasks
        const privateDB = container.privateCloudDatabase;
        const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

        // Local State Update (Shifted Tasks + New Task)
        const updatedTasks = [...tasks];
        const shiftedRecordsToSave: any[] = [];

        // Shift local items and prepare for DB save
        updatedTasks.forEach(t => {
            const tOrder = t.fields.CD_order?.value || 0;
            if (tOrder >= newOrder) {
                // Update local task object
                t.fields.CD_order = { value: tOrder + 1 };

                // Prepare for DB save (only send changed fields for update)
                shiftedRecordsToSave.push({
                    recordName: t.recordName,
                    recordType: 'CD_Task',
                    recordChangeTag: t.recordChangeTag, // Important for updates
                    fields: {
                        CD_order: { value: tOrder + 1 }
                    }
                });
            }
        });

        // Create new task object for local state
        const newTask: TaskRecord = {
            recordName: 'new-task', // Temporary ID for local state
            recordChangeTag: '',
            recordType: 'CD_Task',
            fields: {
                CD_name: { value: '' },
                CD_id: { value: crypto.randomUUID() }, // Client-side UUID for new task
                CD_project: { value: selectedProject.recordName },
                CD_completed: { value: 0 },
                CD_order: { value: newOrder }
            }
        };

        // Insert new task into the local array at the correct position
        updatedTasks.splice(index + 1, 0, newTask);

        // Sort the updatedTasks array to ensure correct display order
        updatedTasks.sort((a, b) => (a.fields.CD_order?.value ?? 0) - (b.fields.CD_order?.value ?? 0));

        setTasks(updatedTasks);
        setEditingTaskId('new-task');
        setEditTaskName('');

        // Persist shifts in background
        if (shiftedRecordsToSave.length > 0) {
            try {
                const result = await privateDB.saveRecords(shiftedRecordsToSave, { zoneID });
                if (result.hasErrors) throw new Error(result.errors[0].message);

                // Update local tags for shifted items
                const savedRecords = result.records;
                setTasks(currentTasks => currentTasks.map(t => {
                    const saved = savedRecords.find((r: any) => r.recordName === t.recordName);
                    return saved ? { ...t, recordChangeTag: saved.recordChangeTag } : t;
                }));
            } catch (err) {
                console.error('Failed to shift tasks:', err);
            }
        }
    };

    // Keyboard Shortcut for New Task
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Cmd+N (Mac) or Ctrl+N (Windows/Linux)
            if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
                e.preventDefault(); // Prevent opening new window
                handleCreateTask();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedProject, editingTaskId, tasks]); // Dependencies to ensure current state used if needed, though handleCreateTask checks them


    const handleTaskEditClick = (task: TaskRecord) => {
        setEditingTaskId(task.recordName);
        setEditTaskName(task.fields.CD_name?.value || '');
    };

    const handleTaskCancel = () => {
        // If cancelling a new task, remove it from the list
        if (editingTaskId === 'new-task') {
            setTasks(prev => prev.filter(t => t.recordName !== 'new-task'));
        }
        setEditingTaskId(null);
        setEditTaskName('');
    };


    useEffect(() => {
        // Mount listeners
        if (container && !isAuthenticated && !isLoading) {
            // (Listeners are already set up in Provider or we rely on promise results usually)
            // But we can keep whenUserSignsIn just in case
            container.whenUserSignsIn().then(() => {
                window.location.reload();
            });
        }
    }, [container, isAuthenticated, isLoading]);

    // Fetch Projects using Query (Works)
    useEffect(() => {
        const fetchProjects = async () => {
            if (!container) return;
            setFetching(true);
            setError(null);
            try {
                const privateDB = container.privateCloudDatabase;
                const query = {
                    recordType: 'CD_Project',
                    filterBy: [{ fieldName: 'CD_name', comparator: 'NOT_EQUALS', fieldValue: { value: '' } }],
                    desiredKeys: ['CD_name', 'CD_id', 'CD_order', 'CD_completed', 'CD_singleactions'],
                    resultsLimit: 100
                };
                const options = { zoneID: { zoneName: 'com.apple.coredata.cloudkit.zone' } };
                const result = await privateDB.performQuery(query, options);
                if (result.hasErrors) throw new Error(result.errors[0].message);

                let records = result.records as ProjectRecord[];
                records = records.filter(p => !p.fields.CD_completed || p.fields.CD_completed.value !== 1);
                records.sort((a, b) => {
                    const isSingleA = a.fields.CD_singleactions?.value === 1;
                    const isSingleB = b.fields.CD_singleactions?.value === 1;
                    if (isSingleA && !isSingleB) return -1;
                    if (!isSingleA && isSingleB) return 1;
                    const orderA = a.fields.CD_order?.value ?? 0;
                    const orderB = b.fields.CD_order?.value ?? 0;
                    return orderA - orderB;
                });

                setProjects(records);
                // Select first project by default if none selected
                if (records.length > 0 && !selectedProject) {
                    setSelectedProject(records[0]);
                }
            } catch (err: any) {
                console.error('Fetch error:', err);
                setError(err.message || 'Failed to fetch projects');
            } finally {
                setFetching(false);
            }
        };

        if (isAuthenticated) {
            fetchProjects();
        }
    }, [isAuthenticated, container]); // Run once on auth

    // Drag and Drop Handlers
    const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
    const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

    const handleDragStart = (e: React.DragEvent, task: TaskRecord) => {
        e.dataTransfer.setData('text/plain', task.recordName);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, project: ProjectRecord) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDragEnter = (project: ProjectRecord) => {
        if (project.recordName !== selectedProject?.recordName) {
            setDragOverProjectId(project.recordName);
        }
    };

    const handleDragLeave = () => {
        setDragOverProjectId(null);
    };

    const handleDrop = async (e: React.DragEvent, targetProject: ProjectRecord) => {
        e.preventDefault();
        setDragOverProjectId(null);

        const taskId = e.dataTransfer.getData('text/plain');
        if (!taskId || !container) return;

        // Don't do anything if dropped on same project
        if (targetProject.recordName === selectedProject?.recordName) return;

        // Optimistic update: Remove task from current list immediately
        setTasks(prev => prev.filter(t => t.recordName !== taskId));

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            // 1. Fetch task
            const fetchResult = await privateDB.fetchRecords([taskId], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const taskRecord = fetchResult.records[0];

            // 2. Update project reference
            // The CloudKit schema for this field is actually a String (containing the ID), 
            // not a native Reference type, as confirmed by the "expected type STRING" error.
            taskRecord.fields.CD_project = {
                value: targetProject.recordName
            };

            // 3. Save
            const saveResult = await privateDB.saveRecords([taskRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            console.log('Task reassigned successfully');

        } catch (err: any) {
            console.error('Reassign error:', err);
            alert('Failed to reassign task: ' + err.message);
            // Verify/Reload if failed
            window.location.reload();
        }
    };

    const handleTaskDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleTaskDragEnter = (task: TaskRecord) => {
        if (task.recordName !== editingTaskId) {
            setDragOverTaskId(task.recordName);
        }
    };

    const handleTaskDragLeave = () => {
        setDragOverTaskId(null);
    };

    const handleTaskDrop = async (e: React.DragEvent, targetTask: TaskRecord) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverTaskId(null);

        const draggedTaskId = e.dataTransfer.getData('text/plain');
        if (!draggedTaskId || draggedTaskId === targetTask.recordName || !container) return;

        // Ensure we are reordering within the same list (check if dragged task is in current list)
        // If not found, it might be a reassignment drop (handled elsewhere) - but here we are dropping ON A TASK.
        const oldIndex = tasks.findIndex(t => t.recordName === draggedTaskId);
        if (oldIndex === -1) return; // Task not in current list (maybe separate window?)

        const newIndex = tasks.findIndex(t => t.recordName === targetTask.recordName);
        if (newIndex === -1) return;

        // Reorder locally
        const newTasks = [...tasks];
        const [movedTask] = newTasks.splice(oldIndex, 1);
        newTasks.splice(newIndex, 0, movedTask);

        // Normalize Orders (1-based index)
        const tasksToSave: any[] = [];
        const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

        newTasks.forEach((t, i) => {
            const newOrder = i + 1;
            // Update if changed (always update dragged task, and shifted ones)
            if (t.fields.CD_order?.value !== newOrder) {
                // Update local
                t.fields.CD_order = { value: newOrder };

                // Prepare for DB
                tasksToSave.push({
                    recordName: t.recordName,
                    recordType: 'CD_Task',
                    recordChangeTag: t.recordChangeTag,
                    fields: {
                        CD_order: { value: newOrder }
                    }
                });
            }
        });

        setTasks(newTasks);

        // Batch Save
        if (tasksToSave.length > 0) {
            try {
                const privateDB = container.privateCloudDatabase;
                const result = await privateDB.saveRecords(tasksToSave, { zoneID });

                if (result.hasErrors) throw new Error(result.errors[0].message);

                // Update local state with new change tags to prevent conflict on next save
                const savedRecords = result.records;
                setTasks(currentTasks => currentTasks.map(t => {
                    const saved = savedRecords.find((r: any) => r.recordName === t.recordName);
                    return saved ? { ...t, recordChangeTag: saved.recordChangeTag } : t;
                }));

                console.log('Reorder saved');
            } catch (err) {
                console.error('Reorder failed:', err);
                alert('Failed to save order');
            }
        }
    };

    // Fetch Tasks logic
    useEffect(() => {
        const fetchTasks = async () => {
            if (!container) return;

            // If in project mode but no project selected, clear tasks
            if (viewMode === 'project' && !selectedProject) {
                setTasks([]);
                return;
            }

            setLoadingTasks(true);
            try {
                const privateDB = container.privateCloudDatabase;
                const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

                let query: any;

                if (viewMode === 'project' && selectedProject) {
                    query = {
                        recordType: 'CD_Task',
                        filterBy: [{
                            fieldName: 'CD_project',
                            comparator: 'EQUALS',
                            fieldValue: { value: selectedProject.recordName }
                        }],
                        desiredKeys: ['CD_name', 'CD_id', 'CD_order', 'CD_project', 'CD_completed'],
                        resultsLimit: 200
                    };
                } else if (viewMode === 'history') {
                    // Fetch ALL completed tasks
                    query = {
                        recordType: 'CD_Task',
                        filterBy: [{
                            fieldName: 'CD_completed',
                            comparator: 'EQUALS',
                            fieldValue: { value: 1 }
                        }],
                        desiredKeys: ['CD_name', 'CD_id', 'CD_order', 'CD_project', 'CD_completed'],
                        resultsLimit: 100
                    };
                } else {
                    // No project selected in project mode, or other unhandled viewMode
                    setTasks([]);
                    setLoadingTasks(false);
                    return;
                }

                const result = await privateDB.performQuery(query, { zoneID });
                if (result.hasErrors) throw new Error(result.errors[0].message);

                const taskRecords = result.records as TaskRecord[];

                // Sort by Order
                // For history, maybe sort by modification date? But we don't have it easily available in desiredKeys.
                // Existing sort uses CD_order.
                taskRecords.sort((a, b) => (a.fields.CD_order?.value ?? 0) - (b.fields.CD_order?.value ?? 0));

                setTasks(taskRecords);
            } catch (err: any) {
                console.error('Fetch tasks error:', err);
                setTasks([]);
            } finally {
                setLoadingTasks(false);
            }
        };

        fetchTasks();
    }, [selectedProject, viewMode, container]);


    const handleToggleComplete = async (task: TaskRecord) => {
        if (!container) return;

        const isCompleting = task.fields.CD_completed?.value !== 1;

        // Optimistic UI updates
        // If we in 'project' mode and completing -> hide it (add to completingIds then remove)
        // If we in 'history' mode and uncompleting -> hide it (restore to project)

        // For simplicity: We just update local state CD_completed.
        // If viewMode=project:
        //   - completing: hide after animation
        //   - uncompleting: (not possible usually as they are hidden, unless we just undid it)
        // If viewMode=history:
        //   - uncompleting: hide immediately (remove from this list)
        //   - completing: (not possible as they are already completed)

        const privateDB = container.privateCloudDatabase;
        const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

        // Optimistic Update
        if (viewMode === 'project' && isCompleting) {
            setCompletingTaskIds(prev => new Set(prev).add(task.recordName));
            setTimeout(() => {
                setCompletingTaskIds(prev => {
                    const next = new Set(prev);
                    next.delete(task.recordName);
                    return next;
                });
            }, 1000);
        }

        // Update Local State array
        // If in history mode and we uncomplete, we should remove it from the list immediately or animate?
        // Let's just update the value, and let the render filter handle it (if we filter history by completed=1).

        setTasks(prev => prev.map(t =>
            t.recordName === task.recordName
                ? { ...t, fields: { ...t.fields, CD_completed: { value: isCompleting ? 1 : 0 } } }
                : t
        ));

        // Persist
        try {
            const recordToSave = {
                recordName: task.recordName,
                recordChangeTag: task.recordChangeTag,
                fields: {
                    CD_completed: { value: isCompleting ? 1 : 0 },
                    CD_ticked: { value: isCompleting ? 1 : 0 },
                    CD_modifieddate: { value: Date.now() }
                }
            };
            const result = await privateDB.saveRecords([recordToSave], { zoneID });
            if (result.hasErrors) throw new Error(result.errors[0].message);

            // Update local state with new change tag
            const savedRecord = result.records[0];
            setTasks(currentTasks => currentTasks.map(t =>
                t.recordName === savedRecord.recordName
                    ? { ...t, recordChangeTag: savedRecord.recordChangeTag }
                    : t
            ));
        } catch (err) {
            console.error('Toggle complete failed:', err);
            // Revert on error?
        }
    };

    // Derived Lists
    // In 'project' mode: show tasks that are NOT completed OR are in the 'completing' animation state.
    // In 'history' mode: show tasks that ARE completed (and NOT uncompleted, though local state update handles that).

    const visibleTasks = tasks.filter(t => {
        if (viewMode === 'project') {
            return (t.fields.CD_completed?.value !== 1) || completingTaskIds.has(t.recordName);
        } else {
            // History mode
            return t.fields.CD_completed?.value === 1;
        }
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!isAuthenticated) {
        // [Existing Login UI]
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
                    <ListTodo className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Log in to Next Idea</h1>
                <p className="text-gray-600 mb-8 max-w-md">Access your projects and tasks directly from your browser.</p>
                <div id="apple-sign-in-button" className="transition-transform hover:scale-105"></div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-64px)] mt-16 bg-white overflow-hidden relative">
            {/* Sidebar: Projects */}
            <div className="w-64 border-r border-gray-100 bg-gray-50/50 flex flex-col">
                <div className="p-4 border-b border-gray-100 bg-white">
                    <h2 className="font-bold text-gray-900 flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-blue-600" />
                        Projects ({projects.length})
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {fetching ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        projects.map(project => (
                            <div
                                key={project.recordName}
                                onClick={() => {
                                    setSelectedProject(project);
                                    setViewMode('project');
                                }}
                                onDragOver={(e) => handleDragOver(e, project)}
                                onDragEnter={() => handleDragEnter(project)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, project)}
                                className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'project' && selectedProject?.recordName === project.recordName
                                    ? 'bg-blue-50 text-blue-700'
                                    : dragOverProjectId === project.recordName
                                        ? 'bg-blue-100 ring-2 ring-blue-300 ring-inset' // Visual cue for drop target
                                        : 'hover:bg-gray-100 text-gray-700'
                                    }`}
                            >
                                <div className="flex-1 min-w-0 font-medium truncate">
                                    {editingId === project.recordName ? (
                                        // Reuse edit input logic within sidebar item
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="block w-full text-sm rounded border-gray-300 px-1 py-0.5"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSave(project);
                                                    if (e.key === 'Escape') handleCancel();
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <button onClick={(e) => { e.stopPropagation(); handleSave(project); }} className="text-green-600"><Check className="w-4 h-4" /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleCancel(); }} className="text-red-600"><X className="w-4 h-4" /></button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between w-full">
                                            <span className="truncate">{project.fields.CD_name?.value || 'Untitled'}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditClick(project);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 rounded"
                                            >
                                                <Pencil className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Sidebar Footer: Global Views */}
                <div className="p-2 border-t border-gray-100 bg-white">
                    <div
                        onClick={() => {
                            setViewMode('history');
                            setSelectedProject(null);
                        }}
                        className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'history'
                            ? 'bg-blue-50 text-blue-700'
                            : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <Clock className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                        <span className="font-medium">Completed Tasks</span>
                    </div>
                </div>
            </div>

            {/* Main Content: Tasks */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-900">
                            {viewMode === 'project'
                                ? (selectedProject?.fields.CD_name?.value || 'Select a Project')
                                : 'Completed Tasks'
                            }
                        </h1>
                        {viewMode === 'project' && selectedProject && (
                            <button
                                onClick={handleCreateTask}
                                className="p-1 rounded-full text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                title="New Task (Cmd+N)"
                            >
                                <Plus className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loadingTasks ? (
                        <div className="flex justify-center p-10">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                        </div>
                    ) : visibleTasks.length === 0 ? (
                        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            {viewMode === 'project' ? (
                                <>
                                    <ListTodo className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500">No active tasks in this project.</p>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-12 h-12 text-green-200 mx-auto mb-4" />
                                    <p className="text-gray-500">No completed tasks yet.</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {visibleTasks.map(task => (
                                <div
                                    key={task.recordName}
                                    draggable={viewMode === 'project' && editingTaskId !== task.recordName} // Disable drag when editing or in history
                                    onDragStart={(e) => handleDragStart(e, task)}
                                    // Drop Handlers for Reordering
                                    onDragOver={handleTaskDragOver}
                                    onDragEnter={() => handleTaskDragEnter(task)}
                                    onDragLeave={handleTaskDragLeave}
                                    onDrop={(e) => handleTaskDrop(e, task)}
                                    className={`group p-4 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-all flex items-center gap-3 ${viewMode === 'project' ? 'cursor-grab active:cursor-grabbing hover:border-blue-100' : 'opacity-75'
                                        } ${dragOverTaskId === task.recordName
                                            ? 'border-blue-400 border-t-4 border-t-blue-500' // Visual cue (insert above style) 
                                            : ''
                                        }`}
                                >
                                    <div
                                        className={`w-5 h-5 rounded-full border-2 cursor-pointer flex items-center justify-center transition-colors ${task.fields.CD_completed?.value === 1
                                            ? 'bg-green-500 border-green-500' // Visual "checked" state
                                            : 'border-gray-300 hover:border-blue-400'
                                            }`}
                                        onClick={() => handleToggleComplete(task)}
                                        title={viewMode === 'history' ? "Restore Task" : "Complete Task"}
                                    >
                                        {task.fields.CD_completed?.value === 1 && (
                                            viewMode === 'history' ? <RotateCcw className="w-3 h-3 text-white" /> : <Check className="w-3.5 h-3.5 text-white" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        {editingTaskId === task.recordName ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editTaskName}
                                                    onChange={(e) => setEditTaskName(e.target.value)}
                                                    className="flex-1 text-sm rounded border-gray-300 px-2 py-1"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleTaskSave(task);
                                                        if (e.key === 'Escape') handleTaskCancel();
                                                    }}
                                                />
                                                <button onClick={() => handleTaskSave(task)} className="text-green-600 p-1 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                                                <button onClick={() => handleTaskCancel()} className="text-red-600 p-1 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between w-full relative">
                                                <span className={`text-gray-900 ${task.fields.CD_completed?.value === 1 ? 'line-through text-gray-400' : ''}`}>
                                                    {task.fields.CD_name?.value}
                                                </span>
                                                {/* Only show actions in Project Mode */}
                                                {viewMode === 'project' && (
                                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleInsertTask(task)}
                                                            className="p-1 mr-1 text-gray-400 hover:text-green-600 rounded"
                                                            title="Insert Task Below"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleTaskEditClick(task)}
                                                            className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                                {/* Show different actions or Project Name in History Mode? */}
                                                {viewMode === 'history' && (
                                                    <span className="text-xs text-gray-400">
                                                        {projects.find(p => p.recordName === task.fields.CD_project?.value)?.fields.CD_name?.value}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AppPage() {
    return (
        <CloudKitProvider>
            <main className="min-h-screen bg-white">
                <Navbar />
                <div className="pt-20">
                    <ProjectsList />
                </div>
                <Footer />
            </main>
        </CloudKitProvider>
    );
}
