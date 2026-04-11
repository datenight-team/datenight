#!/usr/bin/env bash
# resume.sh — Launch Claude Code for the Date Night project, ready to implement.
# Run this from any directory; it navigates to the project root automatically.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check claude CLI is available
if ! command -v claude &>/dev/null; then
  echo "Error: claude CLI not found."
  echo "Install it: curl -fsSL https://claude.ai/install.sh | bash"
  exit 1
fi

cd "$SCRIPT_DIR"

read -r -d '' PROMPT << 'EOF'
I'm resuming the Date Night project — a home-lab movie watchlist app for Ian and Krista.

Design and planning are complete. Implementation has not started. Please:

1. Read the implementation plan at docs/superpowers/plans/2026-04-10-datenight.md
2. Use the superpowers:subagent-driven-development skill to execute it task by task, starting at Task 1

The design spec is at docs/superpowers/specs/2026-04-10-datenight-design.md if you need context on decisions. UI mockups are in docs/mockups/.
EOF

echo "▶ Starting Claude Code for Date Night..."
echo "  Project: $SCRIPT_DIR"
echo ""

claude "$PROMPT"
