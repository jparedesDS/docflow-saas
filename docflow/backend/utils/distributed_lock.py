"""Distributed lock using Redis SET NX EX, with file-based fallback for dev."""

import logging
import os
import time

logger = logging.getLogger("docflow.lock")


class DistributedLock:
    """Context manager for distributed locking."""

    def __init__(self, name: str, ttl: int = 300):
        self.name = f"docflow:lock:{name}"
        self.ttl = ttl
        self.acquired = False
        self._redis = None

    def _get_redis(self):
        from utils.cache import _get_redis
        return _get_redis()

    def __enter__(self):
        self._redis = self._get_redis()
        if self._redis:
            self.acquired = bool(self._redis.set(self.name, "1", nx=True, ex=self.ttl))
        else:
            self.acquired = True

        if self.acquired:
            logger.debug("lock_acquired lock=%s", self.name)
        else:
            logger.debug("lock_skipped lock=%s", self.name)

        return self

    def __exit__(self, *args):
        if self.acquired and self._redis:
            try:
                self._redis.delete(self.name)
            except Exception:
                pass


def locked_job(func, lock_name: str, ttl: int = 300):
    """Wrap a scheduler job function with a distributed lock."""
    def wrapper():
        with DistributedLock(lock_name, ttl) as lock:
            if lock.acquired:
                func()
            else:
                logger.info("job_skipped_locked job=%s", lock_name)
    wrapper.__name__ = func.__name__
    return wrapper
