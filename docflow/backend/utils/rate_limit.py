"""In-memory rate limiter for authentication and API endpoints.

Supports per-plan limits for multi-tenant SaaS.
"""

import time
from collections import defaultdict
from threading import Lock


class RateLimiter:
    """Token-bucket rate limiter keyed by an arbitrary string key."""

    def __init__(self, max_attempts: int = 5, window_seconds: int = 60):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def is_rate_limited(self, key: str) -> bool:
        """Return True if the key has exceeded the rate limit."""
        now = time.time()
        cutoff = now - self.window_seconds

        with self._lock:
            self._attempts[key] = [t for t in self._attempts[key] if t > cutoff]
            if len(self._attempts[key]) >= self.max_attempts:
                return True
            self._attempts[key].append(now)
            return False


# ── Plan-aware API rate limiter ──────────────────────────────────────────────

# Limits per plan (requests per minute)
PLAN_RATE_LIMITS = {
    "free": 100,
    "pro": 500,
    "enterprise": 2000,
}


class TenantRateLimiter:
    """Rate limiter keyed by tenant_id with per-plan limits."""

    def __init__(self, window_seconds: int = 60):
        self.window_seconds = window_seconds
        self._requests: dict[int, list[float]] = defaultdict(list)
        self._lock = Lock()

    def is_rate_limited(self, tenant_id: int, plan: str = "free") -> bool:
        limit = PLAN_RATE_LIMITS.get(plan, PLAN_RATE_LIMITS["free"])
        now = time.time()
        cutoff = now - self.window_seconds

        with self._lock:
            self._requests[tenant_id] = [
                t for t in self._requests[tenant_id] if t > cutoff
            ]
            if len(self._requests[tenant_id]) >= limit:
                return True
            self._requests[tenant_id].append(now)
            return False

    def get_remaining(self, tenant_id: int, plan: str = "free") -> int:
        limit = PLAN_RATE_LIMITS.get(plan, PLAN_RATE_LIMITS["free"])
        now = time.time()
        cutoff = now - self.window_seconds

        with self._lock:
            self._requests[tenant_id] = [
                t for t in self._requests[tenant_id] if t > cutoff
            ]
            return max(0, limit - len(self._requests[tenant_id]))


# Shared instances
login_limiter = RateLimiter(max_attempts=5, window_seconds=60)
api_limiter = TenantRateLimiter(window_seconds=60)
