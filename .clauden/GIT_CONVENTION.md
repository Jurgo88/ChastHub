# 🌿 Git & Branch Naming Convention

**Last updated:** 2026-05-08
**Status:** Active – follow for all commits

---

## 🌿 Branch Naming

```
{type}/task-{number}-{short-description}
```

### Types
| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code refactor (no new feature) |
| `chore` | Config, deps, tooling |
| `docs` | Documentation only |
| `test` | Tests only |

### Examples
```bash
feat/task-021-db-migration-v2
feat/task-022-backend-api-v2
feat/task-023-loqee-dashboard
feat/task-024-loqholder-dashboard
fix/task-016-timer-bubble-ui
chore/task-014-pwa-setup
```

---

## 📝 Commit Messages

```
{type}({scope}): {description} (refs #{issue})
```

### Scopes
| Scope | Files/area |
|-------|-----------|
| `db` | Supabase migrations |
| `api` | Server routes `/server/api/` |
| `auth` | Authentication |
| `loq` | Loq system logic |
| `chat` | Messaging |
| `ui` | Components, pages |
| `realtime` | Supabase Realtime |
| `payments` | Stripe |
| `pwa` | PWA config |
| `config` | nuxt.config, env |

### Keywords
| Keyword | Where | Effect |
|---------|-------|--------|
| `refs #10` | commit message | Links commit to issue, moves Trello → Doing |
| `Closes #10` | **PR body only** | Closes issue when PR is merged, moves Trello → Done |

> **Pravidlo:** `closes` sa NIKDY nepíše do commit message — len do PR body.
> Dôvod: PR môže mať viac commitov a `closes` v commite by issue zavrel predčasne
> (alebo pri rebase spôsobuje zmätok). Issue sa zatvára práve mergom PR.

### Examples
```bash
# Všetky commity používajú refs – aj ten posledný
git commit -m "feat(db): add loq_requests table (refs #21)"
git commit -m "feat(db): update loqs schema with loqee_id (refs #21)"
git commit -m "feat(db): add RLS policies for v2 (refs #21)"

# Bug fix
git commit -m "fix(ui): timer bubble border radius on mobile (refs #16)"

# Viac issues – refs v commite, Closes v PR body
git commit -m "feat(api): loq create + request endpoints (refs #21, refs #22)"
# PR body: "Closes #21\nCloses #22"
```

---

## 🔀 Pull Request

### Title format
```
{type}({scope}): {description}
```

### Body template
```markdown
## Summary
Brief description of what was implemented.

## Test plan
- [ ] Manual test: ...
- [ ] Edge case: ...

Closes #21
```

> `Closes #XX` ide na koniec PR body — tu GitHub zachytí keyword a zavrie issue pri merge.

### Examples
```
feat(db): V2 Database Migration – new loqs schema + loq_requests
feat(api): V2 Backend API Refactor
feat(ui): New Loqee Dashboard – single loq view + start CTA
fix(ui): Client Feedback HIGH – timer bubble + cookie banner
```

---

## 🚀 Workflow

```bash
# 1. Start new task – VŽDY z main
git checkout main && git pull
git checkout -b feat/task-021-db-migration-v2

# 2. Work + commit often – VŽDY refs, nikdy closes
git commit -m "feat(db): add loq_requests table (refs #21)"
git commit -m "feat(db): add RLS policies (refs #21)"

# 3. Push + open PR targeting main
git push -u origin feat/task-021-db-migration-v2
gh pr create --base main --title "feat(db): V2 Database Migration" \
  --body "## Summary\n...\n\nCloses #21"

# 4. Merge → GitHub closes issue, auto-syncs Trello
gh pr merge --merge --delete-branch
```

### Závislé tasky (dependent tasks)

Ak task B závisí od tasku A, stále **obe vetvy ciel na `main`**.
Mergni A ako prvý, potom B — nie B → A → main (stacked PRs).

```bash
# SPRÁVNE
feat/task-A  →  main   (merge first)
feat/task-B  →  main   (merge after A)

# NESPRÁVNE – stacked PRs spôsobujú auto-zatvorenie PR po merge base vetvy
feat/task-B  →  feat/task-A  →  main
```

> **Prečo:** GitHub automaticky zatvorí PR, keď sa zmaže jeho base branch
> (čo sa stane pri merge stacked PR). Výsledok: stratený PR, treba vytvárať znovu.

---

## ⚠️ Rules

- **Never commit directly to `main`**
- **`refs #XX` in every commit** — vždy, vrátane posledného commitu
- **`Closes #XX` iba v PR body** — nikdy v commit message
- **One task = one branch = one PR** (except tiny fixes)
- **Vždy branchovať z `main`** — nikdy z inej feature vetvy
- **Delete branch after merge**
- **Spusti `test-api.sh` pred každým PR** — pridaj testy pre novú funkcionalitu
