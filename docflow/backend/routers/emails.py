from fastapi import APIRouter
from models.email import EmailRequest, EmailResponse
from services.email_service import EmailService

router = APIRouter()
service = EmailService()


@router.post("/send", response_model=EmailResponse)
def send_email(req: EmailRequest):
    return service.send(req)
