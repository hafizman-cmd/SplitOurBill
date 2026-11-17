export const AUDIT_FILTERS = {
  all: 'All events',
  errors: 'All errors',
  scan_completed: 'Successful scans',
  scan_failed: 'Failed scans',
  upstream_timeout: 'AI timeouts',
  upstream_error: 'AI service errors',
  configuration_missing: 'Configuration errors',
  internal_error: 'Server errors',
  scan_client_error: 'Client errors',
  rate_limited: 'Rate limits',
  daily_limit: 'Daily limits',
  invalid_receipt: 'Image / receipt errors',
} as const;

export type AuditFilter = keyof typeof AUDIT_FILTERS;

export const AUDIT_MESSAGES: Record<string, string> = {
  scan_success: 'Receipt scanned successfully',
  rate_limited: 'Scan failed: too many requests',
  configuration_missing: 'Scan failed: AI service configuration missing',
  invalid_payload: 'Scan failed: invalid request',
  image_too_large: 'Scan failed: image too large',
  invalid_image: 'Scan failed: invalid image data',
  daily_limit: 'Scan failed: daily scan limit reached',
  upstream_timeout: 'Scan failed: AI service timed out',
  upstream_error: 'Scan failed: AI service unavailable or request rejected',
  unreadable_receipt: 'Scan failed: receipt could not be read',
  no_items: 'Scan failed: no line items detected',
  internal_error: 'Scan failed: unexpected server error',
  connection_failed: 'Scan request failed: could not connect to the server',
  client_processing_error: 'Scan response could not be processed on the device',
};

export function auditCode(metadata: string): string {
  try {
    const parsed: unknown = JSON.parse(metadata);
    if (typeof parsed === 'object' && parsed !== null && 'code' in parsed && typeof parsed.code === 'string') {
      return Object.hasOwn(AUDIT_MESSAGES, parsed.code) ? parsed.code : '';
    }
  } catch {}
  return '';
}

export function formatAuditTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}
