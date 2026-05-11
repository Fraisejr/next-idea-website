'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { X, Check, Loader2, LogOut } from 'lucide-react';
import { GoogleCalendar, SelectedCalendar, fetchCalendars } from '@/lib/google';

type Props = {
    onClose: () => void;
    selectedCalendars: SelectedCalendar[];
    onSaveCalendars: (calendars: SelectedCalendar[]) => void;
};

export function SettingsModal({ onClose, selectedCalendars, onSaveCalendars }: Props) {
    const { data: session } = useSession();
    const googleToken = session?.accessToken ?? null;

    const [availableCalendars, setAvailableCalendars] = useState<GoogleCalendar[]>([]);
    const [loadingCalendars, setLoadingCalendars] = useState(false);
    const [localSelected, setLocalSelected] = useState<SelectedCalendar[]>(selectedCalendars);

    useEffect(() => {
        if (!googleToken) return;
        setLoadingCalendars(true);
        fetchCalendars(googleToken)
            .then(setAvailableCalendars)
            .catch(() => {})
            .finally(() => setLoadingCalendars(false));
    }, [googleToken]);

    const toggleCalendar = (cal: GoogleCalendar) => {
        const isSelected = localSelected.some(s => s.id === cal.id);
        if (isSelected) {
            setLocalSelected(prev => prev.filter(s => s.id !== cal.id));
        } else {
            setLocalSelected(prev => [
                ...prev,
                { id: cal.id, name: cal.summary, color: cal.backgroundColor || '#4285f4' },
            ]);
        }
    };

    const updateColor = (id: string, color: string) => {
        setLocalSelected(prev => prev.map(s => s.id === id ? { ...s, color } : s));
    };

    const handleSave = () => {
        onSaveCalendars(localSelected);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900">Settings</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Google Calendar</h3>

                        {!googleToken ? (
                            <button
                                onClick={() => signIn('google', { callbackUrl: window.location.href })}
                                className="flex items-center gap-2.5 px-4 py-2.5 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 w-full justify-center cursor-pointer"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                </svg>
                                Sign in with Google
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-green-600 font-medium flex items-center gap-1.5">
                                        <Check className="w-3.5 h-3.5" />
                                        Connected{session?.user?.email ? ` · ${session.user.email}` : ''}
                                    </span>
                                    <button
                                        onClick={() => signOut({ callbackUrl: window.location.href })}
                                        className="text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                        <LogOut className="w-3.5 h-3.5" />
                                        Disconnect
                                    </button>
                                </div>

                                {loadingCalendars ? (
                                    <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Loading calendars…
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">
                                            Select calendars to display
                                        </p>
                                        {availableCalendars.map(cal => {
                                            const sel = localSelected.find(s => s.id === cal.id);
                                            return (
                                                <div key={cal.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                                    <button
                                                        onClick={() => toggleCalendar(cal)}
                                                        className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors cursor-pointer ${sel ? 'bg-blue-500 border-blue-500' : 'border-gray-300 hover:border-gray-400'}`}
                                                    >
                                                        {sel && <Check className="w-3 h-3 text-white" />}
                                                    </button>
                                                    <span className="flex-1 text-sm text-gray-800 truncate">{cal.summary}</span>
                                                    {sel && (
                                                        <input
                                                            type="color"
                                                            value={sel.color.startsWith('#') ? sel.color : '#4285f4'}
                                                            onChange={e => updateColor(cal.id, e.target.value)}
                                                            className="w-7 h-7 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-gray-50 flex items-center gap-4 text-xs text-gray-400">
                        <a href="/privacy" target="_blank" className="hover:text-blue-500 transition-colors">Privacy Policy</a>
                        <a href="/terms" target="_blank" className="hover:text-blue-500 transition-colors">Terms of Service</a>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-100">
                    <button
                        onClick={handleSave}
                        className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
