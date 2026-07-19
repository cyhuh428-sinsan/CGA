# Login Hydration Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent native `/login?` form submission before React hydration while preserving the existing login flow.

**Architecture:** Add a client hydration state to the existing login page. Server-render the submit button as disabled with a preparation label, then enable the existing submit path in `useEffect` without changing API, session, proxy, or routing code.

**Tech Stack:** Next.js, React, TypeScript, PowerShell

## Global Constraints

- Modify only `apps/web/app/login/page.tsx`.
- Keep the 5173 proxy, 8321 API, database, session payload, and post-login path unchanged.

---

### Task 1: Guard login submission until hydration

**Files:**
- Modify: `apps/web/app/login/page.tsx`
- Test: source assertions, server-rendered login HTML, and the 5173 login proxy

**Interfaces:**
- Consumes: React `useState` and `useEffect`
- Produces: `isHydrated: boolean` controlling the existing submit button

- [ ] **Step 1: Run the failing source assertion**

```powershell
$source = Get-Content -LiteralPath .\apps\web\app\login\page.tsx -Raw
if ($source -notmatch 'isHydrated') { throw 'Expected login hydration guard.' }
```

Expected: FAIL with `Expected login hydration guard.`

- [ ] **Step 2: Apply the minimal guard**

```tsx
const [isHydrated, setIsHydrated] = useState(false);
// At the end of the existing useEffect:
setIsHydrated(true);
// Submit button:
disabled={isSubmitting || !isHydrated}
{!isHydrated ? "화면 준비 중..." : isSubmitting ? "로그인 중..." : "로그인"}
```

- [ ] **Step 3: Re-run the source assertion**

Expected: PASS with exit code 0.

- [ ] **Step 4: Verify server HTML and login proxy**

```powershell
Invoke-WebRequest http://127.0.0.1:5173/login
Invoke-RestMethod http://127.0.0.1:5173/api/v1/auth/login -Method Post
```

Expected: initial HTML contains a disabled preparation button; proxy returns `master` and an access token.
