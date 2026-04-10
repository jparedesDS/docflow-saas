"""Tests for utils/cache.py — Redis caching with in-memory fallback."""

import time
import json
import pytest
from unittest.mock import patch, MagicMock

# Ensure the backend package is importable
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.cache import cache_result, invalidate_all, _memory_cache, _make_key


# ── Helpers ──────────────────────────────────────────────────────────────


class DummyService:
    """Fake service to test cache_result on instance methods."""

    def __init__(self):
        self.call_count = 0

    @cache_result(ttl=60, key_prefix="dummy")
    def expensive_method(self, x, y=0):
        self.call_count += 1
        return {"result": x + y}

    @cache_result(ttl=1, key_prefix="short_ttl")
    def short_lived(self, x):
        self.call_count += 1
        return {"value": x}

    @cache_result(ttl=300, key_prefix="args_test")
    def with_args(self, a, b, c="default"):
        self.call_count += 1
        return {"a": a, "b": b, "c": c}


# ── Fixtures ─────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def clear_cache():
    """Clear in-memory cache before each test."""
    _memory_cache.clear()
    yield
    _memory_cache.clear()


# ── Tests ────────────────────────────────────────────────────────────────


class TestCacheResultDecorator:
    """Test the cache_result decorator with in-memory fallback."""

    @patch("utils.cache._get_redis", return_value=None)
    def test_stores_and_returns_cached_value(self, mock_redis):
        """First call executes function, second call returns cached value."""
        svc = DummyService()

        # First call — cache miss
        result1 = svc.expensive_method(10, y=5)
        assert result1 == {"result": 15}
        assert svc.call_count == 1

        # Second call — cache hit (should NOT increment call_count)
        result2 = svc.expensive_method(10, y=5)
        assert result2 == {"result": 15}
        assert svc.call_count == 1  # Still 1 — function was NOT called again

    @patch("utils.cache._get_redis", return_value=None)
    def test_ttl_expiry(self, mock_redis):
        """Cached value expires after TTL seconds."""
        svc = DummyService()

        # Cache with TTL=1s
        result1 = svc.short_lived(42)
        assert result1 == {"value": 42}
        assert svc.call_count == 1

        # Immediately — still cached
        result2 = svc.short_lived(42)
        assert svc.call_count == 1

        # Wait for TTL to expire
        time.sleep(1.1)

        # Now it should re-execute
        result3 = svc.short_lived(42)
        assert result3 == {"value": 42}
        assert svc.call_count == 2

    @patch("utils.cache._get_redis", return_value=None)
    def test_in_memory_fallback_when_redis_unavailable(self, mock_redis):
        """When Redis returns None, cache uses in-memory dict."""
        svc = DummyService()

        result = svc.expensive_method(7)
        assert result == {"result": 7}

        # Verify it's stored in _memory_cache
        assert len(_memory_cache) == 1

        # Verify the stored entry has the right structure
        entry = list(_memory_cache.values())[0]
        assert "data" in entry
        assert "ts" in entry
        assert entry["data"] == {"result": 7}

    @patch("utils.cache._get_redis", return_value=None)
    def test_invalidate_all_clears_cache(self, mock_redis):
        """invalidate_all() empties the in-memory cache."""
        svc = DummyService()

        svc.expensive_method(1)
        svc.expensive_method(2)
        assert len(_memory_cache) >= 1

        invalidate_all()
        assert len(_memory_cache) == 0

        # After invalidation, function should execute again
        svc.expensive_method(1)
        assert svc.call_count == 3  # 1 + 2 + 3 calls total

    @patch("utils.cache._get_redis", return_value=None)
    def test_cache_key_includes_function_args(self, mock_redis):
        """Different args produce different cache keys (different cached entries)."""
        svc = DummyService()

        svc.with_args("a", "b", c="x")
        svc.with_args("a", "b", c="y")
        svc.with_args("d", "e")

        # All three calls should have different keys → 3 entries
        assert len(_memory_cache) == 3
        assert svc.call_count == 3

    @patch("utils.cache._get_redis", return_value=None)
    def test_same_args_same_cache_key(self, mock_redis):
        """Same arguments produce the same cache key."""
        svc = DummyService()

        svc.with_args("a", "b", c="x")
        svc.with_args("a", "b", c="x")

        # Both calls with same args → 1 cache entry, 1 execution
        assert len(_memory_cache) == 1
        assert svc.call_count == 1


