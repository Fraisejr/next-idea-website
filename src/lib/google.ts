export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

export type GoogleCalendar = {
    id: string;
    summary: string;
    backgroundColor: string;
};

export type GoogleEvent = {
    id: string;
    summary?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    calendarId: string;
    calendarColor: string;
};

export type SelectedCalendar = {
    id: string;
    name: string;
    color: string;
};

export async function fetchCalendars(token: string): Promise<GoogleCalendar[]> {
    const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    return (data.items || []) as GoogleCalendar[];
}

export async function fetchTodayEvents(
    token: string,
    calendarId: string,
    color: string,
): Promise<GoogleEvent[]> {
    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const timeMax = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    );
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');

    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    return ((data.items || []) as any[]).map(e => ({
        ...e,
        calendarId,
        calendarColor: color,
    }));
}

export function formatEventTime(event: GoogleEvent): string {
    if (!event.start.dateTime) return 'All day';
    const start = new Date(event.start.dateTime);
    const end = event.end.dateTime ? new Date(event.end.dateTime) : null;
    const fmt = (d: Date) =>
        d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}
