// Runs before `next build`. On Vercel production builds, missing sign-in secrets fail the deploy
// instead of shipping a site nobody can sign in to. Other builds only warn.
const missing = [];
if (!/^[0-9a-z-]+\.apps\.googleusercontent\.com$/i.test(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '')) missing.push('NEXT_PUBLIC_GOOGLE_CLIENT_ID');
if (!process.env.GOOGLE_CLIENT_SECRET?.trim()) missing.push('GOOGLE_CLIENT_SECRET');
if ((process.env.AUTH_SECRET?.trim().length ?? 0) < 32) missing.push('AUTH_SECRET (at least 32 characters)');

if (missing.length === 0) {
  console.log('Sign-in environment is configured.');
} else if (process.env.VERCEL_ENV === 'production') {
  console.error(`Missing Vercel production environment variables: ${missing.join(', ')}`);
  process.exit(1);
} else {
  console.warn(`Sign-in will not work in this build. Missing: ${missing.join(', ')}`);
}
