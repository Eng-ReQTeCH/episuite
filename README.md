# Episuite

One personal productivity workspace, shared by your phone, laptop and PC through your home server. The app lives in **episuite/**.

See [the app guide](episuite/README.md) for onboarding, functionality, backups and optional integrations.

## First deployment

Create an empty remote Git repository with your preferred host, then connect and push this local repository:

```sh
git remote add origin YOUR-REPOSITORY-URL
git push -u origin main
```

On the home server, with Git and Docker Compose installed:

```sh
git clone YOUR-REPOSITORY-URL episuite
cd episuite
docker compose -f episuite/docker-compose.yml up --build -d
docker compose -f episuite/docker-compose.yml ps
```

The container publishes on **127.0.0.1:3210** by default. On the server, use Tailscale Serve or an authenticated HTTPS reverse proxy to reach it from your devices. For intentional direct LAN access, copy **episuite/.env.example** to **episuite/.env** and set **EPISUITE_BIND_ADDRESS** to the host's LAN IP. Every client with direct access has owner access. To move a workspace, export it from Settings and import it into the new instance.

## Update the server

After committing and pushing changes from your development machine, export a backup in Settings, then run these commands in the server checkout:

```sh
git pull --ff-only
docker compose -f episuite/docker-compose.yml up --build -d
docker compose -f episuite/docker-compose.yml ps
```

The named Docker volume keeps your workspace across rebuilds. Keep the Compose project name **episuite** and the same deployment checkout. Avoid **docker compose down -v**, which deletes its data volume. Keep local server configuration in the ignored .env file so updates do not conflict with it. If pull reports local source changes, resolve them before rebuilding.

To inspect startup issues:

```sh
docker compose -f episuite/docker-compose.yml logs --tail=100 episuite
```

Docker runs a single-owner app. HTTPS enables phone installation and offline caching. The container runtime itself still needs verification on your server.

## Develop and verify

Requires Node.js 22 or newer. Install the locked dependencies once:

```sh
cd episuite
npm ci
npm start
```

Run **npm test** for all unit/integration tests and **npm run check** for source and asset checks. For the browser walkthrough, install Chromium with **npx playwright install chromium**, then run **npm run test:browser**. Set **EPISUITE_BROWSER** to an existing Chrome or Edge executable if preferred. **npm run verify** runs all three checks. **npm run profile** measures disposable small and multi-year workspaces.

Personal data, test output, local credentials/configuration, dependency folders and local agent files are ignored. Commit source changes and configuration examples only.
