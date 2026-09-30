import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OWNER_EMAIL, FIREBASE_PROJECT_ID } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return res.status(200).json({
    authMethod: 'firebase',
    ownerEmail: OWNER_EMAIL,
    projectId: FIREBASE_PROJECT_ID,
  });
}