class TestCacheWithRedisMock:
    """Test cache behavior when Redis is available (mocked)."""

    def _make_mock_redis(self):
        """Create a mock Redis client with get/setex/keys/delete/ping."""
        store = {}
        mock = MagicMock()
        mock.ping.return_value = True

        def mock_get(key):
            return store.get(key)

        def mock_setex(key, ttl, value):
            store[key] = value

        def mock_keys(pattern):
            import fnmatch
            return [k for k in store if fnmatch.fnmatch(k, pattern)]

        def mock_delete(*keys):
            for k in keys:
                store.pop(k, None)

        mock.get = MagicMock(side_effect=mock_get)
        mock.setex = MagicMock(side_effect=mock_setex)
        mock.keys = MagicMock(side_effect=mock_keys)
        mock.delete = MagicMock(side_effect=mock_delete)
        return mock, store

    def test_redis_cache_hit(self):
        """When Redis has cached data, it should return it without calling the function."""
        mock_redis, store = self._make_mock_redis()

        with patch("utils.cache._get_redis", return_value=mock_redis):
            svc = DummyService()

            # First call — cache miss, stores in Redis
            result1 = svc.expensive_method(10, y=5)
            assert result1 == {"result": 15}
            assert svc.call_count == 1
            assert mock_redis.setex.called

            # Second call — cache hit from Redis
            result2 = svc.expensive_method(10, y=5)
            assert result2 == {"result": 15}
            assert svc.call_count == 1  # NOT called again

    def test_redis_invalidate_all(self):
        """invalidate_all should delete keys from Redis."""
        mock_redis, store = self._make_mock_redis()

        with patch("utils.cache._get_redis", return_value=mock_redis):
            svc = DummyService()
            svc.expensive_method(1)
            svc.expensive_method(2)

            # Store has entries
            assert len(store) >= 1

            invalidate_all()

            # Store should be empty
            assert len(store) == 0

    def test_prefix_invalidation(self):
        """Calling .invalidate() on a decorated method clears only that prefix."""
        mock_redis, store = self._make_mock_redis()

        with patch("utils.cache._get_redis", return_value=mock_redis):
            svc = DummyService()
            svc.expensive_method(1)  # prefix=dummy
            svc.with_args("a", "b")  # prefix=args_test

            assert len(store) == 2

            # Invalidate only "dummy" prefix
            svc.expensive_method.invalidate()

            # Only "args_test" key should remain
            remaining = [k for k in store if "args_test" in k]
            assert len(remaining) == 1


class TestMakeKey:
    """Test the _make_key helper."""

    def test_deterministic(self):
        """Same inputs produce the same key."""
        key1 = _make_key("test", (1, 2), {"a": "b"})
        key2 = _make_key("test", (1, 2), {"a": "b"})
        assert key1 == key2

    def test_different_args_different_keys(self):
        """Different args produce different keys."""
        key1 = _make_key("test", (1,), {})
        key2 = _make_key("test", (2,), {})
        assert key1 != key2

    def test_key_has_prefix(self):
        """Key starts with docflow:{prefix}:"""
        key = _make_key("monitoring", (1,), {})
        assert key.startswith("docflow:monitoring:")

    def test_kwargs_order_independent(self):
        """kwargs order shouldn't matter (sorted internally)."""
        key1 = _make_key("test", (), {"a": 1, "b": 2})
        key2 = _make_key("test", (), {"b": 2, "a": 1})
        assert key1 == key2
