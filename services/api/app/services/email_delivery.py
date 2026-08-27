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


@dataclass(frozen=True)
class FeedbackEmail:
    to_email: str
    reply_to_email: str
    category: str
    summary: str
    message: str
    page_path: str
    user_agent: str
    ip_address: str
    subject: str
    body: str


FEEDBACK_CATEGORY_LABELS = {
    "suggestion": "Suggestion",
    "bug": "Bug",
    "feature": "Feature request",
}


def format_feedback_category(category: str) -> str:
    return FEEDBACK_CATEGORY_LABELS.get(category, category)


def build_feedback_subject(category: str, summary: str) -> str:
    category_label = format_feedback_category(category)
    clean_summary = " ".join(summary.split())
    if clean_summary:
        return f"PageAlong feedback - {category_label}: {clean_summary}"
    return f"PageAlong feedback - {category_label}"


def build_feedback_body(
    *,
    category: str,
    summary: str,
    message: str,
    reply_to_email: str,
    page_path: str,
    user_agent: str,
    ip_address: str,
) -> str:
    lines = [
        "New feedback submission",
        "",
        f"Category: {format_feedback_category(category)}",
        f"Summary: {summary.strip() or '-'}",
        f"User email: {reply_to_email}",
        f"Page: {page_path.strip() or '-'}",
        f"User agent: {user_agent.strip() or '-'}",
        f"IP address: {ip_address.strip() or '-'}",
        "",
        "Message:",
        message.strip() or "-",
    ]
    return "\n".join(lines)


class RecordingEmailSender:
    def __init__(self):
        self.messages: list[VerificationEmail] = []
        self.feedback_messages: list[FeedbackEmail] = []

    def send_verification_code(self, *, to_email: str, purpose: str, code: str) -> None:
        self.messages.append(VerificationEmail(to_email=to_email, purpose=purpose, code=code))

    def send_feedback(
        self,
        *,
        to_email: str,
        reply_to_email: str,
        category: str,
        summary: str,
        message: str,
        page_path: str,
        user_agent: str,
        ip_address: str,
    ) -> None:
        subject = build_feedback_subject(category, summary)
        body = build_feedback_body(
            category=category,
            summary=summary,
            message=message,
            reply_to_email=reply_to_email,
            page_path=page_path,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        self.feedback_messages.append(
            FeedbackEmail(
                to_email=to_email,
                reply_to_email=reply_to_email,
                category=category,
                summary=summary,
                message=message,
                page_path=page_path,
                user_agent=user_agent,
                ip_address=ip_address,
                subject=subject,
                body=body,
            )
        )


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

    def send_feedback(
        self,
        *,
        to_email: str,
        reply_to_email: str,
        category: str,
        summary: str,
        message: str,
        page_path: str,
        user_agent: str,
        ip_address: str,
    ) -> None:
        if not settings.brevo_smtp_username or not settings.brevo_smtp_password:
            raise EmailDeliveryError("Brevo SMTP credentials are not configured")

        subject = build_feedback_subject(category, summary)
        body = build_feedback_body(
            category=category,
            summary=summary,
            message=message,
            reply_to_email=reply_to_email,
            page_path=page_path,
            user_agent=user_agent,
            ip_address=ip_address,
        )

        message_to_send = EmailMessage()
        message_to_send["Subject"] = subject
        from_name = settings.mail_from_name.strip() or "PageAlong"
        message_to_send["From"] = f"{from_name} <{settings.mail_from_email}>"
        message_to_send["To"] = to_email
        if reply_to_email.strip():
            message_to_send["Reply-To"] = reply_to_email.strip()
        message_to_send.set_content(body)

        try:
            if settings.brevo_smtp_port == 465:
                with smtplib.SMTP_SSL(settings.brevo_smtp_host, settings.brevo_smtp_port, timeout=20) as smtp:
                    smtp.login(settings.brevo_smtp_username, settings.brevo_smtp_password)
                    smtp.send_message(message_to_send)
                return

            with smtplib.SMTP(settings.brevo_smtp_host, settings.brevo_smtp_port, timeout=20) as smtp:
                smtp.starttls()
                smtp.login(settings.brevo_smtp_username, settings.brevo_smtp_password)
                smtp.send_message(message_to_send)
        except (OSError, smtplib.SMTPException) as exc:
            raise EmailDeliveryError("SMTP delivery failed") from exc


def get_default_email_sender() -> SMTPEmailSender:
    return SMTPEmailSender()
