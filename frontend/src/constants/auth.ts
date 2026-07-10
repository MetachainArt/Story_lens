/**
 * Non-sensitive marker recording that an authenticated session likely exists.
 * The actual access/refresh tokens live only in httpOnly cookies and are never
 * accessible to JavaScript.
 */
export const AUTH_FLAG_KEY = 'sl_authed';
