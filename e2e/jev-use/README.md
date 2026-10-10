# Workout Studio × jev-use

End-to-end test of the "start a workout and act on my trainer's feedback" flow,
driven by [cua's jev-use](https://github.com/trycua/cua/tree/main/libs/cua-driver/examples/jev-use):
Cua Driver observes and clicks in a real (isolated) Chromium, and TypeSafe Jev
chooses each next action from a bounded list the task builds.

## Scenario

`seed.json` gives Alex two Leg Press sessions. On the last one Coach Sarah wrote:

> Knees caved in on the last set at 200 lb. Next session drop the working sets
> to 180 lb and move the seat back to notch 5 … Pause 1 second at the bottom.

The run starts a new workout and adds Leg Press. Jev then has to **read that
feedback on the page** and pick the right values over distractors:

| Decision | Correct | Distractors |
| --- | --- | --- |
| Exercise to add | Leg Press | Seated Leg Curl |
| Seat | Seat notch 5 | notch 4 (last time), notch 3 |
| Each working-set load | 180 | 200 (last time), 210 (progressive overload) |

It finishes by leaving Coach Sarah a confirmation note. The **oracle** is the
app's own state, which the page writes through the dev-only
`/api/e2e-state` route. It never relies on the runner's own record of what it did.

The run also **audits the exercise card** at the moment Leg Press appears and
reports which facts a lifter needs are visible:

- trainer's exercise cue · who gave it · trainer's overall session comment
- your own note from last time · exact top set last time (200 lb × 8)
- last seat setting · load trend

## Prerequisites

1. Cua Driver ≥ 0.23.2 with Accessibility + Screen Recording granted:
   `/bin/bash -c "$(curl -fsSL https://cua.ai/driver/install.sh)"`, then `cua-driver doctor`.
2. `uv` and a sparse checkout of the example (default location below; override with `JEV_USE_DIR`):
   ```bash
   git clone --depth 1 --filter=blob:none --sparse https://github.com/trycua/cua.git ~/Codeland/cua
   git -C ~/Codeland/cua sparse-checkout set libs/cua-driver/examples/jev-use
   uv sync --frozen --python 3.12 --project ~/Codeland/cua/libs/cua-driver/examples/jev-use
   ```
3. `TYPESAFE_API_KEY` in your environment for live runs.

## Run

From the repo root. The runner starts its own `next dev` on port 3100 with
`E2E_STATE_DIR` set, so your normal dev server and browser data are untouched.

```bash
# Plumbing check: deterministic mock picks the correct path (no model)
uv run --frozen --project ~/Codeland/cua/libs/cua-driver/examples/jev-use python e2e/jev-use/run_workout.py --provider mock

# Real test: Jev reads the feedback and decides
uv run --frozen --project ~/Codeland/cua/libs/cua-driver/examples/jev-use python e2e/jev-use/run_workout.py --provider live
```

Flags: `--strict-audit` fails the run when a needed fact is missing,
`--dump-snapshots` saves each Driver snapshot, and `--min-confidence` sets
when the runner abstains instead of acting. The output goes in `e2e/jev-use/.run/`
(`run.jsonl`, `report.json`, `next-dev.log`).

Offline unit tests (no Driver, model or server):

```bash
cd e2e/jev-use && uv run --frozen --project ~/Codeland/cua/libs/cua-driver/examples/jev-use python -m unittest test_workout_task.py
```
