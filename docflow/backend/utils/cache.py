"""Cache decorator with Redis backend and in-memory fallback."""

import json
import hashlib
import time
import logging
from functools import wraps
from typing import Optional

logger = logging.getLogger("docflow.cache")

# In-memory fallback cache
_memory_cache: dict = {}
_redis_client = None
_redis_checked = False


def _get_redis():
    """Get Redis client (cached). Only checks connectivity once."""
    global _redis_client, _redis_checked
    if _redis_checked:
        return _redis_client
    try:
        from utils.redis_client import get_redis
        client = get_redis()
        if client:
            client.ping()
            _redis_client = client
    except Exception:
        _redis_client = None
    _redis_checked = True
    return _redis_client


def _make_key(prefix: str, args, kwargs) -> str:
    """Generate cache key from prefix + function arguments."""
    raw = f"{prefix}:{json.dumps(args, default=str)}:{json.dumps(kwargs, sort_keys=True, default=str)}"
    return f"docflow:{prefix}:{hashlib.md5(raw.encode()).hexdigest()}"


def cache_result(ttl: int = 300, key_prefix: str = ""):
    """Decorator to cache function results.

    Args:
        ttl: Time-to-live in seconds (default 5 minutes)
        key_prefix: Prefix for cache key (default: function name)

    Uses Redis if available, falls back to in-memory dict with TTL.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            prefix = key_prefix or func.__name__
            cache_key = _make_key(prefix, args[1:], kwargs)  # Skip self arg

            # Try Redis first
            redis = _get_redis()
            if redis:
                try:
                    cached = redis.get(cache_key)
                    if cached:
                        logger.debug("cache_hit", extra={"key": prefix})
                        return json.loads(cached)
                except Exception:
                    pass
            else:
                # In-memory fallback
                if cache_key in _memory_cache:
                    entry = _memory_cache[cache_key]
                    if time.time() - entry["ts"] < ttl:
                        logger.debug("memory_cache_hit", extra={"key": prefix})
                        return entry["data"]
                    else:
                        del _memory_cache[cache_key]

            result = func(*args, **kwargs)

            # Store result
            try:
                serialized = json.dumps(result, default=str)
                if redis:
                    redis.setex(cache_key, ttl, serialized)
                else:
                    _memory_cache[cache_key] = {"data": result, "ts": time.time()}
            except Exception as exc:
                logger.warning("cache_store_failed", extra={"error": str(exc)})

            return result

        wrapper.invalidate = lambda: _invalidate_prefix(key_prefix or func.__name__)
        return wrapper
    return decorator


def _invalidate_prefix(prefix: str):
    """Invalidate all cache entries with the given prefix."""
    redis = _get_redis()
    if redis:
        try:
            keys = redis.keys(f"docflow:{prefix}:*")
            if keys:
                redis.delete(*keys)
                logger.info("cache_invalidated", extra={"prefix": prefix, "count": len(keys)})
        except Exception:
            pass
    # Also clear memory cache
    to_remove = [k for k in _memory_cache if k.startswith(f"docflow:{prefix}:")]
    for k in to_remove:
        del _memory_cache[k]


def invalidate_all():
    """Clear all cached data."""
    redis = _get_redis()
    if redis:
        try:
            keys = redis.keys("docflow:*")
            if keys:
                redis.delete(*keys)
        except Exception:
            pass
    _memory_cache.clear()
