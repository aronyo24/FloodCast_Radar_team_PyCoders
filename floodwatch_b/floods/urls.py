from django.urls import path

from . import api, bmd

app_name = "floods"

urlpatterns = [
    path("districts/", api.DistrictsView.as_view(), name="districts"),
    path("districts/<str:key>/timeline/", api.DistrictTimelineView.as_view(), name="district-timeline"),
    path("districts/<str:key>/risk/", api.DistrictRiskView.as_view(), name="district-risk"),
    path("risk/", api.RiskView.as_view(), name="risk"),
    path("subscriptions/", api.SubscribeView.as_view(), name="subscribe"),
    path("subscriptions/unsubscribe/<str:token>/", api.UnsubscribeView.as_view(), name="unsubscribe"),
    path("cycles/", api.CyclesView.as_view(), name="cycles"),
    path("cycles/<str:cycle_date>/", api.CycleDetailView.as_view(), name="cycle-detail"),
    path("national/", api.NationalView.as_view(), name="national"),
    path("overlays/", api.OverlaysView.as_view(), name="overlays"),
    path("alerts/", api.AlertsView.as_view(), name="alerts"),
    path("meta/", api.MetaView.as_view(), name="meta"),
    path("update/", api.UpdateView.as_view(), name="update"),
    # Bangladesh Meteorological Department field portal
    path("bmd/csrf/", bmd.CsrfView.as_view(), name="bmd-csrf"),
    path("bmd/register/", bmd.RegisterView.as_view(), name="bmd-register"),
    path("bmd/login/", bmd.LoginView.as_view(), name="bmd-login"),
    path("bmd/logout/", bmd.LogoutView.as_view(), name="bmd-logout"),
    path("bmd/me/", bmd.MeView.as_view(), name="bmd-me"),
    path("bmd/reports/", bmd.ReportsView.as_view(), name="bmd-reports"),
    path("bmd/reports/<int:pk>/", bmd.ReportDetailView.as_view(), name="bmd-report"),
    path("bmd/summary/", bmd.SummaryView.as_view(), name="bmd-summary"),
]
