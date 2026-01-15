# SvonyBrowser Versioning Strategy

## Overview

SvonyBrowser follows a controlled semantic versioning strategy with automatic version bumping on commits.

## Version Format

```
MAJOR.MINOR.PATCH
  │      │     └── Bug fixes, small changes (0-99)
  │      └──────── Feature additions (0-99)  
  └─────────────── Major releases (reserved milestones)
```

## Current Version Path

```
2.2.11 → 2.2.12 → ... → 2.2.99 → 2.3.0 → ... → 2.99.99 → 3.0.0
```

## Version Ranges

| Range          | Description                        | Auto-Bump     |
| -------------- | ---------------------------------- | ------------- |
| 2.2.x          | Current development (Fagan Audits) | ✅ Yes         |
| 2.3.x - 2.99.x | Feature development                | ✅ Yes         |
| 3.0.0          | **RESERVED** - Enterprise Release  | ❌ Manual only |

## Reserved Milestones

### Version 3.0.0 - Enterprise Grade Release
**Requirements:**
- ✅ 42 Fagan Inspection Audits completed
- ✅ All critical issues resolved
- ✅ Full test coverage (>80%)
- ✅ Security audit passed
- ✅ Performance benchmarks met
- ✅ Documentation complete

**This version CANNOT be reached via auto-bump.**

---

## Automatic Version Bumping

### How It Works

1. **On every push to main/master:**
   - GitHub Actions runs `auto-version.yml`
   - Reads current version from `package.json`
   - Increments patch version (2.2.11 → 2.2.12)
   - Commits updated `package.json`
   - Creates git tag `v2.2.12`

2. **When patch reaches 99:**
   - Auto-bumps minor version (2.2.99 → 2.3.0)
   - Resets patch to 0

3. **When minor reaches 99:**
   - **BLOCKS** further auto-bumps
   - Requires manual 3.0.0 release

### Workflow Files

| File                                 | Purpose                |
| ------------------------------------ | ---------------------- |
| `.github/workflows/auto-version.yml` | Auto-increment on push |
| `.github/workflows/release.yml`      | Build releases on tags |

---

## NPM Scripts

```bash
# Auto-increment (default)
npm run version:bump

# Specific bump types
npm run version:patch    # 2.2.11 → 2.2.12
npm run version:minor    # 2.2.x → 2.3.0

# Major release (3.0.0 only - requires approval)
npm run version:major-release

# Full release workflow
npm run release          # Bump + commit + push
npm run release:tag      # Create and push tag
```

---

## Manual Version Control

### Skip Auto-Bump
Add `[skip ci]` to commit message:
```bash
git commit -m "docs: update readme [skip ci]"
```

### Force Specific Version
Edit `package.json` directly, then:
```bash
git add package.json
git commit -m "chore: set version to 2.5.0 [skip ci]"
git tag -a v2.5.0 -m "Release 2.5.0"
git push && git push --tags
```

---

## Release Types

### Patch Release (2.2.x)
- Bug fixes
- Small improvements
- Documentation updates
- **Automatic on every push**

### Minor Release (2.x.0)
- New features
- UI improvements
- Service additions
- **Automatic when patch > 99**

### Major Release (x.0.0)
- Breaking changes
- Architecture overhauls
- Enterprise milestones
- **Manual approval required**

---

## Version History Tracking

### Commit Convention
```
type: description

Types:
- feat:     New feature
- fix:      Bug fix
- docs:     Documentation
- style:    Formatting
- refactor: Code restructuring
- test:     Adding tests
- chore:    Maintenance
```

### Tag Convention
```
v2.2.11     Standard release
v2.3.0-beta Pre-release
v3.0.0      Major milestone
```

---

## Roadmap to 3.0.0

```
Current: 2.2.11
         │
         ├── 2.2.x  (Bug fixes, audits)        ~50 versions
         │
         ├── 2.3.x  (Mirror Mode)              ~100 versions
         │
         ├── 2.4.x  (Account Tabs)             ~100 versions
         │
         ├── 2.5.x  (Agent Swarms)             ~100 versions
         │
         ├── 2.6.x  (MCP Consolidation)        ~100 versions
         │
         ├── 2.7.x  (Memory/RAG)               ~100 versions
         │
         ├── 2.8.x  (Auto-Setup)               ~100 versions
         │
         ├── 2.9.x  (Enterprise Features)      ~100 versions
         │
         └── 3.0.0  Enterprise Release
                    ✓ 42 Fagan Audits
                    ✓ Production Ready
```

---

## Troubleshooting

### Version Not Incrementing
1. Check if commit has `[skip ci]`
2. Verify GitHub Actions is enabled
3. Check workflow permissions

### Duplicate Tags
```bash
git tag -d v2.2.11
git push origin :refs/tags/v2.2.11
```

### Reset Version
```bash
npm run version:bump  # Will read current and increment
```

---

## Security

- Version 3.0.0 is protected by workflow guards
- Auto-bump cannot exceed 2.99.99
- Major releases require manual approval
- All releases are tagged and traceable
