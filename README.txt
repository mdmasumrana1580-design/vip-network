VIP-Network — Block System Replacement Files

Replace ONLY these files in the existing project:
1. worker.js                  -> project root
2. site/device-guard.js      -> site/
3. site/visitor-login.js     -> site/
4. site/app.js               -> site/

Do NOT replace site/admin/worker.js. The project's wrangler.toml uses:
main = "worker.js"

What this version does:
- Admin device Block immediately marks the device blocked.
- For a logged-in account, blocking its device also blocks the linked account and revokes its active session.
- Guest blocking also blocks the guest's registered device.
- Public device checks return HTTP 403 when blocked.
- The browser's device is registered automatically, including guest browsers.
- A secure VIP_ACCESS_DEVICE cookie lets the Worker reject future page requests before the site HTML is served.
- Active pages are still rechecked by device-guard.js.
- Guest tracker rechecks block state.
- /admin is excluded from the public block gate so the administrator does not lock themselves out of the admin panel accidentally.

Important limitation:
No browser-only system can guarantee identifying a real-world person after they clear all site data, switch browsers/devices, or use a different device/network. This is the strongest practical device/account enforcement for this architecture. IP-only blocking is not used because it can block unrelated users sharing an IP.

After replacing the files:
1. Commit/push to GitHub.
2. Let Cloudflare Pages/Workers deploy.
3. Open the site once from a test device.
4. In Admin -> User & Device Management, press Block.
5. Also test Admin -> Guest Account -> Block for a guest.
