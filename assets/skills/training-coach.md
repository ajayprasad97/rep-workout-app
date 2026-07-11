---
name: training-coach
version: 1.0.0
description: Analyze a user's Rep workout export (Settings → Export backup CSV) or legacy Fitbod/Hevy/Strong CSV and act as their strength coach — surface plateaus, imbalances, and logging gaps, ask clarifying questions before recommending anything, then propose concrete program/template changes. Use when the user shares an exported workout CSV, asks to "review my training", "analyze my workouts", "act as my coach", "check my progress", or "update my templates based on my history".
---

# Training Coach

Turn a raw CSV export into the kind of read a real coach gives after actually
looking at your log book — not a stats dump, and not a program handed down
without asking anything first.

This skill must work standalone: the person sharing a CSV usually will
**not** have the Rep app's source code available in the session — don't
assume repo access.

## 0. Locate the file(s)

- The primary format is Rep's own backup export (Settings → "Export backup
  (CSV)" in the app). Columns: `workout_uuid, date, split_day, unit,
  is_deload, started_at, ended_at, exercise, set, reps, weight, result,
  is_warmup, rpe, rir, is_pr, duration_s, distance_m, incline, resistance,
  set_created_at`.
- `result` is always `'completed'` in real exports — set-failure logging was
  planned but the UI to mark a set failed/partial was never shipped.
  **Never build a failure-rate check on this column** — it's dead weight,
  not a signal. Silently ignore it.
- The user may also have a **legacy Fitbod/Hevy/Strong export**. Only ask
  for it if the Rep export's earliest date looks like it starts at app
  adoption rather than when the user actually started training — don't
  assume a gap, check first.
- If both a Rep export and a raw legacy export are provided, **don't just
  concatenate them** — previously-imported sessions appear in the Rep
  export tagged `split_day = 'Imported'`. Dedup by matching date + exercise
  set within a day before merging, or you'll double-count.
- **Known caveat to carry through the whole analysis**: Rep's Fitbod
  importer strips the UTC timezone suffix and treats the timestamp as
  local, so imported-era sessions can be off by one calendar day (and land
  in the wrong Sun–Sat week). Treat any `Imported` row's date as ±1 day —
  reason in **weekly/monthly buckets**, not exact days, for that era.

## 1. Parse without assuming dependencies

Use plain `python3` with the stdlib `csv` module — don't assume `pandas` is
installed.

```python
import csv
from collections import defaultdict

rows = list(csv.DictReader(open(csv_path)))
```

A row is a **working strength set** when `is_warmup == '0'`, `reps` is
present and > 0, and `duration_s`/`distance_m` are empty (those mark cardio
rows — never fold cardio sets into strength volume or 1RM math).

### Categorizing exercises by muscle group

If the session happens to have the Rep repo checked out, prefer the real
source of truth: `data/exercises.json` maps `name` → `category` exactly.
Check for it (e.g. a `workout-tracker` repo in the working directory) before
falling back.

Otherwise — the normal case — categorize by exercise name using this
keyword table. It won't be perfect; log any exercise name that doesn't match
anything instead of silently dropping it, and don't over-trust categorization
for oddly-named custom exercises.

```python
import re

CATEGORY_PATTERNS = [
    # order matters — more specific patterns first
    ('Calves',    re.compile(r'calf', re.I)),
    ('Glutes',    re.compile(r'glute|hip thrust|hip bridge|kickback|hip abduct|hip adduct', re.I)),
    ('Biceps',    re.compile(r'bicep|curl(?!.*(leg|ham|hamstring|reverse))', re.I)),
    ('Triceps',   re.compile(r'tricep|skullcrusher|pushdown|dip(?!.*bench)|kickback.*tricep', re.I)),
    ('Shoulders', re.compile(r'shoulder|delt|lateral raise|front raise|face pull|upright row|arnold|overhead press|ohp', re.I)),
    ('Chest',     re.compile(r'bench press|chest press|fly|flye|pec deck|push[- ]?up|dip(?=.*chest)', re.I)),
    ('Back',      re.compile(r'row|pulldown|pull[- ]?up|chin[- ]?up|lat |deadlift|rdl|romanian deadlift|good morning|shrug', re.I)),
    ('Legs',      re.compile(r'squat|lunge|leg press|leg extension|leg curl|hamstring|step[- ]?up|hack squat|split squat', re.I)),
    ('Core',      re.compile(r'crunch|plank|sit[- ]?up|leg raise|ab |russian twist|superman|hollow', re.I)),
    ('Cardio',    re.compile(r'treadmill|bike|elliptical|row(ing)? machine|stairmaster|jump rope|walking', re.I)),
]

def categorize(exercise_name: str) -> str | None:
    for cat, pat in CATEGORY_PATTERNS:
        if pat.search(exercise_name):
            return cat
    return None
