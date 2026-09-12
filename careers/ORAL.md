# careers-loop (ORAL)

Careers is a **mission type**, not a second commander.

- Operator: ORAL (`agent-alfred`)
- Memory: CF Agent Memory `hermes` / `careers` via Worker HTTP (not cf-memory MCP)
- Trust: D1 packets + optional CF Artifacts snapshot on approve (`src/artifacts.ts`)
- Report: `GET /api/stats` → `brief` string for Alfred

Example brief:

`careers-loop: 20 hot, 4 need captcha/help, 2 interviews, 3 applied. Board careers.hansakoch.com/apply`

Set `ORAL_URL` + `ORAL_TOKEN` on the Worker to POST that brief after digest/search.

Do not install Farmer/Distiller/Curator agents for this loop.
