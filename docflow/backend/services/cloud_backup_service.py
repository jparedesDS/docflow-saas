"""Optional S3-compatible cloud backup after local backup."""

import os
from datetime import datetime

import structlog

logger = structlog.get_logger("docflow.cloud_backup")

# S3 configuration from environment
S3_BUCKET = os.getenv("BACKUP_S3_BUCKET", "")
S3_PREFIX = os.getenv("BACKUP_S3_PREFIX", "docflow-backups/")
S3_ENDPOINT_URL = os.getenv("BACKUP_S3_ENDPOINT_URL", "")  # For MinIO/custom S3


def is_configured() -> bool:
    """Check if S3 backup is configured."""
    return bool(S3_BUCKET)


def _get_s3_client():
    """Get boto3 S3 client. Returns None if boto3 not installed or not configured."""
    if not S3_BUCKET:
        return None
    try:
        import boto3
        kwargs = {}
        if S3_ENDPOINT_URL:
            kwargs["endpoint_url"] = S3_ENDPOINT_URL
        return boto3.client("s3", **kwargs)
    except ImportError:
        logger.warning("boto3 not installed — S3 backup disabled")
        return None
    except Exception as exc:
        logger.error("s3_client_init_failed", error=str(exc))
        return None


def upload_backup(local_path: str, backup_name: str = "") -> dict:
    """Upload a single backup file to S3.

    Args:
        local_path: Path to the local file to upload
        backup_name: Optional name override for S3 key

    Returns:
        dict with status, s3_key, and any error
    """
    client = _get_s3_client()
    if not client:
        return {"status": "skipped", "reason": "S3 not configured or boto3 not installed"}

    if not os.path.isfile(local_path):
        return {"status": "error", "reason": f"File not found: {local_path}"}

    filename = backup_name or os.path.basename(local_path)
    date_prefix = datetime.now().strftime("%Y/%m/%d")
    s3_key = f"{S3_PREFIX}{date_prefix}/{filename}"

    try:
        client.upload_file(local_path, S3_BUCKET, s3_key)
        logger.info("s3_backup_uploaded", key=s3_key, bucket=S3_BUCKET)
        return {"status": "uploaded", "s3_key": s3_key, "bucket": S3_BUCKET}
    except Exception as exc:
        logger.error("s3_upload_failed", key=s3_key, error=str(exc))
        return {"status": "error", "error": str(exc)}


def upload_directory(local_dir: str) -> dict:
    """Upload all files in a backup directory to S3.

    Returns summary with counts.
    """
    if not is_configured():
        return {"status": "skipped", "reason": "S3 not configured"}

    if not os.path.isdir(local_dir):
        return {"status": "error", "reason": f"Directory not found: {local_dir}"}

    results = {"uploaded": 0, "failed": 0, "skipped": 0, "errors": []}

    for filename in os.listdir(local_dir):
        filepath = os.path.join(local_dir, filename)
        if not os.path.isfile(filepath):
            continue
        result = upload_backup(filepath, filename)
        if result["status"] == "uploaded":
            results["uploaded"] += 1
        elif result["status"] == "error":
            results["failed"] += 1
            results["errors"].append(result.get("error", ""))
        else:
            results["skipped"] += 1

    results["status"] = "completed"
    return results
