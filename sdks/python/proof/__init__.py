"""automaze-proof: Capture visual evidence of test execution."""

from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from typing import List, Optional, Union

__version__ = "0.20260313.0"

INSTALL_HELP = (
    "proof CLI not found on PATH. Install it:\n\n"
    "  curl -fsSL https://automaze.io/install/proof | sh\n\n"
    "  or: brew install automazeio/tap/proof\n"
    "  or: npm install -g @automaze/proof\n"
)


def _find_binary() -> str:
    path = shutil.which("proof")
    if not path:
        raise RuntimeError(INSTALL_HELP)
    return path


@dataclass
class Recording:
    """Result of a single capture."""

    path: str
    mode: str
    duration: int
    label: Optional[str] = None


class Proof:
    """Thin wrapper around the proof CLI.

    Requires the ``proof`` binary on PATH. All capture and report
    logic is delegated to the CLI via JSON stdin/stdout.
    """

    def __init__(
        self,
        app_name: str,
        proof_dir: Optional[str] = None,
        run: Optional[str] = None,
        description: Optional[str] = None,
    ) -> None:
        self._bin = _find_binary()
        self._app_name = app_name
        self._proof_dir = proof_dir
        self._run = run
        self._description = description

    def capture(
        self,
        command: str,
        mode: str = "terminal",
        label: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Recording:
        """Run a command and capture its output as proof."""
        payload: dict = {
            "action": "capture",
            "appName": self._app_name,
            "command": command,
            "mode": mode,
        }
        if self._proof_dir:
            payload["proofDir"] = self._proof_dir
        if self._run:
            payload["run"] = self._run
        if self._description:
            payload["description"] = self._description
        if label:
            payload["label"] = label
        if description:
            payload["description"] = description

        result = self._call(payload)
        rec = result["recordings"][0]
        return Recording(
            path=rec["path"],
            mode=rec["mode"],
            duration=rec["duration"],
            label=rec.get("label"),
        )

    def report(
        self,
        format: Optional[Union[str, List[str]]] = None,
    ) -> Union[str, List[str]]:
        """Generate a report from captured artifacts."""
        payload: dict = {
            "action": "report",
            "appName": self._app_name,
        }
        if self._proof_dir:
            payload["proofDir"] = self._proof_dir
        if self._run:
            payload["run"] = self._run
        if format:
            payload["format"] = format

        result = self._call(payload)
        return result["path"]

    def _call(self, payload: dict) -> dict:
        proc = subprocess.run(
            [self._bin, "--json"],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            try:
                error = json.loads(proc.stderr)
                msg = error.get("error", proc.stderr)
            except (json.JSONDecodeError, ValueError):
                msg = proc.stderr or f"proof exited with code {proc.returncode}"
            raise RuntimeError(msg)
        return json.loads(proc.stdout)
