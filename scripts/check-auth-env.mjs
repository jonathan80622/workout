// Runs before `next build`. On Vercel production builds, a missing or placeholder Google client ID
// fails the deploy instead of shipping a site nobody can sign in to. Other builds only warn.
const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

if (/^[0-9a-z-]+\.apps\.googleusercontent\.com$/i.test(clientId)) {
  console.log('Google client ID is configured.');
} else if (process.env.VERCEL_ENV === 'production') {
  console.error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is missing or is not a Google OAuth web client ID.');
  process.exit(1);
} else {
  console.warn('NEXT_PUBLIC_GOOGLE_CLIENT_ID is missing or invalid; sign-in will not work in this build.');
}
