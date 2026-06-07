# CodeMemory Web App

The current Next.js web application still lives at the repository root (`app/`, `components/`, `lib/`) to avoid a large routing and deployment move in the first monorepo step.

Target ownership:

- Cloud web dashboard
- Local web UI used by the desktop shell during the transition period
- Shared UI extraction candidates for `packages/ui`

Migration rule:

- Move files into `apps/web` only when the Next.js config, Dockerfile, deployment scripts, and import aliases are updated together.
- Until then, treat this folder as the monorepo boundary marker for the web app.
