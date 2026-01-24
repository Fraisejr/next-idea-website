'use client';

import { useEffect, useState } from 'react';
import { CloudKitProvider, useCloudKit } from '@/components/CloudKitProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ProjectRecord } from '@/lib/cloudkit';
import { Loader2, ListTodo, CheckCircle2 } from 'lucide-react';

function ProjectsList() {
    const { container, isAuthenticated, isLoading, login } = useCloudKit();
    const [projects, setProjects] = useState<ProjectRecord[]>([]);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    useEffect(() => {
        async function fetchProjects() {
            if (!isAuthenticated || !container) return;

            setFetching(true);
            setError(null);

            try {
                // Core Data with CloudKit syncs to the PRIVATE database in com.apple.coredata.cloudkit.zone
                const privateDB = container.privateCloudDatabase;

                // Core Data with CloudKit syncs to the PRIVATE database in com.apple.coredata.cloudkit.zone
                // We use a filter on CD_name because we verified it's queryable, but we avoid sorting to prevent index errors
                const query = {
                    recordType: 'CD_Project',
                    filterBy: [{
                        fieldName: 'CD_name',
                        comparator: 'NOT_EQUALS',
                        fieldValue: { value: '' }
                    }],
                    desiredKeys: ['CD_name', 'CD_id', 'CD_order', 'CD_completed', 'CD_singleactions'],
                    resultsLimit: 100
                };

                const options = {
                    zoneID: { zoneName: 'com.apple.coredata.cloudkit.zone' }
                };

                // Execute query
                const result = await privateDB.performQuery(query, options);

                if (result.hasErrors) {
                    throw new Error(result.errors[0].message);
                }

                let records = result.records as ProjectRecord[];

                // Filter out completed projects
                records = records.filter(p => !p.fields.CD_completed || p.fields.CD_completed.value !== 1);

                // Sort client-side: Single Actions first, then by CD_order
                records.sort((a, b) => {
                    // Check for Single Actions (CD_singleactions == 1)
                    const isSingleA = a.fields.CD_singleactions?.value === 1;
                    const isSingleB = b.fields.CD_singleactions?.value === 1;

                    if (isSingleA && !isSingleB) return -1; // A comes first
                    if (!isSingleA && isSingleB) return 1;  // B comes first

                    // If both or neither are Single Actions, sort by CD_order
                    const orderA = a.fields.CD_order?.value ?? 0;
                    const orderB = b.fields.CD_order?.value ?? 0;
                    return orderA - orderB;
                });

                setProjects(records);

            } catch (err: any) {
                console.error('Fetch error:', err);
                // Fallback: Try 'CD_Project' if 'Project' not found?
                if (err.message && err.message.includes('Record Type not found')) {
                    setError("Error: Record Type 'Project' not found. Trying 'CD_Project'...");
                    // Retry logic could go here, but for now let's just report.
                }
                setError(err.message || 'Failed to fetch projects');
            } finally {
                setFetching(false);
            }
        }

        if (isAuthenticated) {
            fetchProjects();
        }
    }, [isAuthenticated, container]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
                    <ListTodo className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Log in to Next Idea</h1>
                <p className="text-gray-600 mb-8 max-w-md">
                    Access your projects and tasks directly from your browser.
                </p>

                <div id="apple-sign-in-button" className="transition-transform hover:scale-105"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pt-10 px-4 pb-20">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Your Projects</h1>
                <div className="text-sm text-gray-500">
                    {projects.length} Active
                </div>
            </div>

            {fetching && (
                <div className="py-12 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl mb-6">
                    {error}
                </div>
            )}

            {!fetching && !error && projects.length === 0 && (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No active projects found.</p>
                </div>
            )}

            <div className="grid gap-4">
                {projects.map((project) => (
                    <div
                        key={project.fields.CD_id?.value || project.recordName}
                        className="group bg-white p-6 rounded-2xl border border-gray-100 hover:border-blue-100 shadow-sm transition-all hover:shadow-md"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                                    {project.fields.CD_name?.value || 'Untitled Project'}
                                </h3>
                            </div>
                        </div>
                    </div>
                ))}
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
