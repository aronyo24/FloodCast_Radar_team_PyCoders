"""Non-API views: a small index at / so the backend explains itself."""

from django.http import JsonResponse
from django.urls import reverse


def index(request):
    names = ["districts", "cycles", "national", "overlays", "alerts", "meta", "update"]
    return JsonResponse({
        "service": "FloodCast Radar backend",
        "endpoints": {n: request.build_absolute_uri(reverse(f"floods:{n}")) for n in names},
        "timeline": request.build_absolute_uri("/api/districts/<id>/timeline/"),
        "cycle_detail": request.build_absolute_uri("/api/cycles/<date>/"),
        "admin": request.build_absolute_uri(reverse("admin:index")),
    })


def media(request, path):
    """Serve an overlay PNG from MEDIA_ROOT (read per request, not at import)."""
    from django.conf import settings
    from django.views.static import serve

    response = serve(request, path, document_root=settings.MEDIA_ROOT)
    response["Cache-Control"] = "public, max-age=3600"
    response["Access-Control-Allow-Origin"] = "*"  # images are public; lets <svg><image> load cross-origin
    return response
