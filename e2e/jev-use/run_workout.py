"""Run the Workout Studio jev-use task: Cua Driver acts, TypeSafe Jev decides.

Reuses the runner pieces of cua's jev-use example (Driver session wrapper,
choice validation, Jev adapter). Point ``JEV_USE_DIR`` at that example; by
default it is ``~/Codeland/cua/libs/cua-driver/examples/jev-use``.

The script starts ``next dev`` on a spare port with ``E2E_STATE_DIR`` set, so the
page under test (opened with ``?e2e=1``) loads ``seed.json`` and mirrors every
state change to ``state.json`` for the oracle. Your normal dev server and
browser data are untouched.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import urlopen

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
JEV_USE_DIR = Path(
    os.environ.get("JEV_USE_DIR", Path.home() / "Codeland/cua/libs/cua-driver/examples/jev-use")
)
sys.path.insert(0, str(JEV_USE_DIR / "python"))
sys.path.insert(0, str(HERE))

from mcp import ClientSession, StdioServerParameters  # noqa: E402
from mcp.client.stdio import stdio_client  # noqa: E402

from core import validate_choice  # noqa: E402
from driver_env import driver_environment  # noqa: E402
from jev_adapter import choose_live_for_task, choose_mock_for_task  # noqa: E402
from run import Driver, select_tab_id, wait_for_window, write_event  # noqa: E402
from sources import BrowserSemanticSource  # noqa: E402
from tasks import TaskSources  # noqa: E402
from workout_task import WorkoutStudioTask  # noqa: E402


def wait_http(url: str, timeout: float) -> int:
    deadline = time.monotonic() + timeout
    while True:
        try:
            with urlopen(url, timeout=2) as response:
                return response.status
        except URLError as error:
            status = getattr(error, "code", None)
            if status is not None:
                return status
            if time.monotonic() > deadline:
                raise RuntimeError(f"{url} did not respond within {timeout:.0f}s") from error
            time.sleep(0.5)


def start_server(port: int, state_dir: Path, log_path: Path) -> subprocess.Popen[bytes]:
    env = {**os.environ, "E2E_STATE_DIR": str(state_dir)}
    log = log_path.open("wb")
    return subprocess.Popen(
        ["npx", "next", "dev", "-p", str(port), "-H", "127.0.0.1"],
        cwd=REPO,
        env=env,
        stdout=log,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )


async def wait_for_seed(task: WorkoutStudioTask, timeout: float = 30) -> None:
    """The page writes state.json only after it has applied seed.json."""
    deadline = time.monotonic() + timeout
    while not task.read_oracle():
        if time.monotonic() > deadline:
            raise RuntimeError("page never loaded the e2e seed (state.json not written)")
        await asyncio.sleep(0.25)


async def run(args: argparse.Namespace, task: WorkoutStudioTask, app_url: str, log_path: Path) -> str:
    label = f"workout-jev-{uuid.uuid4().hex[:8]}"
    history: list[dict[str, Any]] = []
    params = StdioServerParameters(
        command=os.getenv("CUA_DRIVER_BIN", "cua-driver"), args=["mcp"], env=driver_environment()
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            driver = Driver(session, label)
            prepared = await driver.call(
                "browser_prepare", {"allow_launch": True, "profile": {"mode": "isolated_new"}}
            )
            pid = int(prepared["prepared_pid"])
            window = await wait_for_window(driver, pid)
            bound = await driver.call("get_browser_state", {"pid": pid, "window_id": window["window_id"]})
            target = {"target_id": bound["target_id"], "tab_id": select_tab_id(bound["tabs"])}
            await driver.call("browser_navigate", {**target, "url": app_url})
            await wait_for_seed(task)

            for step in range(1, task.max_steps + 1):
                outcome = task.classify(task.read_oracle(), steps=step - 1)
                if outcome in {"verified", "refuted"}:
                    return outcome

                started = time.perf_counter()
                snapshot = await driver.call("get_browser_state", {**target, "snapshot_format": "semantic_v2"})
                sources = TaskSources(page=BrowserSemanticSource(snapshot))
                candidates = task.candidates(sources)
                if args.dump_snapshots:
                    (log_path.parent / f"snapshot-{step:02d}.json").write_text(json.dumps(snapshot, indent=2))

                if args.provider == "mock":
                    choice, confidence, probabilities = choose_mock_for_task(task, sources, candidates, history)
                else:
                    choice, confidence, probabilities = await asyncio.to_thread(
                        choose_live_for_task, task, sources, candidates, history
                    )
                if choice is None:
                    return "abstained"
                candidate = validate_choice(choice, candidates, current_capture_id=None)
                if confidence < args.min_confidence and candidate.id not in {"reobserve", "abstain"}:
                    write_event(log_path, {"event": "low_confidence", "step": step, "candidate": candidate.id,
                                           "confidence": confidence, "probabilities": probabilities})
                    return "abstained"

                event = {
                    "event": "step",
                    "step": step,
                    "state": task.state_summary(sources),
                    "offered": [c.id for c in candidates],
                    "candidate": candidate.id,
                    "confidence": confidence,
                    "probabilities": probabilities,
                    "tool": candidate.tool,
                }
                if candidate.id == "abstain":
                    write_event(log_path, event)
                    return "abstained"
                if candidate.tool is not None:
                    await driver.call(candidate.tool, dict(candidate.arguments))
                    await asyncio.sleep(0.4)  # let React commit and the bridge PUT land
                event["step_ms"] = round((time.perf_counter() - started) * 1000, 1)
                history.append(task.history_entry(step, candidate.id))
                write_event(log_path, event)

            return task.classify(task.read_oracle(), steps=task.max_steps)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--provider", choices=("mock", "live"), default="live")
    parser.add_argument("--port", type=int, default=3100)
    parser.add_argument("--max-steps", type=int, default=14)
    parser.add_argument("--min-confidence", type=float, default=0.5)
    parser.add_argument("--out", type=Path, default=HERE / ".run")
    parser.add_argument("--dump-snapshots", action="store_true", help="save each Driver snapshot for debugging")
    parser.add_argument("--strict-audit", action="store_true", help="fail when a needed fact is not visible")
    args = parser.parse_args()

    if args.provider == "live" and not os.environ.get("TYPESAFE_API_KEY"):
        raise SystemExit("TYPESAFE_API_KEY is not set (use --provider mock for a model-free run)")

    state_dir = args.out / "state"
    if args.out.exists():
        shutil.rmtree(args.out)
    state_dir.mkdir(parents=True)
    shutil.copy(HERE / "seed.json", state_dir / "seed.json")
    log_path = args.out / "run.jsonl"
    task = WorkoutStudioTask(state_dir, max_steps=args.max_steps)
    task.reset()

    server = start_server(args.port, state_dir, args.out / "next-dev.log")
    try:
        base = f"http://127.0.0.1:{args.port}"
        if wait_http(f"{base}/api/e2e-state", timeout=120) != 200:
            raise SystemExit(f"/api/e2e-state is not serving the seed; see {args.out / 'next-dev.log'}")
        outcome = asyncio.run(run(args, task, f"{base}/?e2e=1", log_path))
    finally:
        os.killpg(server.pid, 15)

    verdict = task.verdict(task.read_oracle())
    report = {"outcome": outcome, "verdict": verdict, "audit": task.audit}
    write_event(log_path, {"event": "outcome", **report})
    (args.out / "report.json").write_text(json.dumps(report, indent=2))

    print(f"\nOutcome: {outcome}  ({verdict.get('reason') or verdict})")
    if task.audit:
        print("\nWhat the exercise card shows when Leg Press is added:")
        for check in task.audit:
            print(f"  [{'x' if check['visible'] else ' '}] {check['need']}")
    missing = [c for c in task.audit or [] if not c["visible"]]
    failed = outcome != "verified" or (args.strict_audit and (missing or task.audit is None))
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
