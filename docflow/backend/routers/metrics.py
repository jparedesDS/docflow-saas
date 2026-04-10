"""Prometheus metrics endpoint."""

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

router = APIRouter()

try:
    from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

    REQUEST_COUNT = Counter(
        "docflow_requests_total",
        "Total HTTP requests",
        ["method", "endpoint", "status"],
    )
    REQUEST_LATENCY = Histogram(
        "docflow_request_duration_seconds",
        "HTTP request latency in seconds",
        ["method", "endpoint"],
    )
    CACHE_OPS = Counter(
        "docflow_cache_operations_total",
        "Cache operations",
        ["operation"],  # hit, miss, store
    )
    SCHEDULER_RUNS = Counter(
        "docflow_scheduler_runs_total",
        "Scheduler job executions",
        ["job", "status"],  # acquired, skipped
    )

    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False


@router.get("/", response_class=PlainTextResponse)
def metrics():
    """Prometheus metrics in text format."""
    if not PROMETHEUS_AVAILABLE:
        return PlainTextResponse("# prometheus_client not installed\n", status_code=501)
    return PlainTextResponse(
        generate_latest().decode("utf-8"),
        media_type=CONTENT_TYPE_LATEST,
    )
