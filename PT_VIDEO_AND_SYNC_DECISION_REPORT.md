# PT video, sharing, and sync: user-centred decision report

## Status: withdrawn pending a tested delivery model

This report's original architectural decision is **not validated**.  It
mistakenly treated a Drive file being shared “anyone with link” as evidence
that its video bytes can be retrieved and played without Google authentication.
Those are not the same claim.  Google Drive can gate, redirect, or otherwise
make direct byte delivery difficult even where a preview/view page is
reachable.

Do not use the option ranking below as a decision until the specific playback
and authentication paths have been tested with a real uploaded file.

## What the user should experience

### Ideal flow (desiderata, not an implementation proposal)

**Client**

1. Opens the app on a new phone or browser and completes the minimum secure
   access step appropriate to their relationship with the PT.
2. Records a set or uploads a video.  It saves automatically and shows an
   honest progress indicator only while the upload is in progress.
3. Taps **Share with PT**, chooses the PT, and can revoke that access later.
4. Does not have to diagnose storage-provider prompts, file IDs, folders, or
   long URLs.

**PT**

1. Opens the app or a short secure link and completes the least disruptive
   authorization step that still protects client videos.
2. Taps a video.  It plays in a native HTML video player in the same view.
3. Taps expand.  The *same* player becomes full-screen; playback position and
   controls survive.  There is a visible close/back action.
4. Leaves feedback.  It is saved to the client record, not only to that
   browser.

These are desired outcomes.  They deliberately do **not** assume that access
is anonymous, that Google Drive will provide a byte stream, or that the app
must use a particular storage provider.

**Failure behaviour**

- An offline or failed upload says “Waiting to upload” / “Retry upload”; it
  does not pretend the video was saved.
- A permission failure says who needs to act and provides one action.  It
  never exposes a raw storage-provider page as the recovery interface.

### Bad-but-acceptable transition flow

This is the smallest safe flow while the product still uses Drive:

1. The client connects Drive once to back up their data and upload a video.
2. The app reports success only after Drive confirms the upload and sharing
   permission.
3. The PT opens the existing portal and enters its password.
4. The inline card has a clear **Open video in Drive** button.  It opens the
   Drive file in a separate browser tab.
5. The PT portal's own expand button is removed, or it moves the one existing
   player rather than creating a second Drive player.
6. PT comments are labelled as device-local until server-backed comments are
   shipped; they must not look shared or durable.

This is not elegant, but it is understandable: Drive owns playback, so Drive
opens separately.  No one is dropped into a crashing embedded player.

## Current reality: evidence from this codebase

| User-visible behaviour | What the code actually does | Consequence |
| --- | --- | --- |
| “Connect Drive” | Google Identity Services issues a browser access token with `drive.file`; the token is stored in `sessionStorage`. | The client must authorize again in a new browser session.  There is no durable app account or server-held credential. |
| “Share PT portal” | The JSON file is made `anyone with link: reader`; the URL contains its Drive file ID and the portal retrieves it server-side after a password check. | A password protects the portal UI, but Drive file sharing is separate and public-to-link.  It is not a per-PT access model. |
| “Watch video” | Every video is a `drive.google.com/file/{id}/preview` iframe. | The app delegates the player, layout, cookies, errors, and mobile behaviour to Google Drive. |
| “Expand video” | The inline Drive iframe remains mounted and a second Drive iframe is mounted in a full-screen overlay. | This is particularly hostile to iOS Safari memory/process limits, and the two players can behave independently. |
| “PT comments auto-save” | PT comments are written to the PT browser's `localStorage`. | Feedback does not reach the client or another PT device, despite looking like a workflow feature. |

The source locations are `src/utils/driveStorage.ts`,
`app/api/pt-state/route.ts`, and `src/components/PTPortal.tsx`.

## Corrected technical beliefs

