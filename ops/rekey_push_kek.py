"""
구독 at-rest 암호화 KEK 교체(Re-key) 스크립트

주의사항
- 운영 전용. 실행 전 전체 백업 필수.
- 환경변수 `REKEY_OLD_PUSH_KEK`, `REKEY_NEW_PUSH_KEK`에
  base64 인코딩된 키를 주입해야 함.
- 모든 `push_subscriptions` 행을 순회하여 endpoint/p256dh/auth를 새 키로 재암호화.
- 해시는 평문 endpoint 기준이므로 변화 없음. (필요 시 무결성 확인)

사용 예시
  $ REKEY_OLD_PUSH_KEK=... REKEY_NEW_PUSH_KEK=... \
    python -m ops.rekey_push_kek --dry-run
  $ REKEY_OLD_PUSH_KEK=... REKEY_NEW_PUSH_KEK=... \
    python -m ops.rekey_push_kek --limit 1000

다운타임 전략
- 짧은 유지보수 창 권장. 또는 쓰기 중단(구독 등록/삭제) 후 실행.

"""

from __future__ import annotations

import argparse
import base64
import binascii
import hashlib
import os
from dataclasses import dataclass
from typing import Final

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy.orm import Session

from apps.api import models
from apps.api.db import SessionLocal

PREFIX: Final = "enc:v1:"


@dataclass
class Keys:
    old: bytes
    new: bytes


def _require_keys_from_env() -> Keys:
    def _decode(name: str) -> bytes:
        v = os.environ.get(name, "").strip()
        if not v:
            raise RuntimeError(f"환경변수 {name} 가 비어있습니다")
        try:
            b = base64.b64decode(v)
        except (binascii.Error, ValueError) as e:
            raise RuntimeError(f"{name} base64 디코드 실패: {e}") from e
        if len(b) not in (16, 24, 32):
            raise RuntimeError(
                f"{name} 길이({len(b)})가 AES 키 길이가 아닙니다(16/24/32)"
            )
        return b

    return Keys(old=_decode("REKEY_OLD_PUSH_KEK"), new=_decode("REKEY_NEW_PUSH_KEK"))


def _is_encrypted(s: str) -> bool:
    return s.startswith(PREFIX)


def _enc_with(key: bytes, plaintext: str) -> str:
    aes = AESGCM(key)
    nonce = os.urandom(12)
    ct = aes.encrypt(nonce, plaintext.encode("utf-8"), None)
    return PREFIX + base64.b64encode(nonce + ct).decode("ascii")


def _dec_with(key: bytes, ciphertext: str) -> str:
    if not _is_encrypted(ciphertext):
        return ciphertext
    data = base64.b64decode(ciphertext[len(PREFIX) :])
    nonce, ct = data[:12], data[12:]
    aes = AESGCM(key)
    pt = aes.decrypt(nonce, ct, None)
    return pt.decode("utf-8")


def _hash_endpoint(endpoint_plain: str) -> str:
    return hashlib.sha256(endpoint_plain.encode()).hexdigest()


def rekey_once(
    db: Session, keys: Keys, *, dry_run: bool = False, limit: int | None = None
) -> tuple[int, int]:
    updated = 0
    scanned = 0
    q = db.query(models.PushSubscription).order_by(models.PushSubscription.id.asc())
    if limit is not None:
        q = q.limit(limit)
    for row in q:
        scanned += 1
        # 복호화 시도: old → new 순으로 시그널링
        def _dec_guess(s: str) -> str:
            if not _is_encrypted(s):
                return s
            try:
                return _dec_with(keys.old, s)
            except InvalidTag:
                # 이미 신규 키로 암호화된 경우
                try:
                    return _dec_with(keys.new, s)
                except InvalidTag as e:
                    raise RuntimeError("Cannot decrypt with old/new key; 중단") from e

        ep_pt = _dec_guess(str(row.endpoint))
        k_pt = _dec_guess(str(row.p256dh))
        a_pt = _dec_guess(str(row.auth))

        ep_new = _enc_with(keys.new, ep_pt)
        k_new = _enc_with(keys.new, k_pt)
        a_new = _enc_with(keys.new, a_pt)

        need_update = (
            str(row.endpoint) != ep_new
            or str(row.p256dh) != k_new
            or str(row.auth) != a_new
        )
        if need_update:
            updated += 1
            if not dry_run:
                row.endpoint = ep_new
                row.p256dh = k_new
                row.auth = a_new
                row.endpoint_hash = _hash_endpoint(ep_pt)
                db.add(row)
    if not dry_run and updated:
        db.commit()
    return scanned, updated


def main() -> None:
    p = argparse.ArgumentParser(
        description="Re-key push_subscriptions to a new KEK"
    )
    p.add_argument(
        "--dry-run", action="store_true", help="DB 갱신 없이 스캔/비교만 수행"
    )
    p.add_argument("--limit", type=int, default=None, help="처리 행 수 제한(기본 전체)")
    args = p.parse_args()

    keys = _require_keys_from_env()
    with SessionLocal() as db:
        scanned, updated = rekey_once(db, keys, dry_run=args.dry_run, limit=args.limit)
        print(f"scanned={scanned} updated={updated} dry_run={args.dry_run}")


if __name__ == "__main__":
    main()
