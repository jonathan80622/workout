"""jev-use task spec: start a workout and act on the trainer's feedback.

The scenario (``seed.json``): Alex's last Leg Press session ended with Coach
Sarah writing that the knees caved at 200 lb, and that next time the working
sets should drop to 180 lb with the seat moved to notch 5, pausing at the bottom.

A good "start workout" screen should let Alex do that without leaving the
exercise card. The task checks it two ways:

* **Act** – Jev must read the feedback from the page and pick the right seat
  and loads out of plausible distractors (last session's values, a progressive
  overload jump, a different exercise). The oracle is the app state the page
  mirrors to ``state.json`` via the dev-only ``/api/e2e-state`` route, never the
  runner's own events.
* **Audit** – a deterministic check of which facts a lifter needs are visible
  on the exercise card at the moment it appears (``audit_snapshot``).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping

from sources import BrowserSemanticSource, Candidate
from tasks import Outcome, TaskParameter, TaskSources

TASK_ID = "workout-studio-apply-pt-feedback"
EXERCISE = "Leg Press"
DISTRACTOR_EXERCISE = "Seated Leg Curl"
TARGET_SEAT = "Seat notch 5"
SEAT_CHOICES = {"seat-notch-5": TARGET_SEAT, "seat-notch-4": "Seat notch 4", "seat-notch-3": "Seat notch 3"}
TARGET_LOAD = 180
LOAD_CHOICES = (180, 200, 210)
TRAINER_NOTE = (
    "Coach Sarah: applied your Leg Press feedback - seat at notch 5, working sets at 180 lb, "
    "1 second pause at the bottom."
)

GOAL = (
    "You are Alex starting today's lower-body session in Workout Studio. Start a new workout "
    f"and add {EXERCISE}. Before lifting, read Coach Sarah's feedback from the previous "
    f"{EXERCISE} session shown on the exercise card, and apply it: set the seat and every "
    "working-set load exactly as she instructed. Leave the warmup set alone. Then leave her a "
    "short note confirming you applied the feedback."
)

START_BUTTON = "+ Start New Workout Session"
ADD_EXERCISE_BUTTON = "Add Exercise Machine"
PICKER_HEADING = "Select Exercise Machine"
SEAT_FIELD = "Seat settings"
NOTE_FIELD = "Note for your trainer"
LOAD_FIELD = re.compile(r"^Set (\d+) load \((lbs|kg)\)$")

HISTORY_OUTCOMES = {
    "start-workout": "started a new workout session",
    "open-add-exercise": "opened the exercise picker",
    "add-leg-press": f"added {EXERCISE} from previously logged exercises",
    "add-seated-leg-curl": f"added {DISTRACTOR_EXERCISE} from previously logged exercises",
    "write-trainer-note": "wrote the note for the trainer",
    "reobserve": "took no action and requested a fresh observation",
}

# What a lifter needs on the exercise card to act on feedback without digging
# through history. Each is (id, why it matters, matcher over page text).
AUDIT_CHECKS: tuple[tuple[str, str, re.Pattern[str]], ...] = (
    ("exercise_feedback", "Trainer's exercise-specific cue from last session",
     re.compile(r"Knees caved in on the last set")),
    ("feedback_author", "Who gave the feedback, so it can be trusted and followed up",
     re.compile(r"Coach Sarah")),
    ("session_feedback", "Trainer's overall comment on the last workout",
     re.compile(r"prioriti[sz]e depth over load", re.I)),
    ("own_last_note", "Alex's own note from last time (left knee tight)",
     re.compile(r"Left knee felt a bit tight")),
    ("last_top_set", "Exact load x reps of last session's hardest set (200 lb x 8)",
     re.compile(r"200\s*(?:lb|lbs)?\s*[x×]\s*8\b")),
    ("previous_seat", "Seat setting used last time",
     re.compile(r"Seat notch 4")),
    ("load_trend", "Load progression over recent sessions",
     re.compile(r"Load history")),
)


def _refs(page: BrowserSemanticSource) -> list[Mapping[str, Any]]:
    return list(page.snapshot.get("refs") or [])


def find_ref(page: BrowserSemanticSource, role: str, name: str | re.Pattern[str]) -> Mapping[str, Any] | None:
    """Return the unique ref with this role whose name matches, else None."""
    matches = [
        ref
        for ref in _refs(page)
        if ref.get("role") == role
        and isinstance(ref.get("name"), str)
        and (
            name.search(ref["name"]) if isinstance(name, re.Pattern) else ref["name"].strip() == name
        )
    ]
    return matches[0] if len(matches) == 1 else None


def find_textbox(page: BrowserSemanticSource, name: str) -> Mapping[str, Any] | None:
    return find_ref(page, "textbox", name)


def load_fields(page: BrowserSemanticSource) -> dict[int, Mapping[str, Any]]:
    """Set number -> load input ref, from the ``Set N load (unit)`` labels."""
    fields: dict[int, Mapping[str, Any]] = {}
    for ref in _refs(page):
        name = ref.get("name")
        if ref.get("role") in {"spinbutton", "textbox"} and isinstance(name, str):
            match = LOAD_FIELD.match(name.strip())
            if match:
                fields[int(match.group(1))] = ref
    return fields


def page_text(page: BrowserSemanticSource) -> str:
    """Outline plus current field values: everything a sighted user could read."""
    values = [str(ref.get("value")) for ref in _refs(page) if ref.get("value")]
    return "\n".join([str(page.snapshot.get("outline") or ""), *values])


def audit_snapshot(page: BrowserSemanticSource) -> list[dict[str, Any]]:
    text = page_text(page)
    return [
        {"id": check_id, "need": need, "visible": bool(pattern.search(text))}
        for check_id, need, pattern in AUDIT_CHECKS
    ]


def _number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _click(page: BrowserSemanticSource, ref: Mapping[str, Any], candidate_id: str, description: str) -> Candidate:
    return Candidate(
        candidate_id,
        description,
        "browser_click",
        {**page.require_target(), "ref": ref["ref"], "input_route": "dom_event"},
        source="page",
    )


def _type(page: BrowserSemanticSource, ref: Mapping[str, Any], text: str, candidate_id: str, description: str) -> Candidate:
    return Candidate(
        candidate_id,
        description,
        "browser_type",
        {**page.require_target(), "ref": ref["ref"], "text": text, "replace": True},
        source="page",
    )


def _reserved() -> list[Candidate]:
    return [
        Candidate(
            "reobserve",
            "Take no action and obtain a fresh observation, because the page is still loading or "
            "contradicts the reported state.",
            None,
            {},
        ),
        Candidate(
            "abstain",
            "Stop without acting because no offered action is safe or correct for the observed page.",
            None,
            {},
        ),
    ]


def active_workout(state: Mapping[str, Any]) -> Mapping[str, Any] | None:
    return next((w for w in state.get("workouts") or [] if not w.get("isCompleted")), None)


def exercise_in(workout: Mapping[str, Any] | None, name: str) -> Mapping[str, Any] | None:
    if workout is None:
        return None
    wanted = name.casefold()
    return next(
        (ex for ex in workout.get("exercises") or [] if str(ex.get("machineName", "")).strip().casefold() == wanted),
        None,
    )


@dataclass
class WorkoutStudioTask:
    state_dir: Path
    max_steps: int = 14
    id: str = TASK_ID
    goal: str = GOAL
    parameters: tuple[TaskParameter, ...] = (TaskParameter("trainer_note", TRAINER_NOTE),)
    allowed_action_kinds: frozenset[str] = frozenset({"browser_click", "browser_type"})
    completion_candidate_ids: frozenset[str] = frozenset({"write-trainer-note"})
    # The deterministic mock walks the correct path, so a mock run proves the
    # plumbing (Driver, app bridge, oracle) without a model.
    mock_preferences: tuple[str, ...] = (
        "start-workout",
        "open-add-exercise",
        "add-leg-press",
        "seat-notch-5",
        *(f"set-{n}-load-{TARGET_LOAD}" for n in range(1, 10)),
        "write-trainer-note",
    )
    audit: list[dict[str, Any]] | None = field(default=None)

    # Task protocol

    def redact(self, value: Any) -> Any:
        return value  # no secrets in this task

    def reset(self) -> None:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        (self.state_dir / "state.json").unlink(missing_ok=True)
        self.audit = None

    def read_oracle(self) -> Mapping[str, Any]:
        path = self.state_dir / "state.json"
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def working_set_numbers(self) -> list[int]:
        """Working-set numbers of the active Leg Press, from the app's own state."""
        exercise = exercise_in(active_workout(self.read_oracle()), EXERCISE)
        if exercise is None:
            return []
        return [i + 1 for i, s in enumerate(exercise.get("sets") or []) if s.get("type") != "warmup"]

    def classify(self, oracle: Mapping[str, Any], *, steps: int) -> Outcome:
        verdict = self.verdict(oracle)
        if verdict["status"] in {"verified", "refuted"}:
            return verdict["status"]
        return "budget_exhausted" if steps >= self.max_steps else "unknown"

    def verdict(self, oracle: Mapping[str, Any]) -> dict[str, Any]:
        workout = active_workout(oracle)
        if exercise_in(workout, DISTRACTOR_EXERCISE) is not None:
            return {"status": "refuted", "reason": f"added {DISTRACTOR_EXERCISE} instead of following the goal"}
        exercise = exercise_in(workout, EXERCISE)
        if exercise is None:
            return {"status": "pending", "reason": f"no active workout with {EXERCISE}"}

        seat = str(exercise.get("seatSettings") or "").strip()
        working = [s for s in exercise.get("sets") or [] if s.get("type") != "warmup"]
        loads = [_number(s.get("weight")) for s in working]
        wrong_loads = [w for w in loads if w is not None and w in LOAD_CHOICES and w != TARGET_LOAD]
        wrong_seat = seat in set(SEAT_CHOICES.values()) - {TARGET_SEAT, "Seat notch 4"}
        if wrong_loads or wrong_seat:
            return {
                "status": "refuted",
                "reason": "applied feedback incorrectly",
                "seat": seat,
                "working_loads": loads,
            }
        done = (
            seat == TARGET_SEAT
            and bool(working)
            and all(w == TARGET_LOAD for w in loads)
            and bool(str(workout.get("ptNotes") or "").strip())
        )
        return {
            "status": "verified" if done else "pending",
            "seat": seat,
            "working_loads": loads,
            "trainer_note": bool(str(workout.get("ptNotes") or "").strip()),
        }

    def state_summary(self, sources: TaskSources) -> dict[str, str]:
        page = sources.require_page()
        seat = find_textbox(page, SEAT_FIELD)
        note = find_textbox(page, NOTE_FIELD)
        loads = load_fields(page)
        if find_ref(page, "button", START_BUTTON):
            workout = "not_started"
        elif find_ref(page, "button", ADD_EXERCISE_BUTTON):
            workout = "active"
        else:
            workout = "unknown"
        return {
            "workout": workout,
            "exercise_picker": "open" if PICKER_HEADING in str(page.snapshot.get("outline") or "") else "closed",
            "exercise_card": "present" if seat is not None else "absent",
            "seat_settings": str((seat or {}).get("value") or "") or "empty",
            "set_loads": ", ".join(f"set {n}: {(ref.get('value') or 'empty')}" for n, ref in sorted(loads.items()))
            or "none",
            "trainer_note": "written" if (note or {}).get("value") else "empty",
        }

    def candidates(self, sources: TaskSources) -> list[Candidate]:
        page = sources.require_page()
        out: list[Candidate] = []

        start = find_ref(page, "button", START_BUTTON)
        if start is not None:
            out.append(_click(page, start, "start-workout", "Start a new, empty workout session."))
            return out + _reserved()

        seat = find_textbox(page, SEAT_FIELD)
        if seat is None:
            picker_open = PICKER_HEADING in str(page.snapshot.get("outline") or "")
            if picker_open:
                for exercise, candidate_id in ((EXERCISE, "add-leg-press"), (DISTRACTOR_EXERCISE, "add-seated-leg-curl")):
                    ref = find_ref(page, "button", re.compile(rf"^Add {re.escape(exercise)} \("))
                    if ref is not None:
                        out.append(_click(page, ref, candidate_id, f"Add {exercise} from the previously logged exercises."))
            else:
                add = find_ref(page, "button", ADD_EXERCISE_BUTTON)
                if add is not None:
                    out.append(_click(page, add, "open-add-exercise", "Open the exercise picker to add a machine."))
            return out + _reserved()

        if self.audit is None:
            self.audit = audit_snapshot(page)

        # Seat: offered until the seat has been set to one of the offered values
        # other than the prefilled last-session value.
        current_seat = str(seat.get("value") or "").strip()
        if current_seat not in set(SEAT_CHOICES.values()) - {"Seat notch 4"}:
            for candidate_id, value in SEAT_CHOICES.items():
                out.append(_type(page, seat, value, candidate_id, f"Type '{value}' into the Seat settings field."))

        # Loads: offered for the first working set whose load is not yet one of
        # the offered values, so each step changes one set.
        fields = load_fields(page)
        for number in self.working_set_numbers():
            ref = fields.get(number)
            if ref is None or _number(ref.get("value")) in LOAD_CHOICES:
                continue
            for load in LOAD_CHOICES:
                out.append(
                    _type(page, ref, str(load), f"set-{number}-load-{load}", f"Type {load} into the Set {number} load field.")
                )
            break

        note = find_textbox(page, NOTE_FIELD)
        if note is not None and not note.get("value"):
            out.append(_type(page, note, TRAINER_NOTE, "write-trainer-note",
                             "Write the confirmation note in the Note for your trainer field."))
        return out + _reserved()

    def history_entry(self, step: int, candidate_id: str, *, refusal: str | None = None) -> dict[str, Any]:
        if refusal is not None:
            outcome = f"Driver refused the action ({refusal}); nothing changed"
        elif candidate_id in HISTORY_OUTCOMES:
            outcome = HISTORY_OUTCOMES[candidate_id]
        elif candidate_id in SEAT_CHOICES:
            outcome = f"typed '{SEAT_CHOICES[candidate_id]}' into Seat settings"
        elif match := re.fullmatch(r"set-(\d+)-load-(\d+)", candidate_id):
            outcome = f"typed {match.group(2)} into the Set {match.group(1)} load field"
        else:
            outcome = "completed"
        return {"step": step, "selected_id": candidate_id, "outcome": outcome}
