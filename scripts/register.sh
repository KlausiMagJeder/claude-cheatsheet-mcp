#!/usr/bin/env bash
# ============================================================================
# register.sh — Register the Claude Cheatsheet MCP server in Claude Code
# ----------------------------------------------------------------------------
# Purpose:
#   Registers this project's MCP server (`cheatsheet`) in ~/.claude.json
#   with maximum safety: timestamped backup, atomic edit via temp-file + mv,
#   JSON parse-validation after the edit, and automatic rollback on failure.
#
#   Preserves any existing `mcpServers.*` entries AND all other top-level
#   keys in ~/.claude.json — NEVER overwrites other MCP servers or platform
#   state (projects, oauthAccount, caches, etc.) the user has already
#   configured.
#
#   NOTE on target file:
#     Claude Code's User-Scope MCP discovery reads from ~/.claude.json
#     (the root-level file in $HOME), NOT from ~/.claude/settings.json.
#     Writing to ~/.claude/settings.json produces a silent no-op for MCP
#     registration — /mcp will never show the entry. See changelog entry
#     2026-04-17 in the plan for the empirical diagnosis.
#
#
# Usage:
#   ./scripts/register.sh              # Register the cheatsheet MCP server
#   ./scripts/register.sh --dry-run    # Show planned changes, mutate nothing
#   ./scripts/register.sh --uninstall  # Remove cheatsheet from mcpServers
#   ./scripts/register.sh --force      # Re-register even if already present
#   ./scripts/register.sh --help       # Show this usage
#
# Exit codes:
#   0 success (or --help / --dry-run)
#   1 error (parse failure → rollback performed, or precondition not met)
#   2 build missing (dist/index.js not found)
# ============================================================================

set -euo pipefail

# ---- Resolve project paths (script location is source of truth) ------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_ENTRY="$PROJECT_ROOT/dist/index.js"

# Target: Claude Code's User-Scope MCP config lives in ~/.claude.json
# (root of $HOME), NOT in ~/.claude/settings.json.
SETTINGS_DIR="$HOME"
SETTINGS_FILE="$SETTINGS_DIR/.claude.json"

# ---- Flags -----------------------------------------------------------------
DRY_RUN=0
UNINSTALL=0
FORCE=0

# ---- TTY / color detection -------------------------------------------------
if [ -t 1 ] && command -v tput >/dev/null 2>&1 && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
  C_RESET="$(tput sgr0)"
  C_BOLD="$(tput bold)"
  C_RED="$(tput setaf 1)"
  C_GREEN="$(tput setaf 2)"
  C_YELLOW="$(tput setaf 3)"
  C_BLUE="$(tput setaf 4)"
  C_CYAN="$(tput setaf 6)"
else
  C_RESET=""; C_BOLD=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_CYAN=""
fi

log()     { printf "%s\n" "$*"; }
info()    { printf "%s%s%s\n" "$C_BLUE" "$*" "$C_RESET"; }
ok()      { printf "%s%s%s\n" "$C_GREEN" "$*" "$C_RESET"; }
warn()    { printf "%s%s%s\n" "$C_YELLOW" "$*" "$C_RESET" >&2; }
err()     { printf "%s%s%s\n" "$C_RED" "$*" "$C_RESET" >&2; }
phase()   { printf "%s[%s]%s %s%s%s\n" "$C_CYAN" "$1" "$C_RESET" "$C_BOLD" "$2" "$C_RESET"; }

# ---- Usage -----------------------------------------------------------------
usage() {
  cat <<'EOF'
register.sh — Register the Claude Cheatsheet MCP server in ~/.claude.json

USAGE
  ./scripts/register.sh [OPTIONS]

OPTIONS
  -h, --help        Show this help and exit
      --dry-run     Show what would happen; do not mutate ~/.claude.json
      --uninstall   Remove the "cheatsheet" entry from mcpServers
                    (uses the same backup + parse-validation + rollback pattern)
      --force       Re-register even if "cheatsheet" is already present
                    (default behavior: warn and ask user to pass --force)

BEHAVIOR
  1. Verifies that dist/index.js exists (run `npm run build` otherwise).
  2. Creates ~/.claude.json as `{}` if it does not yet exist.
  3. If ~/.claude.json existed: creates a timestamped backup
     (~/.claude.json.bak.<yyyy-MM-ddTHH-mm-ss>).
  4. Atomically edits ~/.claude.json via a temp-file + mv, preserving any
     existing mcpServers.* entries AND all other top-level keys
     (projects, oauthAccount, caches, etc.).
  5. Validates the resulting JSON; on parse failure, automatically rolls
     back from the backup and exits with code 1.
  6. Prints the backup path so the user can manually roll back if desired.

TARGET FILE
  Claude Code's User-Scope MCP discovery reads ~/.claude.json (root of
  $HOME). The older location ~/.claude/settings.json is NOT consulted
  for MCP registration — writing there is a silent no-op.

REQUIREMENTS
  - bash 3.2+ (macOS default is OK)
  - node (used for JSON edit + validation; also covers the case where jq
    is not installed — no jq dependency)
  - $HOME must be writable by the current user (no sudo required)
