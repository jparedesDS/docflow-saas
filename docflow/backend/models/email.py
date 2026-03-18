from pydantic import BaseModel
from typing import Optional, List


class EmailRequest(BaseModel):
    to: List[str]
    subject: str
    body: str
    attachments: Optional[List[str]] = None


class EmailResponse(BaseModel):
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None
