"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { normalizeGoogleEvents } from "@/lib/calendar";
import { sampleCalendarEvents } from "@/lib/fixtures";
import type { CalendarEvent } from "@/lib/types";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (res: { access_token?: string }) => void;
          }): { requestAccessToken(): void };
        };
      };
    };
  }
}

const SCOPES =
  "https://www.googleapis.com/auth/calendar.readonly " +
  "https://www.googleapis.com/auth/calendar.events";

interface Props {
  date: string;
  onDateChange: (date: string) => void;
  onEventsLoaded: (events: CalendarEvent[]) => void;
  onTokenChange: (token: string | null) => void;
  onDemoChange?: (isDemo: boolean) => void;
}

function DemoBadge() {
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-700 leading-none">
      Demo
    </span>
  );
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

export function CalendarSection({
  date,
  onDateChange,
  onEventsLoaded,
  onTokenChange,
  onDemoChange,
}: Props) {
  const tokenClientRef = useRef<{ requestAccessToken(): void } | null>(null);
  const [gisReady, setGisReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  function loadDemoEvents() {
    setEvents(sampleCalendarEvents);
    onEventsLoaded(sampleCalendarEvents);
    setIsDemo(true);
    onDemoChange?.(true);
  }

  // Load GIS script once
  useEffect(() => {
    const el = document.createElement("script");
    el.src = "https://accounts.google.com/gsi/client";
    el.async = true;
    el.defer = true;
    el.onload = () => setGisReady(true);
    document.head.appendChild(el);
    return () => {
      document.head.removeChild(el);
    };
  }, []);

  // Initialize token client once GIS is loaded
  const stableOnTokenChange = useCallback(onTokenChange, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!gisReady || !window.google) return;
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      scope: SCOPES,
      callback: (res) => {
        if (res.access_token) {
          setAccessToken(res.access_token);
          stableOnTokenChange(res.access_token);
        }
      },
    });
  }, [gisReady, stableOnTokenChange]);

  async function loadEvents() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const start = new Date(`${date}T00:00:00`).toISOString();
      const end = new Date(`${date}T23:59:59`).toISOString();
      const url =
        `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
        `?timeMin=${encodeURIComponent(start)}` +
        `&timeMax=${encodeURIComponent(end)}` +
        `&singleEvents=true&orderBy=startTime`;

      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok) throw new Error(`Google Calendar API returned ${r.status}`);

      const d = await r.json();
      // Google returns items: GoogleCalendarEvent[] — normalize into our type
      const normalized = normalizeGoogleEvents(
        (d.items ?? []) as Parameters<typeof normalizeGoogleEvents>[0]
      );
      setEvents(normalized);
      onEventsLoaded(normalized);
      // Real data loaded — exit demo mode if active
      setIsDemo(false);
      onDemoChange?.(false);
    } catch (e) {
      console.error("Calendar load error:", e);
      setError("Couldn't load events — check your Google Calendar permissions.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          1–2 · Calendar
          {isDemo && <DemoBadge />}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={date}
            className="w-36 h-8 text-sm"
            onChange={(e) => onDateChange(e.target.value)}
          />
          {!accessToken ? (
            <>
              <Button
                size="sm"
                onClick={() => tokenClientRef.current?.requestAccessToken()}
                disabled={!gisReady}
              >
                Connect Calendar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={loadDemoEvents}
              >
                Use Sample Events
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={loadEvents}
              disabled={loading}
            >
              {loading ? "Loading…" : "Load Today's Events"}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {!accessToken && events.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Connect Google Calendar to load real events, or click{" "}
            <span className="font-medium">Use Sample Events</span> to demo.
          </p>
        )}
        {accessToken && events.length === 0 && !loading && !error && (
          <p className="text-sm text-muted-foreground">
            Click <span className="font-medium">Load Today&apos;s Events</span> to fetch.
          </p>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
            <div className="w-4 h-4 rounded-full border-2 border-muted border-t-foreground/40 animate-spin shrink-0" />
            Loading events…
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            {error}
          </p>
        )}
        {events.length > 0 && (
          <ul className="divide-y">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="text-muted-foreground w-32 shrink-0">
                  {ev.isAllDay
                    ? "All day"
                    : `${fmtTime(ev.start)} – ${fmtTime(ev.end)}`}
                </span>
                <span className="flex-1 font-medium">{ev.title}</span>
                {ev.location && (
                  <span className="text-muted-foreground text-xs shrink-0">
                    📍 {ev.location}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
