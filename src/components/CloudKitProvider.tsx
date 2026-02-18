'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { CLOUDKIT_API_TOKEN, CLOUDKIT_CONTAINER_ID, CLOUDKIT_ENV } from '@/lib/cloudkit';

// Define CloudKit types loosely to avoid full type definition overhead
type CloudKitContextType = {
    container: any | null;
    isAuthenticated: boolean;
    currentUser: any | null;
    isLoading: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
};

const CloudKitContext = createContext<CloudKitContextType>({
    container: null,
    isAuthenticated: false,
    currentUser: null,
    isLoading: true,
    login: async () => { },
    logout: async () => { },
});

export const useCloudKit = () => useContext(CloudKitContext);

export function CloudKitProvider({ children }: { children: ReactNode }) {
    const [container, setContainer] = useState<any | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initCloudKit = async () => {
            // Poll for CloudKit script to be loaded
            let attempts = 0;
            while (!window.CloudKit && attempts < 20) {
                await new Promise(r => setTimeout(r, 200));
                attempts++;
            }

            if (!window.CloudKit) {
                console.error('CloudKit script failed to load');
                setIsLoading(false);
                return;
            }

            try {
                window.CloudKit.configure({
                    containers: [{
                        containerIdentifier: CLOUDKIT_CONTAINER_ID,
                        apiTokenAuth: {
                            apiToken: CLOUDKIT_API_TOKEN,
                            persist: true,
                            signInButton: {
                                id: 'apple-sign-in-button',
                                theme: 'black'
                            }
                        },
                        environment: CLOUDKIT_ENV
                    }]
                });

                const ckContainer = window.CloudKit.getDefaultContainer();
                if (!ckContainer) throw new Error('Failed to get default container');
                setContainer(ckContainer);

                // AUTH_PERSIST_ERROR can occur on hard refresh when the CloudKit session
                // cookie isn't accessible yet. Retry once after a short delay.
                let authInfo: any = null;
                try {
                    authInfo = await ckContainer.setUpAuth();
                } catch (authErr: any) {
                    const isPersistError = authErr?.ckErrorCode === 'AUTH_PERSIST_ERROR' ||
                        authErr?.message?.includes('ckSession');
                    if (isPersistError) {
                        // Wait for session storage to become available, then retry
                        await new Promise(r => setTimeout(r, 1000));
                        authInfo = await ckContainer.setUpAuth();
                    } else {
                        throw authErr;
                    }
                }

                if (authInfo) {
                    setIsAuthenticated(true);
                    setCurrentUser(authInfo.userIdentity ?? authInfo);
                }
            } catch (err: any) {
                console.error('CloudKit initialization error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        initCloudKit();
    }, []);

    const login = async () => {
        if (!container) return;
    };

    const logout = async () => {
        if (!container) return;
        try {
            await container.signOut();
            setIsAuthenticated(false);
            setCurrentUser(null);
        } catch (err) {
            console.error('Logout error', err);
        }
    };

    // Listen for auth changes
    useEffect(() => {
        if (!container) return;

        // CloudKit JS often exposes event listeners
        // We can use the promise returned by setUpAuth in the init for initial state.
        // For runtime changes (like signing out elsewhere), we might poll or listen to events if documented.
        // Basic implementation: trust the internal state we set.

        // One key thing: CloudKit JS usually renders a button div. 
        // We will let the `app/page.tsx` handle the button rendering using the container.
    }, [container]);

    return (
        <CloudKitContext.Provider value={{
            container,
            isAuthenticated,
            currentUser,
            isLoading,
            login,
            logout
        }}>
            {children}
        </CloudKitContext.Provider>
    );
}
