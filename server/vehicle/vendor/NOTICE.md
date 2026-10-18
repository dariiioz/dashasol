# Volkswagen portal client

`website_portal.py` and `http2_session.py` are derived from
[rafaelhutter/ha-volkswagen-connect v0.5.38](https://github.com/rafaelhutter/ha-volkswagen-connect/releases/tag/v0.5.38), downloaded on 2026-10-18, under the included MIT license.

Domoryx changes: remove the Home Assistant HTTP client factory; restrict HTTP redirects to HTTPS Volkswagen identity/portal hosts; retain individual vehicle timestamps and charge type; read charging target only from chargingSettings.targetSOC_pct, never navigationTargetSOC_pct. The local bridge only calls read endpoints and login flows. No remote vehicle commands are exposed.

The consent exception retains the official consent URL so the owner can review the authorization in their own browser. The bridge never submits this authorization.
