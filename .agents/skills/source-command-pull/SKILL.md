---
name: "source-command-pull"
description: "Pull from remote and show what changed"
---

# source-command-pull

Use this skill when the user asks to run the migrated source command `pull`.

## Command Template

Run `git pull` and summarize the changes:

1. Run `git pull`
2. If already up to date, say so briefly
3. If there were changes, show:
   - Files changed (added / modified / deleted)
   - Brief summary of what each changed file does
