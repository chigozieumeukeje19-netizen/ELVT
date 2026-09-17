# ELVT OS PORTAL: COMPETITOR TEARDOWN AND BUILD SPEC

Written 17 Sep 2026 for the elvt-os-platform build in Claude Code.
Source of truth for what the portal is, what it steals from CoachRx and HubFit, what it deliberately does better, and the exact order to build it.

The one sentence version: the portal is the brain, every client surface (Base44 app, the current static PWA, a future iOS app) is a dumb screen that reads from it. Darren's job shrinks to three actions a week: read the Monday queue, approve or edit what the system proposes, answer same-day triggers. Everything else is generated, scheduled or scored by the machine.

---

## PART 1. COMPETITOR TEARDOWN

### 1.1 CoachRx (OPEX Fitness)

Positioning: individual design for coaches who see coaching as a relationship. Their CTO founded TrueCoach. Their pitch is depth over volume, and their north star metric is compliance (completed sessions divided by prescribed sessions).

What their coach side is built around:

- Coach dashboard widgets: Roster, Schedule, Messages, Notifications, Touchpoints, My Tasks, Activity Feed, My Stats. The dashboard surfaces "priority touchpoints" (who you have not talked to), compliance per client, check-ins due, and coach efficiency metrics (compliance rate, number of programs written).
- Touchpoints. This is their retention engine. A touchpoint is any coach interaction: a comment on a completed workout, a direct message, a consult, a check-in review. They set a default goal of 1 touchpoint per client per week and gamify the coach hitting it. Their internal data: clients receiving more than 2 touchpoints a week sit around 75% compliance. Everything on the dashboard is designed to push the coach to make contact.
- Client segments: filter the roster by compliance band, status or tag so the coach only looks at who needs attention.
- Program design calendar: exercise, lifestyle and nutrition prescriptions all live on one client calendar. Hotkeys for fast programming. Periodization planning at macro, meso and micro cycle level, for both resistance training and energy system (running, conditioning) work.
- Assessment and FMEs (Fitness Monitoring Exercises): systematized intake and a structural balance assessment that automatically generates "client priorities". Priorities are then visible while you program.
- RxBot AI: pulls assessment results, periodized plan, equipment list, goals and previous workouts, generates a program with a rationale, coach reviews and applies it to the calendar in one click. Never applies without the coach.
- Programs feature: two delivery modes. Live (fixed start date, all clients get the same workout on the same day) and Standard (evergreen template a client can start any time). Templates are built around an "avatar" not a person.
- Client docs, SOPs, equipment lists, custom branded PDF export of any coach view.
- Integrations: Apple Health, Garmin, Oura, Cronometer, Stripe, Loom video messaging, blood biomarker testing partner.

What their client app does (from their own walkthrough):

- Home screen shows the week's exercise program, lifestyle prescriptions, and the chat icon. Completed sessions turn green, upcoming are gray.
- Start Workout opens coach notes, demo video, tempo and metrics. Swipe right through supersets. Log weight and reps per set, attach a form-check video. Exit mid-workout keeps progress.
- Exercise history shows last sessions and PRs inline while logging.
- Profile holds streak, compliance, completed workouts, progress photos, metrics and lifts.
- Intake forms, equipment list per location, availability calendar the client sets so the coach programs around it.
- Weekly check-ins and bookable calls in-app.

Weaknesses worth exploiting (from their own reviews and change log):

- Streaks count by when the client recorded the workout, not when they did it. Clients who log the next morning lose streaks. Ours must count by scheduled date and allow same-week backfill.
- No client data export. Coaches asked for a download of all logged sets and notes.
- Heavy OPEX methodology baked in (FMEs, structural balance). Great for OPEX coaches, friction for anyone else.
- Wearable integration was still listed as "coming soon" on parts of their site through 2025.
- No true hybrid view. Running and lifting are both on the calendar but nothing computes combined stress or flags a hard run before leg day.

### 1.2 HubFit

Positioning: modern all-in-one at a low price, every pillar on every plan, 50,000 coaches, 4.9 on the App Store. Their gap they name themselves: nutrition database depth.

Their information architecture (this is the cleanest reference for our screen list):

Coach web app sidebar: Clients, Tasks, Messages, Check-Ins (review inbox), Training (Programs / Workouts / Sections / Exercises), Nutrition, Forms (Check-Ins / Questionnaires), Habits, Metrics, Resources, Packages, Community, Challenges, Teams, Autoflow, Onboarding Flows, Settings.

Training hierarchy: Programs > Workouts > Sections > Exercises.

- Exercise: name, video (upload up to 50MB or paste YouTube), notes, equipment (up to 3 of Barbell, Dumbbell, Machine, Cable, Kettlebells, Body Only, Bands, EZ Bar, Medicine Ball, Exercise Ball, Foam Roll, Bench, Other, None), level, muscles worked (primary starred plus up to 3 secondary), type (Strength, Cardio, Stretching, Plyometrics, Powerlifting, Olympic, Strongman). Up to 4 tracking fields per exercise from: Reps, Weight, Time, Rest, Tempo, Distance, Calories, RPE, RIR, RPM, Speed, Duration. Default is Reps / Weight / Rest. Alternative exercises attached per exercise so the client can swap.
- Section types: Regular, Circuit (rounds plus optional duration), AMRAP (time cap), Interval (timed work and rest). Supersets are groups inside a section.
- Workout: sections plus name, description, cover image, tags. Cover images by phase color so clients see which block they are in.
- Program modes: Calendar (dates or day numbers, drag and drop between days, import to client with a start date) and Fixed (ordered list, no dates, several can be assigned at once). Week actions: clear week, delete week, add week. Templates and folders and tags.
- Periodisation Planner: spreadsheet view, exercises as rows, workouts as columns, edit every week of a lift at once for progressive overload. Completed workouts locked green.
- Client calendar settings: view range (current week, 2 weeks, 4 weeks, all), client can reschedule on or off.
- Client tracker: full-screen scrolling list, previous performance shown per exercise, PRs highlighted the moment they are beaten (Max Weight, Max Volume, Estimated 1RM via Epley), rest timer auto-starts on set completion with plus or minus 15 seconds, minimizes to a floating bar if they leave, iOS Live Activity on the lock screen, difficulty rating 1 to 5 required to finish, session note, shareable story cards after the workout (PRs, muscle map, volume chart).
- Training Statistics: week streak, muscle distribution heat map front and back, push to pull ratio, upper to lower ratio, sets per muscle group daily, weekly, monthly. Each set counts 1.0 to the primary muscle and 0.5 to each secondary.

