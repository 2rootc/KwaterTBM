from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from fill_pdf import create_pdf
from server import validate_meeting_payload

ROOT = Path(__file__).resolve().parent
SAMPLE_PAYLOAD_PATH = ROOT / "data" / "sample-baseline-from-image.json"
TMP_OUTPUT_PATH = ROOT / "storage" / "tmp" / "smoke-test-output.pdf"


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def load_sample_payload() -> dict:
    payload = json.loads(SAMPLE_PAYLOAD_PATH.read_text(encoding="utf-8-sig"))
    payload.setdefault("employeeType", "internal")
    payload.setdefault("teamCode", "SMOKE")
    payload.setdefault("teamName", "Smoke Test Team")
    payload.setdefault("workTime", "09:00")
    return payload


def reserve_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def wait_for_server(port: int, timeout_seconds: float = 10.0) -> None:
    deadline = time.time() + timeout_seconds
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=1.5) as response:
                assert_true(response.status == 200, f"expected GET / to return 200, got {response.status}")
                return
        except Exception as error:
            last_error = error
            time.sleep(0.2)
    raise RuntimeError(f"server did not become ready on port {port}: {last_error}")


def run_http_checks(port: int) -> None:
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz", timeout=3) as response:
        assert_true(response.status == 200, f"expected GET /healthz to return 200, got {response.status}")
        body = json.loads(response.read().decode("utf-8"))
        assert_true(body.get("ok") is True, "expected health payload to include ok=true")

    with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/meetings", timeout=3) as response:
        assert_true(response.status == 200, f"expected GET /api/meetings to return 200, got {response.status}")
        body = json.loads(response.read().decode("utf-8"))
        assert_true(body.get("ok") is True, "expected meetings payload to include ok=true")
        assert_true(isinstance(body.get("meetings"), list), "expected meetings payload to include a list")


def run_server_smoke_test() -> None:
    port = reserve_port()
    env = os.environ.copy()
    env["PORT"] = str(port)

    process = subprocess.Popen(
        [sys.executable, "server.py"],
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    try:
        wait_for_server(port)
        run_http_checks(port)
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)

        stderr_output = process.stderr.read() if process.stderr else ""
        if process.returncode not in (0, -15, 1):
            raise RuntimeError(f"server exited unexpectedly during smoke test: {stderr_output.strip()}")


def run_pdf_smoke_test() -> None:
    payload = load_sample_payload()
    errors = validate_meeting_payload(payload)
    assert_true(not errors, f"sample payload validation failed: {errors}")
    if TMP_OUTPUT_PATH.exists():
        TMP_OUTPUT_PATH.unlink()

    create_pdf(payload, TMP_OUTPUT_PATH)
    assert_true(TMP_OUTPUT_PATH.exists(), "expected PDF output file to be created")
    assert_true(TMP_OUTPUT_PATH.stat().st_size > 0, "expected generated PDF to be non-empty")
    TMP_OUTPUT_PATH.unlink(missing_ok=True)


def main() -> int:
    run_pdf_smoke_test()
    run_server_smoke_test()
    print("Smoke test passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
