## Deploy Configuration (configured for Render)
- Platform: Render
- Production URL: set this after the first Render deploy
- Deploy workflow: manual deploy from Render dashboard or auto-deploy after repository connect
- Deploy status command: HTTP health check
- Merge method: manual
- Project type: web app
- Post-deploy health check: /healthz

### Custom deploy hooks
- Pre-merge: python smoke_test.py
- Deploy trigger: Render Docker web service deploy
- Deploy status: poll production URL until /healthz returns 200
- Health check: /healthz
