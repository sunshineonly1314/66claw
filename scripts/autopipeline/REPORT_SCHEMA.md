# Upstream Analysis Report Schema

Every upstream sync generates a persistent analysis report in this directory.

## File naming

```
YYYY-MM-DD.md           # Daily report (auto-generated)
YYYY-MM-DD-HHMMSS.md    # If multiple syncs in one day
```

## Report sections

### 1. Summary
| Field | Description |
|-------|-------------|
| Date | Sync date |
| Upstream commits | Number of new commits since last merge-base |
| Files changed | Total files modified upstream |
| Risk level | `low` / `medium` / `high` / `critical` |
| Section II affected | Count of Section II files changed by upstream |
| Recommendation | `auto-merge` / `agent-resolve` / `manual-review` |

### 2. Commit Analysis
For each upstream commit:
- **Hash** (short)
- **Author**
- **Message**
- **Category**: `feature` / `bugfix` / `refactor` / `docs` / `deps` / `ci` / `chore`
- **CN Impact**: `none` / `low` / `medium` / `high`
- **Files touched** (count)
- **Summary** (1-2 sentences explaining what this commit does)

### 3. CN Impact Assessment

#### Section I (auto-protected)
- Files upstream changed that are protected by `merge=ours`
- Expected behavior: CN version preserved automatically

#### Section II (needs attention)
For each affected Section II file:
- **File path**
- **Upstream change summary**
- **CN injection affected?** (yes/no)
- **CN marker present?** (yes/no)
- **Risk**: `safe` / `review` / `dangerous`
- **Detailed diff analysis** (what upstream changed, does it conflict with CN code)

### 4. Breaking Change Detection
- API signature changes (function params added/removed/changed)
- Type definition changes (interface/type modifications)
- Config format changes (new required fields, removed fields)
- Dependency version bumps (major/minor/patch)
- Export changes (removed exports, renamed exports)

### 5. Brand Consistency
- Files with `OpenClaw` that will need `OpenClawCN` rename
- New files added by upstream that need brand treatment
- Brand patterns found in new code

### 6. Dependency Changes
- New dependencies added
- Dependencies removed
- Version bumps (with semver classification)
- Lock file changes

### 7. Action Items
Prioritized list of actions:
- `AUTO`: Can be handled automatically (merge=ours, brand rename)
- `AGENT`: AI agent can resolve with markers
- `HUMAN`: Requires human review
- Each item includes file path, reason, and suggested resolution

## Risk level calculation

```
critical  = upstream restructured directories OR major dep version change
high      = models-config.providers.ts changed OR >5 Section II files
medium    = 1-5 Section II files changed (with markers)
low       = 0 Section II files changed
```
