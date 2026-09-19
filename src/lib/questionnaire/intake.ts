import { SCALE_DEFAULTS, type Questionnaire } from "./types";

/**
 * The ELVT intake.
 *
 * Ten sections, one per part of the Blueprint the coach has to end up with.
 * Every question here exists because something downstream reads it: the
 * template applier reads the flags, the calorie path generator reads the
 * nutrition structure and the targets, the question bank filters on the goal
 * type, the trigger presets read the step goal and the failure mode. A
 * question nothing reads is a question not asked.
 *
 * The section order is the order a person can actually answer in. Goals first
 * because they are easy and set the frame; medical and constraints in the
 * middle once there is some momentum; communication and the one thing last,
 * because they are the questions that need a moment's thought and nobody
 * abandons a form on the last screen.
 *
 * Source note: Darren's blueprint document was not supplied to this build, so
 * these sections are derived from Part 4.6 and Part 5 of the portal spec,
 * which enumerate every field the Blueprint has to carry. Recorded in
 * docs/OPEN_QUESTIONS.md. If the document has questions worded differently,
 * this is the one file to change.
 */

const scale = { ...SCALE_DEFAULTS };

export const INTAKE: Questionnaire = {
  name: "ELVT intake",
  kind: "intake",
  sections: [
    {
      key: "goals",
      title: "What you want",
      intent: "The whole plan is built backwards from this, so it is worth being specific.",
      questions: [
        {
          key: "primary_goal",
          type: "multiple_choice",
          text: "What is the main thing you want out of the next few months?",
          required: true,
          options: [
            "Lose fat",
            "Build muscle",
            "Recomposition, both at once",
            "Train for a race",
            "Pass a fitness test",
            "Get back to training after a break",
          ],
          produces: ["primary_goal"],
        },
        {
          key: "goal_statement",
          type: "text",
          text: "Say it in your own words. What does done look like?",
          help: "A sentence is plenty. Numbers if you have them.",
          required: true,
          produces: ["goal_statement"],
        },
        {
          key: "goal_weight",
          type: "number",
          text: "Is there a weight you are aiming at?",
          help: "Leave it blank if there is not. A goal weight is not required.",
          unit: "lb",
          produces: ["goal_weight"],
        },
        {
          key: "duration_weeks",
          type: "multiple_choice",
          text: "How long do you want the first block to be?",
          required: true,
          options: ["8 weeks", "12 weeks", "16 weeks", "Not sure, you decide"],
          produces: ["duration_weeks"],
        },
        {
          key: "done_this_before",
          type: "yes_no",
          text: "Have you followed a structured plan before?",
          produces: ["experience"],
        },
      ],
    },

    {
      key: "starting_point",
      title: "Where you are starting",
      intent: "The first week's numbers come from these, so they go on the chart from day one.",
      questions: [
        {
          key: "start_weight",
          type: "metric",
          metric: "weight",
          text: "Current weight, first thing in the morning",
          help: "Fasted, after the bathroom, before you eat or drink. Same conditions every time.",
          unit: "lb",
          required: true,
          produces: ["start_weight"],
        },
        {
          key: "height_cm",
          type: "number",
          text: "Height",
          unit: "cm",
          required: true,
          produces: ["height_cm"],
        },
        {
          key: "dob",
          type: "date",
          text: "Date of birth",
          required: true,
          produces: ["dob"],
        },
        {
          key: "typical_steps",
          type: "metric",
          metric: "steps",
          text: "Steps on a normal day",
          help: "Your honest average, not your best day.",
          produces: ["step_goal"],
        },
        {
          key: "start_photos",
          type: "progress_photos",
          text: "Starting photos",
          help: "Front, side and back, same spot and same light each time. These are private and only your coach sees them.",
          angles: ["front", "side", "back"],
          produces: ["photos"],
        },
      ],
    },

    {
      key: "availability",
      title: "Your week",
      intent: "Sessions get placed on the days you actually have, not on a template's idea of a week.",
      questions: [
        {
          key: "days_per_week",
          type: "multiple_choice",
          text: "How many days a week can you train?",
          required: true,
          options: ["2", "3", "4", "5", "6"],
          produces: ["days_per_week"],
        },
        {
          key: "preferred_days",
          type: "multiple_choice",
          text: "Which days suit you best?",
          allowMultiple: true,
          required: true,
          options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
          produces: ["preferred_days"],
        },
        {
          key: "session_length",
          type: "multiple_choice",
          text: "How long can a session realistically be?",
          required: true,
          options: ["30 minutes", "45 minutes", "60 minutes", "75 minutes or more"],
          produces: ["session_length"],
        },
        {
          key: "equipment",
          type: "multiple_choice",
          text: "What do you have access to?",
          allowMultiple: true,
          required: true,
          options: [
            "Full gym",
            "Barbell and rack",
            "Dumbbells",
            "Kettlebells",
            "Bands",
            "Machines only",
            "Bodyweight only",
          ],
          produces: ["equipment"],
        },
        {
          key: "travel",
          type: "text",
          text: "Any travel coming up that will break the routine?",
          help: "Dates if you know them.",
          produces: ["travel"],
        },
      ],
    },

    {
      key: "running",
      title: "Running",
      intent: "Skipped entirely if you do not run. If you do, the mileage ramp is built from these.",
      questions: [
        {
          key: "runs_at_all",
          type: "yes_no",
          text: "Do you run?",
          required: true,
          produces: ["runs"],
        },
        {
          key: "weekly_mileage",
          type: "number",
          text: "Roughly how many miles a week right now?",
          unit: "miles",
          produces: ["weekly_mileage"],
        },
        {
          key: "longest_run",
          type: "number",
          text: "Longest run in the last month",
          unit: "miles",
          produces: ["longest_run"],
        },
        {
          key: "race_date",
          type: "date",
          text: "Is there a race in the diary?",
          help: "Leave blank if not.",
          produces: ["race_dates"],
        },
        {
          key: "race_goal",
          type: "text",
          text: "What is the goal for it?",
          help: "A time, or just finishing. Both are real answers.",
          produces: ["race_goal"],
        },
      ],
    },

    {
      key: "nutrition",
      title: "How you eat",
      intent: "The calorie path and the meal plan are shaped around this, not around a generic day.",
      questions: [
        {
          key: "tracks_food",
          type: "multiple_choice",
          text: "Do you track what you eat?",
          required: true,
          options: [
            "Yes, every day",
            "Sometimes",
            "No, and I do not want to",
            "No, but I would try",
          ],
          produces: ["nutrition_structure"],
        },
        {
          key: "meals_per_day",
          type: "multiple_choice",
          text: "How many times a day do you eat?",
          required: true,
          options: ["2", "3", "4", "5 or more"],
          produces: ["meals_per_day"],
        },
        {
          key: "who_cooks",
          type: "multiple_choice",
          text: "Who does the cooking?",
          required: true,
          options: [
            "Me, most days",
            "Someone else at home",
            "Mostly eating out or takeaway",
            "A dining facility or canteen",
          ],
          produces: ["nutrition_structure"],
        },
        {
          key: "foods_out",
          type: "text",
          text: "Anything you will not eat, or cannot?",
          help: "Allergies, dislikes, religious or ethical. All of it counts.",
          produces: ["constraints"],
        },
        {
          key: "alcohol",
          type: "multiple_choice",
          text: "Alcohol in a normal week?",
          options: ["None", "One or two", "A few", "More than I would like"],
          produces: ["alcohol"],
        },
      ],
    },

    {
      key: "recovery",
      title: "Sleep and recovery",
      intent: "Recovery is a category in your weekly score, so it is measured rather than assumed.",
      questions: [
        {
          key: "sleep_hours",
          type: "metric",
          metric: "sleep_hours",
          text: "Hours of sleep on a normal night",
          unit: "hours",
          required: true,
          produces: ["sleep"],
        },
        {
          key: "sleep_quality",
          type: "scale",
          ...scale,
          text: "How well do you sleep?",
          minLabel: "Badly",
          maxLabel: "Straight through",
          required: true,
          produces: ["sleep"],
        },
        {
          key: "stress",
          type: "scale",
          ...scale,
          text: "How stressful is life right now?",
          minLabel: "Calm",
          maxLabel: "Flat out",
          required: true,
          produces: ["stress"],
        },
        {
          key: "recovery_habits",
          type: "multiple_choice",
          text: "Anything you already do to recover?",
          allowMultiple: true,
          options: ["Stretching", "Mobility work", "Sauna", "Massage", "Walking", "Nothing yet"],
          produces: ["recovery_priorities"],
        },
      ],
    },

    {
      key: "medical",
      title: "Injuries and medical",
      intent:
        "This is the section that keeps movements you should not do out of your program automatically, so nothing here depends on anyone remembering it.",
      questions: [
        {
          key: "current_pain",
          type: "yes_no",
          text: "Anything hurting right now?",
          required: true,
          produces: ["flags"],
        },
        {
          key: "injury_areas",
          type: "multiple_choice",
          text: "Where, past or present?",
          allowMultiple: true,
          options: [
            "Lower back or spine",
            "Knee",
            "Shoulder",
            "Elbow",
            "Hip",
            "Achilles or calf",
            "Wrist",
            "Ankle",
            "Neck",
            "Ribs",
            "None of these",
          ],
          produces: ["flags"],
        },
        {
          key: "surgery",
          type: "text",
          text: "Any surgery or diagnosis a coach should know about?",
          help: "Dates and what was done, as much as you are comfortable writing.",
          produces: ["medical"],
        },
        {
          key: "cleared",
          type: "yes_no",
          text: "Has a doctor or physio cleared you to train?",
          required: true,
          produces: ["medical"],
        },
        {
          key: "medical_consent",
          type: "signature",
          text: "Confirm the above is accurate and you are training at your own risk",
          required: true,
          produces: ["consent"],
        },
      ],
    },

    {
      key: "history",
      title: "What has and has not worked",
      intent: "The failure mode in your blueprint comes from here, and so does what we do not try again.",
      questions: [
        {
          key: "what_worked",
          type: "text",
          text: "What has worked for you before?",
          required: true,
          produces: ["history"],
        },
        {
          key: "what_failed",
          type: "text",
          text: "What has not, and where did it usually fall apart?",
          help: "Week three, holidays, weekends, work trips. Be specific if you can.",
          required: true,
          produces: ["failure_mode"],
        },
        {
          key: "confidence",
          type: "scale",
          ...scale,
          text: "How confident are you that you will stick to this?",
          minLabel: "Not very",
          maxLabel: "Completely",
          required: true,
          produces: ["failure_mode"],
        },
        {
          key: "form_video",
          type: "media",
          text: "A short video of a squat or a deadlift, if you have one",
          help: "Optional. Side on, a couple of reps. It saves a lot of guessing.",
          produces: ["form"],
        },
      ],
    },

    {
      key: "communication",
      title: "How you want to be coached",
      intent: "This sets the tone of every message you get, and how often you get one.",
      questions: [
        {
          key: "tone",
          type: "multiple_choice",
          text: "What gets the best out of you?",
          required: true,
          options: [
            "Direct, tell me the number",
            "Encouraging, but honest",
            "Mostly leave me to it",
            "Check on me often",
          ],
          produces: ["tone"],
        },
        {
          key: "reminder_time",
          type: "multiple_choice",
          text: "When should reminders land?",
          required: true,
          options: ["Early morning", "Mid morning", "Lunchtime", "Evening"],
          produces: ["comm_prefs"],
        },
        {
          key: "checkin_day",
          type: "multiple_choice",
          text: "Which day suits the weekly check-in?",
          required: true,
          options: ["Sunday", "Monday"],
          produces: ["comm_prefs"],
        },
        {
          key: "accountability",
          type: "scale",
          ...scale,
          text: "How much accountability do you actually want?",
          minLabel: "Hands off",
          maxLabel: "On me constantly",
          required: true,
          produces: ["comm_prefs"],
        },
      ],
    },

    {
      key: "one_thing",
      title: "The one thing",
      intent: "Your coach reads this before every message. It is the single most useful answer here.",
      questions: [
        {
          key: "one_thing",
          type: "text",
          text: "What is the one thing you know you should be doing and are not?",
          required: true,
          produces: ["one_thing"],
        },
        {
          key: "biggest_obstacle",
          type: "text",
          text: "What is most likely to get in the way?",
          required: true,
          produces: ["failure_mode"],
        },
        {
          key: "anything_else",
          type: "text",
          text: "Anything else worth knowing?",
          produces: ["notes"],
        },
        {
          key: "start_readiness",
          type: "star_rating",
          // No min or max. Five stars is what a star rating is, and repeating
          // it on the question is how the two drift apart.
          text: "Ready to start?",
          required: true,
          produces: ["readiness"],
        },
      ],
    },
  ],
};
