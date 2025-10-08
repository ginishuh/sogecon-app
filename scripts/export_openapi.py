#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from apps.api.main import app  # type: ignore  # noqa: E402


def main() -> None:
    openapi_data = app.openapi()
    output_path = ROOT / "packages" / "schemas" / "openapi.json"
    output_path.write_text(json.dumps(openapi_data, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
