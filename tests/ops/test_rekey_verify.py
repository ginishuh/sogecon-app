from __future__ import annotations

import base64
import os

from sqlalchemy.orm import Session

from apps.api import models
from apps.api.config import reset_settings_cache
from apps.api.crypto_utils import encrypt_str
from ops.rekey_push_kek import _hash_endpoint, verify_new_key_only

_MEMBER_STUDENT_ID = "rekey-verify-member"


def _seed_encrypted_subscription(db: Session, *, key: bytes) -> None:
    os.environ["PUSH_ENCRYPT_AT_REST"] = "true"
    os.environ["PUSH_KEK"] = base64.b64encode(key).decode()
    reset_settings_cache()

    member = models.Member(
        student_id=_MEMBER_STUDENT_ID,
        email="rekey-verify@example.com",
        name="Rekey Verify",
        cohort=1,
        roles="member",
        status="active",
    )
    db.add(member)
    db.flush()

    endpoint = "https://example.com/push/rekey-verify"
    row = models.PushSubscription(
        member_id=member.id,
        endpoint=encrypt_str(endpoint),
        p256dh=encrypt_str("p256dh-value"),
        auth=encrypt_str("auth-value"),
        endpoint_hash=_hash_endpoint(endpoint),
    )
    db.add(row)
    db.commit()


def _cleanup_seeded_rows(db: Session) -> None:
    db.query(models.PushSubscription).filter(
        models.PushSubscription.member_id.in_(
            db.query(models.Member.id).filter(
                models.Member.student_id == _MEMBER_STUDENT_ID
            )
        )
    ).delete(synchronize_session=False)
    db.query(models.Member).where(
        models.Member.student_id == _MEMBER_STUDENT_ID
    ).delete()
    db.commit()


def test_verify_new_key_only_passes_for_rows_encrypted_with_target_key(
    sync_db: Session,
) -> None:
    new_key = os.urandom(32)
    wrong_key = os.urandom(32)
    try:
        _seed_encrypted_subscription(sync_db, key=new_key)
        checked, failed = verify_new_key_only(sync_db, new_key)
        assert checked == 1
        assert failed == 0

        checked_wrong, failed_wrong = verify_new_key_only(sync_db, wrong_key)
        assert checked_wrong == 1
        assert failed_wrong == 1
    finally:
        os.environ.pop("PUSH_ENCRYPT_AT_REST", None)
        os.environ.pop("PUSH_KEK", None)
        reset_settings_cache()
        sync_db.rollback()
        _cleanup_seeded_rows(sync_db)
