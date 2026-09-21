VIP-Network explicit login fix
Replace:
1. worker.js
2. site/visitor-login.js
3. site/device-guard.js

Important: after deployment, the first visit on this browser requires a fresh Login or Guest Account. Old/stale VIP_USER_SESSION cookies are cleared when no v2 login marker exists. After a successful login, refresh keeps the user logged in until logout/session expiry/block/delete.
Do not replace wrangler.toml or Cloudflare secrets.