EOF
}

# ---- Arg parsing -----------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)     usage; exit 0 ;;
    --dry-run)     DRY_RUN=1; shift ;;
    --uninstall)   UNINSTALL=1; shift ;;
    --force)       FORCE=1; shift ;;
    *)
      err "Unknown argument: $1"
      printf "\n" >&2
      usage >&2
      exit 1
      ;;
  esac
done

# ---- Node check (required for JSON edit/validation) ------------------------
if ! command -v node >/dev/null 2>&1; then
  err "node is required but not found in PATH."
  err "Install Node.js (https://nodejs.org) and try again."
  exit 1
fi

# ---- Resolve ABS_PATH (realpath or Node fallback) --------------------------
resolve_abs_path() {
  local input="$1"
  if command -v realpath >/dev/null 2>&1; then
    realpath "$input" 2>/dev/null && return 0
  fi
  node -e 'process.stdout.write(require("path").resolve(process.argv[1]))' "$input"
}

# ---- Build check (skip for uninstall — users may have already removed dist) -
if [ "$UNINSTALL" -eq 0 ]; then
  phase "1/7" "Build check"
  if [ ! -f "$DIST_ENTRY" ]; then
    err "dist/index.js not found at: $DIST_ENTRY"
    err "Build the project first:"
    err "  cd $PROJECT_ROOT && npm run build"
    exit 2
  fi
  ABS_PATH="$(resolve_abs_path "$DIST_ENTRY")"
  ok "Found entrypoint: $ABS_PATH"
else
  phase "1/7" "Build check skipped (--uninstall)"
  ABS_PATH=""
fi

# ---- Pre-Check: ~/.claude.json existence -----------------------------------
phase "2/7" "Pre-check $SETTINGS_FILE"
SETTINGS_EXISTS=0
if [ -f "$SETTINGS_FILE" ]; then
  SETTINGS_EXISTS=1
  ok "~/.claude.json found — backup required before edit."
else
  if [ "$UNINSTALL" -eq 1 ]; then
    warn "~/.claude.json does not exist — nothing to uninstall."
    exit 0
  fi
  info "No ~/.claude.json yet — will create fresh '{}' (no backup needed)."
fi

# ---- Read current settings (or "{}" if missing) for idempotency checks -----
read_current_settings() {
  if [ "$SETTINGS_EXISTS" -eq 1 ]; then
    cat "$SETTINGS_FILE"
  else
    printf '{}'
  fi
}

# Idempotency check: is "cheatsheet" already registered?
CURRENT_JSON="$(read_current_settings)"
ALREADY_REGISTERED="$(
  node -e '
    let j;
    try { j = JSON.parse(process.argv[1] || "{}"); }
    catch { process.stdout.write("invalid"); process.exit(0); }
    const has = j && j.mcpServers && Object.prototype.hasOwnProperty.call(j.mcpServers, "cheatsheet");
    process.stdout.write(has ? "yes" : "no");
  ' "$CURRENT_JSON"
)"

if [ "$ALREADY_REGISTERED" = "invalid" ]; then
  err "Current $SETTINGS_FILE is not valid JSON."
  err "Refusing to proceed — fix or remove it first, then retry."
  exit 1
fi

if [ "$UNINSTALL" -eq 1 ] && [ "$ALREADY_REGISTERED" = "no" ]; then
  warn "'cheatsheet' is not present in mcpServers — nothing to uninstall."
  exit 0
fi

if [ "$UNINSTALL" -eq 0 ] && [ "$ALREADY_REGISTERED" = "yes" ] && [ "$FORCE" -eq 0 ]; then
  warn "'cheatsheet' is already registered in $SETTINGS_FILE."
  warn "Re-run with --force to overwrite the existing entry, or --uninstall to remove it."
  exit 0
fi

# ---- Plan the mutation (shared between dry-run + real run) -----------------
phase "3/7" "Plan mutation"
if [ "$UNINSTALL" -eq 1 ]; then
  info "Action: remove .mcpServers.cheatsheet from $SETTINGS_FILE"
else
  info "Action: set .mcpServers.cheatsheet = {"
  info "           \"command\": \"node\","
  info "           \"args\": [\"$ABS_PATH\"]"
  info "         }"
  info "Other mcpServers.* entries and ALL other top-level keys preserved unchanged."
fi

