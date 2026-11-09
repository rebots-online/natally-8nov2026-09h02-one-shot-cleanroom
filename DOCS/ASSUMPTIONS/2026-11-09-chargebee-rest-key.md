# Assumption — Chargebee REST access (2026-11-09)

## Assumption

The billing server reaches Chargebee through the REST API with a Full-Access
API key for site `rochemedia`, read at runtime from `CHARGEBEE_API_KEY`. That key
is created on the dashboard page Settings → Configure Chargebee → API Keys and
Webhooks → API Keys, and replaces the current value. All other billing work
continues now on that basis: catalog setup and webhook registration run as soon
as the variable authenticates, and until then every billing call fails visibly
naming `CHARGEBEE_API_KEY`.

## What was tried (all on 2026-11-09)

| # | Attempt | Result |
| --- | --- | --- |
| 1 | KStore full revision history, every document, for any `CHARGEBEE_*`/`CB_*` key/secret/site setting | only `CHARGEBEE_SITE` entries written today; no earlier key existed |
| 2 | Operator key (`live_ai_…`, issued as "natally-dev-9nov2026") as Bearer on `rochemedia.mcp.chargebee.com/build_mcp_server` | accepted; tools/list returns the MCP Builder's 20 server-management tools |
| 3 | Same key on REST `rochemedia.chargebee.com/api/v2/item_families`, Basic auth (key as username) | 401 `api_authentication_invalid_key` |
| 4 | Same key on REST `rochemedia.chargebee.com/api/v2/item_families`, Bearer | 401 |
| 5 | Same key on REST `rochemedia-test.chargebee.com/api/v2/item_families`, Basic and Bearer | 401 / 401 |
| 6 | Created custom MCP server `natally_catalog` via the Builder; attached 32 tools (item family, item, item price, product operations, catalog lookup) | created and attached |
| 7 | `create_mcp_server_api_key` for `natally_catalog`, twice | the response carries only an 11-character masked `api_key`; the full secret is never returned by the API |
| 8 | The masked value as Bearer on `rochemedia.mcp.chargebee.com/natally_catalog` | 401 |
| 9 | The Builder key as Bearer on `natally_catalog` | 401 |
| 10 | The Builder's offered toolsets for any server | subscription, customer, product/item/price, coupon, entitlement — none creates hosted checkout pages or receives payment webhooks |
| 11 | Dashboard API Keys page opened in the controlled browser | Chargebee sign-in page; no session in that browser |

## Why this assumption

Checkout creation and payment webhooks — the two operations a purchase needs —
exist only on Chargebee's REST API (attempt 10). Every non-REST credential
available today is either scoped to the MCP Builder (attempts 2–5) or not
retrievable through the API (attempts 7–9). A Full-Access REST key is therefore
the one credential type that makes purchases possible, and the dashboard page
named above is where Chargebee issues it.
