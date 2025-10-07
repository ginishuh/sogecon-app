from __future__ import annotations

import base64
import os

from apps.api.config import reset_settings_cache
from apps.api.crypto_utils import decrypt_str, encrypt_str


def test_decrypt_returns_ciphertext_on_key_mismatch() -> None:
    # Enable encryption with KEK-A
    os.environ["PUSH_ENCRYPT_AT_REST"] = "true"
    os.environ["PUSH_KEK"] = base64.b64encode(os.urandom(32)).decode()
    reset_settings_cache()
    ct = encrypt_str("hello")
    assert ct.startswith("enc:v1:")

    # Rotate to KEK-B (mismatch)
    os.environ["PUSH_KEK"] = base64.b64encode(os.urandom(32)).decode()
    reset_settings_cache()

    # decrypt_str should not raise; it should return the ciphertext unchanged
    out = decrypt_str(ct)
    assert out == ct

    # Cleanup
    os.environ.pop("PUSH_ENCRYPT_AT_REST", None)
    os.environ.pop("PUSH_KEK", None)
    reset_settings_cache()

