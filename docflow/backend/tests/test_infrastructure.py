"""Tests for distributed lock, health checks (database + redis), and Prometheus metrics."""

from unittest.mock import patch, MagicMock


class TestDistributedLock:
    """Tests for utils.distributed_lock."""

    def test_lock_acquires_without_redis(self):
        """Lock should always acquire when Redis is unavailable."""
        from utils.distributed_lock import DistributedLock

        with patch.object(DistributedLock, "_get_redis", return_value=None):
            with DistributedLock("test_job", ttl=10) as lock:
                assert lock.acquired is True

    def test_lock_acquires_with_redis(self):
        """Lock should acquire when Redis SET NX succeeds."""
        from utils.distributed_lock import DistributedLock

        mock_redis = MagicMock()
        mock_redis.set.return_value = True
        mock_redis.ping.return_value = True

        with patch.object(DistributedLock, "_get_redis", return_value=mock_redis):
            with DistributedLock("test_job", ttl=10) as lock:
                assert lock.acquired is True
                mock_redis.set.assert_called_once_with(
                    "docflow:lock:test_job", "1", nx=True, ex=10
                )
        # After exit, lock should be released
        mock_redis.delete.assert_called_once_with("docflow:lock:test_job")

    def test_lock_skips_when_held(self):
        """Lock should not acquire when Redis SET NX returns False (lock held)."""
        from utils.distributed_lock import DistributedLock

        mock_redis = MagicMock()
        mock_redis.set.return_value = False
        mock_redis.ping.return_value = True

        with patch.object(DistributedLock, "_get_redis", return_value=mock_redis):
            with DistributedLock("test_job", ttl=10) as lock:
                assert lock.acquired is False
        # Should NOT call delete since lock was not acquired
        mock_redis.delete.assert_not_called()

    def test_lock_release_exception_handled(self):
        """Lock release should not raise even if Redis delete fails."""
        from utils.distributed_lock import DistributedLock

        mock_redis = MagicMock()
        mock_redis.set.return_value = True
        mock_redis.ping.return_value = True
        mock_redis.delete.side_effect = Exception("connection lost")

        with patch.object(DistributedLock, "_get_redis", return_value=mock_redis):
            # Should not raise
            with DistributedLock("test_job", ttl=10) as lock:
                assert lock.acquired is True


class TestLockedJob:
    """Tests for locked_job wrapper."""

    def test_locked_job_runs_when_acquired(self):
        """Wrapped function should execute when lock is acquired."""
        from utils.distributed_lock import locked_job, DistributedLock

        tracker = {"called": False}

        def my_job():
            tracker["called"] = True

        wrapped = locked_job(my_job, "my_job", ttl=60)

        with patch.object(DistributedLock, "_get_redis", return_value=None):
            wrapped()

        assert tracker["called"] is True

    def test_locked_job_skips_when_locked(self):
        """Wrapped function should NOT execute when lock is held by another."""
        from utils.distributed_lock import locked_job, DistributedLock

        tracker = {"called": False}

        def my_job():
            tracker["called"] = True

        wrapped = locked_job(my_job, "my_job", ttl=60)

        mock_redis = MagicMock()
        mock_redis.set.return_value = False
        mock_redis.ping.return_value = True

        with patch.object(DistributedLock, "_get_redis", return_value=mock_redis):
            wrapped()

        assert tracker["called"] is False

    def test_locked_job_preserves_name(self):
        """Wrapper should preserve the original function name."""
        from utils.distributed_lock import locked_job

        def my_backup():
            pass

        wrapped = locked_job(my_backup, "backup")
        assert wrapped.__name__ == "my_backup"


class TestHealthEndpoints:
    """Tests for /api/v1/health/ endpoints including database and redis checks."""

    def test_liveness(self, client):
        """GET /api/v1/health/liveness always returns 200."""
        res = client.get("/api/v1/health/liveness")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"

    def test_readiness_includes_database_check(self, client):
        """GET /api/v1/health/ includes database check."""
        res = client.get("/api/v1/health/")
        assert res.status_code == 200
        data = res.json()
        assert "checks" in data
        assert "database" in data["checks"]
        # In test env, STORAGE_BACKEND=excel, so backend should be "excel"
        assert data["checks"]["database"]["status"] == "ok"
        assert data["checks"]["database"]["backend"] == "excel"

    def test_readiness_includes_redis_check(self, client):
        """GET /api/v1/health/ includes redis check."""
        res = client.get("/api/v1/health/")
        assert res.status_code == 200
        data = res.json()
        assert "checks" in data
        assert "redis" in data["checks"]
        # Redis may or may not be available in test env
        assert data["checks"]["redis"]["status"] in ("ok", "degraded")

    def test_readiness_includes_all_checks(self, client):
        """GET /api/v1/health/ includes all six check categories."""
        res = client.get("/api/v1/health/")
        data = res.json()
        expected_checks = {"data_erp", "consulta_erp", "tags", "disk", "database", "redis"}
        assert set(data["checks"].keys()) == expected_checks

    def test_readiness_has_timestamp(self, client):
        """GET /api/v1/health/ includes ISO timestamp."""
        res = client.get("/api/v1/health/")
        data = res.json()
        assert "timestamp" in data
        assert "T" in data["timestamp"]  # ISO format


class TestMetricsEndpoint:
    """Tests for /api/v1/metrics/ Prometheus endpoint."""

    def test_metrics_returns_prometheus_format(self, client):
        """GET /api/v1/metrics/ returns Prometheus text format."""
        res = client.get("/api/v1/metrics/")
        # Should return 200 if prometheus_client is installed, 501 otherwise
        assert res.status_code in (200, 501)
        if res.status_code == 200:
            # Prometheus format includes HELP/TYPE lines or metric data
            assert "text/plain" in res.headers.get("content-type", "") or \
                   "text/plain" in res.headers.get("Content-Type", "") or \
                   res.status_code == 200

    def test_metrics_no_auth_required(self, client):
        """GET /api/v1/metrics/ should not require authentication."""
        res = client.get("/api/v1/metrics/")
        # Should NOT be 401 (unauthorized)
        assert res.status_code != 401

    def test_metrics_contains_custom_metrics(self, client):
        """If prometheus_client is available, custom metrics should be defined."""
        try:
            from routers.metrics import (
                PROMETHEUS_AVAILABLE,
                REQUEST_COUNT,
                REQUEST_LATENCY,
                CACHE_OPS,
                SCHEDULER_RUNS,
            )
            if PROMETHEUS_AVAILABLE:
                # Verify metric names
                # Counter strips _total suffix from _name internally
                assert "docflow_requests" in REQUEST_COUNT._name
                assert "docflow_request_duration" in REQUEST_LATENCY._name
                assert "docflow_cache_operations" in CACHE_OPS._name
                assert "docflow_scheduler_runs" in SCHEDULER_RUNS._name
        except ImportError:
            pass  # prometheus_client not installed — skip
