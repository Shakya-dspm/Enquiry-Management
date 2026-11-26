# Enquiry Desk

This static frontend reads enquiry records, categories, and statuses from FreeProjectAPI's Enquiry API.

## Local development

Run `node server.js` and open <http://localhost:8080>. The server serves the static files and proxies `/api/Enquiry/*` requests to `https://api.freeprojectapi.com`, avoiding browser CORS checks during local development. It uses Node's built-in modules and requires no install step.

## Static hosting limitation

The provider's current `GET /api/Enquiry/get-enquiries` response does not include `Access-Control-Allow-Origin`. The API advertises allowed methods in preflight responses, but that alone does not permit browser reads. GitHub Pages cannot run this Node proxy, so a static deployment needs the provider to enable CORS or a separately hosted HTTPS proxy. The app uses the full provider URL on non-local hosts and shows the connection/CORS error if the browser blocks it.

## Endpoints used

- `GET /api/Enquiry/get-enquiries`
- `GET /api/Enquiry/get-enquiry/{id}`
- `GET /api/Enquiry/get-categories`
- `GET /api/Enquiry/get-statuses`
- Documented create, update, and delete enquiry/category/status endpoints for user-triggered actions.

List filtering and sorting happen in the browser because the catalogue documents `POST /filter-enquiries`, while the UI needs local text and multi-filter behavior. No writes are run as part of development checks.

Run mocked API checks with `node --test tests/api.test.cjs`.\n