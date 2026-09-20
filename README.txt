VIP-Network Block/Unblock v3
Replace ONLY:
1. root worker.js
2. site/device-guard.js
3. site/visitor-login.js
4. site/app.js

This version:
- preserves pre-block device approval/status and restores them on unblock
- revokes active login session when a device is blocked
- links guest records to the persistent device ID
- blocking a guest also blocks its linked device
- unblocking a guest restores the linked device's previous state
- blocked guest/device IDs are not deleted client-side
Do NOT replace site/admin/worker.js for this fix.