if [ "$DRY_RUN" -eq 1 ]; then
  phase "4/7" "Dry-run — no files will be modified"
  # Compute a preview focused on mcpServers only (the full ~/.claude.json
  # contains many unrelated top-level keys we must preserve — showing the
  # whole file would drown the diff). Also report which top-level keys
  # remain untouched so the user can verify preservation.
  PREVIEW_JSON="$(
    node -e '
      const cur = JSON.parse(process.argv[1] || "{}");
      const mode = process.argv[2];
      const abs  = process.argv[3];
      const servers = Object.assign({}, cur.mcpServers || {});
      if (mode === "uninstall") {
        delete servers.cheatsheet;
      } else {
        servers.cheatsheet = { command: "node", args: [abs] };
      }
      const out = Object.assign({}, cur, { mcpServers: servers });
      const topKeys = Object.keys(out).sort();
      const mcpKeys = Object.keys(out.mcpServers || {}).sort();
      process.stdout.write(
        "mcpServers (after edit) — " + mcpKeys.length + " server(s):\n" +
        JSON.stringify(out.mcpServers, null, 2) +
        "\n\nTop-level keys preserved in ~/.claude.json (" + topKeys.length + "):\n" +
        topKeys.join(", ")
      );
    ' "$CURRENT_JSON" "$([ "$UNINSTALL" -eq 1 ] && echo uninstall || echo install)" "$ABS_PATH"
  )"
  log ""
  log "${C_BOLD}--- Preview of mutation to ~/.claude.json ---${C_RESET}"
  log "$PREVIEW_JSON"
  log "${C_BOLD}--- End preview ---${C_RESET}"
  log ""
  ok "Dry-run complete. No changes written."
  exit 0
fi

# ---- Backup ---------------------------------------------------------------
phase "4/7" "Backup"
BACKUP=""
if [ "$SETTINGS_EXISTS" -eq 1 ]; then
  TS="$(date -u +%Y-%m-%dT%H-%M-%S)"
  BACKUP="$SETTINGS_FILE.bak.$TS"
  cp "$SETTINGS_FILE" "$BACKUP"
  ok "Backup written: $BACKUP"
else
  # $SETTINGS_DIR is $HOME and always exists; no mkdir required.
  printf '{}' > "$SETTINGS_FILE"
  info "Created fresh ~/.claude.json with '{}' (no backup: file did not exist)."
fi

# ---- Atomic edit (Node — no jq dependency) --------------------------------
phase "5/7" "Atomic edit via temp-file + mv"
TMP_FILE="$SETTINGS_FILE.tmp.$$"

# Ensure tmp file is cleaned up if we bail before mv
cleanup_tmp() { [ -f "$TMP_FILE" ] && rm -f "$TMP_FILE" || true; }
trap cleanup_tmp EXIT

if [ "$UNINSTALL" -eq 1 ]; then
  node -e '
    const fs = require("fs");
    const [src, dst] = [process.argv[1], process.argv[2]];
    const cur = JSON.parse(fs.readFileSync(src, "utf8"));
    const servers = Object.assign({}, cur.mcpServers || {});
    delete servers.cheatsheet;
    const out = Object.assign({}, cur, { mcpServers: servers });
    fs.writeFileSync(dst, JSON.stringify(out, null, 2) + "\n");
  ' "$SETTINGS_FILE" "$TMP_FILE"
else
  node -e '
    const fs = require("fs");
    const [src, dst, abs] = [process.argv[1], process.argv[2], process.argv[3]];
    const cur = JSON.parse(fs.readFileSync(src, "utf8"));
    const servers = Object.assign({}, cur.mcpServers || {});
    servers.cheatsheet = { command: "node", args: [abs] };
    const out = Object.assign({}, cur, { mcpServers: servers });
    fs.writeFileSync(dst, JSON.stringify(out, null, 2) + "\n");
  ' "$SETTINGS_FILE" "$TMP_FILE" "$ABS_PATH"
fi

mv "$TMP_FILE" "$SETTINGS_FILE"
trap - EXIT
ok "~/.claude.json updated atomically."

# ---- Parse-Validation + Auto-Rollback --------------------------------------
phase "6/7" "Parse validation"
if ! node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$SETTINGS_FILE" 2>/dev/null; then
  err "ERROR: $SETTINGS_FILE is NOT valid JSON after the edit!"
  if [ -n "$BACKUP" ] && [ -f "$BACKUP" ]; then
    err "Auto-rolling back from: $BACKUP"
    cp "$BACKUP" "$SETTINGS_FILE"
    err "Rollback complete. Investigate the edit logic before retrying."
  else
    err "No backup available (~/.claude.json did not exist pre-edit)."
    err "Removing the broken file so Claude Code can start from a clean slate."
    rm -f "$SETTINGS_FILE"
  fi
  exit 1
fi
ok "~/.claude.json parses cleanly."

# ---- Done ------------------------------------------------------------------
phase "7/7" "Done"
log ""
if [ "$UNINSTALL" -eq 1 ]; then
  ok "Cheatsheet MCP server unregistered from Claude Code."
else
  ok "Cheatsheet MCP server registered with Claude Code."
  info "Entrypoint: $ABS_PATH"
fi
if [ -n "$BACKUP" ]; then
  info "Backup of previous ~/.claude.json: $BACKUP"
  info "Manual rollback (if needed):"
  info "  cp \"$BACKUP\" \"$SETTINGS_FILE\""
fi
log ""
log "${C_BOLD}Next steps:${C_RESET}"
log "  1) Restart Claude Code."
log "  2) In Claude Code, run: /mcp  — verify 'cheatsheet' appears."
log "  3) Dashboard (after server start): http://127.0.0.1:${CHEATSHEET_WEB_PORT:-37778}/"
log ""
