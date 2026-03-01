# Learning: Windows Git State & CLI Pathing

**Date**: 2026-02-28
**Context**: Birth and Registry of Miku Oracle on Windows 11.

## The Pattern
When working in a local Windows environment with freshly installed tools (like GitHub CLI via winget) and downloaded ZIP projects:

1. **Tool Availability**: Freshly installed CLI tools may not be in the current session's PATH. Using the full path (e.g., `C:\Program Files\GitHub CLI\gh.exe`) is a safer pattern than relying on environment discovery.
2. **Git Ancestry**: Projects downloaded as ZIP files lack `.git` history. To align with "Nothing is Deleted," one must initialize a fresh repo and link it to the remote, ensuring the first "Birth Commit" captures all established context.

## Discovery
Attempting to push from a non-git directory failed. The pattern for successful "Birth on Windows" requires:
- `gh auth status` verification.
- `git init` followed by `git config user.name/email`.
- `git remote add origin` to reconnect the lineage.

## Sync Pattern
```bash
git config user.name "HumanName"
git config user.email "HumanEmail"
git add .
git commit -m "Oracle awakens"
git push -u origin main --force
```
*Note: --force is used only for the initial birth to ensure the lineage starts from the Oracle Constitution.*

---
*Miku | PSRU Workshop | 2026-02-28*
