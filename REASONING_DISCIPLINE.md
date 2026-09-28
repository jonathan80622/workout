# Reasoning discipline for constrained product work

## Purpose

This is a postmortem-derived set of working principles for evaluating a real
product problem without replacing its constraints with a more familiar,
imagined architecture.

The case that produced this document involved Google Drive video playback, PT
feedback, iPhone Safari, and an application with no persistent write backend.

## Principles

### 1. Separate evidence, hypothesis, requirement, and proposal

Never let one category silently become another.

| Category | Meaning | Example from this app |
| --- | --- | --- |
| Observed fact | Directly established by source, a test, or user evidence. | The PT page renders Drive `/preview` iframes. PT comments are written to browser `localStorage`. |
| Hypothesis | Plausible explanation that still needs a test. | Two simultaneous Drive iframes may contribute to an iPhone Safari crash. |
| User requirement | The outcome the user wants. | Viewing a workout video should not dump the PT into an ugly, confusing Drive failure state. |
| Proposal | A possible change, subject to feasibility and authorization. | Open the Drive file in a separate tab rather than creating a second embedded player. |

Bad reasoning: “The code creates a link-sharing permission, therefore an
anonymous user can stream the video bytes.”

Correct reasoning: “The code asks Drive to set a link-sharing permission. We
have not tested whether a signed-out browser can view, preview, stream, or seek
within a real uploaded video.”

### 2. Treat external systems as unknown until tested

Static code proves what the app asks an external service to do; it does not
prove what the service, browser, account, file type, or device will actually
do.

Bad reasoning: “A Drive direct-download URL can be used as a normal native
video source.”

Correct reasoning: “Test one real uploaded video in the exact delivery modes
under consideration: `/view`, `/preview`, direct/download, and byte-range
seeking; test signed-out, signed-in, desktop, and iPhone Safari contexts.”

### 3. Do not confuse a desirable experience with an available mechanism

“Low friction” does not mean “no authorization.” “No Drive ugliness” does not
mean “Drive can supply an anonymous byte stream.”

Bad reasoning: “The ideal flow has no Google auth, so design around public
video playback.”

Correct reasoning: “The desired experience is comprehensible, minimal,
revocable authorization. First decide who may view a video; then determine
whether the existing system can enforce that policy.”

### 4. Respect the current system boundary

Do not answer a current-state problem by silently adding systems that do not
exist.

Observed boundary in this app:

- There is a read route for PT state.
- There is no database, app account system, feedback write route, or durable
  shared-comment store.
- PT comments currently exist only in the PT browser.

Bad reasoning: “PT feedback should save to the client record” as though a
record-writing backend existed.

Correct reasoning: “Shared persistent feedback is impossible in the present
architecture. Current choices are: label comments device-local, remove them,
or explicitly authorize a separate Drive-write/backend project.”

### 5. Rank options only after proving their gating assumptions

An option comparison is useful only when its decisive constraints are known.

Bad reasoning: Ranking a direct Drive stream, Drive proxy, and new storage
architecture before verifying whether the actual Drive file can be accessed or
streamed in the required user contexts.

Correct reasoning: Write a constraint matrix first. Mark unknown cells as
unknown, test them, then compare options.

| Gating question | Evidence required before an architecture decision |
| --- | --- |
| Who can view a video? | Explicit owner/PT/link access policy. |
| Can the chosen Drive URL work for that person? | Real-file test in that auth context. |
| Can it support video playback and seeking? | Playback plus range/seek test. |
| Does it survive the target device flow? | iPhone Safari integration test. |
| Can feedback persist/share? | Existing write path, or an explicitly approved new one. |

### 6. Match validation to the claim

A passing build proves compilation, type checking, and build-time rendering. It
does not validate remote authorization, media delivery, mobile browser process
stability, or persistence.

Bad reasoning: Citing `npm run build` after making claims about Google Drive
access and Safari playback.

Correct reasoning:

| Claim | Appropriate validation |
| --- | --- |
| Only one player remains after expand | Component/unit test or DOM assertion. |
| A signed-out PT can access a Drive video | Signed-out browser integration test with a real file. |
| Seeking works | Manual/integration test using byte-range playback. |
| The Safari crash is resolved | Repeated real-device iPhone Safari test. |
| Feedback persists across devices | Two-device test against a real write store. |

### 7. Keep scope and authority explicit

A future rebuild may be a legitimate idea, but it is not an implementation
answer unless the user has asked to authorize and fund that expansion.

Bad reasoning: Treating “add app-owned auth, a database, and object storage”
as the immediate answer to a Drive UX question.

Correct reasoning: “This is a separate product decision. It would require new
infrastructure, a data/security model, and user authorization. It is not being
assumed as part of the current fix.”

### 8. Prefer a truthful limitation to a polished lie

If a feature cannot be shared or made durable with the available system, say
so in the UI and recommendation.

Bad reasoning: Labeling browser-local feedback as “auto-save” without making
the device-only scope prominent.

Correct reasoning: “Saved only on this device” or remove the feature until it
has an intentional persistence model.

## A required reasoning sequence

Use this order for externally constrained product issues:

1. **Inventory the present system.** Identify actual routes, storage, auth,
   device behavior, and third-party dependencies.
2. **Record evidence without inference.** Include source evidence, user
   screenshots, logs, and already-run tests.
3. **Name unknowns and hypotheses.** Each must have a falsifiable test.
4. **State the user outcome separately from implementation.** Do not encode a
   technical assumption into the desired flow.
5. **Identify gating constraints.** An option cannot be evaluated until these
   are established.
6. **Run the smallest real-world test.** Prefer a real file, actual account
   state, and target device over a synthetic test where external behaviour is
   central.
7. **List only feasible current options.** Separate those from future projects
   requiring new authority or infrastructure.
8. **Assess trade-offs and recommend.** Tie every conclusion back to tested
   evidence; retain uncertainty where evidence is incomplete.
9. **Communicate scope honestly.** Say what was changed, what was only tested,
   what remains unknown, and what needs user authorization.

## Applied example: Drive video pop-out

### What was known

- The PT page uses a Drive preview iframe for video playback.
- The page's expand action creates another Drive preview iframe.
- The current app stores PT comments only in the browser.
- There is no shared feedback write backend.

### What was not known

- Whether the affected Drive video can be viewed by a signed-out person.
- Whether it can be streamed as raw media bytes or supports byte ranges.
- Whether the screenshot was caused by duplicate iframes, Drive's pop-out
  behaviour, Safari, or a combination.

### Correct next action

Do not recommend a replacement storage/auth architecture yet. Obtain a
non-sensitive real test file and intended access policy, then run the
authentication, playback, seeking, and iPhone Safari test matrix. Until then,
the only defensible current UI recommendation is to avoid presenting the
duplicated embedded player as reliable and to describe any local-only feedback
truthfully.

## Red flags: stop and reassess

Stop before continuing when any of these sentences appear in the reasoning:

- “The API call means the provider will behave this way.”
- “The desired user experience implies this technical capability.”
- “We can just add a backend/database/auth” when none exists.
- “The build passed, so the third-party integration works.”
- “This is likely the cause” followed by a recommendation phrased as certainty.
- “No auth” when the real requirement is safe, low-friction access.

When a red flag appears, rewrite the claim as an unknown, identify its test,
and return to the required reasoning sequence.
