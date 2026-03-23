"""Redis client singleton with connection pooling and graceful fallback."""

import logging
import os

logger = logging.getLogger(__name__)

_redis_client = None
_initialized = False


def get_redis():
    """Return a Redis client or None if unavailable."""
    global _redis_client, _initialized
    if _initialized:
        return _redis_client
    _initialized = True

    redis_url = os.getenv("REDIS_URL", "")
    if not redis_url:
        logger.info("REDIS_URL not set — using in-memory fallback")
        return None

    try:
        import redis
        _redis_client = redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
            retry_on_timeout=True,
        )
        _redis_client.ping()
        logger.info("Redis connected: %s", redis_url)
        return _redis_client
    except Exception as e:
        logger.warning("Redis unavailable — falling back to in-memory: %s", e)
        _redis_client = None
        return None
