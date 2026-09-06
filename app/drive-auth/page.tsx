'use client';

import { useSearchParams } from 'next/navigation';

export default function DriveAuthPage() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success') === '1';

  return (
    <main className="min-h-screen bg-[#0c0a09] text-[#f7f3ee] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-[#382f29] bg-[#181412] p-6 space-y-4">
        <h1 className="text-xl font-bold">Drive video authorization</h1>
        {success ? (
          <>
            <p className="text-sm text-[#a3b8a7]">Done. Vercel can now read your workout videos through the Drive API when your trainer watches them.</p>
            <a href="/" className="inline-block rounded-xl bg-[#e6a15c] px-4 py-2 text-sm font-bold text-black">Back to workout app</a>
          </>
        ) : (
          <>
            <p className="text-sm text-[#c8b8a8]">Authorize the same Google Drive account that owns your Workout Recorder folder. This is the one-time authorization that lets the server refresh access while you are away.</p>
            <a href="/api/google-drive-auth/start" className="inline-block rounded-xl bg-[#e6a15c] px-4 py-2 text-sm font-bold text-black">Authorize Google Drive</a>
          </>
        )}
      </div>
    </main>
  );
}
