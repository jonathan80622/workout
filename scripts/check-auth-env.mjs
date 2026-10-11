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

// The Bumstead tab needs OpenAI for replies and Redis to resume and stop replies across serverless instances.
for (const [name, hint] of [['OPENAI_API_KEY', 'the Bumstead tab cannot reply'], ['REDIS_URL', 'Bumstead replies cannot be resumed or stopped across instances']]) {
  if (name === 'REDIS_URL' ? process.env.REDIS_URL || process.env.KV_URL : process.env[name]) continue;
  if (process.env.VERCEL_ENV === 'production') {
    console.error(`${name} is missing; ${hint}.`);
    process.exit(1);
  }
  console.warn(`${name} is missing; ${hint} in this build.`);
}
