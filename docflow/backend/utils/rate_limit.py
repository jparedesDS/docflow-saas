"""Rate limiter with Redis backend (preferred) and in-memory fallback.

Supports per-plan limits for multi-tenant SaaS.
"""

import time
from collections import defaultdict
from threading import Lock


class RateLimiter:
    """Token-bucket rate limiter keyed by an arbitrary string key.

    Uses Redis if available, otherwise falls back to in-memory.
    """

    def __init__(self, max_attempts: int = 5, window_seconds: int = 60):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def _try_redis(self, key: str) -> bool | None:
        """Try Redis-based rate limiting. Returns None if Redis unavailable."""
        try:
            from utils.redis_client import get_redis
            r = get_redis()
            if r is None:
                return None
            redis_key = f"rl:{key}"
            pipe = r.pipeline()
            now = time.time()
            pipe.zremrangebyscore(redis_key, 0, now - self.window_seconds)
            pipe.zcard(redis_key)
            pipe.zadd(redis_key, {str(now): now})
            pipe.expire(redis_key, self.window_seconds + 1)
            results = pipe.execute()
            count = results[1]
            if count >= self.max_attempts:
                return True
            return False
        except Exception:
            return None

    def is_rate_limited(self, key: str) -> bool:
        """Return True if the key has exceeded the rate limit."""
        result = self._try_redis(key)
        if result is not None:
            return result

        # In-memory fallback
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
    """Rate limiter keyed by tenant_id with per-plan limits.

    Uses Redis if available, otherwise falls back to in-memory.
    """

    def __init__(self, window_seconds: int = 60):
        self.window_seconds = window_seconds
        self._requests: dict[int, list[float]] = defaultdict(list)
        self._lock = Lock()

    def _try_redis(self, tenant_id: int, limit: int) -> bool | None:
        """Try Redis-based rate limiting. Returns None if Redis unavailable."""
        try:
            from utils.redis_client import get_redis
            r = get_redis()
            if r is None:
                return None
            redis_key = f"trl:{tenant_id}"
            pipe = r.pipeline()
            now = time.time()
            pipe.zremrangebyscore(redis_key, 0, now - self.window_seconds)
            pipe.zcard(redis_key)
            pipe.zadd(redis_key, {str(now): now})
            pipe.expire(redis_key, self.window_seconds + 1)
            results = pipe.execute()
            count = results[1]
            if count >= limit:
                return True
            return False
        except Exception:
            return None

    def is_rate_limited(self, tenant_id: int, plan: str = "free") -> bool:
        limit = PLAN_RATE_LIMITS.get(plan, PLAN_RATE_LIMITS["free"])

        result = self._try_redis(tenant_id, limit)
        if result is not None:
            return result

        # In-memory fallback
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

    def _try_redis_remaining(self, tenant_id: int, limit: int) -> int | None:
        """Try getting remaining count from Redis."""
        try:
            from utils.redis_client import get_redis
            r = get_redis()
            if r is None:
                return None
            redis_key = f"trl:{tenant_id}"
            now = time.time()
            r.zremrangebyscore(redis_key, 0, now - self.window_seconds)
            count = r.zcard(redis_key)
            return max(0, limit - count)
        except Exception:
            return None

    def get_remaining(self, tenant_id: int, plan: str = "free") -> int:
        limit = PLAN_RATE_LIMITS.get(plan, PLAN_RATE_LIMITS["free"])

        result = self._try_redis_remaining(tenant_id, limit)
        if result is not None:
            return result

        # In-memory fallback
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
