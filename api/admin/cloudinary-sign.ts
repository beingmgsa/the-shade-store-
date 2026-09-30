import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractBearerToken, verifyFirebaseOwnerToken } from '../_lib/auth.js';
import { getCloudinaryConfig, generateCloudinarySignature } from '../_lib/cloudinary.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Common security & caching headers
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  // Ensure POST method
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: `Method ${req.method} not allowed. Only POST is accepted.`,
    });
  }

  // 1. Verify Firebase authentication
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized: Firebase authentication token required',
    });
  }

  const authResult = verifyFirebaseOwnerToken(token);
  if (!authResult.valid) {
    return res.status(403).json({
      error: authResult.error || 'Forbidden: Admin access denied',
    });
  }

  // 2. Read Cloudinary credentials strictly from server environment variables
  const { cloudName, apiKey, apiSecret, isConfigured } = getCloudinaryConfig();

  if (!isConfigured) {
    const missingKeys: string[] = [];
    if (!cloudName) missingKeys.push('CLOUDINARY_CLOUD_NAME');
    if (!apiKey) missingKeys.push('CLOUDINARY_API_KEY');
    if (!apiSecret) missingKeys.push('CLOUDINARY_API_SECRET');

    return res.status(400).json({
      error: `Cloudinary secrets missing in production: ${missingKeys.join(', ')}. Please add them in your Vercel Project Settings > Environment Variables.`,
      missing: missingKeys,
    });
  }

  // 3. Generate cryptographic HMAC-SHA1 signature for Cloudinary direct upload
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'the_shade_store/products';

  const paramsToSign = {
    folder,
    timestamp,
  };

  const signature = generateCloudinarySignature(paramsToSign, apiSecret);

  // Return signed payload. CLOUDINARY_API_SECRET is NEVER returned.
  return res.status(200).json({
    signature,
    apiKey,
    cloudName,
    timestamp,
    folder,
  });
}
