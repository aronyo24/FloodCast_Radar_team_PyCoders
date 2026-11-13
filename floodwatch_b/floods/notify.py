"""
Automatic flood e-mails.

    welcome      sent right after someone subscribes: today's outlook for their district
    alert        the outlook reached the subscriber's chosen level (or got worse)
    all_clear    a district they were warned about has dropped back to low

`send_notifications()` runs after every successful data import (see
updater.run_update) and from `manage.py send_flood_notifications`. It is safe
to repeat: a subscriber hears about a given cycle at most once, unless the
level got worse.

E-mail goes through Django's normal EMAIL_* settings. With no SMTP configured
the console backend prints every message to the server log, which is enough
for a demo.
"""

from __future__ import annotations

import logging
import secrets
from dataclasses import dataclass, field
from datetime import date

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from django.utils.html import escape

from .models import Notification, Subscriber
from .risk import ACTIONS, LEVEL_ORDER, district_risk
from .serializers import Season

log = logging.getLogger("floods.notify")

LEVEL_STYLE = {
    "low": ("#15803d", "LOW"),
    "moderate": ("#b45309", "MODERATE"),
    "high": ("#c2410c", "HIGH"),
    "severe": ("#b91c1c", "SEVERE"),
}


def new_token() -> str:
    return secrets.token_urlsafe(32)


def site_url(path: str = "") -> str:
    return settings.FLOODWATCH_SITE_URL.rstrip("/") + path


def unsubscribe_url(sub: Subscriber) -> str:
    return site_url(f"/api/subscriptions/unsubscribe/{sub.token}/")


def _fmt_date(value: str | None) -> str:
    if not value:
        return "—"
    return date.fromisoformat(value).strftime("%-d %b %Y")


def compose(sub: Subscriber, risk: dict, kind: str) -> tuple[str, str, str]:
    """(subject, text body, html body)."""
    level = risk["level"]
    color, label = LEVEL_STYLE[level]
    name = risk["district"]["name_en"]
    prob = risk["probability"]
    district_link = site_url(f"/explorer/?district={risk['district']['id']}")

    if kind == "welcome":
        subject = f"FloodCast Radar: you're subscribed to {name} — current risk {label} ({prob}%)"
        intro = (f"Hi {sub.name}, thanks for subscribing. We will e-mail you automatically when the "
                 f"flood outlook for {name} reaches {sub.get_min_level_display().lower()}. "
                 f"Here is the outlook right now:")
    elif kind == "all_clear":
        subject = f"FloodCast Radar: flood risk in {name} has dropped to LOW"
        intro = f"Hi {sub.name}, good news: the latest NISAR radar pass shows flooding in {name} has eased."
    elif kind == "test":
        subject = f"FloodCast Radar test: {name} risk {label} ({prob}%)"
        intro = f"Hi {sub.name}, this is a test of your FloodCast Radar alert for {name}."
    else:
        subject = f"⚠ FloodCast Radar: {label} flood risk in {name} — {prob}% chance in the next 12 days"
        intro = (f"Hi {sub.name}, the latest NISAR satellite radar pass raised the flood outlook for "
                 f"{name} to {label}. Please read the steps below and share them with your family.")

    trend = risk["trend_pp"]
    trend_txt = f"{'+' if trend > 0 else ''}{trend:.1f} pp vs previous passes"
    rows = [
        ("Chance of flooding (next 12 days)", f"{prob}%"),
        ("Risk level", label),
        ("Flooded now (radar)", f"{risk['current_pct']:.1f}% of the district"),
        ("Trend", trend_txt),
        ("Expected next pass", f"{risk['forecast_range'][0]:.0f}–{risk['forecast_range'][1]:.0f}% flooded"),
        ("Season peak so far", f"{risk['peak_pct']:.1f}%"),
        ("Radar pass", _fmt_date(risk["last_observed"])),
        ("Outlook valid until", _fmt_date(risk["outlook_until"])),
        ("Confidence", risk["confidence"].capitalize()),
    ]
    actions = ACTIONS[level]
    unsub = unsubscribe_url(sub)

    text = "\n".join([
        intro, "",
        *[f"  {k}: {v}" for k, v in rows], "",
        "What to do now:",
        *[f"  • {a}" for a in actions], "",
        f"Live map: {district_link}",
        "Emergency: 999   Disaster warning: 1090", "",
        "FloodCast Radar uses provisional NASA-ISRO NISAR radar data. It does not replace official",
        "warnings from FFWC/BWDB or the Department of Disaster Management.",
        f"Unsubscribe: {unsub}",
    ])

    row_html = "".join(
        f'<tr><td style="padding:6px 0;color:#64748b;font-size:13px">{escape(k)}</td>'
        f'<td style="padding:6px 0;text-align:right;font-weight:700;font-size:13px;color:#0f172a">{escape(v)}</td></tr>'
        for k, v in rows
    )
    action_html = "".join(f'<li style="margin:0 0 6px">{escape(a)}</li>' for a in actions)
    html = f"""<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:#0b1220;padding:18px 24px;color:#e2e8f0;font-weight:800;font-size:16px">🌊 FloodCast Radar
<span style="float:right;font-weight:600;font-size:12px;color:#94a3b8">NASA-ISRO NISAR radar</span></td></tr>
<tr><td style="background:{color};padding:22px 24px;color:#fff">
<div style="font-size:12px;letter-spacing:.08em;font-weight:700;opacity:.85">FLOOD RISK · {escape(name.upper())}</div>
<div style="font-size:40px;font-weight:900;line-height:1.1;margin-top:4px">{prob}%</div>
<div style="font-size:14px;font-weight:700">{label} chance of flooding in the next 12 days</div></td></tr>
<tr><td style="padding:20px 24px;color:#334155;font-size:14px;line-height:1.55">{escape(intro)}
<table role="presentation" width="100%" style="margin-top:14px;border-top:1px solid #e2e8f0">{row_html}</table>
<h3 style="margin:20px 0 8px;font-size:15px;color:#0f172a">What to do now</h3>
<ul style="margin:0;padding-left:18px;font-size:13.5px">{action_html}</ul>
<p style="margin:20px 0 0"><a href="{escape(district_link)}" style="display:inline-block;background:#0284c7;color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:8px">Open live flood map</a></p>
<p style="margin:16px 0 0;font-size:13px"><b>Emergency 999</b> · Disaster warning <b>1090</b></p></td></tr>
<tr><td style="padding:14px 24px;background:#f8fafc;color:#94a3b8;font-size:11.5px;line-height:1.5">
Provisional NASA-ISRO NISAR radar data. This outlook does not replace official warnings from FFWC/BWDB or the Department of Disaster Management.<br>
<a href="{escape(unsub)}" style="color:#64748b">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>"""
    return subject, text, html


