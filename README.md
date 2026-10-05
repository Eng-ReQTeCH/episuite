# Episuite

One personal productivity workspace, shared by your phone, laptop and PC through your home server. The current app lives in **episuite/**. Earlier versions in **EpiApps/**, **EpiAppsTest/** and **epiblock/** are retained as source references.

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

Open **http://YOUR-SERVER-IP:3210** from each device. No account creation is needed. Configuration overrides belong in **episuite/.env**; copy **episuite/.env.example** to that location if needed. The source tree contains no user workspace data. To move an existing workspace, export it from the old instance's Settings and import it into the new instance.

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

Docker exposes a single-owner app on your trusted home network. HTTPS is needed for full phone installation/offline caching; use an authenticated reverse proxy if accessing it outside that network. Docker execution has not been verified on this development machine because Docker is not installed.

## Develop and verify

Requires Node.js 22 or newer, with no package installation for the current app:

```sh
cd episuite
node server.mjs
node --test tests/domain.test.mjs tests/server.test.mjs tests/integrations.test.mjs tests/extra.test.mjs tests/onboarding.test.mjs tests/engagement.test.mjs tests/home-server.test.mjs
node scripts/check.mjs
```

Personal data, test output, local credentials/configuration, dependency folders and local agent files are ignored. Commit source changes and configuration examples only. The Git repository starts at this directory and is independent of any repository above it.
