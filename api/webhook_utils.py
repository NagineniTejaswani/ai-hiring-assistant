import hmac
import hashlib
import base64
from collections.abc import Iterable


def compute_hunar_signature(*, api_key: str, request_body: bytes, timestamp: str) -> str:
    """One Base64 segment of X-Hunar-Signature for the given key, timestamp, and message bytes."""
    message = f"{timestamp.strip()}.".encode("utf-8") + request_body
    digest = hmac.new(api_key.encode("utf-8"), message, hashlib.sha256).digest()
    return base64.b64encode(digest).decode("ascii")


def verify_hunar_webhook_signature(
    *,
    signature_header: str | None,
    timestamp_header: str | None,
    request_body: bytes,
    trusted_api_keys: Iterable[str],
) -> bool:
    """True if any comma-separated signature matches any trusted key."""
    if not (signature_header and signature_header.strip()) or not timestamp_header:
        return False

    timestamp = timestamp_header.strip()
    signatures = [s.strip() for s in signature_header.split(",") if s.strip()]
    for api_key in trusted_api_keys:
        computed = compute_hunar_signature(api_key=api_key, request_body=request_body, timestamp=timestamp)
        for signature in signatures:
            if hmac.compare_digest(signature, computed):
                return True
    return False