def send(sub: Subscriber, risk: dict, kind: str) -> Notification:
    subject, text, html = compose(sub, risk, kind)
    note = Notification(
        subscriber=sub, kind=kind, subject=subject[:200], level=risk["level"],
        probability=risk["probability"],
        cycle=date.fromisoformat(risk["cycle"]) if risk["cycle"] else None,
    )
    try:
        msg = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [sub.email])
        msg.attach_alternative(html, "text/html")
        msg.extra_headers = {"List-Unsubscribe": f"<{unsubscribe_url(sub)}>"}
        msg.send(fail_silently=False)
    except Exception as exc:  # noqa: BLE001 - a bad address must not stop the others
        log.warning("E-mail to %s failed: %s", sub.email, exc)
        note.ok = False
        note.error = f"{type(exc).__name__}: {exc}"[:2000]
    note.save()
    return note


@dataclass
class NotifyResult:
    cycle: date | None
    alerts: int = 0
    all_clear: int = 0
    skipped: int = 0
    failed: int = 0
    emails: list[str] = field(default_factory=list)

    def __str__(self) -> str:
        return (f"cycle {self.cycle}: {self.alerts} alert(s), {self.all_clear} all-clear, "
                f"{self.skipped} unchanged, {self.failed} failed")


def send_notifications(force: bool = False, season: Season | None = None) -> NotifyResult:
    """E-mail every subscriber whose district crossed their threshold this cycle."""
    season = season or Season()
    cycle = season.latest
    result = NotifyResult(cycle=cycle)
    if cycle is None:
        return result

    cache: dict[int, dict] = {}
    subs = Subscriber.objects.filter(active=True).select_related("district")
    for sub in subs:
        risk = cache.get(sub.district_id)
        if risk is None:
            risk = cache[sub.district_id] = district_risk(season, sub.district, cycle)
        level = risk["level"]
        rank = LEVEL_ORDER[level]
        wanted = LEVEL_ORDER[sub.min_level]
        previous = LEVEL_ORDER.get(sub.last_notified_level, -1)
        same_cycle = sub.last_notified_cycle == cycle

        kind = None
        if rank >= wanted:
            # Once per cycle, or again within it only if things got worse.
            if force or not same_cycle or rank > previous:
                kind = Notification.Kind.ALERT
        elif level == "low" and previous >= wanted and not same_cycle:
            kind = Notification.Kind.ALL_CLEAR

        if kind is None:
            result.skipped += 1
            continue

        note = send(sub, risk, kind)
        if not note.ok:
            result.failed += 1
            continue
        if kind == Notification.Kind.ALERT:
            result.alerts += 1
        else:
            result.all_clear += 1
        result.emails.append(sub.email)
        sub.last_notified_cycle = cycle
        sub.last_notified_level = level
        sub.last_notified_at = timezone.now()
        sub.save(update_fields=["last_notified_cycle", "last_notified_level", "last_notified_at"])
    log.info("Notifications %s", result)
    return result
