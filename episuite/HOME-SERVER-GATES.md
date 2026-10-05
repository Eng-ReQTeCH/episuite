# Gates: one owner across devices

OWNS: public/**, server.mjs, Dockerfile, docker-compose.yml, .dockerignore, .gitignore, .env.example, tests/home-server.test.mjs, tests/engagement.test.mjs, HOME-SERVER-GATES.md, ENGAGEMENT-REVIEW.md, README.md

- [x] H1: Shared state, timer controls, stale edits, onboarding and daily rollover are safe across independent clients and restart.
  CHECK: node --test tests/home-server.test.mjs
  EXPECT: fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=18da50a89922aa7c0b8072ec0999ac6f46839c98b21f926c7593d693624aa410; exit=0; EXPECT=matched; output-sha256=5a179c9b89af58b3b09d4f3804f83f8bbd28a6c4496db99e01cf35740d5815be; output-bytes=1063; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=afa1ae4e2e19/33 entries
- [x] H2: All existing functionality remains intact and sources validate.
  CHECK: node --test tests/domain.test.mjs tests/server.test.mjs tests/integrations.test.mjs tests/extra.test.mjs tests/onboarding.test.mjs tests/engagement.test.mjs
  EXPECT: fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=e99f79ad005b3c408494a67ab7a2645dbaf5d8125c5ad1fc79abd1ee91f696d6; exit=0; EXPECT=matched; output-sha256=dac5c2718692068d77b9a34e1066e630e5362137349c23971153ba29777dccfb; output-bytes=3816; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=afa1ae4e2e19/33 entries
- [x] H3: Source checks pass.
  CHECK: node scripts/check.mjs
  EXPECT: Episuite source checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=b3e9d34cbf264bf8e7cd88cfa037843456f6b4f407c322e3d7e0848a0bc9c2b6; exit=0; EXPECT=matched; output-sha256=944d4bd8f2b775688f42b2a6d538ceae667429a2eb5d55f48cc3e3cc597b2244; output-bytes=30; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=afa1ae4e2e19/33 entries
- [x] H4: Docker configuration, launch instructions and persistent storage are reviewed; container execution is verified if the local Docker runtime is available, otherwise the exact limitation is recorded.
  EVIDENCE: Docker CLI and Docker Desktop executable are absent. Container execution remains unverified and is explicitly documented in README.md. Compose publishes the LAN port, keeps a named volume, runs as node, includes init/restart/health/graceful stop and optional reachable Ollama configuration. Native Node restart and multi-client persistence tests pass.
- [x] H5: Two browser clients and phone/desktop workflows verify visible onboarding, shared changes and the revised engagement loop. Continued judge iterations and a candid score are recorded.
  EVIDENCE: Independent 127.0.0.1 and localhost origins on isolated port 3212 shared onboarding, task edits and pause state. Stale laptop draft remained visible after phone save. Phone recharge screen, session handoff and installation help verified. Owner preview on port 3210 shows first-run welcome, zero test tasks; screenshot test-results/home-onboarding.png. ENGAGEMENT-REVIEW.md records passes 21 and 22, scores 9.6 and 9.7, weighted simulated result 9.725; real addictiveness unmeasured.
