import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

async function refreshAccessToken(token: any) {
    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                grant_type: 'refresh_token',
                refresh_token: token.refreshToken,
            }),
        });
        const tokens = await response.json();
        if (!response.ok) throw tokens;
        return {
            ...token,
            accessToken: tokens.access_token,
            expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
            refreshToken: tokens.refresh_token ?? token.refreshToken,
        };
    } catch {
        return { ...token, error: 'RefreshAccessTokenError' };
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
                params: {
                    scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        }),
    ],
    callbacks: {
        async jwt({ token, account }) {
            // First sign-in: persist tokens from Google
            if (account) {
                return {
                    ...token,
                    accessToken: account.access_token,
                    refreshToken: account.refresh_token,
                    expiresAt: account.expires_at,
                };
            }
            // Token still valid
            if (token.expiresAt && Date.now() < (token.expiresAt as number) * 1000) {
                return token;
            }
            // Token expired — refresh it
            return refreshAccessToken(token);
        },
        async session({ session, token }) {
            session.accessToken = token.accessToken as string;
            session.error = token.error as string | undefined;
            return session;
        },
    },
});
