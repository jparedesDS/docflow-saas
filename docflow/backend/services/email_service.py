import os
import requests
from models.email import EmailRequest, EmailResponse


class EmailService:
    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY", "")
        self.from_email = os.getenv("FROM_EMAIL", "onboarding@resend.dev")

    def send(self, req: EmailRequest) -> EmailResponse:
        if not self.api_key:
            return EmailResponse(success=False, error="RESEND_API_KEY not configured")

        response = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "from": self.from_email,
                "to": req.to,
                "subject": req.subject,
                "html": req.body,
            },
        )

        if response.status_code == 200:
            data = response.json()
            return EmailResponse(success=True, message_id=data.get("id"))
        return EmailResponse(success=False, error=response.text)
