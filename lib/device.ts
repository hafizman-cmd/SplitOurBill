const DEVICE_ID_KEY = 'kira_device_id';
const DEVICE_ID_COOKIE = 'kira_device_id';

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const value = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);

  return value ? decodeURIComponent(value) : null;
}

function createDeviceId(): string {
  return `dev_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';

  try {
    const stored = window.localStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;

    const cookieId = readCookie(DEVICE_ID_COOKIE);
    if (cookieId) {
      window.localStorage.setItem(DEVICE_ID_KEY, cookieId);
      return cookieId;
    }

    const id = createDeviceId();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
    document.cookie = `${DEVICE_ID_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
    return id;
  } catch {
    const cookieId = readCookie(DEVICE_ID_COOKIE);
    if (cookieId) return cookieId;

    const id = createDeviceId();
    document.cookie = `${DEVICE_ID_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
    return id;
  }
}