Nutrition: macro targets (one for every day, per day of week, or rest day target), meal plans with alternatives, 5,000 recipe library, barcode scanner, quick log, daily macro rings, Meal AI (describe a meal, get macros), Smart Meal Planner (generate a day from a target), Cronometer sync, shareable custom food library per client.

Forms: two types. Check-in (recurring, per client copy, scheduled daily, weekly, bi-weekly or monthly in the client's timezone, push reminder, backdate up to 14 days) and Questionnaire (one-off, stays linked to the library, used for intake). Eleven question types: Text, Number, Multiple Choice, Scale 1 to 10, Yes/No, Media, Date, Star Rating, Signature, Progress Photos (syncs to gallery), Metric (syncs to the client's metric history so weight typed in a check-in lands on the weight chart). Review inbox shows every submission with Pending or Reviewed status, submitted-ago time, and a review note that fires push plus email to the client. Compare view shows one question across many submissions.

Habits: daily or weekly, 15 units (steps, minutes, cups, calories, km, grams, or a check-off), streak, best streak, completion rate, coach can log on the client's behalf, weekly averages.

Metrics: weight, body fat, circumferences, custom metrics, trend charts, progress photos front side back with comparison toggle.

Automation (this is the leverage layer):

- Onboarding Flow: triggered on package purchase or manual add. Assigns program, nutrition plan, habits, check-ins, questionnaires, community, challenge, and sets which features that client can see. Different flows per client type.
- Autoflow: day-based drip. Day 1 welcome message, Day 3 check-in message, Day 5 resource, Day 14 phase unlocked. Reusable templates.
- Feature Control per client: toggle Workout, Workout Logger, Habits, Nutrition, Nutrition Tracker, Check Ins, Progress Photos, Metrics, Messaging. Tab disappears if off.
- Zapier triggers on any event.

