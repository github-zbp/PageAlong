from __future__ import annotations

import smtplib
from dataclasses import dataclass
from email.message import EmailMessage

from app.core.config import settings


@dataclass(frozen=True)
class VerificationEmail:
    to_email: str
    purpose: str
    code: str


class RecordingEmailSender:
    def __init__(self):
        self.messages: list[VerificationEmail] = []

    def send_verification_code(self, *, to_email: str, purpose: str, code: str) -> None:
        self.messages.append(VerificationEmail(to_email=to_email, purpose=purpose, code=code))


class EmailDeliveryError(RuntimeError):
    pass


class SMTPEmailSender:
    def send_verification_code(self, *, to_email: str, purpose: str, code: str) -> None:
        if not settings.brevo_smtp_username or not settings.brevo_smtp_password:
            raise EmailDeliveryError("Brevo SMTP credentials are not configured")

        message = EmailMessage()
        message["Subject"] = "页相随 PageAlong 邮箱验证码"
        from_name = settings.mail_from_name.strip() or "PageAlong"
        message["From"] = f"{from_name} <{settings.mail_from_email}>"
        message["To"] = to_email
        message.set_content(
            "\n".join(
                [
                    "你的页相随 PageAlong 邮箱验证码是：",
                    "",
                    code,
                    "",
                    "验证码 10 分钟内有效。若非本人操作，请忽略这封邮件。",
                ]
            )
        )

        try:
            if settings.brevo_smtp_port == 465:
                with smtplib.SMTP_SSL(settings.brevo_smtp_host, settings.brevo_smtp_port, timeout=20) as smtp:
                    smtp.login(settings.brevo_smtp_username, settings.brevo_smtp_password)
                    smtp.send_message(message)
                return

            with smtplib.SMTP(settings.brevo_smtp_host, settings.brevo_smtp_port, timeout=20) as smtp:
                smtp.starttls()
                smtp.login(settings.brevo_smtp_username, settings.brevo_smtp_password)
                smtp.send_message(message)
        except (OSError, smtplib.SMTPException) as exc:
            raise EmailDeliveryError("SMTP delivery failed") from exc


def get_default_email_sender() -> SMTPEmailSender:
    return SMTPEmailSender()
