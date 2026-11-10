# ACPM Flight Schedule: Evaluation and Plan

_Evaluated at commit `9b5de75` (2026-11-09). Live at https://gdruumond.github.io/ACPM/_

## 1. What the app is today

A single file, `index.html`, of about 3,200 lines (125 KB). It holds the CSS, the markup and around 2,300 lines of vanilla JavaScript. It has no build step, no dependencies besides jsPDF (from cdnjs) and Google Fonts, and no tests. GitHub Pages serves the file as it is.

The app plans **tomorrow's flight schedule** for the ACPM flight school (CIAC). It has six tabs:

| Tab | What it does |
|---|---|
| 1 · Recursos | Turns the 9 daily time slots (06:30 to 17:30, night slot) on or off, and the fleet (13 × C152, 6 × C172, 3 × PA-34, 4 simulators). This is how an aircraft is marked as in maintenance. |
| 2 · Instrutores | The 40 instructors: active flag, level A01–A09, weight, availability per slot. |
| 3 · Alunos | Students: name, weight, and instructors they must not be paired with. |
| 4 · Demanda | Each student's requests for the day. A student can have several missions (Ground + flight + night), each with a mission type, aircraft, 2 preferred slots, hours, sessions and priority. |
| 5 · Escala | Generated schedule: an official table, a timeline by aircraft or by instructor, a status per flight (Confirmado / Em Voo / Pendente / Cancelado), the day's change log with revert, and CSV and PDF export. |
| 6 · BI | Utilisation dashboard built from saved past days, with a "simulate 30 days" button, and the user manual. |

### Key functionality worth protecting

- **`runAllocationEngine(state)`** (around line 1498, 380 lines). This is the core of the app: a deterministic greedy scheduler. It already enforces:
  - Ground School before flight: a 90-minute class shared by several students with one instructor. A student's Ground is scheduled before that student's flight on the same subject.
  - The cumulative instructor level matrix (A01–A09) per mission and per aircraft, choosing the **lowest qualified level** so senior instructors stay free.
  - Crew weight limits: C152 170 kg, C172 222 kg, PA-34 250 kg.
  - The PR-JPL acrobatic aircraft is used only for Parafuso (spin) missions, by A06+ instructors.
  - Student/instructor block lists, instructor slot availability, no double-booking of a student, and priority ordering.

  It is a **pure function of `state`**, which makes it easy to extract and test. That is the most important property to keep.
- **Operador / Gestor roles.** Gestor is read-only. A "share" link puts the whole day's state into the URL as base64 and opens it locked in Gestor mode.
- **Undo** (30 steps) and an **audit log** with per-entry revert.
- **The `ApiClient` object** is already an async storage layer. Its `REMOTE_ENDPOINT` hook does `GET`/`PUT /state`. The author planned for a backend, and this is the point where one can be plugged in.

## 2. Problems found

### Data and storage (the main issue)
1. **All data lives in one browser's `localStorage`** under these keys: `acpm3` (state), `acpm3_res` (last result), `acpm3_audit`, `acpm3_bi`, `acpm3_theme`. Because of that:
   - Two operators on two machines see two **different** rosters and schedules.
   - Clearing the browser or switching computers loses everything, including BI history.
   - The share link is the only way to hand off data. It is a snapshot, so it goes stale as soon as the operator changes anything.
2. **Only one "current day" exists.** Changing the date does not load that date's schedule; the result is simply overwritten. BI history keeps copies per date, but they cannot be edited.
3. **No concurrency model.** `saveState` writes the whole state blob. With a remote backend added naively, the last writer wins and silently overwrites a colleague's changes.
4. **BI history grows without limit** in `localStorage`, which caps at about 5 MB per origin.

### Security and privacy
5. **Personal data is in a public repository.** The full names and body weights of all 40 instructors are hardcoded in `INS_DATA`, and the repo is public on GitHub. Weight counts as personal data under the LGPD, so this should be moved out of the source and out of the git history.
6. **The Gestor lock works only in the browser.** Removing `?share=` from the URL gives full Operador mode. That is harmless today because every browser has its own data. **Once storage is shared, it becomes real write access for anyone with the URL.** A shared backend therefore requires authentication.
7. **The share link carries student names and weights** in a readable base64 query string. That data ends up in chat apps and browser history.

### Code health
8. **Instructor levels are placeholders.** Fresh state assigns `lv: (i % 9) + 1`, so instructor levels cycle by alphabetical order. The real levels exist only in someone's `localStorage`.
9. **The whole file is uploaded through the GitHub web UI.** Commit `9b5de75` rewrote all 3,236 lines because of a line-ending change (CRLF to LF), so `git diff` and `git blame` are useless across it.
10. **Business rules are spread across separate constants:** `MIS`, `EQ`, `EQ_MIN_LV`, `DEFAULT_LIM`, the fleet registrations and `INS_DATA`. Changing the fleet or a rule means editing code.
11. **No tests for the scheduler,** even though it is pure and fully deterministic.
12. Leftover code from being generated as a Claude artifact (the `window.claude` downloads path in `sv()`). It is harmless and can be removed.

## 3. Storage options

The data is small and document-shaped: one roster (about 50 KB), one schedule per date, the audit entries and BI history. Writes come from 1 to 3 operators and reads from a few managers. The requirements in order of importance:

1. One shared source of truth.
2. Real authentication, so Operador and Gestor are enforced on the server.
3. History per date.
4. Free or near free.
5. Stays compatible with GitHub Pages.