Client app tabs: Dashboard (today's tasks card listing pending check-ins, habits and scheduled workouts, plus challenges, community preview, resources, coach notes), Training, Habits, Nutrition, Profile (check-ins, photos, metrics, integrations, settings). Chat icon in the header. First-time setup collects sex, DOB, height, and Apple Health or Health Connect permission.

Weaknesses worth exploiting (all from their own help center FAQ):

- Cannot set different target values per set. 12, 10, 8, 6 has to go in a notes field.
- Cannot duplicate a week inside a program.
- No overview of overdue check-ins across all clients. You open each profile.
- Clients cannot reply to check-in feedback. Feedback is one way.
- No cardio module. Runs are just workouts. Interval sections cannot track sets and reps. Clients cannot log self-directed activity at all.
- Completed workouts do not keep the originally prescribed values, so you cannot see prescribed versus actual after the fact.
- No PDF export of programs.
- No summary of all clients' training progress in one place.
- Check-in schedules are workspace-wide, so a client who joins Sunday gets a form Monday.
- Muscle statistics only as good as manual muscle tagging.

### 1.3 What the wider market does that both miss

- Hevy, Strong, Fitbod: previous performance and PR detection inline in the logger, rest timer that survives leaving the app, plate calculator, one-tap "same as last set".
- Everfit, TrainHeroic: percentage-of-1RM programming (coach writes 75% and the app shows the client their weight), saved workout sections, drag and drop, RPE and cadence fields.
- WHOOP, Garmin: recovery gating. A daily readiness number that changes the plan's intensity. Nobody in coaching software does this well.
- TrainingPeaks: planned versus completed load per week, ramp rate flags (mileage spikes), race countdown, taper visualization. This is the running side the coaching apps ignore.
- The coaching platforms all treat check-ins as a form. None of them treat the check-in as the input to a decision. That gap is the whole ELVT model.

---

## PART 2. WHAT ELVT OS STEALS, SKIPS, AND DOES BETTER

### Steal as-is

- HubFit's training hierarchy and field list (Program > Workout > Section > Exercise, 4 tracking fields, section types, alternatives per exercise).
- HubFit's two form types (Questionnaire for intake, Check-In for recurring) and the synced Metric and Progress Photo question types.
- HubFit's Onboarding Flow and Autoflow concepts, rebuilt as our Program Template plus Day-Based Drip.
- HubFit's per-client Feature Control.
- CoachRx's touchpoint counter and compliance-per-client on the roster.
- CoachRx's AI-draft-then-coach-approves loop.
- HubFit's periodization planner grid (exercise rows, week columns).
- HubFit's client tracker behaviors: previous performance inline, PR flash, rest timer, resume floating bar, difficulty rating.

### Skip on purpose

- Community feed, challenges with leaderboards, packages and Stripe checkout, multi-coach teams, recipe library of 5,000 recipes, Meal AI. None of it moves the eight current clients. Schema leaves room, nothing gets built.
- OPEX structural balance assessment. Our intake is goal and constraint driven, not movement fault driven.
- In-app notes fields for clients. Standing ELVT rule: apps are pure accountability, all coaching data comes from check-ins.

### Do better (the differentiators)

1. Check-ins that drive decisions. Every question exists to change something on Monday. The portal knows which variable changed last Monday and builds the next form around it (the "spine rule").
2. Per-client triggers. Thresholds stored on the client, evaluated nightly, surfaced as an attention queue with a suggested action. CoachRx tells you who you have not messaged. We tell you Karar's steps were under 6,000 two days running and offer the message.
3. Hybrid stress calendar. Strength and running on one week view with a stress score per day and rule-based flags (hard run before legs, two Zone 2 days back to back, mileage ramp over 10%).
4. Projected calorie path. A different weekly target for all twelve weeks, generated from a start point and an end point, protein held flat, deload weeks held flat, editable per week, and the final week equals the goal state. Nobody else has this.
5. Prescribed versus actual kept forever. Every logged set stores the prescription next to the result.
6. Per-set targets. 12, 10, 8, 6 is a first-class feature, so is 5x5 at 80%.
7. Week duplication, week shift, day swap for travel, all one click.
8. Streaks by scheduled date with backfill, not by log timestamp.
9. Overdue check-ins and low adherence in one queue across all clients.
10. Coach can reply and the client can reply back on a check-in review. It becomes a thread.
11. A run is its own object with distance, pace range, HR range, fueling notes, and it logs distance, pace, average HR, RPE. Planned versus completed mileage per week. Race countdown that reflects the day being viewed, not today.
12. Client Blueprint auto-drafted from onboarding, approved by the coach, then everything (program, calorie path, habits, question bank, triggers) is generated from it.

---

## PART 3. THE LEVERAGE MODEL (how Darren's week actually works)

The portal is designed backwards from these three coach touches. If a feature does not feed one of them, it is not in Phase 1.

### Touch 1. The Monday Review Queue (the only scheduled block)

Sunday 23:59 the system rolls every client's week: archives the week snapshot, computes the ELVT Score, closes the weekly check-in window. Monday morning the queue shows one card per client, sorted by attention score:

- Weight trend (7 day average, delta vs last week, delta vs plan)
- Adherence: training, running, nutrition, movement, recovery, each as a fraction (e.g. lifts 3/3, runs 1/2, protein days 5/7, steps 4/7)
- Their check-in, with the spine question (last week's change) pinned at the top
- Flags fired this week
- Proposed changes. The AI reads the check-in plus the data and drafts "what I would change and why" as a diff: calories 2,650 to 2,550, move long run to Sunday, add hip mobility habit. Each line has Accept, Edit, Reject.
- Draft coach message to the client summarizing the week and any change, in Darren's voice rules (two to five lines, real numbers, one question, no motivational filler, no dashes).

Accept All writes the changes to next week, publishes the week to the client app, sends the message. One client takes under two minutes. Eight clients in fifteen.

### Touch 2. Same-day triggers (Tuesday to Saturday, read only)

Nightly at 21:00 client local time the trigger engine evaluates every client's daily check-in and logs against their stored thresholds. Fired triggers go to the queue with a suggested message. Darren opens the queue once a day, sends or dismisses. If nothing fired, he does nothing.

### Touch 3. Approving what the machine drafts

New client onboarding submitted → Blueprint draft → approve. Program generated → approve. Weekly check-in form generated → approve (or auto-send if the client has "auto" on). Nothing reaches a client without an approval, and approval is one tap.

### What is fully automated, no touch

- Week roll and snapshotting
- Daily and weekly check-in delivery at the client's chosen time
- Reminders (morning plan, workout, water, steps, evening reflection, Monday weigh-in and photos)
- Streaks, scores, PRs, milestones, celebration events
- Calorie path stepping week to week
- Phase transitions and roadmap unlocks
- Retention risk detection (no activity 72h, two missed sessions, no food logs, no check-in)
- Deload weeks holding calories flat
- Race countdown, taper start, race week checklist

---

## PART 4. PORTAL INFORMATION ARCHITECTURE (coach side)

Left sidebar, in this order:

1. Queue (home). Attention queue plus Monday review cards. Badge count.
2. Clients. Roster table: name, program, week X of N, phase, ELVT score this week, 7-day adherence, weight trend arrow, last activity, last touchpoint, flags. Filters: needs attention, low adherence, check-in overdue, race within 6 weeks, onboarding incomplete. Bulk select for actions.
3. Client detail (tabs): Overview, Program, Nutrition, Check-ins, Progress, Photos, Messages, Blueprint, Settings.
4. Builder. Program templates, workout templates, sections, exercise library, run templates, habit library, question bank, trigger presets, message templates.
5. Calendar. All clients on one week grid, or one client's full program. Hybrid stress overlay.
6. Messages. Unified inbox, scheduled sends, voice notes, quick replies.
7. Library. Videos, docs, education lessons, recipes (Phase 2).
8. Settings. Branding, reminder defaults, scoring weights defaults, integrations, exports.

### 4.1 Client Overview tab

Top strip: name, age, sex, goal statement, program name, Day X of N, phase chip, race countdown if any, start date, end date.
Row of six tiles: Weight (now, 7d avg, vs start, vs goal), ELVT Score (this week, 4 week trend), Training (sessions done of planned this week), Nutrition (days on target of 7, protein days), Movement (avg steps vs goal), Recovery (avg sleep, readiness if wearable).
Below: The One Thing (the single field Darren reads daily for this client, editable), active flags with dates, last check-in summary, last 5 touchpoints, upcoming events (retest, photos due, race, phase change), coach notes (private).

### 4.2 Client Program tab

Week strip 1 to N with phase color bands. Selected week shows Mon to Sun as columns. Each day cell stacks: strength session card, run card, mobility card, rest marker, nutrition target for the day (calories, protein), habits. Cards are drag and drop between days. Right rail: Hybrid stress meter per day (strength load plus run load, with flags), planned mileage total, planned sets per muscle.

Actions on the week: duplicate to next week, duplicate to weeks X to Y, shift everything one day, swap two days, mark deload, clear.
Actions on a session: open in builder, swap exercise (from library or the client's flag-safe list), apply progression rule, view last 3 performances per exercise.
Periodization grid button: one exercise as a row, every week as a column, edit load or reps across the whole block.

### 4.3 Client Nutrition tab

Calorie path table: week, calories, protein, carbs, fat, note (deload held, reset week, taper), status (projected, confirmed, edited). Regenerate path from start and end points. Rest day and training day variants. Day-specific override (Rodrigo style: base plus per-mile).
Meal plan: named meals with macros summing exactly to the day target, last meal absorbs rounding. Swap list per macro category. Grocery hub with quantities scaled to the current week's target. Training fueling notes that attach to run and session cards.
Client logging view: what they ticked and what they custom-logged, daily and weekly adherence.

### 4.4 Client Check-ins tab

Assigned forms: Daily (client-specific questions after the shared four), Weekly (Sunday, weight is always question 1, around 15 questions). Each shows schedule, next due, last submitted, auto-send on or off.
Submissions list. Compare view across weeks per question. Spine indicator showing which variable changed each Monday and whether the following check-in confirmed it worked.
Form generator: pick last Monday's change, the system proposes next Sunday's form from the client question bank, coach approves.

### 4.5 Client Progress tab

Default shows only the metrics that matter for this client's phase (fat loss: weight, calories, protein, steps; race prep: mileage, fueling, sleep, recovery). Toggle to show everything: weight, 7d average, waist, measurements, strength per lift (e1RM trend), run pace, weekly mileage, steps, sleep, HRV, RHR, calories, protein, adherence, streak, program completion. Date range selector. Export CSV.

### 4.6 Blueprint tab

The approved document: goals, duration, availability, running experience, nutrition structure, targets, step goal, recovery priorities, constraints and flags, race dates, medical considerations, communication preferences, the One Thing, triggers, likely failure mode, tone. Versioned. Edit and re-approve. This is also the context block the AI receives every time it drafts anything for this client.

---

## PART 5. DATA MODEL (Supabase Postgres)

Keep what already exists from the August rebuild (profiles.role, clients table with slug, program_start_date, program_length_weeks, calorie_target, flag_config jsonb). Extend it. Every table has id uuid, created_at, updated_at. Every client-scoped table has client_id with an RLS policy keyed to auth.uid() for the client role and open to coach and admin roles. Deny-all by default.

### Identity

- profiles: id (auth.users), role (client, coach, admin), display_name, email, timezone, avatar
- clients: id, profile_id, slug, first_name, last_name, sex, dob, height_cm, start_weight, goal_weight, units (imperial, metric), status (onboarding, pending_approval, active, paused, finished, archived), program_start_date, program_length_weeks, current_phase_id, primary_goal, goal_statement, occupation, location, timezone, communication_prefs jsonb (tone, directness, reminder_time, preferred_channel), flag_config jsonb, feature_flags jsonb (workouts, running, nutrition_tracker, meal_plan, steps, water, habits, photos, checkins, messaging, community), one_thing text, coach_notes text, last_activity_at, base44_user_id

### Onboarding and Blueprint

- questionnaires: id, name, kind (intake, reassessment, custom), sections jsonb
- questionnaire_responses: client_id, questionnaire_id, answers jsonb, submitted_at
- blueprints: client_id, version, status (draft, approved), content jsonb (goals, duration, availability, running_experience, nutrition_structure, calorie_target, protein_target, step_goal, recovery_priorities, constraints, race_dates, medical, comm_prefs, one_thing, triggers, failure_mode, tone), approved_at, approved_by

### Library

- exercises: id, name, aliases text[], type, primary_muscle, secondary_muscles text[], equipment text[], level, pattern (squat, hinge, push_h, push_v, pull_h, pull_v, carry, core, lunge, rotation), media jsonb (youtube_id, gif_url, video_url, thumb_url, source, verified_at), cues text[], default_fields text[], unilateral bool, is_custom bool, owner_id
- exercise_alternatives: exercise_id, alt_exercise_id, reason (equipment, injury, level)
- exercise_contraindications: exercise_id, flag_key (elbow, knee, spine, shoulder, rib, achilles). Drives the flag-safe swap list per client.
- sections_templates, workout_templates, run_templates, program_templates (all jsonb bodies plus name, tags, goal_type, duration_weeks, split)
- habits_library: name, unit (check, steps, ml, oz, minutes, grams, hours), default_target
- question_bank: key, text, type, options jsonb, category (shared, steps, injury, nutrition, sleep, recovery, running, training, life, accountability), applies_when jsonb (goal types, flags), produces jsonb (which client variable this answer can change)
- trigger_presets: key, name, expression jsonb, default_threshold, suggested_message
- message_templates: key, body, variables text[]

### Program (per client, materialized)

- programs: client_id, template_id, name, phases jsonb (name, start_week, end_week, color), duration_weeks, status
- program_weeks: program_id, week_number, starts_on, is_deload, calories, protein, carbs, fat, calorie_note, calorie_status (projected, confirmed, edited), planned_mileage, snapshot jsonb (frozen copy written at week roll), elvt_score, adherence jsonb
- program_days: program_week_id, date, day_of_week, is_rest, calories_override, protein_override, notes
- sessions: program_day_id, kind (strength, run, mobility, conditioning, skill), name, order, status (planned, done, modified, skipped), started_at, completed_at, difficulty_rating, duration_min, fueling_notes, coach_notes, video_id
- session_sections: session_id, type (regular, superset, circuit, amrap, interval), order, rounds, duration_sec, name
- session_exercises: section_id, exercise_id, order, sets jsonb (array of {set, reps, weight, pct_1rm, time, distance, rest, rpe, rir, tempo}, per-set targets are first class), tracking_fields text[], notes, rir_guidance, substituted_from_exercise_id
- set_logs: session_exercise_id, set_number, prescribed jsonb, actual jsonb, is_pr, pr_type, logged_at, logged_for_date
- runs: session_id, run_type (easy, recovery, zone2, long, tempo, threshold, intervals, progression, hills, strides, race_pace, race, brick, walk_run, custom), distance_target, duration_target, pace_min, pace_max, hr_min, hr_max, rpe_target, warmup, workout_body jsonb, cooldown, fueling jsonb
- run_logs: run_id, distance, duration, avg_pace, avg_hr, max_hr, rpe, cadence, elevation, felt (easy, ok, hard), stayed_in_zone bool, notes, source (manual, strava, garmin, apple)
- habits: client_id, habit_id, target, unit, days_of_week, active_from, active_to
- habit_logs: habit_id, date, value, completed bool
- meals: client_id, program_week_id nullable, name, order, calories, protein, carbs, fat, items jsonb
- meal_logs: client_id, date, meal_id nullable, custom jsonb (name, kcal, p, c, f), source (plan_tick, custom, barcode)
- daily_logs: client_id, date, weight, steps, water, sleep_hours, energy, mood, readiness, session_status, custom jsonb. One row per client per day, the daily check-in writes here.
- day_completion: client_id, date, score, tasks jsonb (task key, weight, done), streak_after

### Check-ins and communication

- checkin_forms: client_id, kind (daily, weekly, week1, reassessment), questions jsonb, schedule jsonb (days, time), auto_send bool, spine_variable text, generated_from_change_id
- checkin_submissions: form_id, client_id, for_date, answers jsonb, submitted_at, reviewed_at, review_note, thread_id
- threads, messages: thread_id, sender_id, body, kind (text, voice, video, photo, file, system), scheduled_for, sent_at, read_at, touchpoint bool
- touchpoints: client_id, kind, ref_id, at. Counted per week for the roster.

### Engine

- client_triggers: client_id, key, expression jsonb, threshold, active, suggested_message, last_fired_at
- queue_items: client_id, kind (trigger, retention_risk, checkin_due, checkin_submitted, approval, milestone, weight_flag, mileage_spike), severity, title, detail jsonb, suggested_action jsonb, status (open, done, dismissed), created_at
- plan_changes: client_id, week_number, field, from_value, to_value, reason, source (coach, ai_accepted, ai_edited), created_at. This is the spine record.
- milestones, client_milestones, celebrations
- scoring_config: client_id nullable (null = default), weights jsonb {training, run, calories, protein, steps, water, recovery, sleep, checkin, custom...}
- wearable_samples: client_id, source, metric, value, at (Phase 2)
- bloodwork_panels, bloodwork_markers (Phase 2, encrypted columns, audit logged)
- audit_log: actor_id, action, table, row_id, diff jsonb, at
- events: type, client_id, payload jsonb, at. Every state change emits one. The Base44 app and any webhook subscribe here.

---

## PART 6. PROGRAM ENGINE

### 6.1 Templates never overwrite personalization

A template is a recipe: split (e.g. 3 lifts + 2 runs), session skeletons by day, progression rules, deload cadence, calorie path shape, default habits, default question bank subset, default triggers. Applying a template to a client runs it through the Blueprint: remove contraindicated exercises using flag_config, pick alternatives from the flag-safe list, place sessions on the client's preferred training days, place the long run on their preferred day, never put two same-stimulus hard days back to back, cap lifting sessions at 3 if a combat sport is present, insert two full rest days if the blueprint says so. Output is a materialized program the coach can edit freely. Re-applying a template later only touches sessions marked "from template", never coach-edited ones.

### 6.2 Progression rules (attached at the exercise or session level)

- linear_load: add X lb or kg when all sets hit the top of the rep range at or under the RIR target
- double_progression: reps climb through a range, then load goes up and reps reset
- percentage: sets defined as % of e1RM, e1RM recomputed from logs (Epley)
- rpe_autoreg: prescribe RPE, show the client a suggested load from last performance
- wave: 3 up 1 down cycle over the block
- run_ramp: weekly mileage increases by at most N% with a down week every 4th; flag any week over the ramp

Rules run at week roll and write next week's prescription. Coach sees the diff in the Monday queue.

### 6.3 Calorie path generator

Inputs: start calories (reset week or Mifflin-St Jeor times activity), end calories (goal state), protein (held flat), deload weeks (held flat), number of weeks, shape (linear, front-loaded, mileage-linked for runners, muscle-gain rising). Output: one row per week with carbs and fat scaled to hit the number, last meal absorbs rounding so plan meals sum exactly. Every row marked projected until the Monday review confirms or edits it. Editing week 6 does not move weeks 7 to 12 unless the coach chooses "re-ramp from here".

### 6.4 Hybrid stress view

Each session gets a stress estimate: strength = sets × relative load factor × muscle group weight (legs heavier), run = distance × intensity factor (zone 2 = 1, tempo = 1.6, intervals = 2, long run = 1.3). Day stress = sum. Flags: leg session within 24h before or after a hard run, two hard runs consecutive, weekly mileage over 10% above the previous three-week average, week stress over the block average by 25% and it is not a planned peak, deload week with stress above the previous week. Flags render on the calendar and in the queue.

### 6.5 Day swap and travel

Swap two days moves session, run, nutrition target and habits together. Shift week moves everything one day. Travel mode for a date range: replaces sessions with the template's hotel version (bodyweight or dumbbell), keeps runs, keeps calories, adds a travel eating card.

### 6.6 Week roll (Sunday 23:59 client local)

Freeze snapshot of the week into program_weeks.snapshot. Compute ELVT Score. Compute adherence fractions. Compute weight 7d average and trend. Run progression rules for next week. Run run_ramp check. Create next week's daily forms. Create next Sunday's weekly form draft from the spine. Emit week_rolled event. Create Monday queue card.

---

## PART 7. SCORING AND GAMIFICATION (mature, not childish)

Daily score 0 to 100 = sum of weighted assigned behaviors done that day. Weights live in scoring_config, default: training session 30, run 20 (only if one is planned that day, otherwise redistribute), calories in range 15, protein hit 15, steps 10, water 5, recovery task 5, daily check-in 5, custom tasks share the remainder. Rest days rescale so a perfect rest day still scores 100.

Weekly ELVT Score by category: Training, Nutrition, Movement, Recovery, Accountability, each 0 to 100, week score is the weighted mean, and the category furthest below 80 gets a "focus" tag.

Streak counts scheduled days completed at or above 70, computed on scheduled date, backfill allowed within the week. Best streak stored.

Milestones: 7, 14, 30, 60, 90 day streaks; first 5, 10, 20 lb; first continuous 5K, 10K; half, full; new e1RM PR; 25, 50, 100 sessions; 90% week; program midpoint; program completion; retest; race done. Coach-created custom milestones and gifts with pending, sent, delivered status. Celebration is a single full-screen card with the number, no confetti spam.

XP and levels exist in the schema (client_xp) but render only as a quiet level badge on the profile. Phase 2.

---

## PART 8. EXERCISE LIBRARY AND ANIMATIONS

What the good apps do: every exercise row has a thumbnail, tapping opens a sheet with a looping demo (GIF or short MP4, auto-plays muted, no leaving the app), 3 to 5 cues, tracking fields, last performance and history. The client never taps out to YouTube mid-set.

Media strategy, in this order:

1. Seed with the existing verified YouTube library extracted from the current client HTML files. This is the only source with every ELVT exercise already vetted. Store youtube_id, mark source verified.
2. Add an inline loop for the top 300 movements. Options with commercial rights:
   - ExerciseDB dataset: 1,500 exercises with GIF animations, structured JSON, one-time purchase with commercial rights (their Kaggle listing states one-time payment, no recurring). Their API on RapidAPI covers 11,000 exercises with videos, GIFs and images, male and female.
   - MuscleWiki API: 1,900 exercises, 7,700 video demonstrations, 45 muscle groups, paid plans include full commercial use.
   - ExerciseAnimatic style 3D animation bundles: lifetime license, downloadable MP4s, consistent look across the whole library, good fit for a premium monochrome brand.
   Pick one, download the media, re-host on Supabase Storage or Cloudflare R2, never hot-link a third-party CDN into a client app.
3. Film ELVT-branded demos for the 40 movements that appear in nearly every program (the brand layer). Replace media.source with "elvt" as they land.

The exercises table stores all three so the client app renders: elvt video if present, else GIF loop, else YouTube thumbnail with a play sheet. Matching between library sources is by name plus aliases; keep a review screen in the Builder where unmatched imported exercises are resolved by hand once.

Contraindications: every exercise carries flag keys. A client with flag_config.knee = true never sees walking lunges in a swap list, and the template applier removes them automatically. This is what makes Andi, Janessa and Karar safe by construction, not by memory.

---

## PART 9. CHECK-IN ENGINE

Rules already in force, now encoded:

- Two forms per client. Daily 6 to 7 questions under a minute. Weekly on Sunday, about 15 questions, fasted weight is question 1 for everyone, then adherence 1 to 10, biggest win, biggest struggle, photos done.
- The first four daily questions are identical across clients: session done (yes, modified, no, plus the client's own third option if configured), sleep hours, energy 1 to 10, steps. Everything after is pulled from question_bank filtered by the client's goal and flags.
- Weekly forms are built around the spine: whichever variable changed the previous Monday. The generator reads plan_changes for last week and pulls the questions whose produces field matches that variable.
- Week 1 form carries the fit section: does the structure fit your life, what confused you, what felt unsustainable, app usability.
- Every weekly form asks accountability 1 to 10 and "the one thing you know you should be doing and are not", plus whether they hit the specific number their plan is built on.
- Answers of type Metric write to daily_logs (weight, steps, sleep). Answers of type Photos write to the gallery.
- Backdating allowed up to 7 days for daily, the weekly is locked to its Sunday.

Decision rules on the coach side (rendered in the Monday card as three lanes):

1. Flag at actionable level (Janessa back discomfort above none, Karar elbow changing an exercise, calf above 5, training on a rest day). Handled same day, not Monday.
2. Trend across two weeks. One bad week is noise, two is a signal.
3. Direct request, weighed against their data, always answered even when the answer is no.

A single bad week with no flag and no trend changes nothing. The AI drafter is instructed with exactly these three rules and the client's Blueprint, so its proposals follow ELVT logic rather than generic coaching.

---

## PART 10. AI INSIDE THE PORTAL

All AI runs server-side with the client's Blueprint plus the last 4 weeks of data as context. Every output is a draft with an approve step. Never diagnoses, never changes a plan on its own, never messages a client unprompted.

Jobs:

1. Blueprint drafter: onboarding answers → structured blueprint jsonb plus a plain-English summary plus proposed One Thing, triggers, failure mode and tone.
2. Program drafter: blueprint plus chosen template → materialized program with per-exercise substitutions explained. Writes a rationale per week.
3. Calorie path proposer: computes from stats, proposes end point, coach edits.
4. Weekly review drafter: check-in plus data → the Monday card's proposed changes (as plan_changes rows in draft) and the client message.
5. Trigger message drafter: fired trigger → two to four line message in the client's tone.
6. Check-in summarizer: long answers → three bullets, sentiment flag if emotionally heavy free text.
7. Form generator: spine variable → next weekly form.

Voice rules baked into every message prompt: coach texting, never open with the session name, no motivational filler, two to five lines, one real question, real numbers, match the client's tone, no dashes, US English, state which session the client has that day.

---

## PART 11. CLIENT SURFACE CONTRACT (this is how Base44 connects)

Principle: the portal is API-first. The Base44 app, the current static PWA, and any future native app are all clients of the same API. Nothing lives only in Base44.

### 11.1 How Base44 talks to the portal

Base44 backend functions run on Deno with per-app Secrets and can call any external API; each function also gets its own HTTP endpoint that external systems can hit (Builder plan or higher). The Base44 database is its own NoSQL store. Do not mirror client data into it. Use Base44 for the UI and its auth session only, and route every read and write through portal endpoints via a backend function that holds the portal API key in Secrets.

Flow:

1. Client opens the Base44 app and signs in (Base44 auth, email). The app calls a Base44 backend function `elvtSession`, which calls `POST /api/v1/auth/exchange` on the portal with the client's email and the portal API key. The portal looks up clients.base44_user_id or the email, returns a short-lived client JWT scoped to that client_id.
2. Every subsequent screen calls Base44 functions (`elvtGet`, `elvtPost`) which forward to the portal with the client JWT. Base44 stores nothing but the JWT in session.
3. The portal emits events. A Base44 function endpoint `/functions/elvtWebhook` receives `week_published`, `message_sent`, `plan_changed` and the app refetches. Pull-to-refresh also works because the portal is the truth.

Alternative for later: Base44 functions call Supabase directly with supabase-js and the service key, filtering by client_id. Same contract, fewer hops. Keep the REST layer anyway so the static PWA and any native app use it too.

### 11.2 Endpoints (Next.js route handlers under /api/v1, client JWT required unless noted)

Auth
- POST /auth/exchange (API key) → client JWT
- POST /auth/magic-link (for the portal-served client page)

Read
- GET /me → client, program summary, day X of N, phase, feature flags, race countdown, one_thing shown to client if enabled
- GET /today → tasks with weights, sessions, run, nutrition target and meals, habits, score so far, streak, coach message, checkin due
- GET /week/:n → seven days with everything, phase, calorie target, planned mileage
- GET /program → weeks list with phase bands, calorie path, roadmap stages and unlock state
- GET /session/:id → sections, exercises, per-set targets, media, cues, last performance per exercise, alternatives (flag-safe)
- GET /exercise/:id/history
- GET /nutrition/:date → target, meals, logs, remaining
- GET /progress?metrics=&from=&to=
- GET /checkins → forms due, submissions, review threads
- GET /messages?since=
- GET /milestones

Write
- POST /session/:id/start, /session/:id/complete (difficulty, duration), /session/:id/skip
- POST /set-log (session_exercise_id, set_number, actual)
- POST /session/:id/swap-exercise (exercise_id, alt_id)
- POST /session/:id/customize (text override, standing rule: no free notes on the client side except this pencil override)
- POST /run-log
- POST /day/:date/task (key, done)
- POST /habit-log
- POST /meal-log (plan tick or custom kcal p c f)
- POST /day/:date/target-override (kcal, p, c, f)
- POST /daily-log (weight, steps, water, sleep, energy)
- POST /checkin/:form_id/submit
- POST /checkin/:submission_id/reply
- POST /message, POST /message/:id/read
- POST /day-swap (date_a, date_b) if feature enabled
- POST /photos (multipart, front side back, week)
- POST /device (push token, platform)

Every write validates against the client JWT's client_id at the RLS layer, not only in code.

### 11.3 Migrating the eight live apps without waiting for Base44

Add a portal endpoint `GET /export/pwa/:slug` that renders the current single-file COACH app from the database with the standard layout (goal and countdown, week strip, day strip, profile, today's training, nutrition, trackers, Monday photos and weigh-in, past weeks, reference last) and the current light theme. The generated file posts logs to the API when online and queues to localStorage when offline. This makes the portal the source of truth for the current clients on day one, and Base44 becomes a nicer skin on the same data later. It also removes the deploy mixup risk because the file is generated per slug and the page title is asserted at generation.

---

## PART 12. CLIENT APP SCREENS (for the Base44 build, so the API is designed for them)

Tabs: Today, Plan, Nutrition, Progress, Profile. Community and chat icon hidden unless enabled.

Today: greeting, Day X of N, phase, race countdown that reflects the viewed day, score ring, streak, then task list (each one tap), today's session card with Start, today's run card with Start, nutrition card (calories and protein progress, one tap to log each plan meal, plus Log Something Else), movement and water, recovery prompt, coach message, Monday-only photos and weigh-in card.

Plan: week strip with phase bands, day strip, selected day contents, past weeks read-only, roadmap stages.

Session player: full-screen list, per exercise a thumbnail, per set a row with target and an input, "same as last" tap, rest timer that survives leaving, PR flash, alternatives sheet filtered flag-safe, difficulty 1 to 5 on finish, resume bar if abandoned.

Run player: target block (distance, pace range, HR range, fueling), log fields, "stayed in zone" toggle, RPE, felt.

Nutrition: today's target and remaining, meals as tap-to-tick rows, custom logger with direct entry (kcal, p, c, f for the amount weighed; never per-100g math), swap list, grocery hub, weekly adherence shown larger than the daily number.

Progress: phase-default metrics, expand for all, photos by week with compare.

Profile: blueprint summary, goals, reminders and times, connected devices, check-in forms, submissions, units.

---

## PART 13. SECURITY AND OPERATIONS

- Supabase Auth. Coach email plus password. Clients magic link (phone in the gym) or Base44-mediated exchange. profiles.role gates everything.
- RLS deny-all, narrow policies per table for client role on own rows. Service role only in server code.
- Bloodwork and medical fields in separate tables with pgsodium column encryption and audit_log entries on every read.
- Storage buckets per client for photos and uploads, signed URLs with short expiry.
- Every state change writes events, every coach action writes audit_log.
- Environments: local, staging (Supabase project labeled ELVT OS STAGING), production (ELVT OS PROD). Netlify or Vercel site names carry the same labels. No real client data in staging. Seed script generates eight synthetic clients shaped like the real roster (recomp with spine flag, marathoner with calf flag, combat sport plus lifting, no-calorie-tracking habits client, deployed runner with dining facility constraints, army fitness test rebuild, race prep with HRV focus, 6 month transformation) so every rule path is exercised.
- pg_cron or a scheduled Edge Function for: nightly trigger evaluation, week roll, reminder dispatch, retention scan.
- Backups on, point in time recovery on.

---

## PART 14. BUILD ORDER FOR CLAUDE CODE

Sequenced by dependency, not by time. Each item is done when its tests pass against the synthetic seed. Reuse the existing audit style: a real DOM harness, legacy state test, constraint test per client, feature completeness test.

Block A. Foundation
1. Repo scaffold in ~/Projects/elvt-os-platform: Next.js App Router, TypeScript, Tailwind, Supabase (local via CLI), Playwright, Vitest. Light cream theme tokens from the current client apps (--bg #FAF7F2, --panel #FFFFFF, --panel2 #F4F0E9, --line #E4DFD6, --txt #111111, --mut #6E6A64, --gold #8A6F34, radius 12px), logo asset, Inter plus the heading face decision. US English strings only.
2. Schema migration for every table in Part 5. RLS policies. audit_log and events triggers. Seed script with eight synthetic clients.
3. Auth: coach login, client magic link, role middleware, API key exchange endpoint.
4. Exercise library import: parse the eight current client HTML files, extract every exercise name and YouTube id, dedupe by name and alias, write exercises rows with media.source = youtube_verified. Build the unmatched review screen.

Block B. The program engine
5. Builder: exercise CRUD with contraindication flags and alternatives, section and workout templates, run templates, program templates with split, progression rules, deload cadence, calorie path shape.
6. Template applier with the Blueprint filter (contraindications, preferred days, no back-to-back same stimulus, combat sport cap, rest days).
7. Client program tab: week strip, day grid, drag and drop, duplicate week, shift, swap days, deload mark, periodization grid, hybrid stress rail and flags.
8. Calorie path generator and the nutrition tab (path table, meals summing exactly, swap list, grocery hub scaling).
9. Week roll job, progression rules execution, snapshot, scores, streaks, milestones.

Block C. Intake and check-ins
10. Questionnaire builder and intake questionnaire from the blueprint document sections 1 to 10.
11. Blueprint drafter (AI) and approval screen. Program drafter and approval.
12. Question bank, trigger presets, per-client daily and weekly forms, spine-based weekly generator, submission views, compare, review threads with client replies.
13. Trigger engine nightly job, retention scan, queue_items.

Block D. The Queue and messaging
14. Queue home: attention items, Monday review cards with adherence, weight, check-in, flags, AI-proposed plan_changes with accept, edit, reject, drafted message, Accept All publishes and sends.
15. Messages: threads, scheduled sends, voice note upload, quick replies, touchpoint counting on the roster.
16. Reminders dispatcher with per-client times.

Block E. Client API and surfaces
17. All /api/v1 endpoints in Part 11 with RLS-backed tests.
18. PWA exporter GET /export/pwa/:slug producing the standard single-file app wired to the API, run the existing four audits against its output.
19. Base44 backend function templates (elvtSession, elvtGet, elvtPost, elvtWebhook) written as files in /integrations/base44 so they can be pasted into Base44 when that build starts.

Block F. Progress and polish
20. Progress tab with phase-default metrics, charts, CSV export.
21. Photos by week with compare.
22. Roster filters, bulk actions, client segments.
23. Race mode: countdown, taper start, race week dashboard change, planned versus completed mileage.

Phase 2 after the roster is live: wearables (Apple Health, Garmin, Strava, WHOOP, Oura), barcode and food database, bloodwork timeline, education library, video library search, community, challenges, milestone gifts, XP and levels rendering.

---

## PART 15. DEFINITION OF DONE FOR PHASE 1

- Darren adds a client from the portal, sends the intake link, the client completes it on a phone.
- The Blueprint drafts itself, Darren approves it in one screen.
- A 12 or 16 week program materializes from a template, respecting every flag, with a calorie path where week 12 equals the goal state.
- The client sees Day 1 on Monday in the generated PWA, logs a session with weights, ticks meals, logs the daily check-in.
- Sunday night the week rolls, the score and streak compute, the weekly form arrives at the client's chosen time with weight as question 1.
- Monday the queue shows the card with adherence, weight trend, the check-in, and three proposed changes with a drafted message. Accept All takes under two minutes.
- A trigger fires (steps under threshold two days running) and the suggested message is waiting in the queue the next morning.
- All four audits pass on the generated client app, the legacy state test passes, and the synthetic Janessa never sees a barbell back squat anywhere in 84 days.
