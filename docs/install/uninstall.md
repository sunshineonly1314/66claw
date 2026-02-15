---
summary: "Uninstall OpenClawCN completely (CLI, service, state, workspace)"
read_when:
  - You want to remove OpenClawCN from a machine
  - The gateway service is still running after uninstall
---

# Uninstall

Two paths:
- **Easy path** if `openclawcn` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
openclawcn uninstall
```

Non-interactive (automation / npx):

```bash
openclawcn uninstall --all --yes --non-interactive
npx -y openclawcn uninstall --all --yes --non-interactive
```

Manual steps (same result):

1) Stop the gateway service:

```bash
openclawcn gateway stop
```

2) Uninstall the gateway service (launchd/systemd/schtasks):

```bash
openclawcn gateway uninstall
```

3) Delete state + config:

```bash
rm -rf "${OPENCLAWCN_STATE_DIR:-$HOME/.openclawcn}"
```

If you set `OPENCLAWCN_CONFIG_PATH` to a custom location outside the state dir, delete that file too.

4) Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/clawd
```

5) Remove the CLI install (pick the one you used):

```bash
npm rm -g openclawcn
pnpm remove -g openclawcn
bun remove -g openclawcn
```

6) If you installed the macOS app:

```bash
rm -rf /Applications/OpenClawCN.app
```

Notes:
- If you used profiles (`--profile` / `OPENCLAWCN_PROFILE`), repeat step 3 for each state dir (defaults are `~/.openclawcn-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `openclawcn` is missing.

### macOS (launchd)

Default label is `com.openclawcn.gateway` (or `com.openclawcn.<profile>`):

```bash
launchctl bootout gui/$UID/com.openclawcn.gateway
rm -f ~/Library/LaunchAgents/com.openclawcn.gateway.plist
```

If you used a profile, replace the label and plist name with `com.openclawcn.<profile>`.

### Linux (systemd user unit)

Default unit name is `openclawcn-gateway.service` (or `openclawcn-gateway-<profile>.service`):

```bash
systemctl --user disable --now openclawcn-gateway.service
rm -f ~/.config/systemd/user/openclawcn-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `OpenClawCN Gateway` (or `OpenClawCN Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "OpenClawCN Gateway"
Remove-Item -Force "$env:USERPROFILE\.openclawcn\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.openclawcn-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://openclawcn.com/install.sh` or `install.ps1`, the CLI was installed with `npm install -g openclawcn@latest`.
Remove it with `npm rm -g openclawcn` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `openclawcn ...` / `bun run openclawcn ...`):

1) Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2) Delete the repo directory.
3) Remove state + workspace as shown above.
