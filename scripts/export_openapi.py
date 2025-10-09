#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from importlib import import_module
from pathlib import Path
from typing import TYPE_CHECKING, Protocol, cast

if TYPE_CHECKING:
    from fastapi import FastAPI


class _AppModule(Protocol):
    app: FastAPI

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

def _load_app() -> FastAPI:
    module = cast(_AppModule, import_module("apps.api.main"))
    return module.app


def main() -> None:
    app = _load_app()
    openapi_data = app.openapi()
    output_path = ROOT / "packages" / "schemas" / "openapi.json"
    output_path.write_text(json.dumps(openapi_data, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