| Option | Fit | Effort | Auth | Cost | Notes |
|---|---|---|---|---|---|
| **Supabase** (Postgres + Auth + row-level security, used as JSON documents first) | ★★★★★ | Medium | Built in (email magic link / Google) | Free tier | Can start as "documents in a table" (`jsonb`) so the data model barely changes, then normalise later. Realtime updates are possible. Calls go straight from GitHub Pages, with no server to run. |
| **Google Sheets + Apps Script** web app | ★★★★ | Low–Medium | Google accounts | Free | Staff can edit the roster and fleet in a spreadsheet they already know. Slow (1–3 s per call), weak concurrency, and Apps Script quotas apply. Fits well if the school already runs on Google Workspace. |
| **Cloudflare Worker + KV or D1** | ★★★★ | Medium | DIY or Cloudflare Access | Free tier | Matches the existing `REMOTE_ENDPOINT` `GET`/`PUT /state` contract almost exactly. Auth, ETags and backups would have to be built. |
| **JSON files in a GitHub repo** via the GitHub API | ★★ | Low | GitHub tokens per user | Free | Version history comes for free. However, each operator needs a GitHub account and token, commits per change are clumsy, and **a public repo means public data.** |
| Firebase Firestore | ★★★★ | Medium | Built in | Free tier | Comparable to Supabase. Supabase wins on SQL for BI queries and on data portability. |

**Recommendation: Supabase**, used in stages:
- **Start document-style:** a `docs` table with columns `key`, `jsonb`, `version` and `updated_by`. This keeps the existing `ApiClient` shape and the "not necessarily a database" spirit.
- **Normalise later**, once the shape stabilises: `instructors`, `students`, `fleet`, `demands`, `schedules(date)`, `flights`, `audit`. That turns BI into plain SQL instead of re-parsing JSON blobs.

**Fallback:** choose Google Sheets if the people who maintain the roster are not technical and need to edit it in a spreadsheet.

## 4. Plan

### Phase 0: Make the repo workable (about 1 day, no behaviour change)
- [ ] Agree on a workflow: commits from git with `.gitattributes` (`* text=auto eol=lf`) and branches + PRs, instead of uploading through the web UI.
- [ ] Split `index.html` into `index.html`, `css/app.css` and ES modules: `js/config.js`, `js/engine.js`, `js/storage.js`, `js/views/*.js`, `js/export.js`. Use native modules, which still need no build step and still deploy to Pages.
- [ ] Move the rules data (`MIS`, `EQ`, `EQ_MIN_LV`, `DEFAULT_LIM`, time slots) into a single `config.js`, or JSON.
- [ ] Add `node --test` tests for `runAllocationEngine`: Ground before flight, the level matrix, weight limits, PR-JPL exclusivity, block lists, and the shared Ground class counted once in instructor hours. Use a few real days as golden fixtures.

### Phase 1: Privacy fix (do before or together with Phase 2)
- [ ] Remove `INS_DATA` names and weights from the source. Seed them from storage, or from a private import file.
- [ ] Decide with the repo owner whether to **rewrite git history** (`git filter-repo`) or make the repo private. Pages on a private repo needs a paid plan, or the site can move to Cloudflare Pages or Netlify.
- [ ] Stop putting personal data in share links. Share links become `?date=YYYY-MM-DD` and are read from the backend behind login.

### Phase 2: Shared storage (about 3–5 days)
- [ ] Create the Supabase project. Add a `profiles(role: operador|gestor)` table and row-level security: Gestor can only read, Operador can read and write.
- [ ] Implement a `SupabaseStorage` adapter behind the existing `ApiClient` methods (`fetchState`, `saveState`, `fetchResult` …). Keep `localStorage` as an offline cache and a fallback.
- [ ] Add **optimistic concurrency**: each document carries a `version`. A save with a stale version is rejected, and the user gets "a colleague changed this, reload" instead of a silent overwrite.
- [ ] Add login (magic link). Remove the client-side role picker; the role comes from the signed-in profile.
- [ ] Write a one-time migration button: "Upload my local data". Whoever has the real instructor levels pushes their `localStorage` up.

### Phase 3: Data model that matches the job (about 1 week)
- [ ] Separate the **master data** (instructors, students, fleet, rules) from **per-date documents** (demand, schedule result, flight statuses, audit). The date picker then loads and saves that date's schedule.
- [ ] Store audit entries in their own table (append-only, with user and timestamp). This replaces the 100-entry local cap.
- [ ] Compute BI from stored `flights` rows with SQL views, replacing the `BI_HISTORY` blob. Remove or keep the "simulate 30 days" button as a demo.
- [ ] Optional: realtime subscription so Gestor screens update live while the Operador edits.

### Phase 4: Nice to have
- [ ] Track instructor and student qualifications and currency: last flight, medical/CMA expiry, student course phase. The engine then checks these instead of relying on manual levels.
- [ ] Integrate with the Google Calendar that students already use, publishing each student's missions.
- [ ] Make the app installable (PWA) for use on the apron with poor connectivity.

## 5. Open questions for the repo owner
1. Who uses the app daily, and how many operators edit at the same time?
2. Is the school on Google Workspace? This decides Sheets versus Supabase.
3. Can the repo be made private, or the history rewritten, to remove instructor weights?
4. Are the instructor levels in someone's browser the real ones, and whose?
5. Should student and instructor data be linked to any existing school system?
