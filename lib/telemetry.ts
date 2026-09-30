const SESSION_STORAGE_KEY = 'kira_telemetry_session_id';

function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const sessionId = window.crypto?.randomUUID?.();
    if (!sessionId) return null;
    window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    return sessionId;
  } catch {
    return null;
  }
}

export function logEvent(
  eventName: string,
  metadata: Record<string, unknown> = {},
): void {
  if (typeof window === 'undefined' || !eventName) return;
  const sessionId = getSessionId();
  if (!sessionId) return;

  const screenMetrics = `${window.screen.width}x${window.screen.height} @ ${window.devicePixelRatio}x`;
  void fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ eventName, metadata, sessionId, screenMetrics }),
  }).catch(() => undefined);
}