1. **Drive is fine as a personal backup folder; it is a poor product surface.**
   Its permission model and viewer are optimized for Drive, not a branded,
   low-friction client/PT workflow.
2. **A Drive preview/view page and an unauthenticated video byte stream are
   separate things.**  Neither implies the other.  I did not test either path
   for a real uploaded video.
3. **The desired experience is not “no auth.”**  It is low-friction,
   comprehensible, revocable authorization.  Any architecture must first say
   who is authorized to see each video, how that is granted, and how it is
   revoked.
4. **A backend may be required for durable cross-device sharing, but that is
   an architectural hypothesis to assess against the actual Drive constraints
   and operational cost—not a conclusion established by this report.**
5. **No shared service credential belongs in the browser.**  Any server-side
   Drive approach would need its credential, permission model, delivery
   behaviour, and costs designed and tested explicitly.

## Original options table: invalidated

The distances and recommendation were based in part on the untested claim
above, so they are withdrawn.  A valid comparison must start with an empirical
matrix for a real uploaded Drive file:

| Test | Anonymous browser | Signed-in non-owner | Owner | iPhone Safari |
| --- | --- | --- | --- | --- |
| Drive `/view` | untested | untested | untested | untested |
| Drive `/preview` iframe | untested | untested | untested | untested |
| Direct/download URL returns usable video bytes | untested | untested | untested | untested |
| Range request needed for seeking | untested | untested | untested | untested |
| Current PT portal player | untested | untested | untested | untested |

Only after this matrix exists can we say whether keeping Drive, proxying it,
or migrating storage has a meaningful distance from the desired and
bad-but-acceptable flows.

## What remains safe to say now

### Immediate UI containment

- Remove the nested full-screen Drive iframe behaviour.  On mobile, replace
  **Expand** with **Open in Drive**; on desktop it may use a separate tab.
- Never load two previews of the same file simultaneously.
- Rename the current local-only comments or temporarily hide them, so the UI
  does not imply that feedback is shared.
- Make Drive connection wording explicit: “Optional Drive backup” rather than
  “required sync.”

This makes the current experience bad-but-understandable instead of unstable.

## Validation performed and remaining proof

### Performed

- `npm run build` completed successfully on 2026-09-13.  The production build
  compiles, type-checks, and generates `/pt` and `/api/pt-state`.
- Source inspection confirms the two simultaneously mounted Google Drive
  iframes and confirms that comments are browser-local.
- There is no unit-test framework or test suite in `package.json`, so there is
  no existing automated mobile-player test to run.

### What was not validated

I did not unit-test or integration-test access to a real Drive-hosted video,
with or without Google authentication.  The build test is not evidence about
Drive authorization, byte delivery, or Safari behaviour.

Whether a particular iPhone/Safari version kills the page while two Drive
preview frames run is browser/process-integration behaviour.  A React unit
test could prove that only one iframe is mounted after a fix; it cannot prove
that Google's remote player will not crash Safari.

### Acceptance tests before shipping the transition patch

1. iPhone Safari: open one video, expand/open it, rotate, return, and repeat
   five times.  The PT page must remain alive; only one player may exist.
2. iPhone Safari: open a video with no Google login.  The result must be a
   clear Drive access failure or a working authorized viewer, never a blank or
   crash loop.
3. Client: close/reopen browser and verify the product keeps local records
   without calling Drive a failure; reconnecting Drive remains optional.
4. PT: submit feedback on device A and verify it appears on device B after
   Phase 1.  Before then, verify the UI explicitly says “saved only on this
   device.”
5. Revocation: remove a PT's grant and verify that existing links and video
   requests fail server-side, not merely disappear from the UI.

## Next required decision input

Obtain one non-sensitive test video file ID and define the intended access
policy (for example: owner only, a named PT, or anyone with a revocable
link).  Run the matrix above from signed-out and signed-in browser contexts,
including an iPhone.  That evidence, rather than an assumption about Drive,
must anchor the redesigned decision report.
