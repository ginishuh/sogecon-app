"""Transactional email via SMTP (Gmail app password)."""

from __future__ import annotations

import asyncio
import html
import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path
from urllib.parse import urlencode

from ..config import Settings, get_settings
from ..errors import BadGatewayError, ConflictError

logger = logging.getLogger(__name__)

_SMTP_TIMEOUT_SECONDS = 20
ACTIVATION_HERO_CID = "activation-hero@sogecon"
ACTIVATION_HERO_PATH = (
    Path(__file__).resolve().parent.parent / "assets" / "email" / "activation-hero.jpg"
)


def smtp_configured(settings: Settings | None = None) -> bool:
    current = settings or get_settings()
    return bool(
        current.smtp_username
        and current.smtp_password
        and from_address(current)
    )


def from_address(settings: Settings) -> str:
    return settings.smtp_from_email or settings.smtp_username


def mask_email_address(email: str) -> str:
    trimmed = (email or "").strip()
    local, sep, domain = trimmed.partition("@")
    if not sep or not domain:
        return "***"
    if not local:
        return f"*@{domain}"
    return f"{local[0]}***@{domain}"


def build_activation_url(token: str, *, site_url: str | None = None) -> str:
    base = (site_url or get_settings().public_site_url).rstrip("/")
    return f"{base}/activate?{urlencode({'token': token})}"


def _activation_hero_bytes() -> bytes | None:
    try:
        data = ACTIVATION_HERO_PATH.read_bytes()
    except OSError:
        return None
    return data or None


def build_activation_text(
    *,
    name: str,
    student_id: str,
    activation_url: str,
    from_name: str,
) -> str:
    return (
        f"[{from_name}] {name}({student_id})님, "
        "가입이 승인되었습니다.\n"
        "아래 링크에서 첫 로그인에 사용할 비밀번호를 설정해 주세요.\n"
        f"{activation_url}"
    )


def build_activation_html(
    *,
    name: str,
    student_id: str,
    activation_url: str,
    from_name: str,
    hero_cid: str | None = ACTIVATION_HERO_CID,
) -> str:
    safe_name = html.escape(name)
    safe_student_id = html.escape(student_id)
    safe_url = html.escape(activation_url, quote=True)
    sender = html.escape(from_name)
    hero_row = ""
    if hero_cid:
        hero_row = (
            "<tr><td style=\"padding:0;line-height:0;font-size:0;\">"
            f'<img src="cid:{html.escape(hero_cid, quote=True)}" '
            'width="600" alt="서강대학교 경제대학원 총동문회" '
            'style="display:block;width:100%;max-width:600px;height:auto;border:0;">'
            "</td></tr>"
        )
    return (
        '<!DOCTYPE html><html lang="ko"><head>'
        '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">'
        f"<title>{sender} 가입 승인</title></head>"
        '<body style="margin:0;padding:0;background:#f2eee8;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#f2eee8;"><tr>'
        '<td align="center" style="padding:24px 12px;">'
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" '
        'style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;'
        'overflow:hidden;border:1px solid #d8d3cc;">'
        '<tr><td style="background:#8a1e2d;padding:18px 28px;">'
        '<p style="margin:0;font-family:Pretendard,Apple SD Gothic Neo,Malgun Gothic,'
        f'sans-serif;font-size:13px;letter-spacing:0.02em;color:#ffffff;">{sender}</p>'
        "</td></tr>"
        f"{hero_row}"
        '<tr><td style="padding:28px 28px 8px;'
        'font-family:Pretendard,Apple SD Gothic Neo,Malgun Gothic,sans-serif;'
        'color:#1f242d;">'
        '<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#8a1e2d;">'
        "가입 승인</p>"
        '<p style="margin:0 0 16px;font-size:24px;line-height:1.35;font-weight:700;">'
        f"환영합니다, {safe_name}님</p>"
        '<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#2b3340;">'
        "가입 신청이 승인되었습니다. 아래 버튼에서 첫 로그인에 사용할 "
        "비밀번호를 만들어 주세요.</p>"
        '<p style="margin:0;font-size:14px;line-height:1.6;color:#5d6673;">'
        f"로그인 학번 {safe_student_id}</p>"
        "</td></tr>"
        '<tr><td align="center" style="padding:20px 28px 8px;">'
        '<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
        '<td bgcolor="#8a1e2d" style="border-radius:8px;background:#8a1e2d;">'
        f'<a href="{safe_url}" '
        'style="display:inline-block;padding:14px 28px;font-family:Pretendard,'
        "Apple SD Gothic Neo,Malgun Gothic,sans-serif;font-size:15px;"
        'font-weight:700;color:#ffffff;text-decoration:none;">'
        "비밀번호 만들기</a>"
        "</td></tr></table></td></tr>"
        '<tr><td style="padding:8px 28px 28px;'
        'font-family:Pretendard,Apple SD Gothic Neo,Malgun Gothic,sans-serif;">'
        '<p style="margin:0;font-size:12px;line-height:1.6;color:#5d6673;'
        'word-break:break-all;">'
        "버튼이 열리지 않으면 아래 주소를 브라우저에 붙여 넣어 주세요.<br>"
        f'<a href="{safe_url}" style="color:#8a1e2d;">{safe_url}</a></p>'
        "</td></tr>"
        '<tr><td style="padding:18px 28px;background:#f9f5f1;'
        'font-family:Pretendard,Apple SD Gothic Neo,Malgun Gothic,sans-serif;">'
        '<p style="margin:0;font-size:12px;line-height:1.6;color:#5d6673;">'
        f"이 안내는 {sender} 사무국에서 보냈습니다. "
        "신청하지 않으셨다면 이 메일을 무시해 주세요.</p>"
        "</td></tr></table></td></tr></table></body></html>"
    )


