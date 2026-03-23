import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from apscheduler.schedulers.background import BackgroundScheduler
from starlette.middleware.base import BaseHTTPMiddleware

from routers import (
    documents, emails, erp, claims, ai, reports, notifications,
    transmittals, analytics, inbox, agenda, docusign, personal,
    backup, health, auth, templates, polling, projects, search,
    schedules, tenants, billing, admin, workflows,
    audit, comments, saved_filters, attachments, webhooks_config, api_keys,
    classification, portal, response_templates, predictions,
)
from utils.config import CORS_ORIGINS
from utils.logging_config import setup_logging
from services.auth_service import verify_token

setup_logging()
logger = structlog.get_logger("docflow.main")

scheduler = BackgroundScheduler(timezone="Europe/Madrid")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from services.backup_service import run_backup
    from services.polling_service import poll_and_process
    from services.scheduled_reports_service import sync_scheduler_jobs

    # Infrastructure jobs (not user-configurable)
    scheduler.add_job(run_backup, "cron", hour=2, minute=0, id="daily_backup")
    scheduler.add_job(poll_and_process, "interval", minutes=15, id="imap_polling")

    # Dynamic report schedules from JSON config
    sync_scheduler_jobs(scheduler)

    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="DocFlow Industrial", version="1.0.0", lifespan=lifespan)

# ── Exception handlers ──────────────────────────────────────────


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning("validation_error", path=str(request.url), errors=str(exc.errors()))
    return JSONResponse(
        status_code=422,
        content={"detail": "Validation error", "errors": exc.errors()},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "unhandled_exception",
        path=str(request.url),
        method=request.method,
        error=str(exc),
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ── Security headers middleware ─────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


# ── JWT Authentication middleware ───────────────────────────────

PUBLIC_PATHS = {
    "/",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/auth/accept-invite",
    "/api/v1/health/",
    "/api/v1/health/liveness",
    "/api/v1/tenants/register",
    "/api/v1/billing/webhooks",
}

PUBLIC_PREFIXES = (
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/v1/portal/documents",
    "/api/v1/portal/dashboard",
)


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """Global JWT authentication middleware.

    Intercepts all requests and validates the Bearer token,
    except for whitelisted public paths.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Allow public paths
        if path in PUBLIC_PATHS or path.startswith(PUBLIC_PREFIXES):
            return await call_next(request)

        # Allow OPTIONS (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Try API Key auth first (X-API-Key header)
        api_key_header = request.headers.get("x-api-key", "")
        if api_key_header:
            try:
                from services.api_key_service import validate_key
                key_info = validate_key(api_key_header)
                if key_info:
                    request.state.user = {
                        "username": f"api-key:{key_info['name']}",
                        "role": "api",
                        "initials": "API",
                        "tenant_id": key_info["tenant_id"],
                        "scopes": key_info["scopes"],
                    }
                    return await call_next(request)
            except Exception:
                pass
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid API key"},
            )

        # Extract and validate JWT
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid authorization header"},
            )

        token = auth_header.removeprefix("Bearer ")
        try:
            payload = verify_token(token)
            # Attach user info to request state for downstream use
            request.state.user = {
                "username": payload["sub"],
                "role": payload["role"],
                "initials": payload["initials"],
                "tenant_id": payload.get("tenant_id", 1),
            }
        except Exception:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired token"},
            )

        return await call_next(request)


# ── API rate limiting + usage tracking middleware ────────────────────


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-tenant rate limiting based on plan tier."""

    async def dispatch(self, request: Request, call_next):
        user = getattr(request.state, "user", None)
        if user and user.get("tenant_id"):
            from utils.rate_limit import api_limiter
            # Determine plan
            plan = "enterprise"  # Default for existing tenants
            try:
                from services.plan_service import get_plan
                plan = get_plan(user["tenant_id"])
            except Exception:
                pass

            if api_limiter.is_rate_limited(user["tenant_id"], plan):
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Upgrade your plan for higher limits."},
                )

            # Track API usage
            try:
                from services.usage_service import increment_usage
                increment_usage(user["tenant_id"], "api_calls")
            except Exception:
                pass

        return await call_next(request)


# ── Middleware registration (order matters: last added = first executed) ──

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(JWTAuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────────────────

app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(emails.router, prefix="/api/v1/emails", tags=["emails"])
app.include_router(erp.router, prefix="/api/v1/erp", tags=["erp"])
app.include_router(claims.router, prefix="/api/v1/claims", tags=["claims"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(transmittals.router, prefix="/api/v1/transmittals", tags=["transmittals"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(inbox.router, prefix="/api/v1/inbox", tags=["inbox"])
app.include_router(agenda.router, prefix="/api/v1/agenda", tags=["agenda"])
app.include_router(docusign.router, prefix="/api/v1/docusign", tags=["docusign"])
app.include_router(personal.router, prefix="/api/v1/personal", tags=["personal"])

app.include_router(backup.router, prefix="/api/v1/backup", tags=["backup"])
app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(templates.router, prefix="/api/v1/templates", tags=["templates"])

app.include_router(polling.router, prefix="/api/v1", tags=["polling"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
app.include_router(schedules.router, prefix="/api/v1/schedules", tags=["schedules"])
app.include_router(tenants.router, prefix="/api/v1/tenants", tags=["tenants"])
app.include_router(billing.router, prefix="/api/v1/billing", tags=["billing"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(workflows.router, prefix="/api/v1/workflows", tags=["workflows"])
app.include_router(audit.router, prefix="/api/v1/audit", tags=["audit"])
app.include_router(comments.router, prefix="/api/v1/comments", tags=["comments"])
app.include_router(saved_filters.router, prefix="/api/v1/filters", tags=["filters"])
app.include_router(attachments.router, prefix="/api/v1/attachments", tags=["attachments"])
app.include_router(webhooks_config.router, prefix="/api/v1/webhooks", tags=["webhooks"])
app.include_router(api_keys.router, prefix="/api/v1/api-keys", tags=["api-keys"])
app.include_router(classification.router, prefix="/api/v1/classification", tags=["classification"])
app.include_router(portal.router, prefix="/api/v1/portal", tags=["portal"])
app.include_router(response_templates.router, prefix="/api/v1/response-templates", tags=["response-templates"])
app.include_router(predictions.router, prefix="/api/v1/predictions", tags=["predictions"])


@app.get("/")
def root():
    return {"message": "DocFlow Industrial API", "version": "1.0.0"}
