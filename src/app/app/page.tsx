'use client';

import { useEffect, useState } from 'react';
import { CloudKitProvider, useCloudKit } from '@/components/CloudKitProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ProjectRecord, TaskRecord } from '@/lib/cloudkit';
import { Loader2, ListTodo, CheckCircle2, Pencil, Check, X, ClipboardList, Plus, Clock, RotateCcw, Calendar, Hourglass, Repeat, Moon, ChevronRight, Zap, Inbox, Keyboard, CalendarClock, CalendarDays } from 'lucide-react';

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
    const [taskError, setTaskError] = useState<string | null>(null);

    // View Mode
    const [viewMode, setViewMode] = useState<'project' | 'history' | 'inbox' | 'next_actions' | 'someday' | 'due' | 'waiting' | 'deferred'>('next_actions'); // Default to next_actions
    const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());

    // Details Panel State
    const [selectedTaskDetails, setSelectedTaskDetails] = useState<TaskRecord | null>(null);

    // Optimistic State Cache (to handle query latency)
    const [optimisticTasks, setOptimisticTasks] = useState<Record<string, TaskRecord>>({});

    // Keyboard Shortcuts Modal
    const [showShortcuts, setShowShortcuts] = useState(false);

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

    // Create new project at bottom of list
    const handleCreateProject = () => {
        if (!container) return;

        const maxOrder = projects.reduce((max, p) => Math.max(max, p.fields.CD_order?.value || 0), 0);
        const newProject: ProjectRecord = {
            recordName: 'new-project',
            recordType: 'CD_Project',
            fields: {
                CD_name: { value: '' },
                CD_id: { value: 'new-project' },
                CD_order: { value: maxOrder + 1 },
                CD_singleactions: { value: 0 }
            }
        };

        setProjects(prev => [...prev, newProject]);
        setEditingId('new-project');
        setEditName('');
    };

    // Create new project at top of list
    const handleCreateProjectAtTop = async () => {
        if (!container) return;

        const newProject: ProjectRecord = {
            recordName: 'new-project',
            recordType: 'CD_Project',
            fields: {
                CD_name: { value: '' },
                CD_id: { value: 'new-project' },
                CD_order: { value: 0 },
                CD_singleactions: { value: 0 }
            }
        };

        // Shift all existing projects down
        const shiftedProjects = projects.map(p => ({
            ...p,
            fields: { ...p.fields, CD_order: { value: (p.fields.CD_order?.value || 0) + 1 } }
        }));

        setProjects([newProject, ...shiftedProjects]);
        setEditingId('new-project');
        setEditName('');

        // Persist shifts in background
        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            const recordsToUpdate = projects.map(p => ({
                recordName: p.recordName,
                fields: {
                    CD_order: { value: (p.fields.CD_order?.value || 0) + 1 }
                }
            }));

            if (recordsToUpdate.length > 0) {
                await privateDB.saveRecords(recordsToUpdate, { zoneID });
            }
        } catch (err) {
            console.error('Failed to shift projects:', err);
        }
    };

    // Save new or edited project
    const handleProjectSave = async () => {
        if (!editName.trim() || !container || !editingId) return;

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            if (editingId === 'new-project') {
                // Create new project
                const recordName = crypto.randomUUID();
                const project = projects.find(p => p.recordName === 'new-project');

                const newRecord = {
                    recordName: recordName,
                    recordType: 'CD_Project',
                    fields: {
                        CD_name: { value: editName },
                        CD_id: { value: crypto.randomUUID() },
                        CD_order: { value: project?.fields.CD_order?.value || 0 },
                        CD_singleactions: { value: 0 },
                        CD_focus: { value: 1 }
                    }
                };

                const result = await privateDB.saveRecords([newRecord], { zoneID });
                if (result.hasErrors) throw new Error(result.errors[0].message);

                const savedRecord = result.records[0];
                setProjects(prev => prev.map(p =>
                    p.recordName === 'new-project'
                        ? { ...savedRecord, fields: savedRecord.fields }
                        : p
                ));
            } else {
                // Update existing project - use existing handleSave logic
                const project = projects.find(p => p.recordName === editingId);
                if (project) {
                    await handleSave(project);
                    return;
                }
            }

            setEditingId(null);
            setEditName('');
        } catch (err: any) {
            console.error('Save project error:', err);
            alert('Failed to save project: ' + err.message);
        }
    };

    const handleTaskSave = async (task: TaskRecord) => {
        if (!editTaskName.trim() || !container) return;

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            // Handle New Task Creation
            if (task.recordName === 'new-task') {
                // CRITICAL: Generate a proper recordName (UUID) for CloudKit compatibility
                // Without this, CloudKit sync fails on iOS
                const recordName = crypto.randomUUID();

                console.log('[CloudKit Sync] Creating new task with recordName:', recordName);

                // Find Single Actions project for Next Actions view or Someday view
                const singleActionsProject = (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred')
                    ? projects.find(p => p.fields.CD_singleactions?.value === 1)
                    : null;

                const newRecord = {
                    recordName: recordName, // FIXED: Added recordName for CloudKit compatibility
                    recordType: 'CD_Task',
                    fields: {
                        CD_name: { value: editTaskName },
                        CD_id: { value: crypto.randomUUID() },
                        // Inbox: omit project. Next Actions/Someday/Due: use Single Actions project. Project mode: use selectedProject.
                        ...(viewMode === 'inbox' ? {}
                            : (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred')
                                ? (singleActionsProject?.recordName ? { CD_project: { value: singleActionsProject.recordName } } : {})
                                : (selectedProject?.recordName ? { CD_project: { value: selectedProject.recordName } } : {})),
                        ...(viewMode === 'someday' ? { CD_someday: { value: 1 } } : {}),
                        ...(viewMode === 'due' ? { CD_date: { value: Date.now() }, CD_dateactive: { value: 1 } } : {}), // Default to Today & Active
                        ...(viewMode === 'waiting' ? { CD_waitingfor: { value: 1 }, CD_someday: { value: 0 } } : {}),
                        ...(viewMode === 'deferred' ? { CD_date: { value: new Date(new Date().setHours(24, 0, 0, 0)).getTime() }, CD_dateactive: { value: 1 }, CD_hideuntildate: { value: 1 }, CD_someday: { value: 0 } } : {}),
                        CD_completed: { value: 0 },
                        // Use the order we set in the local state object
                        CD_order: { value: task.fields.CD_order?.value || 0 },
                    }
                };

                console.log('[CloudKit Sync] Saving new task:', newRecord);
                const saveResult = await privateDB.saveRecords([newRecord], { zoneID });

                if (saveResult.hasErrors) {
                    console.error('[CloudKit Sync] Failed to save new task:', saveResult.errors);
                    throw new Error(saveResult.errors[0].message);
                }

                const savedRecord = saveResult.records[0];
                console.log('[CloudKit Sync] ✅ Task created successfully:', savedRecord.recordName);

                // Replace temp task with real one
                setTasks(prev => prev.map(t =>
                    t.recordName === 'new-task' ? {
                        ...savedRecord,
                        fields: {
                            ...savedRecord.fields,
                            ...((viewMode === 'due' && !savedRecord.fields.CD_date) ? { CD_date: { value: Date.now() }, CD_dateactive: { value: 1 } } : {}),
                            ...((viewMode === 'waiting' && !savedRecord.fields.CD_waitingfor) ? { CD_waitingfor: { value: 1 }, CD_someday: { value: 0 } } : {}),
                            ...((viewMode === 'deferred' && !savedRecord.fields.CD_date) ? { CD_date: { value: new Date(new Date().setHours(24, 0, 0, 0)).getTime() }, CD_dateactive: { value: 1 }, CD_hideuntildate: { value: 1 }, CD_someday: { value: 0 } } : {})
                        }
                    } : t
                ));

                // Add to optimistic tasks to prevent flickering on next poll/fetch
                setOptimisticTasks(prev => ({
                    ...prev,
                    [savedRecord.recordName]: savedRecord
                }));

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
        if ((!selectedProject && viewMode !== 'inbox' && viewMode !== 'next_actions' && viewMode !== 'someday' && viewMode !== 'due' && viewMode !== 'waiting' && viewMode !== 'deferred') || editingTaskId) return; // Don't start if already editing

        // Find Single Actions project for Next Actions view or Someday view
        const singleActionsProject = (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred')
            ? projects.find(p => p.fields.CD_singleactions?.value === 1)
            : null;

        const newTask: TaskRecord = {
            recordName: 'new-task',
            recordChangeTag: '',
            recordType: 'CD_Task',
            fields: {
                CD_name: { value: '' },
                CD_id: { value: 'new-task' },
                // Inbox: omit project. Next Actions/Someday: use Single Actions project. Project mode: use selectedProject.
                ...(viewMode === 'inbox' ? {}
                    : (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred')
                        ? (singleActionsProject?.recordName ? { CD_project: { value: singleActionsProject.recordName } } : {})
                        : (selectedProject?.recordName ? { CD_project: { value: selectedProject.recordName } } : {})),
                ...(viewMode === 'someday' ? { CD_someday: { value: 1 } } : {}),
                ...(viewMode === 'due' ? { CD_date: { value: Date.now() }, CD_dateactive: { value: 1 } } : {}),
                ...(viewMode === 'waiting' ? { CD_waitingfor: { value: 1 }, CD_someday: { value: 0 } } : {}),
                ...(viewMode === 'deferred' ? { CD_date: { value: new Date(new Date().setHours(24, 0, 0, 0)).getTime() }, CD_dateactive: { value: 1 }, CD_hideuntildate: { value: 1 }, CD_someday: { value: 0 } } : {}),
                CD_completed: { value: 0 },
                CD_order: { value: tasks.reduce((max, t) => Math.max(max, t.fields.CD_order?.value || 0), 0) + 1 }
            }
        };

        setTasks(prev => [...prev, newTask]);
        setEditingTaskId('new-task');
        setEditTaskName('');
    };

    const handleInsertTask = async (afterTask: TaskRecord) => {
        if ((!selectedProject && viewMode !== 'inbox' && viewMode !== 'next_actions' && viewMode !== 'someday' && viewMode !== 'due' && viewMode !== 'waiting' && viewMode !== 'deferred') || editingTaskId || !container) return;

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

        // Find Single Actions project for Next Actions view or Someday view
        const singleActionsProject = (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred')
            ? projects.find(p => p.fields.CD_singleactions?.value === 1)
            : null;

        // Create new task object for local state
        const newTask: TaskRecord = {
            recordName: 'new-task', // Temporary ID for local state
            recordChangeTag: '',
            recordType: 'CD_Task',
            fields: {
                CD_name: { value: '' },
                CD_id: { value: crypto.randomUUID() }, // Client-side UUID for new task
                // Inbox: omit project. Next Actions/Someday: use Single Actions project. Project mode: use selectedProject.
                ...(viewMode === 'inbox' ? {}
                    : (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred')
                        ? (singleActionsProject?.recordName ? { CD_project: { value: singleActionsProject.recordName } } : {})
                        : (selectedProject?.recordName ? { CD_project: { value: selectedProject.recordName } } : {})),
                ...(viewMode === 'someday' ? { CD_someday: { value: 1 } } : {}),
                ...(viewMode === 'due' ? { CD_date: { value: Date.now() }, CD_dateactive: { value: 1 } } : {}),
                ...(viewMode === 'waiting' ? { CD_waitingfor: { value: 1 }, CD_someday: { value: 0 } } : {}),
                ...(viewMode === 'deferred' ? { CD_date: { value: new Date(new Date().setHours(24, 0, 0, 0)).getTime() }, CD_dateactive: { value: 1 }, CD_hideuntildate: { value: 1 }, CD_someday: { value: 0 } } : {}),
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

    // Create task at top
    const handleCreateTaskAtTop = () => {
        if ((!selectedProject && viewMode !== 'inbox' && viewMode !== 'next_actions' && viewMode !== 'someday' && viewMode !== 'due' && viewMode !== 'waiting' && viewMode !== 'deferred') || editingTaskId) return;

        const singleActionsProject = (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred')
            ? projects.find(p => p.fields.CD_singleactions?.value === 1)
            : null;

        const newTask: TaskRecord = {
            recordName: 'new-task',
            recordChangeTag: '',
            recordType: 'CD_Task',
            fields: {
                CD_name: { value: '' },
                CD_id: { value: 'new-task' },
                ...(viewMode === 'inbox' ? {}
                    : (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred')
                        ? (singleActionsProject?.recordName ? { CD_project: { value: singleActionsProject.recordName } } : {})
                        : (selectedProject?.recordName ? { CD_project: { value: selectedProject.recordName } } : {})),
                ...(viewMode === 'someday' ? { CD_someday: { value: 1 } } : {}),
                ...(viewMode === 'due' ? { CD_date: { value: Date.now() }, CD_dateactive: { value: 1 } } : {}),
                ...(viewMode === 'waiting' ? { CD_waitingfor: { value: 1 }, CD_someday: { value: 0 } } : {}),
                ...(viewMode === 'deferred' ? { CD_date: { value: new Date(new Date().setHours(24, 0, 0, 0)).getTime() }, CD_dateactive: { value: 1 }, CD_hideuntildate: { value: 1 }, CD_someday: { value: 0 } } : {}),
                CD_completed: { value: 0 },
                CD_order: { value: 0 } // Top of the list
            }
        };

        // Shift all existing tasks down
        setTasks(prev => {
            const shifted = prev.map(t => ({
                ...t,
                fields: { ...t.fields, CD_order: { value: (t.fields.CD_order?.value || 0) + 1 } }
            }));
            return [newTask, ...shifted];
        });
        setEditingTaskId('new-task');
        setEditTaskName('');
    };

    // Keyboard Shortcuts Handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input/textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            // N - Create task at bottom
            if (e.key === 'n' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                handleCreateTask();
            }

            // Shift+N - Create task at top
            if (e.key === 'N' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                handleCreateTaskAtTop();
            }

            // P - Create project at bottom
            if (e.key === 'p' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                handleCreateProject();
            }

            // Shift+P - Create project at top
            if (e.key === 'P' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                handleCreateProjectAtTop();
            }

            // ? - Show keyboard shortcuts
            if (e.key === '?' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                setShowShortcuts(true);
            }

            // Escape - Close shortcuts modal
            if (e.key === 'Escape' && showShortcuts) {
                setShowShortcuts(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedProject, editingTaskId, tasks, projects, viewMode, showShortcuts]);


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
            if (!container) {
                console.log('[CloudKit Projects] Container not available');
                return;
            }

            console.log('[CloudKit Projects] 🚀 Fetching projects from CloudKit...');
            setFetching(true);
            setError(null);
            try {
                const privateDB = container.privateCloudDatabase;
                const query = {
                    recordType: 'CD_Project',
                    filterBy: [{ fieldName: 'CD_name', comparator: 'NOT_EQUALS', fieldValue: { value: '' } }],
                    desiredKeys: ['CD_name', 'CD_id', 'CD_order', 'CD_completed', 'CD_singleactions', 'CD_focus'],
                    resultsLimit: 100
                };
                const options = { zoneID: { zoneName: 'com.apple.coredata.cloudkit.zone' } };

                console.log('[CloudKit Projects] Executing query:', query);
                const result = await privateDB.performQuery(query, options);

                if (result.hasErrors) {
                    console.error('[CloudKit Projects] ❌ Query errors:', result.errors);
                    throw new Error(result.errors[0].message);
                }

                let records = result.records as ProjectRecord[];
                console.log(`[CloudKit Projects] ✅ Received ${records.length} total projects from CloudKit`);
                console.log('[CloudKit Projects] Raw projects:', records.map(p => ({
                    name: p.fields.CD_name?.value,
                    completed: p.fields.CD_completed?.value,
                    singleActions: p.fields.CD_singleactions?.value,
                    order: p.fields.CD_order?.value
                })));

                const beforeFilter = records.length;
                records = records.filter(p => !p.fields.CD_completed || p.fields.CD_completed.value !== 1);
                console.log(`[CloudKit Projects] 🔍 Filtered out ${beforeFilter - records.length} completed projects`);

                records.sort((a, b) => {
                    const isSingleA = a.fields.CD_singleactions?.value === 1;
                    const isSingleB = b.fields.CD_singleactions?.value === 1;
                    if (isSingleA && !isSingleB) return -1;
                    if (!isSingleA && isSingleB) return 1;
                    const orderA = a.fields.CD_order?.value ?? 0;
                    const orderB = b.fields.CD_order?.value ?? 0;
                    return orderA - orderB;
                });

                console.log(`[CloudKit Projects] 📋 Final project list (${records.length} projects):`);
                records.forEach((p, i) => {
                    console.log(`  ${i + 1}. "${p.fields.CD_name?.value}" (order: ${p.fields.CD_order?.value})`);
                });

                setProjects(records);
                // Select first project by default if none selected
                if (records.length > 0 && !selectedProject) {
                    setSelectedProject(records[0]);
                }
            } catch (err: any) {
                console.error('[CloudKit Projects] ❌ Fetch error:', err);
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
    const [dragOverPosition, setDragOverPosition] = useState<'top' | 'bottom' | null>(null);
    const [isDraggingProject, setIsDraggingProject] = useState(false);
    const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

    const handleDragStart = (e: React.DragEvent, item: TaskRecord | ProjectRecord, type: 'task' | 'project') => {
        e.dataTransfer.setData('text/plain', item.recordName);
        e.dataTransfer.setData('application/type', type);
        e.dataTransfer.effectAllowed = 'move';
        if (type === 'project') {
            setIsDraggingProject(true);
        }
    };

    const handleDragEnd = () => {
        setIsDraggingProject(false);
        setDragOverProjectId(null);
        setDragOverPosition(null);
    };

    const handleDragOver = (e: React.DragEvent, project: ProjectRecord) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';

        // Calculate if top or bottom half
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const isTop = y < rect.height / 2;

        let position: 'top' | 'bottom' = isTop ? 'top' : 'bottom';

        // Constraint: Cannot drop ABOVE Single Actions project (must stay at top)
        if (project.fields.CD_singleactions?.value === 1 && position === 'top') {
            // If we try to drop above Single Actions, force to bottom or prevent?
            // User said "don't let me drop... above it".
            // We'll treat Top zone as invalid or map to Bottom?
            // Actually, simplest is to just not set position/id if it's invalid top drop, 
            // but that flickers. 
            // Better: Force to bottom? No, that's confusing.
            // We'll check in handleDrop to preventing saving. 
            // But visually we want to hide the Top indicator.
            // So here we won't set dragOverPosition if it's top on Single Actions.
            if (isDraggingProject) {
                // Only relevant for project reordering. Tasks drop ON the project.
                // So if dragging project, and target is Single Actions top, invalid.
                // But wait, if I can't drop above, I can't start a drag there.
                // We'll just ignore setting state for 'top' on SE project.
                setDragOverProjectId(null);
                setDragOverPosition(null);
                return;
            }
        }

        if (dragOverPosition !== position) {
            setDragOverPosition(position);
        }

        if (dragOverProjectId !== project.recordName) {
            setDragOverProjectId(project.recordName);
        }
    };

    const handleDragEnter = (project: ProjectRecord) => {
        if (project.recordName !== selectedProject?.recordName) {
            setDragOverProjectId(project.recordName);
        }
    };

    const handleDragLeave = () => {
        setDragOverProjectId(null);
        setDragOverPosition(null);
    };

    const handleDrop = async (e: React.DragEvent, targetProject: ProjectRecord) => {
        e.preventDefault();
        setDragOverProjectId(null);

        const id = e.dataTransfer.getData('text/plain');
        const type = e.dataTransfer.getData('application/type') || 'task'; // Default to task for backward compatibility

        if (!id || !container) return;

        // --- Handle Project Reordering ---
        if (type === 'project') {
            if (id === targetProject.recordName) return; // Drop on self

            const sourceProject = projects.find(p => p.recordName === id);
            if (!sourceProject) return;

            // Boundary Check: Ensure we stay within same section (Active vs On Hold)
            const isActive = (p: ProjectRecord) => (!p.fields.CD_focus || p.fields.CD_focus.value !== 0) || p.fields.CD_singleactions?.value === 1;

            const sourceIsActive = isActive(sourceProject);
            const targetIsActive = isActive(targetProject);

            if (sourceIsActive !== targetIsActive) {
                // Prevent dragging across sections
                return;
            }

            // Reorder
            const newProjects = [...projects];
            const sourceIndex = newProjects.findIndex(p => p.recordName === id);
            const targetIndex = newProjects.findIndex(p => p.recordName === targetProject.recordName);

            if (sourceIndex === -1 || targetIndex === -1) return;

            // Recalculate position to be safe (state might be cleared by dragLeave)
            const rect = e.currentTarget.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const isTop = y < rect.height / 2;
            const position = isTop ? 'top' : 'bottom';

            let insertIndex = targetIndex + (position === 'bottom' ? 1 : 0);
            // If we're moving it down, we need to account for the removal shifting indices
            if (sourceIndex < insertIndex) insertIndex--;

            // Move project
            newProjects.splice(sourceIndex, 1);
            newProjects.splice(insertIndex, 0, sourceProject);

            // Optimistic Update
            setProjects(newProjects);

            // Save new order
            try {
                const privateDB = container.privateCloudDatabase;
                const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

                // Re-assign CD_order for all projects (simple normalized ordering)
                // We'll update ALL projects to ensure consistency, or just the affected range.
                // Updating all is safer for 'order' fields to keep them clean (0, 1, 2...).
                const recordsToUpdate = newProjects.map((p, index) => ({
                    ...p,
                    fields: {
                        ...p.fields,
                        CD_order: { value: index }
                    }
                }));

                // Only save if order actually changed (optimization)
                // But for now, safe simply
                await privateDB.saveRecords(recordsToUpdate, { zoneID });

                console.log('Project order updated successfully');
            } catch (err: any) {
                console.error('Failed to reorder projects:', err);
                alert('Failed to reorder projects: ' + err.message);
                // Revert on error?
                // For now, let's just log. Reloading might be needed.
            }
            return;
        }

        // --- Handle Task Move (Legacy Logic) ---
        // Don't do anything if dropped on same project
        if (targetProject.recordName === selectedProject?.recordName) return;

        // Optimistic update: Remove task from current list immediately
        setTasks(prev => prev.filter(t => t.recordName !== id));

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            // 1. Fetch task
            const fetchResult = await privateDB.fetchRecords([id], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const taskRecord = fetchResult.records[0];

            // 2. Update project reference
            if (targetProject.recordName === 'inbox-pseudo-project') {
                // Remove the field entirely (send null or undefined? CloudKit JS usually expects value: null to delete)
                taskRecord.fields.CD_project = { value: null };
            } else {
                taskRecord.fields.CD_project = {
                    value: targetProject.recordName
                };
            }

            // 3. Save
            const saveResult = await privateDB.saveRecords([taskRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            // 4. Update Optimistic Cache
            const savedRecord = saveResult.records[0];
            setOptimisticTasks(prev => ({
                ...prev,
                [savedRecord.recordName]: savedRecord
            }));

            console.log('Task reassigned successfully');

        } catch (err: any) {
            console.error('Reassign error:', err);
            alert('Failed to reassign task: ' + err.message);
            // Verify/Reload if failed
            window.location.reload();
        }
    };

    const handleDropNextActions = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverProjectId(null);

        const taskId = e.dataTransfer.getData('text/plain');
        if (!taskId || !container) return;

        // Optimistic update: Remove task from current list immediately
        setTasks(prev => prev.filter(t => t.recordName !== taskId));

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            // 1. Fetch task
            const fetchResult = await privateDB.fetchRecords([taskId], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const taskRecord = fetchResult.records[0];

            // 2. Apply Next Actions logic
            const updates: any = {};

            // If task has no project, assign to Single Actions project
            if (!taskRecord.fields.CD_project?.value) {
                const singleActionsProject = projects.find(p => p.fields.CD_singleactions?.value === 1);
                if (singleActionsProject) {
                    updates.CD_project = { value: singleActionsProject.recordName };
                }
            }
            // If task already has a project, don't change it

            // If someday is set, remove it
            if (taskRecord.fields.CD_someday?.value === 1) {
                updates.CD_someday = { value: 0 };
            }

            // If waiting for is set, remove it
            if (taskRecord.fields.CD_waitingfor?.value === 1) {
                updates.CD_waitingfor = { value: 0 };
            }

            // Remove date constraints to make task immediately available
            if (taskRecord.fields.CD_dateactive?.value === 1) {
                updates.CD_dateactive = { value: 0 };
            }
            if (taskRecord.fields.CD_hideuntildate?.value === 1) {
                updates.CD_hideuntildate = { value: 0 };
            }

            // Apply updates to task record
            Object.assign(taskRecord.fields, updates);

            // 3. Save
            const saveResult = await privateDB.saveRecords([taskRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            // 4. Update Optimistic Cache
            const savedRecord = saveResult.records[0];
            setOptimisticTasks(prev => ({
                ...prev,
                [savedRecord.recordName]: savedRecord
            }));

            console.log('Task moved to Next Actions successfully');

        } catch (err: any) {
            console.error('Move to Next Actions error:', err);
            alert('Failed to move task to Next Actions: ' + err.message);
            // Verify/Reload if failed
            window.location.reload();
        }
    };

    const handleDropWaiting = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverProjectId(null);

        const id = e.dataTransfer.getData('text/plain');
        if (!id || !container) return;

        // Optimistic update
        setTasks(prev => prev.map(t => {
            if (t.recordName === id) {
                const singleActionsProject = projects.find(p => p.fields.CD_singleactions?.value === 1);
                // If it doesn't have a project, assign Single Actions
                const needsProject = !t.fields.CD_project?.value;

                return {
                    ...t,
                    fields: {
                        ...t.fields,
                        CD_waitingfor: { value: 1 },
                        CD_someday: { value: 0 },
                        CD_completed: { value: 0 },
                        ...(needsProject && singleActionsProject?.recordName ? { CD_project: { value: singleActionsProject.recordName } } : {})
                    }
                };
            }
            return t;
        }));

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            // 1. Fetch latest version
            const fetchResult = await privateDB.fetchRecords([id], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const taskRecord = fetchResult.records[0];

            // 2. Update fields
            const singleActionsProject = projects.find(p => p.fields.CD_singleactions?.value === 1);
            const needsProject = !taskRecord.fields.CD_project?.value;

            const updates: any = {
                CD_waitingfor: { value: 1 },
                CD_someday: { value: 0 },
                CD_completed: { value: 0 },
                CD_modifieddate: { value: Date.now() }
            };

            if (needsProject && singleActionsProject) {
                updates.CD_project = { value: singleActionsProject.recordName };
            }

            Object.assign(taskRecord.fields, updates);

            // 3. Save
            const saveResult = await privateDB.saveRecords([taskRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            // 4. Update Optimistic Cache
            const savedRecord = saveResult.records[0];
            setOptimisticTasks(prev => ({
                ...prev,
                [savedRecord.recordName]: savedRecord
            }));

            console.log('Task moved to Waiting for successfully');

        } catch (err: any) {
            console.error('Move to Waiting for error:', err);
            alert('Failed to move task to Waiting for: ' + err.message);
            // Verify/Reload if failed
            window.location.reload();
        }
    };

    const handleDropDeferred = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverProjectId(null);

        const id = e.dataTransfer.getData('text/plain');
        if (!id || !container) return;

        // Calculate Tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0); // Start of day
        const tomorrowTs = tomorrow.getTime();

        // Optimistic update
        setTasks(prev => prev.map(t => {
            if (t.recordName === id) {
                const singleActionsProject = projects.find(p => p.fields.CD_singleactions?.value === 1);
                const needsProject = !t.fields.CD_project?.value;

                return {
                    ...t,
                    fields: {
                        ...t.fields,
                        CD_date: { value: tomorrowTs },
                        CD_dateactive: { value: 1 },
                        CD_hideuntildate: { value: 1 },
                        CD_someday: { value: 0 },
                        CD_waitingfor: { value: 0 },
                        CD_completed: { value: 0 },
                        ...(needsProject && singleActionsProject?.recordName ? { CD_project: { value: singleActionsProject.recordName } } : {})
                    }
                };
            }
            return t;
        }));

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            // 1. Fetch
            const fetchResult = await privateDB.fetchRecords([id], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const taskRecord = fetchResult.records[0];

            // 2. Update
            const singleActionsProject = projects.find(p => p.fields.CD_singleactions?.value === 1);
            const needsProject = !taskRecord.fields.CD_project?.value;

            const updates: any = {
                CD_date: { value: tomorrowTs },
                CD_dateactive: { value: 1 },
                CD_hideuntildate: { value: 1 },
                CD_someday: { value: 0 },
                CD_waitingfor: { value: 0 },
                CD_completed: { value: 0 },
                CD_modifieddate: { value: Date.now() }
            };

            if (needsProject && singleActionsProject) {
                updates.CD_project = { value: singleActionsProject.recordName };
            }

            Object.assign(taskRecord.fields, updates);

            // 3. Save
            const saveResult = await privateDB.saveRecords([taskRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            // 4. Update Cache
            const savedRecord = saveResult.records[0];
            setOptimisticTasks(prev => ({
                ...prev,
                [savedRecord.recordName]: savedRecord
            }));

            console.log('Task moved to Deferred successfully');

        } catch (err: any) {
            console.error('Move to Deferred error:', err);
            alert('Failed to move task to Deferred: ' + err.message);
            window.location.reload();
        }
    };

    const handleDropDue = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverProjectId(null);

        const id = e.dataTransfer.getData('text/plain');
        if (!id || !container) return;

        // Set to Today
        const todayTs = Date.now();

        // Optimistic update
        setTasks(prev => prev.map(t => {
            if (t.recordName === id) {
                const singleActionsProject = projects.find(p => p.fields.CD_singleactions?.value === 1);
                const needsProject = !t.fields.CD_project?.value;

                return {
                    ...t,
                    fields: {
                        ...t.fields,
                        CD_date: { value: todayTs },
                        CD_dateactive: { value: 1 },
                        CD_someday: { value: 0 },
                        CD_waitingfor: { value: 0 },
                        CD_completed: { value: 0 },
                        ...(needsProject && singleActionsProject?.recordName ? { CD_project: { value: singleActionsProject.recordName } } : {})
                    }
                };
            }
            return t;
        }));

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            // 1. Fetch
            const fetchResult = await privateDB.fetchRecords([id], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const taskRecord = fetchResult.records[0];

            // 2. Update
            const singleActionsProject = projects.find(p => p.fields.CD_singleactions?.value === 1);
            const needsProject = !taskRecord.fields.CD_project?.value;

            const updates: any = {
                CD_date: { value: todayTs },
                CD_dateactive: { value: 1 },
                CD_someday: { value: 0 },
                CD_waitingfor: { value: 0 },
                CD_completed: { value: 0 },
                CD_modifieddate: { value: Date.now() }
            };

            if (needsProject && singleActionsProject) {
                updates.CD_project = { value: singleActionsProject.recordName };
            }

            Object.assign(taskRecord.fields, updates);

            // 3. Save
            const saveResult = await privateDB.saveRecords([taskRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            // 4. Update Cache
            const savedRecord = saveResult.records[0];
            setOptimisticTasks(prev => ({
                ...prev,
                [savedRecord.recordName]: savedRecord
            }));

            console.log('Task moved to Due successfully');

        } catch (err: any) {
            console.error('Move to Due error:', err);
            alert('Failed to move task to Due: ' + err.message);
            window.location.reload();
        }
    };

    const handleDropSomeday = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverProjectId(null);

        const id = e.dataTransfer.getData('text/plain');
        if (!id || !container) return;

        // Optimistic update
        setTasks(prev => prev.filter(t => t.recordName !== id));

        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            // 1. Fetch
            const fetchResult = await privateDB.fetchRecords([id], { zoneID });
            if (fetchResult.hasErrors) throw new Error(fetchResult.errors[0].message);
            const taskRecord = fetchResult.records[0];

            // 2. Updates
            const updates: any = {};
            updates.CD_someday = { value: 1 };
            // Clear waiting
            if (taskRecord.fields.CD_waitingfor?.value === 1) updates.CD_waitingfor = { value: 0 };
            // If no project, assign to Single Actions
            if (!taskRecord.fields.CD_project?.value) {
                const singleActions = projects.find(p => p.fields.CD_singleactions?.value === 1);
                if (singleActions) updates.CD_project = { value: singleActions.recordName };
            }

            Object.assign(taskRecord.fields, updates);

            // 3. Save
            const saveResult = await privateDB.saveRecords([taskRecord], { zoneID });
            if (saveResult.hasErrors) throw new Error(saveResult.errors[0].message);

            // 4. Optimistic
            const savedRecord = saveResult.records[0];
            setOptimisticTasks(prev => ({ ...prev, [savedRecord.recordName]: savedRecord }));

            console.log('Task moved to Someday successfully');
        } catch (err: any) {
            console.error('Move to Someday error:', err);
            alert('Failed to move task to Someday: ' + err.message);
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
        // If we are currently editing/creating a task (editingTaskId) or a project (editingId),
        // we pause polling to prevent overwriting local state with server data.
        if (editingTaskId || editingId) {
            console.log('[CloudKit Sync] ⏸️ Edit active, pausing polling');
            return;
        }

        const fetchTasks = async (isPoll = false) => {
            if (!container) {
                console.log('[CloudKit Sync] Container not available, skipping fetch');
                return;
            }

            // If in project mode but no project selected, clear tasks
            if (viewMode === 'project' && !selectedProject) {
                console.log('[CloudKit Sync] No project selected in project mode, clearing tasks');
                setTasks([]);
                return;
            }

            const timestamp = new Date().toLocaleTimeString();
            console.log(`[CloudKit Sync] ${isPoll ? '🔄 Polling' : '📥 Initial fetch'} started at ${timestamp}`);
            console.log(`[CloudKit Sync] View mode: ${viewMode}`, selectedProject ? `Project: ${selectedProject.fields.CD_name?.value}` : '');

            if (!isPoll) setLoadingTasks(true);
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
                        desiredKeys: ['CD_name', 'CD_id', 'CD_order', 'CD_project', 'CD_completed', 'CD_hideuntildate'],
                        resultsLimit: 200
                    };
                } else if (viewMode === 'inbox') {
                    // Inbox: Fetch all active tasks, filter locally for no project.
                    // This handles cases where project is empty string OR null/missing.
                    query = {
                        recordType: 'CD_Task',
                        filterBy: [
                            {
                                fieldName: 'CD_completed',
                                comparator: 'NOT_EQUALS',
                                fieldValue: { value: 1 }
                            }
                        ],
                        desiredKeys: ['CD_name', 'CD_id', 'CD_order', 'CD_project', 'CD_completed', 'CD_date', 'CD_recurring', 'CD_recurrence', 'CD_recurrencetype', 'CD_hideuntildate'],
                        resultsLimit: 400
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
                        desiredKeys: ['CD_name', 'CD_id', 'CD_order', 'CD_project', 'CD_completed', 'CD_modifieddate', 'CD_hideuntildate'],
                        resultsLimit: 100
                    };
                } else if (viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred') {
                    // Next Actions & Someday & Due & Waiting & Deferred: Fetch all active tasks, extensive client-side filtering
                    query = {
                        recordType: 'CD_Task',
                        filterBy: [{
                            fieldName: 'CD_name',
                            comparator: 'NOT_EQUALS',
                            fieldValue: { value: '' }
                        }],
                        sortBy: [{ fieldName: 'CD_order', ascending: true }],
                        desiredKeys: [
                            'CD_name', 'CD_id', 'CD_order', 'CD_project', 'CD_completed',
                            'CD_someday', 'CD_waitingfor', 'CD_dateactive',
                            'CD_date', 'CD_hideuntildate'
                        ],
                        resultsLimit: 400
                    };
                } else {
                    // No project selected in project mode, or other unhandled viewMode
                    console.log('[CloudKit Sync] Unhandled view mode, clearing tasks');
                    setTasks([]);
                    setLoadingTasks(false);
                    return;
                }

                console.log('[CloudKit Sync] Executing query:', query);
                const result = await privateDB.performQuery(query, { zoneID });

                if (result.hasErrors) {
                    console.error('[CloudKit Sync] Query returned errors:', result.errors);
                    throw new Error(result.errors[0].message);
                }

                let taskRecords = result.records as TaskRecord[];
                console.log(`[CloudKit Sync] ✅ Received ${taskRecords.length} tasks from CloudKit`);

                // --- OPTIMISTIC MERGE ---
                // Apply overrides from optimisticTasks

                // 1. Update existing records with overrides
                taskRecords = taskRecords.map(t => optimisticTasks[t.recordName] || t);

                // 2. Filter out records that no longer belong to this view
                if (viewMode === 'project' && selectedProject) {
                    taskRecords = taskRecords.filter(t => t.fields.CD_project?.value === selectedProject.recordName);
                } else if (viewMode === 'inbox') {
                    taskRecords = taskRecords.filter(t => !t.fields.CD_project?.value);
                } else if (viewMode === 'next_actions') {
                    console.log(`[Next Actions Debug] Filtering ${taskRecords.length} candidate tasks...`);

                    taskRecords = taskRecords.filter(t => {
                        const fields = t.fields;
                        // const name = fields.CD_name?.value || 'Unnamed';

                        // 1. Must not be completed
                        if (fields.CD_completed?.value === 1) return false;

                        // 2. Must not be Someday
                        if (fields.CD_someday?.value === 1) return false;

                        // 3. Must not be Waiting For
                        if (fields.CD_waitingfor?.value === 1) return false;

                        // 4. Must belong to a Project (not Inbox)
                        if (!fields.CD_project?.value) return false;

                        // 4. Date Logic: Hide future tasks if "Hide Until" is active
                        const isDateActive = fields.CD_dateactive?.value === 1;
                        if (isDateActive) {
                            const isHideUntil = fields.CD_hideuntildate?.value === 1;
                            if (isHideUntil && fields.CD_date?.value) {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);

                                const taskDate = new Date(fields.CD_date.value);
                                taskDate.setHours(0, 0, 0, 0);

                                // If date is in future, HIDE it
                                if (taskDate > today) return false;
                            }
                        }

                        return true;
                    });
                } else if (viewMode === 'waiting') {
                    taskRecords = taskRecords.filter(t => {
                        const fields = t.fields;

                        // 1. Must not be completed
                        if (fields.CD_completed?.value === 1) return false;

                        // 2. Must not be Someday
                        if (fields.CD_someday?.value === 1) return false;

                        // 3. MUST be Waiting For
                        if (fields.CD_waitingfor?.value !== 1) return false;

                        // 4. Must belong to a Project (not Inbox)
                        if (!fields.CD_project?.value) return false;

                        // 5. Date Logic: Hide future tasks if "Hide Until" is active
                        const isDateActive = fields.CD_dateactive?.value === 1;
                        if (isDateActive) {
                            const isHideUntil = fields.CD_hideuntildate?.value === 1;
                            if (isHideUntil && fields.CD_date?.value) {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);

                                const taskDate = new Date(fields.CD_date.value);
                                taskDate.setHours(0, 0, 0, 0);

                                // If date is in future, HIDE it
                                if (taskDate > today) return false;
                            }
                        }

                        return true;
                    });
                } else if (viewMode === 'someday') {
                    taskRecords = taskRecords.filter(t => {
                        const fields = t.fields;

                        // 1. Must not be completed
                        if (fields.CD_completed?.value === 1) return false;

                        // 2. MUST be Someday
                        if (fields.CD_someday?.value !== 1) return false;

                        // 3. Must not be Waiting For
                        if (fields.CD_waitingfor?.value === 1) return false;

                        // 4. Must belong to a Project (not Inbox)
                        if (!fields.CD_project?.value) return false;

                        // 5. Date filters (hide future)
                        const isDateActive = fields.CD_dateactive?.value === 1;
                        if (isDateActive) {
                            const isHideUntil = fields.CD_hideuntildate?.value === 1;
                            if (isHideUntil && fields.CD_date?.value) {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const taskDate = new Date(fields.CD_date.value);
                                taskDate.setHours(0, 0, 0, 0);
                                if (taskDate > today) return false;
                            }
                        }
                        return true;
                    });
                } else if (viewMode === 'due') {
                    taskRecords = taskRecords.filter(t => {
                        const fields = t.fields;

                        // 1. Must not be completed
                        if (fields.CD_completed?.value === 1) return false;

                        // 2. Must have a date set AND be active
                        if (!fields.CD_date?.value) return false;
                        if (fields.CD_dateactive?.value !== 1) return false;

                        // 3. Date must be <= END of Today
                        const todayEnd = new Date();
                        todayEnd.setHours(23, 59, 59, 999);
                        const taskDate = new Date(fields.CD_date.value);

                        return taskDate <= todayEnd;
                    });
                } else if (viewMode === 'deferred') {
                    taskRecords = taskRecords.filter(t => {
                        const fields = t.fields;
                        if (fields.CD_completed?.value === 1) return false;
                        if (fields.CD_someday?.value === 1) return false;
                        if (fields.CD_waitingfor?.value === 1) return false;
                        if (!fields.CD_project?.value) return false;

                        // Must be Hidden Until Future Date
                        if (fields.CD_dateactive?.value !== 1) return false;
                        if (fields.CD_hideuntildate?.value !== 1) return false;
                        if (!fields.CD_date?.value) return false;

                        const todayEnd = new Date();
                        todayEnd.setHours(23, 59, 59, 999);
                        const taskDate = new Date(fields.CD_date.value);
                        return taskDate > todayEnd;
                    });
                }

                // 3. Append missing records from optimisticTasks that BELONG to this view
                Object.values(optimisticTasks).forEach(override => {
                    // Check if not completed
                    if (override.fields.CD_completed?.value === 1) return;

                    if (viewMode === 'project' && selectedProject) {
                        if (override.fields.CD_project?.value === selectedProject.recordName) {
                            if (!taskRecords.find(t => t.recordName === override.recordName)) {
                                taskRecords.push(override);
                            }
                        }
                    } else if (viewMode === 'inbox') {
                        if (!override.fields.CD_project?.value) {
                            if (!taskRecords.find(t => t.recordName === override.recordName)) {
                                taskRecords.push(override);
                            }
                        }
                    } else if (viewMode === 'next_actions') {
                        // Apply same logic to optimistic tasks
                        const fields = override.fields;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        let shouldShow = false;

                        if (
                            fields.CD_project?.value &&
                            fields.CD_completed?.value !== 1 &&
                            fields.CD_someday?.value !== 1 &&
                            fields.CD_waitingfor?.value !== 1
                        ) {
                            const isDateActive = fields.CD_dateactive?.value === 1;
                            if (!isDateActive) shouldShow = true;
                            else {
                                const isHideUntil = fields.CD_hideuntildate?.value === 1;
                                if (!isHideUntil) shouldShow = true;
                                else {
                                    if (!fields.CD_date?.value) shouldShow = true;
                                    else {
                                        const taskDate = new Date(fields.CD_date.value);
                                        taskDate.setHours(0, 0, 0, 0);
                                        if (taskDate <= today) shouldShow = true;
                                    }
                                }
                            }
                        }

                        if (shouldShow) {
                            if (!taskRecords.find(t => t.recordName === override.recordName)) {
                                taskRecords.push(override);
                            }
                        }
                    }
                    else if (viewMode === 'someday') {
                        // Apply Someday filtering checks for overrides
                        const fields = override.fields;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        let shouldShow = false;

                        if (
                            fields.CD_project?.value &&
                            fields.CD_completed?.value !== 1 &&
                            fields.CD_someday?.value === 1 && // Must be Someday
                            fields.CD_waitingfor?.value !== 1
                        ) {
                            // Date Checks
                            const isDateActive = fields.CD_dateactive?.value === 1;
                            if (!isDateActive) shouldShow = true;
                            else {
                                const isHideUntil = fields.CD_hideuntildate?.value === 1;
                                if (!isHideUntil) shouldShow = true;
                                else {
                                    if (!fields.CD_date?.value) shouldShow = true;
                                    else {
                                        const taskDate = new Date(fields.CD_date.value);
                                        taskDate.setHours(0, 0, 0, 0);
                                        if (taskDate <= today) shouldShow = true;
                                    }
                                }
                            }
                        }

                        if (shouldShow) {
                            if (!taskRecords.find(t => t.recordName === override.recordName)) {
                                taskRecords.push(override);
                            }
                        }
                    } else if (viewMode === 'waiting') {
                        const fields = override.fields;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        let shouldShow = false;

                        if (
                            fields.CD_project?.value &&
                            fields.CD_completed?.value !== 1 &&
                            fields.CD_someday?.value !== 1 &&
                            fields.CD_waitingfor?.value === 1 // Must be Waiting
                        ) {
                            // Date Checks (Same as Next Actions)
                            const isDateActive = fields.CD_dateactive?.value === 1;
                            if (!isDateActive) shouldShow = true;
                            else {
                                const isHideUntil = fields.CD_hideuntildate?.value === 1;
                                if (!isHideUntil) shouldShow = true;
                                else {
                                    if (!fields.CD_date?.value) shouldShow = true;
                                    else {
                                        const taskDate = new Date(fields.CD_date.value);
                                        taskDate.setHours(0, 0, 0, 0);
                                        if (taskDate <= today) shouldShow = true;
                                    }
                                }
                            }
                        }

                        if (shouldShow) {
                            if (!taskRecords.find(t => t.recordName === override.recordName)) {
                                taskRecords.push(override);
                            }
                        }
                    } else if (viewMode === 'due') {
                        const fields = override.fields;
                        if (
                            fields.CD_completed?.value !== 1 &&
                            fields.CD_date?.value &&
                            fields.CD_dateactive?.value === 1
                        ) {
                            const todayEnd = new Date();
                            todayEnd.setHours(23, 59, 59, 999);
                            const taskDate = new Date(fields.CD_date.value);

                            if (taskDate <= todayEnd) {
                                if (!taskRecords.find(t => t.recordName === override.recordName)) {
                                    taskRecords.push(override);
                                }
                            }
                        }
                    } else if (viewMode === 'deferred') {
                        const fields = override.fields;
                        if (
                            fields.CD_completed?.value !== 1 &&
                            fields.CD_someday?.value !== 1 &&
                            fields.CD_waitingfor?.value !== 1 &&
                            fields.CD_project?.value &&
                            fields.CD_dateactive?.value === 1 &&
                            fields.CD_hideuntildate?.value === 1 &&
                            fields.CD_date?.value
                        ) {
                            const todayEnd = new Date();
                            todayEnd.setHours(23, 59, 59, 999);
                            const taskDate = new Date(fields.CD_date.value);
                            if (taskDate > todayEnd) {
                                if (!taskRecords.find(t => t.recordName === override.recordName)) {
                                    taskRecords.push(override);
                                }
                            }
                        }
                    }
                });
                // ------------------------

                // Sort tasks
                if (viewMode === 'history') {
                    // Sort by Modified Date DESC (Most recent first)
                    taskRecords.sort((a, b) => (b.fields.CD_modifieddate?.value ?? 0) - (a.fields.CD_modifieddate?.value ?? 0));
                } else {
                    // Default: Sort by Order ASC
                    taskRecords.sort((a, b) => (a.fields.CD_order?.value ?? 0) - (b.fields.CD_order?.value ?? 0));
                }

                console.log(`[CloudKit Sync] 📋 Final task count after filtering: ${taskRecords.length}`);
                setTasks(taskRecords);
                setTasks(taskRecords);
            } catch (err: any) {
                console.error('[CloudKit Sync] ❌ Fetch tasks error:', err);
                setTaskError(err.message || 'Failed to fetch tasks');
                if (!isPoll) setTasks([]);
            } finally {
                if (!isPoll) setLoadingTasks(false);
            }
        };

        console.log('[CloudKit Sync] 🚀 Setting up polling interval');
        fetchTasks(true);

        if (!editingTaskId && !editingId) {
            // Poll every 10 seconds to keep fresh
            const intervalId = setInterval(() => fetchTasks(true), 10000);
            console.log('[CloudKit Sync] ⏰ Polling interval created:', intervalId);

            return () => {
                console.log('[CloudKit Sync] 🛑 Cleaning up polling interval:', intervalId);
                clearInterval(intervalId);
            };
        }
    }, [selectedProject, viewMode, container, editingTaskId, editingId]);


    const handleToggleComplete = async (task: TaskRecord) => {
        if (!container) return;

        const isCompleting = task.fields.CD_completed?.value !== 1;
        const isRecurring = task.fields.CD_recurring?.value === 1;

        // Optimistic UI updates
        if (viewMode === 'project' && isCompleting) {
            setCompletingTaskIds(prev => new Set(prev).add(task.recordName));
            if (!isRecurring) {
                // Only hide if not recurring (recurrence stays in list but updates date)
                // Actually, for user feedback, maybe we still "flash" it or show a "Rescheduled" toast?
                // For now, let's treat recurring task update as an immediate update in place.
                setTimeout(() => {
                    setCompletingTaskIds(prev => {
                        const next = new Set(prev);
                        next.delete(task.recordName);
                        return next;
                    });
                }, 1000);
            } else {
                // Clean up the completing ID immediately after state update so it doesn't stay "faded"
                setTimeout(() => {
                    setCompletingTaskIds(prev => {
                        const next = new Set(prev);
                        next.delete(task.recordName);
                        return next;
                    });
                }, 500); // Shorter flash for update
            }
        }

        const privateDB = container.privateCloudDatabase;
        const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

        // RECURRING TASK LOGIC
        if (isRecurring && isCompleting) {
            // 1. Calculate New Date
            const currentTimestamp = task.fields.CD_date?.value || Date.now();
            const recurrenceVal = task.fields.CD_recurrence?.value || 1;
            const recurrenceType = task.fields.CD_recurrencetype?.value || 'days';

            const nextDate = new Date(currentTimestamp);

            switch (recurrenceType) {
                case 'weeks':
                    nextDate.setDate(nextDate.getDate() + (recurrenceVal * 7));
                    break;
                case 'months':
                    nextDate.setMonth(nextDate.getMonth() + recurrenceVal);
                    break;
                case 'years':
                    nextDate.setFullYear(nextDate.getFullYear() + recurrenceVal);
                    break;
                case 'days':
                default:
                    nextDate.setDate(nextDate.getDate() + recurrenceVal);
                    break;
            }

            const nextTimestamp = nextDate.getTime();

            // 2. Create History Record (Completed Duplicate)
            // Generate a random UUID-like string for the new record name
            const historyRecordName = crypto.randomUUID();

            const historyRecord = {
                recordName: historyRecordName,
                recordType: 'CD_Task',
                fields: {
                    ...task.fields,
                    CD_recurring: { value: 0 },
                    CD_completed: { value: 1 },
                    CD_ticked: { value: 1 },
                    CD_modifieddate: { value: Date.now() },
                    CD_id: { value: crypto.randomUUID() }, // New unique ID for the history instance
                    // Ensure we don't carry over cloudkit system fields if they were in fields (they usually aren't directly)
                }
            };

            // 3. Update Original Record
            const originalUpdate = {
                recordName: task.recordName,
                recordChangeTag: task.recordChangeTag,
                fields: {
                    CD_date: { value: nextTimestamp },
                    CD_modifieddate: { value: Date.now() }
                    // CD_completed remains 0
                }
            };

            // Local Update
            setTasks(prev => {
                const updatedList = prev.map(t =>
                    t.recordName === task.recordName
                        ? { ...t, fields: { ...t.fields, CD_date: { value: nextTimestamp } } }
                        : t
                );
                // We typically don't show the history item in 'project' view, so no need to insert it into 'tasks' state
                // unless we are in history view? But we are "completing" it, so it goes to history.
                return updatedList;
            });

            // Persist Batch
            try {
                const result = await privateDB.saveRecords([historyRecord, originalUpdate], { zoneID });
                if (result.hasErrors) throw new Error(result.errors[0].message);

                console.log('Recurring task processed: duplicated history and rescheduled original.');

                // Update local change tag for original task
                const savedOriginal = result.records.find((r: any) => r.recordName === task.recordName);
                if (savedOriginal) {
                    setTasks(currentTasks => currentTasks.map(t =>
                        t.recordName === task.recordName
                            ? { ...t, recordChangeTag: savedOriginal.recordChangeTag }
                            : t
                    ));
                }

            } catch (err) {
                console.error('Recurring task save failed:', err);
                alert('Failed to process recurring task');
                // Revert local state?
                window.location.reload();
            }

            return;
        }

        // STANDARD TOGGLE LOGIC (Non-recurring or Un-completing)

        // Update Local State array
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
    // In 'inbox' mode: show tasks with no project and NOT completed.
    // In 'next_actions' mode: show tasks that are NOT completed (already filtered by query).
    // In 'history' mode: show tasks that ARE completed (and NOT uncompleted, though local state update handles that).

    const visibleTasks = tasks.filter(t => {
        if (viewMode === 'project') {
            return (t.fields.CD_completed?.value !== 1) || completingTaskIds.has(t.recordName);
        } else if (viewMode === 'inbox') {
            // Inbox: Show tasks with NO project (or empty string) AND not completed
            return (!t.fields.CD_project?.value) && (t.fields.CD_completed?.value !== 1 || completingTaskIds.has(t.recordName));
        } else if (viewMode === 'next_actions') {
            // Next Actions: Show non-completed tasks (already filtered by query for someday/waiting/etc)
            return (t.fields.CD_completed?.value !== 1) || completingTaskIds.has(t.recordName);
        } else if (viewMode === 'someday') {
            // Someday: Show non-completed tasks
            return (t.fields.CD_completed?.value !== 1) || completingTaskIds.has(t.recordName);
        } else if (viewMode === 'due') {
            // Due: Show non-completed tasks with date <= Today
            if (t.fields.CD_completed?.value === 1 && !completingTaskIds.has(t.recordName)) return false;
            if (!t.fields.CD_date?.value) return false;
            if (t.fields.CD_dateactive?.value !== 1) return false;

            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);
            const taskDate = new Date(t.fields.CD_date.value);
            return taskDate <= todayEnd;
        } else if (viewMode === 'waiting') {
            // Waiting: Show non-completed tasks (filtered by query)
            return (t.fields.CD_completed?.value !== 1) || completingTaskIds.has(t.recordName);
        } else if (viewMode === 'deferred') {
            // Deferred: Show non-completed tasks (filtered by query)
            return (t.fields.CD_completed?.value !== 1) || completingTaskIds.has(t.recordName);
        } else {
            // History mode
            return t.fields.CD_completed?.value === 1;
        }
    });

    // Details Side Panel Handlers
    const handleTaskClick = (task: TaskRecord) => {
        setSelectedTaskDetails(task);
    };

    // Modified to accept batch updates or single field
    const handleUpdateTaskDetail = async (fieldOrUpdates: keyof TaskRecord['fields'] | Record<string, any>, value?: any) => {
        if (!selectedTaskDetails || !container) return;

        let updates: Record<string, any> = {};
        if (typeof fieldOrUpdates === 'string') {
            updates[fieldOrUpdates] = value;
        } else {
            updates = fieldOrUpdates;
        }

        const updatedTask = { ...selectedTaskDetails };

        // Update local state details immediately
        Object.entries(updates).forEach(([key, val]) => {
            const field = key as keyof TaskRecord['fields'];
            if (!updatedTask.fields[field]) {
                (updatedTask.fields as any)[field] = { value: val };
            } else {
                (updatedTask.fields as any)[field].value = val;
            }
        });

        // Always update modified date
        updatedTask.fields.CD_modifieddate = { value: Date.now() };

        setSelectedTaskDetails(updatedTask);

        // Update main list state
        setTasks(prev => prev.map(t => t.recordName === updatedTask.recordName ? updatedTask : t));

        // Persist
        try {
            const privateDB = container.privateCloudDatabase;
            const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

            const fieldsToSave: Record<string, any> = {
                CD_modifieddate: { value: Date.now() }
            };

            Object.entries(updates).forEach(([key, val]) => {
                fieldsToSave[key] = { value: val };
            });

            const recordToSave = {
                recordName: updatedTask.recordName,
                recordChangeTag: updatedTask.recordChangeTag,
                fields: fieldsToSave
            };

            const result = await privateDB.saveRecords([recordToSave], { zoneID });
            if (result.hasErrors) throw new Error(result.errors[0].message);

            // Sync change tag
            const savedRecord = result.records[0];
            const finalTask = { ...updatedTask, recordChangeTag: savedRecord.recordChangeTag };

            setSelectedTaskDetails(finalTask);
            setTasks(prev => prev.map(t => t.recordName === finalTask.recordName ? finalTask : t));

        } catch (err) {
            console.error('Failed to update task details:', err);
        }
    };

    // Status Helper Logic
    const toggleStatus = (type: 'next' | 'someday' | 'waiting') => {
        if (!selectedTaskDetails) return;

        const isSomeday = selectedTaskDetails.fields.CD_someday?.value === 1;
        const isWaiting = selectedTaskDetails.fields.CD_waitingfor?.value === 1;
        const isNext = !isSomeday && !isWaiting;

        let updates: Record<string, any> = {};

        if (type === 'next') {
            if (isNext) {
                // Untick Next -> Toggle Someday (as requested)
                updates = { CD_someday: 1, CD_waitingfor: 0 };
            } else {
                // Tick Next -> Clear others
                updates = { CD_someday: 0, CD_waitingfor: 0 };
            }
        } else if (type === 'someday') {
            if (isSomeday) {
                // Untick Someday -> Next
                updates = { CD_someday: 0, CD_waitingfor: 0 };
            } else {
                // Tick Someday -> Clear others
                updates = { CD_someday: 1, CD_waitingfor: 0 };
            }
        } else if (type === 'waiting') {
            if (isWaiting) {
                // Untick Waiting -> Next
                updates = { CD_someday: 0, CD_waitingfor: 0 };
            } else {
                // Tick Waiting -> Clear others
                updates = { CD_someday: 0, CD_waitingfor: 1 };
            }
        }

        handleUpdateTaskDetail(updates);
    };

    const handleToggleDate = () => {
        if (!selectedTaskDetails) return;
        const isActive = selectedTaskDetails.fields.CD_dateactive?.value === 1;

        let updates: Record<string, any> = {};
        if (isActive) {
            // Turning OFF: Disable Date AND Reminder AND Recurring
            updates = { CD_dateactive: 0, CD_reminderactive: 0, CD_recurring: 0 };
        } else {
            // Turning ON: Enable Date, ensure date value exists (default to today if null)
            updates = { CD_dateactive: 1 };
            if (!selectedTaskDetails.fields.CD_date?.value) {
                updates.CD_date = Date.now();
            }
        }
        handleUpdateTaskDetail(updates);
    };

    const handleToggleReminder = () => {
        if (!selectedTaskDetails) return;
        const isActive = selectedTaskDetails.fields.CD_reminderactive?.value === 1;

        let updates: Record<string, any> = {};
        if (isActive) {
            // Turning OFF: Just disable Reminder
            updates = { CD_reminderactive: 0 };
        } else {
            // Turning ON: Enable Reminder AND Date
            updates = { CD_reminderactive: 1, CD_dateactive: 1 };
            if (!selectedTaskDetails.fields.CD_date?.value) {
                updates.CD_date = Date.now();
            }
        }
        handleUpdateTaskDetail(updates);
    };


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
                <div className="p-2 space-y-1 mt-2 mx-2">
                    <div
                        onClick={() => {
                            setViewMode('inbox');
                            setSelectedProject(null);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (dragOverProjectId !== 'inbox-pseudo-project') {
                                setDragOverProjectId('inbox-pseudo-project');
                            }
                        }}
                        onDragEnter={(e) => {
                            e.preventDefault();
                            if (dragOverProjectId !== 'inbox-pseudo-project') {
                                setDragOverProjectId('inbox-pseudo-project');
                            }
                        }}
                        onDragLeave={(e) => {
                            // Prevent flickering when hovering over children
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setDragOverProjectId(null);
                            }
                        }}
                        onDrop={(e) => handleDrop(e, { recordName: 'inbox-pseudo-project', recordType: 'CD_Project', fields: { CD_name: { value: 'Inbox' }, CD_id: { value: 'inbox' } } } as any)}
                        className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'inbox'
                            ? 'bg-blue-50 text-blue-700'
                            : dragOverProjectId === 'inbox-pseudo-project'
                                ? 'bg-blue-100 ring-2 ring-blue-300 ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <Inbox className="w-5 h-5 text-blue-500" />
                        <span className="font-medium">Inbox</span>
                    </div>

                    <div
                        onClick={() => {
                            setViewMode('due');
                            setSelectedProject(null);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                        }}
                        onDragEnter={(e) => {
                            e.preventDefault();
                            if (dragOverProjectId !== 'due-pseudo-project') {
                                setDragOverProjectId('due-pseudo-project');
                            }
                        }}
                        onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setDragOverProjectId(null);
                            }
                        }}
                        onDrop={handleDropDue}
                        className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'due'
                            ? 'bg-orange-50 text-orange-700'
                            : dragOverProjectId === 'due-pseudo-project'
                                ? 'bg-orange-100 ring-2 ring-orange-300 ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <CalendarClock className={`w-5 h-5 ${viewMode === 'due' ? 'text-orange-500' : 'text-gray-400'}`} />
                        <span className="font-medium">Due and Overdue</span>
                    </div>

                    <div
                        onClick={() => {
                            setViewMode('next_actions');
                            setSelectedProject(null);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                        }}
                        onDragEnter={(e) => {
                            e.preventDefault();
                            if (dragOverProjectId !== 'next-actions-pseudo-project') {
                                setDragOverProjectId('next-actions-pseudo-project');
                            }
                        }}
                        onDragLeave={(e) => {
                            // Prevent flickering when hovering over children
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setDragOverProjectId(null);
                            }
                        }}
                        onDrop={handleDropNextActions}
                        className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'next_actions'
                            ? 'bg-purple-50 text-purple-700'
                            : dragOverProjectId === 'next-actions-pseudo-project'
                                ? 'bg-purple-100 ring-2 ring-purple-300 ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <Zap className={`w-5 h-5 ${viewMode === 'next_actions' ? 'text-purple-500' : 'text-gray-400'}`} />
                        <span className="font-medium">Next actions</span>
                    </div>

                    <div
                        onClick={() => {
                            setViewMode('waiting');
                            setSelectedProject(null);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                        }}
                        onDragEnter={(e) => {
                            e.preventDefault();
                            if (dragOverProjectId !== 'waiting-pseudo-project') {
                                setDragOverProjectId('waiting-pseudo-project');
                            }
                        }}
                        onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setDragOverProjectId(null);
                            }
                        }}
                        onDrop={handleDropWaiting}
                        className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'waiting'
                            ? 'bg-indigo-50 text-indigo-700'
                            : dragOverProjectId === 'waiting-pseudo-project'
                                ? 'bg-indigo-100 ring-2 ring-indigo-300 ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <Hourglass className={`w-5 h-5 ${viewMode === 'waiting' ? 'text-indigo-500' : 'text-gray-400'}`} />
                        <span className="font-medium">Waiting for</span>
                    </div>

                    <div
                        onClick={() => {
                            setViewMode('deferred');
                            setSelectedProject(null);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                        }}
                        onDragEnter={(e) => {
                            e.preventDefault();
                            if (dragOverProjectId !== 'deferred-pseudo-project') {
                                setDragOverProjectId('deferred-pseudo-project');
                            }
                        }}
                        onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setDragOverProjectId(null);
                            }
                        }}
                        onDrop={handleDropDeferred}
                        className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'deferred'
                            ? 'bg-teal-50 text-teal-700'
                            : dragOverProjectId === 'deferred-pseudo-project'
                                ? 'bg-teal-100 ring-2 ring-teal-300 ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <CalendarDays className={`w-5 h-5 ${viewMode === 'deferred' ? 'text-teal-500' : 'text-gray-400'}`} />
                        <span className="font-medium">Deferred</span>
                    </div>

                    <div
                        onClick={() => {
                            setViewMode('someday');
                            setSelectedProject(null);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                        }}
                        onDragEnter={(e) => {
                            e.preventDefault();
                            if (dragOverProjectId !== 'someday-pseudo-project') {
                                setDragOverProjectId('someday-pseudo-project');
                            }
                        }}
                        onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setDragOverProjectId(null);
                            }
                        }}
                        onDrop={handleDropSomeday}
                        className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'someday'
                            ? 'bg-amber-50 text-amber-700'
                            : dragOverProjectId === 'someday-pseudo-project'
                                ? 'bg-amber-100 ring-2 ring-amber-300 ring-inset'
                                : 'hover:bg-gray-100 text-gray-700'
                            }`}
                    >
                        <CalendarClock className={`w-5 h-5 ${viewMode === 'someday' ? 'text-amber-500' : 'text-gray-400'}`} />
                        <span className="font-medium">Someday / Maybe</span>
                    </div>
                </div>

                <div className="p-4 border-b border-gray-100 border-t mt-2">
                    <h2 className="font-bold text-gray-900 flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-blue-600" />
                        Projects ({projects.length})
                        <button
                            onClick={handleCreateProject}
                            className="ml-auto p-1 rounded-full text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            title="New Project (P)"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {fetching ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <>
                            {/* Active Projects */}
                            {projects
                                .filter(p => (!p.fields.CD_focus || p.fields.CD_focus.value !== 0) || p.fields.CD_singleactions?.value === 1)
                                .map(project => (
                                    <div
                                        key={project.recordName}
                                        draggable={project.fields.CD_singleactions?.value !== 1}
                                        onDragStart={(e) => handleDragStart(e, project, 'project')}
                                        onDragEnd={handleDragEnd}
                                        onClick={() => {
                                            setSelectedProject(project);
                                            setViewMode('project');
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'move';
                                            if (dragOverProjectId !== project.recordName) {
                                                setDragOverProjectId(project.recordName);
                                            }
                                        }}
                                        onDragEnter={(e) => {
                                            e.preventDefault();
                                            if (dragOverProjectId !== project.recordName) {
                                                setDragOverProjectId(project.recordName);
                                            }
                                        }}
                                        onDragLeave={(e) => {
                                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                                setDragOverProjectId(null);
                                            }
                                        }}
                                        onDrop={(e) => handleDrop(e, project)}
                                        className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${viewMode === 'project' && selectedProject?.recordName === project.recordName
                                            ? 'bg-blue-50 text-blue-700'
                                            : dragOverProjectId === project.recordName
                                                ? isDraggingProject
                                                    ? dragOverPosition === 'top' ? 'border-t-2 border-blue-500' : 'border-b-2 border-blue-500'
                                                    : 'bg-blue-100 ring-2 ring-blue-300 ring-inset'
                                                : 'hover:bg-gray-100 text-gray-700'
                                            }`}
                                    >
                                        <div className="flex-1 min-w-0 font-medium truncate">
                                            {editingId === project.recordName ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="block w-full text-sm rounded border-gray-300 px-1 py-0.5"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleProjectSave();
                                                            if (e.key === 'Escape') handleCancel();
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                    <button onClick={(e) => { e.stopPropagation(); handleProjectSave(); }} className="text-green-600"><Check className="w-4 h-4" /></button>
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
                                ))}

                            {/* Projects on Hold */}
                            {projects.some(p => p.fields.CD_focus?.value === 0 && p.fields.CD_singleactions?.value !== 1) && (
                                <>
                                    <div className="p-4 border-b border-gray-100 border-t mt-4 mb-2">
                                        <h3 className="font-bold text-gray-500 text-xs uppercase tracking-wider">
                                            Projects on hold
                                        </h3>
                                    </div>
                                    {projects
                                        .filter(p => p.fields.CD_focus?.value === 0 && p.fields.CD_singleactions?.value !== 1)
                                        .map(project => (
                                            <div
                                                key={project.recordName}
                                                draggable={true}
                                                onDragStart={(e) => handleDragStart(e, project, 'project')}
                                                onDragEnd={handleDragEnd}
                                                onClick={() => {
                                                    setSelectedProject(project);
                                                    setViewMode('project');
                                                }}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    e.dataTransfer.dropEffect = 'move';
                                                    if (dragOverProjectId !== project.recordName) {
                                                        setDragOverProjectId(project.recordName);
                                                    }
                                                }}
                                                onDragEnter={(e) => {
                                                    e.preventDefault();
                                                    if (dragOverProjectId !== project.recordName) {
                                                        setDragOverProjectId(project.recordName);
                                                    }
                                                }}
                                                onDragLeave={(e) => {
                                                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                                        setDragOverProjectId(null);
                                                    }
                                                }}
                                                onDrop={(e) => handleDrop(e, project)}
                                                className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors opacity-75 ${viewMode === 'project' && selectedProject?.recordName === project.recordName
                                                    ? 'bg-gray-100 text-gray-900'
                                                    : dragOverProjectId === project.recordName
                                                        ? isDraggingProject
                                                            ? dragOverPosition === 'top' ? 'border-t-2 border-blue-500' : 'border-b-2 border-blue-500'
                                                            : 'bg-gray-100 ring-2 ring-gray-300 ring-inset'
                                                        : 'hover:bg-gray-50 text-gray-600'
                                                    }`}
                                            >
                                                <div className="flex-1 min-w-0 font-medium truncate">
                                                    {editingId === project.recordName ? (
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="text"
                                                                value={editName}
                                                                onChange={(e) => setEditName(e.target.value)}
                                                                className="block w-full text-sm rounded border-gray-300 px-1 py-0.5"
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleProjectSave();
                                                                    if (e.key === 'Escape') handleCancel();
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            <button onClick={(e) => { e.stopPropagation(); handleProjectSave(); }} className="text-green-600"><Check className="w-4 h-4" /></button>
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
                                        ))}
                                </>
                            )}
                        </>
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

                {/* Keyboard Shortcuts Button */}
                <div className="p-4 border-t border-gray-100">
                    <button
                        onClick={() => setShowShortcuts(true)}
                        className="w-full flex items-center gap-2 p-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <Keyboard className="w-4 h-4" />
                        <span>Keyboard Shortcuts</span>
                        <span className="ml-auto text-xs text-gray-400">?</span>
                    </button>
                </div>
            </div>

            {/* Keyboard Shortcuts Modal */}
            {showShortcuts && (
                <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Keyboard className="w-6 h-6 text-blue-600" />
                                <h2 className="text-xl font-bold text-gray-900">Keyboard Shortcuts</h2>
                            </div>
                            <button
                                onClick={() => setShowShortcuts(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Tasks Section */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <ListTodo className="w-5 h-5 text-blue-600" />
                                    Tasks
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-700">Create task at bottom</span>
                                        <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">N</kbd>
                                    </div>
                                    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-700">Create task at top</span>
                                        <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">Shift + N</kbd>
                                    </div>
                                </div>
                            </div>

                            {/* Projects Section */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <ClipboardList className="w-5 h-5 text-blue-600" />
                                    Projects
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-700">Create project at bottom</span>
                                        <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">P</kbd>
                                    </div>
                                    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-700">Create project at top</span>
                                        <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">Shift + P</kbd>
                                    </div>
                                </div>
                            </div>

                            {/* General Section */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <Keyboard className="w-5 h-5 text-blue-600" />
                                    General
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-700">Show this help</span>
                                        <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">?</kbd>
                                    </div>
                                    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-700">Close modals</span>
                                        <kbd className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm font-mono text-sm">Esc</kbd>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100 text-center text-sm text-gray-600">
                            Press <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded shadow-sm font-mono text-xs">Esc</kbd> to close
                        </div>
                    </div>
                </div>
            )}

            {selectedTaskDetails && (
                <div className="absolute inset-0 z-50 bg-black/10 backdrop-blur-[1px] flex justify-end">
                    {/* Click backdrop to close */}
                    <div className="absolute inset-0" onClick={() => setSelectedTaskDetails(null)} />

                    <div className="relative w-96 bg-white shadow-2xl border-l border-gray-100 h-full flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                            <div>
                                <h2 className="font-bold text-lg text-gray-900 break-words line-clamp-2">
                                    {selectedTaskDetails.fields.CD_name?.value}
                                </h2>
                                <p className="text-xs text-gray-400 mt-1">Details</p>
                            </div>
                            <button onClick={() => setSelectedTaskDetails(null)} className="text-gray-400 hover:text-gray-600 mt-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Date Field */}
                            {/* Date & Reminder Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    {/* Date Toggle */}
                                    <div className="flex-1 flex items-center justify-between p-3 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors" onClick={handleToggleDate}>
                                        <div className="flex items-center gap-2">
                                            <Calendar className={`w-4 h-4 ${selectedTaskDetails.fields.CD_dateactive?.value === 1 ? 'text-blue-500' : 'text-gray-400'}`} />
                                            <span className={`text-sm font-medium ${selectedTaskDetails.fields.CD_dateactive?.value === 1 ? 'text-gray-900' : 'text-gray-500'}`}>Date</span>
                                        </div>
                                        <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${selectedTaskDetails.fields.CD_dateactive?.value === 1 ? 'bg-blue-500' : 'bg-gray-200'}`}>
                                            <div className={`w-3 h-3 bg-white rounded-full transition-transform ${selectedTaskDetails.fields.CD_dateactive?.value === 1 ? 'translate-x-4' : ''}`} />
                                        </div>
                                    </div>

                                    {/* Reminder Toggle */}
                                    <div className="flex-1 flex items-center justify-between p-3 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors" onClick={handleToggleReminder}>
                                        <div className="flex items-center gap-2">
                                            <Clock className={`w-4 h-4 ${selectedTaskDetails.fields.CD_reminderactive?.value === 1 ? 'text-blue-500' : 'text-gray-400'}`} />
                                            <span className={`text-sm font-medium ${selectedTaskDetails.fields.CD_reminderactive?.value === 1 ? 'text-gray-900' : 'text-gray-500'}`}>Reminder</span>
                                        </div>
                                        <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${selectedTaskDetails.fields.CD_reminderactive?.value === 1 ? 'bg-blue-500' : 'bg-gray-200'}`}>
                                            <div className={`w-3 h-3 bg-white rounded-full transition-transform ${selectedTaskDetails.fields.CD_reminderactive?.value === 1 ? 'translate-x-4' : ''}`} />
                                        </div>
                                    </div>
                                </div>

                                {/* Conditional Input */}
                                {selectedTaskDetails.fields.CD_dateactive?.value === 1 && (
                                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                        <input
                                            type={selectedTaskDetails.fields.CD_reminderactive?.value === 1 ? "datetime-local" : "date"}
                                            className="w-full text-sm p-2 border border-blue-100 bg-blue-50/30 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-gray-700"
                                            value={selectedTaskDetails.fields.CD_date?.value ?
                                                (selectedTaskDetails.fields.CD_reminderactive?.value === 1
                                                    ? new Date(selectedTaskDetails.fields.CD_date.value).toISOString().slice(0, 16)
                                                    : new Date(selectedTaskDetails.fields.CD_date.value).toISOString().slice(0, 10)
                                                ) : ''}
                                            onChange={(e) => {
                                                const dateVal = e.target.value ? new Date(e.target.value).getTime() : 0;
                                                handleUpdateTaskDetail('CD_date', dateVal);
                                            }}
                                        />

                                        <div className="mt-4 flex items-center justify-between">
                                            <div
                                                className="flex items-center gap-2 cursor-pointer group w-fit"
                                                onClick={() => handleUpdateTaskDetail('CD_recurring', selectedTaskDetails.fields.CD_recurring?.value === 1 ? 0 : 1)}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedTaskDetails.fields.CD_recurring?.value === 1 ? 'bg-blue-500 border-blue-500' : 'border-gray-300 group-hover:border-blue-400'}`}>
                                                    {selectedTaskDetails.fields.CD_recurring?.value === 1 && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                                <span className={`text-xs ${selectedTaskDetails.fields.CD_recurring?.value === 1 ? 'text-blue-600 font-medium' : 'text-gray-500 group-hover:text-gray-700'}`}>Recurring Task</span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="flex items-center gap-2 cursor-pointer group w-fit"
                                                    onClick={() => handleUpdateTaskDetail('CD_hideuntildate', selectedTaskDetails.fields.CD_hideuntildate?.value === 1 ? 0 : 1)}
                                                >
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedTaskDetails.fields.CD_hideuntildate?.value === 1 ? 'bg-blue-500 border-blue-500' : 'border-gray-300 group-hover:border-blue-400'}`}>
                                                        {selectedTaskDetails.fields.CD_hideuntildate?.value === 1 && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <span className={`text-xs ${selectedTaskDetails.fields.CD_hideuntildate?.value === 1 ? 'text-blue-600 font-medium' : 'text-gray-500 group-hover:text-gray-700'}`}>Hide until date</span>
                                                </div>
                                            </div>
                                        </div>

                                        {selectedTaskDetails.fields.CD_recurring?.value === 1 && (
                                            <div className="mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                <div className="w-16">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        className="w-full text-xs p-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                        value={selectedTaskDetails.fields.CD_recurrence?.value || 1}
                                                        onChange={(e) => handleUpdateTaskDetail('CD_recurrence', parseInt(e.target.value) || 1)}
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <select
                                                        className="w-full text-xs p-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                                                        value={selectedTaskDetails.fields.CD_recurrencetype?.value || 'days'}
                                                        onChange={(e) => handleUpdateTaskDetail('CD_recurrencetype', e.target.value)}
                                                    >
                                                        <option value="days">Days</option>
                                                        <option value="weeks">Weeks</option>
                                                        <option value="months">Months</option>
                                                        <option value="years">Years</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <hr className="border-gray-100" />

                            {/* Toggles */}
                            <div className="space-y-4">
                                {/* Next Action (Calculated: !someday && !waiting) */}
                                <div className="flex items-center justify-between group cursor-pointer" onClick={() => toggleStatus('next')}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${(!selectedTaskDetails.fields.CD_someday?.value && !selectedTaskDetails.fields.CD_waitingfor?.value) ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-400'}`}>
                                            <Zap className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-gray-900">Next Action</p>
                                            <p className="text-xs text-gray-500">Do this as soon as possible</p>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${(!selectedTaskDetails.fields.CD_someday?.value && !selectedTaskDetails.fields.CD_waitingfor?.value) ? 'bg-yellow-500' : 'bg-gray-200'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${(!selectedTaskDetails.fields.CD_someday?.value && !selectedTaskDetails.fields.CD_waitingfor?.value) ? 'translate-x-4' : ''}`} />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between group cursor-pointer" onClick={() => toggleStatus('someday')}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${selectedTaskDetails.fields.CD_someday?.value === 1 ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                                            <Moon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-gray-900">Someday / Maybe</p>
                                            <p className="text-xs text-gray-500">No immediate action</p>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${selectedTaskDetails.fields.CD_someday?.value === 1 ? 'bg-purple-500' : 'bg-gray-200'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${selectedTaskDetails.fields.CD_someday?.value === 1 ? 'translate-x-4' : ''}`} />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between group cursor-pointer" onClick={() => toggleStatus('waiting')}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${selectedTaskDetails.fields.CD_waitingfor?.value === 1 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>
                                            <Hourglass className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-gray-900">Waiting For</p>
                                            <p className="text-xs text-gray-500">Waiting on someone else</p>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${selectedTaskDetails.fields.CD_waitingfor?.value === 1 ? 'bg-orange-500' : 'bg-gray-200'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${selectedTaskDetails.fields.CD_waitingfor?.value === 1 ? 'translate-x-4' : ''}`} />
                                    </div>
                                </div>


                            </div>
                        </div>

                        {/* Footer info */}
                        <div className="p-4 bg-gray-50 text-xs text-gray-400 border-t border-gray-100 flex justify-between">
                            <span>Change Tag: {selectedTaskDetails.recordChangeTag.slice(0, 8)}...</span>
                            <span>{selectedTaskDetails.fields.CD_modifieddate?.value ? new Date(selectedTaskDetails.fields.CD_modifieddate.value).toLocaleTimeString() : 'No date'}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content: Tasks */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-900">
                            {viewMode === 'project'
                                ? (selectedProject?.fields.CD_name?.value || 'Select a Project')
                                : viewMode === 'inbox' ? 'Inbox'
                                    : viewMode === 'next_actions' ? 'Next actions'
                                        : viewMode === 'waiting' ? 'Waiting for'
                                            : viewMode === 'deferred' ? 'Deferred'
                                                : viewMode === 'someday' ? 'Someday / Maybe'
                                                    : viewMode === 'due' ? 'Due and Overdue'
                                                        : 'Completed Tasks'
                            }
                        </h1>
                        {(viewMode === 'project' && selectedProject || viewMode === 'inbox' || viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'due' || viewMode === 'waiting' || viewMode === 'deferred') && (
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

                {taskError && (
                    <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                        <X className="w-4 h-4" />
                        <span>{taskError}</span>
                    </div>
                )}

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
                            ) : viewMode === 'inbox' ? (
                                <>
                                    <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500">Inbox is empty.</p>
                                </>
                            ) : viewMode === 'next_actions' ? (
                                <>
                                    <Zap className="w-12 h-12 text-purple-200 mx-auto mb-4" />
                                    <p className="text-gray-500">No next actions available.</p>
                                </>
                            ) : viewMode === 'someday' ? (
                                <>
                                    <CalendarClock className="w-12 h-12 text-amber-200 mx-auto mb-4" />
                                    <p className="text-gray-500">No someday tasks.</p>
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
                                    draggable={(viewMode === 'project' || viewMode === 'inbox' || viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'waiting' || viewMode === 'deferred' || viewMode === 'due') && editingTaskId !== task.recordName} // Enable drag for Project, Inbox, Next Actions, Someday, Waiting, Deferred, Due
                                    onDragStart={(e) => handleDragStart(e, task, 'task')}
                                    // Drop Handlers for Reordering
                                    onDragOver={handleTaskDragOver}
                                    onDragEnter={() => handleTaskDragEnter(task)}
                                    onDragLeave={handleTaskDragLeave}
                                    onDrop={(e) => handleTaskDrop(e, task)}
                                    className={`group p-4 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-all flex items-center gap-3 ${(viewMode === 'project' || viewMode === 'inbox' || viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'waiting' || viewMode === 'deferred' || viewMode === 'due') ? 'cursor-grab active:cursor-grabbing hover:border-blue-100' : 'opacity-75'
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

                                    <div className="flex-1 min-w-0" onClick={() => handleTaskClick(task)}>
                                        {editingTaskId === task.recordName ? (
                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                                            <div className="flex items-center justify-between w-full relative cursor-pointer">
                                                <span className={`text-gray-900 ${task.fields.CD_completed?.value === 1 ? 'line-through text-gray-400' : ''}`}>
                                                    {task.fields.CD_name?.value}
                                                </span>
                                                {/* Meta Icons (Mini badges) */}
                                                <div className="flex items-center gap-1 ml-2">
                                                    {task.fields.CD_date?.value && task.fields.CD_dateactive?.value === 1 ? <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(task.fields.CD_date.value).toLocaleDateString()}</span> : null}
                                                    {(!task.fields.CD_someday?.value && !task.fields.CD_waitingfor?.value) ? <span title="Next Action" className="text-yellow-500"><Zap className="w-3 h-3" /></span> : null}
                                                    {task.fields.CD_waitingfor?.value === 1 && <span title="Waiting For" className="text-orange-400"><Hourglass className="w-3 h-3" /></span>}
                                                    {task.fields.CD_someday?.value === 1 && <span title="Someday" className="text-purple-400"><Moon className="w-3 h-3" /></span>}
                                                    {task.fields.CD_recurring?.value === 1 && <span title="Recurring" className="text-blue-400"><Repeat className="w-3 h-3" /></span>}
                                                </div>

                                                {/* Show actions in Project Mode, Inbox Mode, Next Actions Mode, Someday Mode, Waiting Mode, Deferred Mode, Due Mode */}
                                                {(viewMode === 'project' || viewMode === 'inbox' || viewMode === 'next_actions' || viewMode === 'someday' || viewMode === 'waiting' || viewMode === 'deferred' || viewMode === 'due') && (
                                                    <div className="flex items-center ml-auto opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
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
                                                        <ChevronRight className="w-4 h-4 text-gray-300" />
                                                    </div>
                                                )}
                                                {/* Show different actions or Project Name in History Mode? */}
                                                {viewMode === 'history' && (
                                                    <span className="text-xs text-gray-400 ml-auto">
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