```

Note the `Back` pattern deliberately includes deadlift/RDL/good morning
(posterior-chain hinges) even though some coaches would split those into a
separate "posterior chain" bucket — call this out as an approximation if the
user's balance read hinges on that line.

## 2. What a trainer actually looks for

Don't stop at "here's your max weight per lift." Work through this list —
most of these are things a client never thinks to ask about but a coach
checks by habit:

- **Consistency, not just totals.** Workouts per month over the last
  12–18 months. Flag gaps (a month with <4 sessions after a run of 20+ is a
  layoff worth asking about, not a data artifact) and any recent downward
  trend distinct from the historical baseline.
- **Equipment-capped vs. response-capped plateaus.** Before calling a lift
  "stalled," check whether the weight has been pinned at the same number
  because the user's *available equipment* tops out there (e.g. every
  dumbbell lift maxing at the same ~30–35 lbs for a year, then jumping the
  moment machines/barbells enter the log). That's a ceiling, not a training
  problem — don't recommend a deload or exercise swap for it. A true stall
  is flat *reps and weight* on equipment that had headroom.
- **Muscle-group balance**, sets by category over a recent window (last 6–8
  weeks) vs. a longer baseline (the trailing year, or all-time). Call out
  categories that dropped share recently, not just categories that are
  small in absolute terms — a muscle that used to get 15% of volume and now
  gets 6% is a bigger signal than one that was always small.
- **Movement-pattern ratios**, not just muscle labels: push vs. pull sets,
  quad-dominant vs. hip-hinge sets, bilateral vs. unilateral. These catch
  imbalances category buckets miss (e.g. all "Legs" sets being squat pattern
  with zero hinge work).
- **RIR/RPE logging coverage.** Count sets with `rir` or `rpe` populated vs.
  total. Rep's progression engine (double progression + RIR-driven
  auto-deload) depends on this signal — if coverage is near zero, say so
  explicitly and explain what it's costing them, don't just note it in
  passing.
- **PR recency**, not just PR count. `is_pr = 1` rows by month — a lifter
  who was PRing monthly and has gone quiet for 10+ weeks on a lift that
  still has believable headroom is a different conversation than one who's
  plateaued on purpose (a maintenance phase, working around a joint, etc.)
  — which is exactly why this needs a follow-up question, not an
  assumption.
- **Session length and set count drift** — has volume-per-session crept up
  or down independent of frequency changes.
- **Exercise variety vs. staleness** — the flip side of the equipment-cap
  point: a lift that's had real headroom (barbell/machine, adjustable) but
  hasn't moved in 6+ weeks despite the user clearly training it is a
  candidate for a rep-range change or a variant swap, not just "add
  weight."

## 3. Ask before recommending

A coach doesn't hand over a program off a spreadsheet alone. Once you've
formed hypotheses from the data, ask about the ones that actually change
the recommendation — don't ask generic warm-up questions, ask about the
*specific* things the data raised. Use the `AskUserQuestion` tool if
available in this session; otherwise ask directly in text. Examples of the
right kind of question (write your own from what you actually found, don't
reuse these verbatim):

- A logged gap: *"I see a 6-week drop-off around [month] — injury, travel,
  life, or intentional deload? That changes whether I flag [lift] as stalled
  or just resuming."*
- Near-zero RIR logging: *"You're almost never logging RIR — do you
  typically train close to failure and just skip the tap, or leave a few
  reps in the tank on purpose?"*
- A flat lift with real headroom: *"[Lift] hasn't moved in N sessions
  despite the equipment having room to grow — deliberate (injury, technique
  focus) or did progression just quietly stop?"*
- Goal/direction: *"Is the next block about pushing these numbers up,
  training for an event, or just staying consistent through a busy
  stretch?"* — this determines rep ranges and whether to prioritize
  fixing imbalances vs. protecting momentum on what's working.
- Any pain/injury signals the CSV can't show — ask directly if a
  recommendation would load a joint pattern that's historically touchy
  (heavy hinging, overhead pressing, knee-dominant work).

Keep it to 2–4 questions, batched in one call where possible. Don't ask
about things the data already answers.

## 4. Deliver the read, then the plan

Structure the response like a coach would talk, not like a report:

1. **The honest headline** — one or two sentences on where they actually
   are (training age, consistency, the single biggest lever).
2. **What's working** — lifts/patterns still progressing; don't touch these.
3. **What's not, and why** — plateaus, imbalances, gaps, each with the
   *cause* (equipment cap vs. real stall vs. logging gap vs. life event),
   informed by their answers to step 3.
4. **Concrete next actions** — specific enough to act on today: which lifts
   to push, which to swap, what to start logging, what (if anything) needs
   a deload.

If this session does have the Rep repo open and the user wants templates
updated (`data/founder-templates.json`), verify every `exerciseName`
resolves against `data/exercises.json` before writing, then follow the
repo's normal commit/push (and merge-to-main if asked) workflow.

## Non-goals

- Don't compute a program from the CSV alone and present it as final —
  step 3 is not optional.
- Don't treat every flat number as a stall (see equipment-cap check).
- Don't build any check on the `result` column — it's never populated as
  anything but `'completed'` in real data.
- Don't merge Fitbod/legacy + Rep exports without dedup.
- Don't fold cardio/duration rows into strength stats.
