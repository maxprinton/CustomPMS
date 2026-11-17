# CPMS API v1

Base address: `https://custompms.vercel.app/api/v1`. Create a key in Settings > API and integrations (owner only). Send it on every call:

    Authorization: Bearer cpms_...

A key belongs to one workspace and only sees that workspace's data. Revoke it in Settings at any time.

## Resources

| Path | Methods | Notes |
|---|---|---|
| `/me` | GET | Which workspace this key belongs to |
| `/clients`, `/clients/{id}` | GET, POST, PATCH | filters: kind, archived |
| `/projects`, `/projects/{id}` | GET, POST, PATCH | filters: client_id, method, phase, status, archived |
| `/tasks`, `/tasks/{id}` | GET, POST, PATCH | filters: project_id, status |
| `/backlog`, `/backlog/{id}` | GET, POST, PATCH | BL rules apply (caps, sizes); filters: status, type, project_id, number |
| `/erp-links` | GET, POST, DELETE `?id=` | maps a CPMS record to its ERP id |

Lists: `?limit=` (default 50, max 200), `?offset=`, and `?updated_since=<ISO time>` for syncing. Responses: `{ "data": ..., "meta": { "total", "limit", "offset" } }`. Errors: `{ "error": { "code", "message", "details"? } }` with 401, 404, 422 (validation or backlog rule).

## ERP links

POST `/erp-links` `{ "entity_type": "project", "entity_id": "<cpms id>", "erp_id": "A-123", "erp_system": "erp" }`. One CPMS record keeps one ERP id per system; posting again replaces it. Look up by `?entity_type=&entity_id=` or by `?erp_id=`.

## Webhooks

Settings > Webhooks: an https address, optional event list (empty = all). Events: client.created/updated, project.created/updated, task.created/updated, backlog.created/moved. Delivery: POST JSON `{ event, workspace_id, sent_at, data }` with headers `x-cpms-event` and `x-cpms-signature: sha256=<hex HMAC-SHA256 of the raw body, using the webhook secret>`. Check the signature before trusting it. Timeout 5 s, no retries; recent deliveries are listed in Settings. Events sent from the API itself are also delivered.
