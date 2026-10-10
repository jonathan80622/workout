"""Offline tests for the Workout Studio task: no Driver, no model, no server.

Run: uv run --project "$JEV_USE_DIR" python -m unittest e2e/jev-use/test_workout_task.py
"""

from __future__ import annotations

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

import run_workout  # noqa: F401  (puts the jev-use example on sys.path)
from jev_adapter import choose_mock_for_task, task_decision_state
from sources import BrowserSemanticSource
from tasks import TaskSources
from workout_task import TRAINER_NOTE, WorkoutStudioTask

HERE = Path(__file__).resolve().parent
TARGET = {"target_id": "bt-1", "tab_id": "tab-1"}


def snapshot(outline: str, refs: list[dict]) -> TaskSources:
    numbered = [{"ref": f"p1:{i}", **ref} for i, ref in enumerate(refs)]
    return TaskSources(page=BrowserSemanticSource({**TARGET, "page": {"url": "http://127.0.0.1:3100/?e2e=1"},
                                                   "outline": outline, "refs": numbered}))


def card_page(seat="Seat notch 4", set2="120", set3="140", note=None, outline_extra="") -> TaskSources:
    outline = (
        '- textbox "Seat settings"\n'
        '- statictext "🔥 PT Feedback from prior workouts"\n'
        '- statictext "Thu, Sep 24, 6:00 PM: Knees caved in on the last set at 200 lb. Next session drop '
        'the working sets to 180 lb and move the seat back to notch 5 so you reach full depth."\n'
        '- button "Load history 2 logged sessions · average load per session"\n' + outline_extra
    )
    return snapshot(outline, [
        {"role": "textbox", "name": "Seat settings", "value": seat},
        {"role": "spinbutton", "name": "Set 1 load (lbs)", "value": "80"},
        {"role": "spinbutton", "name": "Set 2 load (lbs)", "value": set2},
        {"role": "spinbutton", "name": "Set 3 load (lbs)", "value": set3},
        {"role": "textbox", "name": "Note for your trainer", "value": note},
        {"role": "button", "name": "Add Exercise Machine", "value": None},
    ])


def active_state(seat="Seat notch 4", loads=(120, 140), note="", exercise="Leg Press") -> dict:
    sets = [{"type": "warmup", "weight": 80}] + [{"type": "working", "weight": w} for w in loads]
    return {"workouts": [{"isCompleted": False, "ptNotes": note,
                          "exercises": [{"machineName": exercise, "seatSettings": seat, "sets": sets}]}]}


class WorkoutTaskTest(unittest.TestCase):
    def setUp(self) -> None:
        self.dir = Path(tempfile.mkdtemp())
        self.task = WorkoutStudioTask(self.dir)
        self.task.reset()

    def write_state(self, state: dict) -> None:
        (self.dir / "state.json").write_text(json.dumps(state))

    def ids(self, sources: TaskSources) -> list[str]:
        return [c.id for c in self.task.candidates(sources)]

    def test_seed_is_valid_and_has_no_active_workout(self) -> None:
        seed = json.loads((HERE / "seed.json").read_text())
        self.assertTrue(all(w["isCompleted"] for w in seed["workouts"]))

    def test_navigation_candidates(self) -> None:
        start = snapshot("", [{"role": "button", "name": "+ Start New Workout Session"}])
        self.assertEqual(self.ids(start), ["start-workout", "reobserve", "abstain"])

        empty = snapshot("", [{"role": "button", "name": "Add Exercise Machine"}])
        self.assertEqual(self.ids(empty), ["open-add-exercise", "reobserve", "abstain"])

        picker = snapshot('- heading "Select Exercise Machine"', [
            {"role": "button", "name": "Add Leg Press (Quads)"},
            {"role": "button", "name": "Add Seated Leg Curl (Hamstrings)"},
        ])
        self.assertEqual(self.ids(picker), ["add-leg-press", "add-seated-leg-curl", "reobserve", "abstain"])

    def test_card_offers_seat_first_working_load_and_note(self) -> None:
        self.write_state(active_state())
        ids = self.ids(card_page())
        self.assertEqual(ids[:3], ["seat-notch-5", "seat-notch-4", "seat-notch-3"])
        self.assertEqual(ids[3:6], ["set-2-load-180", "set-2-load-200", "set-2-load-210"])
        self.assertIn("write-trainer-note", ids)
        self.assertNotIn("set-1-load-180", ids, "warmup set must not be offered")

    def test_progresses_to_next_working_set(self) -> None:
        self.write_state(active_state(seat="Seat notch 5", loads=(180, 140)))
        ids = self.ids(card_page(seat="Seat notch 5", set2="180"))
        self.assertNotIn("seat-notch-5", ids)
        self.assertEqual(ids[:3], ["set-3-load-180", "set-3-load-200", "set-3-load-210"])

    def test_candidate_arguments_come_from_snapshot_refs(self) -> None:
        self.write_state(active_state())
        by_id = {c.id: c for c in self.task.candidates(card_page())}
        self.assertEqual(dict(by_id["seat-notch-5"].arguments),
                         {**TARGET, "ref": "p1:0", "text": "Seat notch 5", "replace": True})
        self.assertEqual(by_id["write-trainer-note"].arguments["text"], TRAINER_NOTE)

    def test_oracle_verdicts(self) -> None:
        self.assertEqual(self.task.classify({}, steps=0), "unknown")
        self.assertEqual(self.task.classify(active_state(seat="Seat notch 5", loads=(180, 180), note="ok"), steps=5),
                         "verified")
        self.assertEqual(self.task.classify(active_state(seat="Seat notch 5", loads=(180, 180)), steps=5),
                         "unknown", "note still missing")
        self.assertEqual(self.task.classify(active_state(loads=(200, 140)), steps=3), "refuted")
        self.assertEqual(self.task.classify(active_state(seat="Seat notch 3"), steps=3), "refuted")
        self.assertEqual(self.task.classify(active_state(exercise="Seated Leg Curl"), steps=3), "refuted")
        self.assertEqual(self.task.classify({}, steps=self.task.max_steps), "budget_exhausted")

    def test_mock_walks_the_correct_path(self) -> None:
        self.write_state(active_state())
        sources = card_page()
        choice, _, _ = choose_mock_for_task(self.task, sources, self.task.candidates(sources), [])
        self.assertEqual(choice, "seat-notch-5")

    def test_decision_state_carries_feedback_but_not_the_answer_key(self) -> None:
        self.write_state(active_state())
        sources = card_page()
        state = task_decision_state(self.task, sources, [])
        self.assertIn("Knees caved in", state["observation"]["outline"])
        summary = json.dumps(state["observation"]["form"])
        self.assertNotIn("180", summary)
        self.assertNotIn("notch 5", summary)

    def test_audit_reports_missing_facts(self) -> None:
        self.write_state(active_state())
        sources = card_page()
        self.task.candidates(sources)
        visible = {c["id"]: c["visible"] for c in self.task.audit}
        self.assertTrue(visible["exercise_feedback"])
        self.assertTrue(visible["previous_seat"])
        self.assertTrue(visible["load_trend"])
        self.assertFalse(visible["session_feedback"])
        self.assertFalse(visible["last_top_set"])


if __name__ == "__main__":
    unittest.main()
