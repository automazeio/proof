"""Tests for the proof Python SDK."""

from __future__ import annotations

import json
import subprocess
from unittest.mock import MagicMock, patch

import pytest

from proof import INSTALL_HELP, Proof, Recording, _find_binary


class TestFindBinary:
    def test_found(self):
        with patch("proof.shutil.which", return_value="/usr/local/bin/proof"):
            assert _find_binary() == "/usr/local/bin/proof"

    def test_not_found(self):
        with patch("proof.shutil.which", return_value=None):
            with pytest.raises(RuntimeError, match="proof CLI not found"):
                _find_binary()


class TestRecording:
    def test_dataclass(self):
        r = Recording(path="/tmp/test.html", mode="terminal", duration=1200)
        assert r.path == "/tmp/test.html"
        assert r.mode == "terminal"
        assert r.duration == 1200
        assert r.label is None

    def test_with_label(self):
        r = Recording(path="/tmp/test.html", mode="terminal", duration=500, label="unit")
        assert r.label == "unit"


class TestProofInit:
    def test_raises_when_binary_missing(self):
        with patch("proof.shutil.which", return_value=None):
            with pytest.raises(RuntimeError, match="proof CLI not found"):
                Proof(app_name="test")

    def test_stores_config(self):
        with patch("proof.shutil.which", return_value="/usr/local/bin/proof"):
            p = Proof(
                app_name="my-app",
                proof_dir="./evidence",
                run="v1",
                description="test run",
            )
            assert p._app_name == "my-app"
            assert p._proof_dir == "./evidence"
            assert p._run == "v1"
            assert p._description == "test run"


def _make_proof(**kwargs):
    with patch("proof.shutil.which", return_value="/usr/local/bin/proof"):
        return Proof(app_name="test-app", **kwargs)


class TestCapture:
    def test_basic_capture(self):
        p = _make_proof()
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = json.dumps({
            "recordings": [{
                "path": "/tmp/unit-143012.html",
                "mode": "terminal",
                "duration": 2400,
                "label": "unit",
            }]
        })

        with patch("proof.subprocess.run", return_value=mock_result) as mock_run:
            rec = p.capture(command="pytest tests/", label="unit")

            assert rec.path == "/tmp/unit-143012.html"
            assert rec.mode == "terminal"
            assert rec.duration == 2400
            assert rec.label == "unit"

            call_args = mock_run.call_args
            assert call_args[0][0] == ["/usr/local/bin/proof", "--json"]
            payload = json.loads(call_args[1]["input"])
            assert payload["action"] == "capture"
            assert payload["appName"] == "test-app"
            assert payload["command"] == "pytest tests/"
            assert payload["mode"] == "terminal"
            assert payload["label"] == "unit"

    def test_capture_with_all_options(self):
        p = _make_proof(proof_dir="./evidence", run="v2", description="global desc")
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = json.dumps({
            "recordings": [{
                "path": "/tmp/api.html",
                "mode": "terminal",
                "duration": 5000,
            }]
        })

        with patch("proof.subprocess.run", return_value=mock_result) as mock_run:
            p.capture(
                command="pytest tests/api/",
                mode="terminal",
                label="api",
                description="api tests",
            )

            payload = json.loads(mock_run.call_args[1]["input"])
            assert payload["proofDir"] == "./evidence"
            assert payload["run"] == "v2"
            assert payload["description"] == "api tests"
            assert payload["label"] == "api"

    def test_capture_cli_error(self):
        p = _make_proof()
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = json.dumps({"error": "command not found: bad-cmd"})

        with patch("proof.subprocess.run", return_value=mock_result):
            with pytest.raises(RuntimeError, match="command not found"):
                p.capture(command="bad-cmd")

    def test_capture_cli_error_non_json(self):
        p = _make_proof()
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = "segfault"

        with patch("proof.subprocess.run", return_value=mock_result):
            with pytest.raises(RuntimeError, match="segfault"):
                p.capture(command="bad-cmd")


class TestReport:
    def test_basic_report(self):
        p = _make_proof()
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = json.dumps({"path": "/tmp/report.md"})

        with patch("proof.subprocess.run", return_value=mock_result) as mock_run:
            path = p.report()

            assert path == "/tmp/report.md"
            payload = json.loads(mock_run.call_args[1]["input"])
            assert payload["action"] == "report"
            assert payload["appName"] == "test-app"

    def test_report_with_format(self):
        p = _make_proof(proof_dir="./evidence", run="v1")
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = json.dumps({"path": ["/tmp/report.md", "/tmp/report.html"]})

        with patch("proof.subprocess.run", return_value=mock_result) as mock_run:
            result = p.report(format=["md", "html"])

            payload = json.loads(mock_run.call_args[1]["input"])
            assert payload["format"] == ["md", "html"]
            assert payload["proofDir"] == "./evidence"
            assert payload["run"] == "v1"
