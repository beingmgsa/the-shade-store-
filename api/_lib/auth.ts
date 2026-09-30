export const OWNER_EMAIL = (process.env.ADMIN_OWNER_EMAIL || 'beingmagrajwork@gmail.com').toLowerCase().trim();
export const FIREBASE_PROJECT_ID = 'the-shade-store-2335e';

export interface FirebaseTokenPayload {
  iss?: string;
  aud?: string;
  auth_time?: number;
  user_id?: string;
  sub?: string;
  exp?: number;
  email?: string;
  email_verified?: boolean;
  firebase?: {
    identities?: Record<string, unknown>;
    sign_in_provider?: string;
  };
}

export function parseJwtPayload(token: string): FirebaseTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function verifyFirebaseOwnerToken(token: string): { valid: boolean; email?: string; error?: string } {
  const payload = parseJwtPayload(token);
  if (!payload) {
    return { valid: false, error: 'Malformed authentication token' };
  }

  const now = Math.floor(Date.now() / 1000);

  // Check expiration
  if (payload.exp && payload.exp < now) {
    return { valid: false, error: 'Firebase session expired. Please sign in again.' };
  }

  // Check audience (Firebase Project ID)
  if (payload.aud !== FIREBASE_PROJECT_ID) {
    return { valid: false, error: `Invalid project token: expected audience ${FIREBASE_PROJECT_ID}` };
  }

  // Check issuer
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    return { valid: false, error: 'Invalid token issuer' };
  }

  // Verify email matches designated shop owner
  const email = (payload.email || '').toLowerCase().trim();
  if (!email || email !== OWNER_EMAIL) {
    return {
      valid: false,
      error: `Access Denied: Only the store owner (${OWNER_EMAIL}) has admin privileges.`
    };
  }

  return { valid: true, email };
}

export function extractBearerToken(authorizationHeader?: string | string[]): string | null {
  if (!authorizationHeader) return null;
  const header = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.substring(7).trim();
}
