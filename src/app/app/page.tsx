'use client';

import { useEffect, useState } from 'react';
import { CloudKitProvider, useCloudKit } from '@/components/CloudKitProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ProjectRecord, TaskRecord } from '@/lib/cloudkit';
import { Loader2, ListTodo, CheckCircle2, Pencil, Check, X, ClipboardList } from 'lucide-react';

function ProjectsList() {
    const { container, isAuthenticated, isLoading, login } = useCloudKit();
    const [projects, setProjects] = useState<ProjectRecord[]>([]);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    // Task & Selection State
    const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
    const [tasks, setTasks] = useState<TaskRecord[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);

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

    // Fetch Tasks when selectedProject changes
    useEffect(() => {
        const fetchTasks = async () => {
            if (!container || !selectedProject) return;
            setLoadingTasks(true);
            try {
                const privateDB = container.privateCloudDatabase;
                const zoneID = { zoneName: 'com.apple.coredata.cloudkit.zone' };

                // Construct Reference Filter
                const projectRecordID = {
                    recordName: selectedProject.recordName,
                    zoneID: zoneID
                };

                const query = {
                    recordType: 'CD_Task',
                    filterBy: [{
                        fieldName: 'CD_project',
                        comparator: 'EQUALS',
                        fieldValue: { value: selectedProject.recordName }
                    }],
                    desiredKeys: ['CD_name', 'CD_id', 'CD_order', 'CD_project', 'CD_completed'],
                    resultsLimit: 200
                };

                const result = await privateDB.performQuery(query, { zoneID });
                if (result.hasErrors) throw new Error(result.errors[0].message);

                const taskRecords = result.records as TaskRecord[];


                // Sort by Order
                taskRecords.sort((a, b) => (a.fields.CD_order?.value ?? 0) - (b.fields.CD_order?.value ?? 0));

                setTasks(taskRecords);
            } catch (err: any) {
                console.error('Fetch tasks error:', err);
                // Silently fail for tasks so we don't block UI
                setTasks([]);
            } finally {
                setLoadingTasks(false);
            }
        };

        if (selectedProject) {
            fetchTasks();
        } else {
            setTasks([]);
        }
    }, [selectedProject, container]);


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
        <div className="flex h-[calc(100vh-64px)] mt-16 bg-white overflow-hidden">
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
                                onClick={() => setSelectedProject(project)}
                                className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${selectedProject?.recordName === project.recordName ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
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
            </div>

            {/* Main Content: Tasks */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {selectedProject?.fields.CD_name?.value || 'Select a Project'}
                    </h1>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loadingTasks ? (
                        <div className="flex justify-center p-10">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <ListTodo className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">No tasks found in this project.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {tasks.map(task => (
                                <div key={task.recordName} className="p-4 bg-white border border-gray-100 rounded-xl hover:border-blue-100 hover:shadow-sm transition-all flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full border-2 ${task.fields.CD_completed?.value === 1 ? 'bg-blue-500 border-blue-500' : 'border-gray-300'} cursor-pointer`}></div>
                                    <span className={`text-gray-900 ${task.fields.CD_completed?.value === 1 ? 'line-through text-gray-400' : ''}`}>
                                        {task.fields.CD_name?.value}
                                    </span>
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
