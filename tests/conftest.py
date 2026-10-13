from __future__ import annotations

import os
import sys
from pathlib import Path

# 테스트 기본 환경: 레이트리밋은 APP_ENV=test 일 때만 스킵한다.
# api conftest가 app을 import하기 전에 고정해야 한다.
os.environ["APP_ENV"] = "test"
# 셸이나 로컬 `.env`의 실제 DSN으로 앱 import 시점에 Sentry가 켜지지 않게 한다.
# 환경변수는 env 파일보다 우선하므로 빈 값으로 고정한다.
os.environ["SENTRY_DSN"] = ""

# Ensure repo root on sys.path so the "apps" package
# is importable during pytest collection.
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
