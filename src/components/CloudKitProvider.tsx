'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { CLOUDKIT_API_TOKEN, CLOUDKIT_CONTAINER_ID, CLOUDKIT_ENV } from '@/lib/cloudkit';

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
                            },
                            signOutButton: {
                                id: 'apple-sign-out-button',
                                theme: 'black'
                            }
                        },
                        environment: CLOUDKIT_ENV
                    }]
                });

                const ckContainer = window.CloudKit.getDefaultContainer();
                if (!ckContainer) throw new Error('Failed to get default container');
                setContainer(ckContainer);

                ckContainer.whenUserSignsIn().then((userIdentity: any) => {
                    setIsAuthenticated(true);
                    setCurrentUser(userIdentity);
                });
                ckContainer.whenUserSignsOut().then(() => {
                    setIsAuthenticated(false);
                    setCurrentUser(null);
                });

                const authInfo = await ckContainer.setUpAuth();
                if (authInfo) {
                    setIsAuthenticated(true);
                    setCurrentUser(authInfo.userIdentity ?? authInfo);
                }
            } catch (err: any) {
                // AUTH_PERSIST_ERROR on hard refresh is expected — ignore it.
                // The user can navigate away and back to /app/ to restore their session.
                if (err?.ckErrorCode !== 'AUTH_PERSIST_ERROR' &&
                    !err?._reason?.includes('ckSession')) {
                    console.error('CloudKit initialization error:', err);
                }
            } finally {
                setIsLoading(false);
            }
        };

        initCloudKit();
    }, []);

    const login = async () => { };

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
