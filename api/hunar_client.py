import httpx
from config import settings

HUNAR_BASE_URL = "https://api.voice.hunar.ai/external/v1"


class HunarAPIError(Exception):
    """Raised when Hunar's API returns an error response."""
    def __init__(self, status_code: int, message: str, details: list | None = None):
        self.status_code = status_code
        self.message = message
        self.details = details or []
        super().__init__(f"Hunar API error [{status_code}]: {message}")


def _headers() -> dict:
    return {
        "X-API-Key": settings.hunar_api_key,
        "Content-Type": "application/json",
    }


def _raise_for_status(response: httpx.Response):
    if response.status_code == 200:
        return
    try:
        body = response.json()
        message = body.get("message", "Unknown error")
        details = body.get("details", [])
    except Exception:
        message = response.text
        details = []
    raise HunarAPIError(response.status_code, message, details)


def _webhook_config() -> dict:
    """Every call we create points all four webhook types at our single receiver endpoint."""
    url = f"{settings.backend_base_url}/webhooks/hunar"
    return {
        "call_status_callback_url": url,
        "call_recording_callback_url": url,
        "call_result_callback_url": url,
        "call_summary_callback_url": url,
    }


def _default_retry_config() -> dict:
    return {
        "max_retry_count": 2,
        "retry_interval_hours": 6,
    }


def _default_guardrails() -> dict:
    return {
        "allowed_days": ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
        "earliest_call_time": "09:00",
        "last_call_time": "21:00",
    }

 
async def create_call(
    *,
    callee_name: str,
    mobile_number: str,
    custom_data: dict,
    request_id: str,
) -> dict:
    """Trigger a single screening call. request_id should be our screening_calls.id
    so we can correlate incoming webhooks back to the right DB row."""
    payload = {
        "agent_id": settings.hunar_agent_id,
        "callee_name": callee_name,
        "mobile_number": mobile_number,
        "custom_data": custom_data,
        "request_id": request_id,
        "retry_config": _default_retry_config(),
        "guardrails": _default_guardrails(),
        "callback_config": _webhook_config(),
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(f"{HUNAR_BASE_URL}/calls/", headers=_headers(), json=payload)
    _raise_for_status(response)
    return response.json()


async def create_bulk_calls(
    *,
    batch_request_id: str,
    recipients: list[dict],
) -> list[dict]:
    """recipients: list of {"callee_name", "mobile_number", "custom_data", "request_id"}
    Note: Hunar's bulk endpoint's `data` items don't take a per-item request_id in their
    documented schema, so we rely on hunar_call_id (returned per item) plus mobile_number
    matching for correlation instead. See Step 4 for how we reconcile this."""
    payload = {
        "agent_id": settings.hunar_agent_id,
        "request_id": batch_request_id,
        "data": [
            {
                "callee_name": r["callee_name"],
                "mobile_number": r["mobile_number"],
                "custom_data": r["custom_data"],
            }
            for r in recipients
        ],
        "retry_config": _default_retry_config(),
        "guardrails": _default_guardrails(),
        "callback_config": _webhook_config(),
        "remove_invalid_rows": True,
        "remove_duplicate_phone_numbers": True,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(f"{HUNAR_BASE_URL}/calls/bulk/", headers=_headers(), json=payload)
    _raise_for_status(response)
    return response.json()


async def get_call(hunar_call_id: str) -> dict:
    """Manual fallback fetch — not part of the primary webhook-driven flow."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(f"{HUNAR_BASE_URL}/calls/{hunar_call_id}/", headers=_headers())
    _raise_for_status(response)
    return response.json()


async def create_bulk_calls(
    *,
    batch_request_id: str,
    recipients: list[dict],
) -> list[dict]:
    """recipients: list of {"callee_name", "mobile_number", "custom_data"}.
    Returns Hunar's array response — one object per successfully created call."""
    payload = {
        "agent_id": settings.hunar_agent_id,
        "request_id": batch_request_id,
        "data": [
            {
                "callee_name": r["callee_name"],
                "mobile_number": r["mobile_number"],
                "custom_data": r["custom_data"],
            }
            for r in recipients
        ],
        "retry_config": _default_retry_config(),
        "guardrails": _default_guardrails(),
        "remove_invalid_rows": True,
        "remove_duplicate_phone_numbers": True,
    }
    webhook_config = _webhook_config()
    if webhook_config:
        payload["callback_config"] = webhook_config

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(f"{HUNAR_BASE_URL}/calls/bulk/", headers=_headers(), json=payload)
    _raise_for_status(response)
    return response.json()