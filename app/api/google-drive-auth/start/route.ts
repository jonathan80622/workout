import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const STATE_COOKIE = 'workout_drive_oauth_state';

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return new Response('Google Drive OAuth