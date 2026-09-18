VIP NETWORK - MINIMAL USER & DEVICE MANAGEMENT FIX

Replace ONLY:
site/admin/app.js
site/admin/index.html

Do NOT replace worker.js. The current worker already contains:
- POST /api/admin/users/set-number
- GET /api/admin/users
- GET /api/admin/devices
- POST /api/admin/devices/block
- POST /api/admin/devices/unblock
- DELETE /api/admin/devices?deviceId=...

No channel, playlist, player, notice or dashboard API code is intentionally changed.
