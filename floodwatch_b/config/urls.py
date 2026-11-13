"""FloodCast Radar URL configuration."""

from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from floods.views import index, media

urlpatterns = [
    path("", index, name="index"),
    path("admin/", admin.site.urls),
    path("api/", include("floods.urls")),
]

if settings.SERVE_MEDIA:
    # Overlay PNGs. Small files, so Django serving them is fine for a demo or a
    # single small server; put nginx in front for anything busier.
    urlpatterns += [
        re_path(r"^media/(?P<path>.+)$", media, name="media"),
    ]
