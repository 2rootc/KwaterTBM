## Deploy Configuration (configured by /setup-deploy)
- Platform: Render (free tier)
- Production URL: set this after the first Render deploy
- Deploy workflow: auto-deploy on push to main (or manual from Render dashboard)
- Deploy status command: HTTP health check
- Merge method: manual
- Project type: web app
- Post-deploy health check: /healthz
- Keep-alive: UptimeRobot monitors /healthz every 5 minutes to prevent cold start

### Custom deploy hooks
- Pre-merge: python smoke_test.py
- Deploy trigger: Render Docker web service deploy
- Deploy status: poll production URL until /healthz returns 200
- Health check: /healthz

## gstack

- Install: `git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup`
- For all web browsing, use gstack's `/browse` skill. NEVER use `mcp__claude-in-chrome__*` tools.
- Available skills:
  - /office-hours
  - /plan-ceo-review
  - /plan-eng-review
  - /plan-design-review
  - /design-consultation
  - /design-shotgun
  - /review
  - /ship
  - /land-and-deploy
  - /canary
  - /benchmark
  - /browse
  - /connect-chrome
  - /qa
  - /qa-only
  - /design-review
  - /setup-browser-cookies
  - /setup-deploy
  - /retro
  - /investigate
  - /document-release
  - /codex
  - /cso
  - /autoplan
  - /careful
  - /freeze
  - /guard
  - /unfreeze
  - /gstack-upgrade

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
