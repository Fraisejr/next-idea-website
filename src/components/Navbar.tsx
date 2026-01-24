'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCloudKit } from './CloudKitProvider';

export default function Navbar() {
    const { isAuthenticated, logout, container } = useCloudKit();

    // On the homepage (no provider), container is null. We treat that as disconnected.
    const showLogout = container && isAuthenticated;

    const handleLogout = async () => {
        await logout();
        // Optional: reload to ensure clean state or redirect
        window.location.reload();
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo / Brand */}
                    <Link href="/" className="flex items-center gap-2">
                        <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0">
                            <Image
                                src="/logo.png"
                                alt="Next Idea Logo"
                                fill
                                className="object-cover"
                            />
                        </div>
                        <span className="text-lg font-semibold text-gray-900 tracking-tight">Next Idea</span>
                    </Link>

                    {/* Navigation Links */}
                    <div className="hidden md:flex items-center gap-8">
                        <Link href="/#overview" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">
                            Overview
                        </Link>
                        <Link
                            href="/tutorials"
                            className="text-gray-600 hover:text-blue-600 font-medium transition-colors"
                        >
                            Tutorials
                        </Link>

                        {showLogout ? (
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium transition-colors text-sm"
                            >
                                Log Out
                            </button>
                        ) : (
                            <Link
                                href="/app"
                                className="px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors text-sm"
                            >
                                Open App
                            </Link>
                        )}
                    </div>

                    {/* Mobile Menu Button (Placeholder) */}
                    <div className="md:hidden flex items-center gap-4">
                        {showLogout ? (
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium transition-colors text-xs"
                            >
                                Log Out
                            </button>
                        ) : (
                            <Link
                                href="/app"
                                className="px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors text-xs"
                            >
                                Open App
                            </Link>
                        )}
                        <button className="text-gray-500 hover:text-gray-900">
                            <span className="sr-only">Open menu</span>
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
