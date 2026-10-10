# Android screentime redemption

Create or edit a reward in **Rewards → Create a reward**, choose **Phone screentime key**, and set its price and minutes. Buying it deducts coins and displays a random key. Unused keys remain visible in **Phone keys ready to use** after reloads and server restarts.

Your automation should collect the key and make this request to the same reachable Episuite server used by the webapp:

```http
POST /api/screentime/redeem HTTP/1.1
Content-Type: application/json

{"key":"PASTE-THE-PURCHASED-KEY-HERE"}
```

A successful response is HTTP **200**:

```json
{"ok":true,"minutes":30,"seconds":1800,"purchaseId":"purchase-uuid"}
```

Unlock the phone only after HTTP 200 with `ok` exactly `true` and a positive `minutes` or `seconds` value. Use that returned duration for your local countdown, then lock again when it expires. The server does not lock or unlock Android itself. It grants the duration once; your automation must persist and enforce the countdown.

Keys contain 24 cryptographically random base32 characters, displayed in six groups of four (120 bits). Lowercase letters, omitted hyphens, and spaces are accepted. No separate API token is required: possession of the purchased key authorizes this single redemption. Send keys in the JSON body, and use the server's HTTPS address or a trusted LAN/VPN connection. Native Android HTTP actions need no browser notification permission or CORS configuration.

Errors return JSON with an `error` string:

| HTTP status | Meaning | Automation action |
| --- | --- | --- |
| 400 | Missing/malformed key or JSON | Keep locked; allow correcting the key |
| 410 | Key unknown or already redeemed | Keep locked; ask for a new valid key |
| 403 | Request has a foreign browser Origin | Use your automation's native HTTP action |
| 405 | Wrong HTTP method | Use POST |
| 415 | Wrong content type | Use application/json |
| 500 or network failure | Server could not complete the request | Keep locked |

On success, the server deletes the key and marks the purchase used in an atomic save **before** returning minutes. Simultaneous requests have only one successful redemption. Neither ordinary state reads nor API exports redeem keys. Personal reward timers cannot consume phone keys. Changing or deleting the shop option does not change a purchased key's minutes. Keys do not expire before use.

An HTTP timeout is ambiguous: the server may have redeemed the key even if the phone did not receive the response. Retrying a consumed key returns 410 and does not grant another duration. Keep the phone locked in that case; this API deliberately provides strict single-use behavior. Handle the successful HTTP response promptly and persist the local unlock deadline before changing the lock.

Live keys are excluded from exports. Importing a backup preserves this server's current screentime purchases and redemption records, so old backups cannot revive consumed keys. A new server receiving an exported backup cannot restore unused phone keys. Copying or restoring the entire server data directory is a full state rollback, so avoid rolling back that directory after granting phone time.
