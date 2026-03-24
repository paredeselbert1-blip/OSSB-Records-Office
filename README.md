# Transmittal Monitoring System (Next.js)

A Next.js-based system to quickly check transmittal status/details across offices and agencies, with login and role permissions.

## Roles
- `admin`: full access (read/create/update)
- `encoder`: read/create/update, limited to assigned office for create/status update
- `viewer`: read-only

## Default Accounts
- `admin` / `admin123`
- `encoder1` / `encoder123`
- `viewer1` / `viewer123`

Stored in `src/data/users.json`.

## Run
1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

3. Open:

`http://localhost:3000`

## API
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/transmittals`
- `POST /api/transmittals`
- `GET /api/transmittals/:id`
- `PATCH /api/transmittals/:id/status`
