# ZestBasket operations portal

The original project contained only the React/Vite starter. This implementation adds a responsive purple administration workspace and a role-restricted employee portal backed by a Node.js server and SQLite.

## Run locally

Requires Node.js 24 or later. Dependencies are already installed in this checkout.

```sh
npm install
npm run build
npm start
```

Open http://localhost:3001. On Windows PowerShell with script restrictions, use `npm.cmd` instead of `npm`.

The requested administrator account has been initialized. Its bootstrap configuration is in the ignored `.env` file. Passwords in SQLite are salted and hashed using scrypt; credentials are never bundled into the browser application. Bootstrap environment variables only apply when there is no administrator in the database.

For frontend development, run `npm run server` in one terminal and `npm run dev` in another. Vite proxies `/api` to the backend.

## Implemented workflows

- Unified login, HttpOnly sessions, logout, failed-login throttling, and server-side role checks. No public signup endpoint or signup screen.
- Admin-only employee account creation, employee list, enable/disable access, immediate session invalidation when access changes.
- Dashboard with database-derived metrics, revenue bars, order distribution, recent orders, activity and shortcuts.
- Order creation, editing and lifecycle status changes.
- Customer accounts are not created by administrators in this staff portal; administrators provision employees.
- Shop and rider records with approval/rejection workflow.
- Product inventory creation/editing, stock, pricing and availability.
- Settlement and refund records with status management. These record operational decisions and do not transfer funds.
- Sales analytics with date filtering and CSV export.
- Support tickets with editable details and resolution states.
- Administrator audit history and persisted platform preferences.
- Initial employee credentials shown to the administrator after account creation, with reveal/copy/dismiss controls. These credentials are held only in browser memory, not local storage.
- My account with read-only login email and password changes validated against the current password. Changing a password revokes other sessions. No email change API is provided.
- Low-stock cards (20 units or fewer), shopkeeper follow-up tasks, staff attribution, due dates and Open / Contacted / Restocked / Closed lifecycle. Follow-ups are internal records; no email, SMS or WhatsApp is sent.
- Rider selection, recorded coordinates, OpenStreetMap map, staff coordinate updates and 15-second location refresh. Example locations are labelled as demo; automatic GPS is not connected.
- Custom reusable shield/basket administration logo in `public/zestbasket-admin.svg`, with modern admin/employee branding.
- Search, status filters, empty states, loading/errors and mobile navigation.

Employees can manage orders, shops, riders, inventory, refunds and support and view delivery overview and reports. Customers, financial settlements, employee access, audit and settings require administrator access, enforced by the server independently of navigation.

## Data and integration boundaries

SQLite lives in ignored `data/zestbasket.sqlite`. Seed records are examples, labelled as a demo workspace. The map shows stored rider coordinates; initial positions are demo data and no automatic GPS provider is connected. Map tiles are loaded from OpenStreetMap. Bank payouts, payment processing, notifications, identity-document uploads and external customer/store applications are not integrated. Commission, delivery fee and maintenance preference are saved configuration; applying them to a customer checkout requires that checkout integration. Verification currently records approvals rather than checking external identity documents.

This is a local application, not a deployed multi-tenant service. Deployment needs persistent disk for SQLite, HTTPS, `COOKIE_SECURE=true`, a reverse proxy, backups and appropriate production configuration. The server binds to loopback by default.

## Verification

`npm run build` validates TypeScript and creates the production bundle. With the server running, `node server/smoke-test.mjs` checks authentication, employee provisioning, role restrictions, record validation, order update persistence, disabled-account session revocation and logout. This test uses temporary employee records in the local demo database. Browser visual QA was unavailable because the browser access host could not be reached.

`node server/workflow-test.mjs` additionally checks immutable emails, own-password changes, session revocation, customer-creation rejection, stock follow-up attribution and rider coordinate validation. Both tests require a running server and a local demo database; the workflow test cleans up its temporary records.
