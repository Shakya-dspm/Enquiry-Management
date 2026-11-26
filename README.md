# Enquiry Desk

This static frontend reads enquiry records, categories, and statuses from FreeProjectAPI's Enquiry API.

## Local development

Run `node server.js` and open <http://localhost:8080>. The server serves the static files and proxies `/api/Enquiry/*` requests to `https://api.freeprojectapi.com`, avoiding browser CORS checks during local development. It uses Node's built-in modules and requires no install step.

## GitHub Pages deployment

The app calls `https://api.freeprojectapi.com/api/Enquiry` directly when hosted outside local development. The API currently allows cross-origin browser requests, so the static site can load and write data from GitHub Pages without a Node server. If requests fail, check the browser console for the provider's response and confirm the API is available. A CORS error means the API provider has changed its cross-origin policy; GitHub Pages itself cannot proxy API requests.

## Endpoints used

- `GET /api/Enquiry/get-enquiries`
- `GET /api/Enquiry/get-enquiry/{id}`
- `GET /api/Enquiry/get-categories`
- `GET /api/Enquiry/get-statuses`
- Documented create, update, and delete enquiry/category/status endpoints for user-triggered actions.

List filtering and sorting happen in the browser because the catalogue documents `POST /filter-enquiries`, while the UI needs local text and multi-filter behavior. No writes are run as part of development checks.

Run mocked API checks with `node --test tests/api.test.cjs`.\n