def build_activation_message(
    *,
    to_email: str,
    name: str,
    student_id: str,
    activation_url: str,
    settings: Settings | None = None,
) -> EmailMessage:
    current = settings or get_settings()
    sender_email = from_address(current)
    hero = _activation_hero_bytes()
    hero_cid = ACTIVATION_HERO_CID if hero is not None else None
    message = EmailMessage()
    message["Subject"] = f"[{current.smtp_from_name}] 가입이 승인되었습니다"
    message["From"] = formataddr((current.smtp_from_name, sender_email))
    message["To"] = to_email
    message["Reply-To"] = sender_email
    text = build_activation_text(
        name=name,
        student_id=student_id,
        activation_url=activation_url,
        from_name=current.smtp_from_name,
    )
    message.set_content(text)
    message.add_alternative(
        build_activation_html(
            name=name,
            student_id=student_id,
            activation_url=activation_url,
            from_name=current.smtp_from_name,
            hero_cid=hero_cid,
        ),
        subtype="html",
    )
    if hero is not None and hero_cid is not None:
        _attach_inline_jpeg(message, hero, hero_cid)
    return message


def _attach_inline_jpeg(message: EmailMessage, data: bytes, cid: str) -> None:
    html_part: EmailMessage | None = None
    for part in message.iter_parts():
        if isinstance(part, EmailMessage) and part.get_content_type() == "text/html":
            html_part = part
            break
    if html_part is None:
        return
    html_part.add_related(
        data,
        maintype="image",
        subtype="jpeg",
        cid=f"<{cid}>",
    )


def deliver_message(
    message: EmailMessage, settings: Settings | None = None
) -> None:
    current = settings or get_settings()
    if not smtp_configured(current):
        raise ConflictError(code="email_not_configured")
    context = ssl.create_default_context()
    try:
        with smtplib.SMTP(
            current.smtp_host,
            current.smtp_port,
            timeout=_SMTP_TIMEOUT_SECONDS,
        ) as smtp:
            smtp.ehlo()
            if current.smtp_use_tls:
                smtp.starttls(context=context)
                smtp.ehlo()
            smtp.login(current.smtp_username, current.smtp_password)
            smtp.send_message(message)
    except (smtplib.SMTPException, OSError) as exc:
        logger.warning("smtp_send_failed type=%s", type(exc).__name__)
        raise BadGatewayError(code="email_send_failed") from exc


async def send_activation_email(
    *,
    to_email: str,
    name: str,
    student_id: str,
    token: str,
    settings: Settings | None = None,
) -> str:
    current = settings or get_settings()
    if not smtp_configured(current):
        raise ConflictError(code="email_not_configured")
    activation_url = build_activation_url(token, site_url=current.public_site_url)
    message = build_activation_message(
        to_email=to_email,
        name=name,
        student_id=student_id,
        activation_url=activation_url,
        settings=current,
    )
    await asyncio.to_thread(deliver_message, message, current)
    return to_email
