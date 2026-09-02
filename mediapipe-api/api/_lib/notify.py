"""
Sends emails via plain SMTP (stdlib `smtplib`, no extra pip dependency —
works with Gmail App Passwords, or any SMTP provider).

Every function here is best-effort: a misconfigured or failing SMTP setup
must never break signup/approval flows, so failures are swallowed and
returned as `False` rather than raised.

Env vars:
  SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASSWORD
  ADMIN_NOTIFY_EMAIL — where "new signup" notifications get sent
"""
import os
import smtplib
import ssl
from email.mime.text import MIMEText


def _smtp_configured():
    return all([
        os.environ.get("SMTP_HOST"),
        os.environ.get("SMTP_USER"),
        os.environ.get("SMTP_PASSWORD"),
    ])


def send_email(to_email, subject, body):
    if not _smtp_configured() or not to_email:
        return False

    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ["SMTP_USER"]
    password = os.environ["SMTP_PASSWORD"]

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = user
    msg["To"] = to_email

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(host, port, timeout=8) as server:
            server.starttls(context=context)
            server.login(user, password)
            server.sendmail(user, [to_email], msg.as_string())
        return True
    except Exception:
        return False


def notify_admin_new_signup(email):
    admin_email = os.environ.get("ADMIN_NOTIFY_EMAIL")
    if not admin_email:
        return False
    return send_email(
        admin_email,
        f"[MediaPipe API] Đăng ký mới chờ duyệt: {email}",
        (
            f"Người dùng {email} vừa tạo tài khoản và đang chờ duyệt.\n\n"
            "Vào trang /admin -> tab \"Người dùng chờ duyệt\" để duyệt hoặc từ chối."
        ),
    )


def notify_user_approved(email, api_key):
    return send_email(
        email,
        "Tài khoản MediaPipe API của bạn đã được duyệt",
        (
            f"Chào {email},\n\n"
            "Tài khoản của bạn đã được duyệt để dùng MediaPipe API.\n"
            f"API key của bạn: {api_key}\n\n"
            "Đăng nhập lại tại trang /account để xem lại thông tin bất cứ lúc nào."
        ),
    )
