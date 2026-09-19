/**
 * The client app's runtime, as a string.
 *
 * Every rule in here is carried over from the eight live v1 apps, and every one
 * of them is there because it went wrong once. They are written as code rather
 * than as instructions because a rule in a comment is a rule someone breaks in
 * six months.
 *
 * Kept as a template string rather than a bundled module on purpose: the whole
 * point of this artifact is that it is one file a client can open with no build
 * step, no network and no dependencies.
 */

export const APP_SCRIPT = String.raw`
"use strict";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * Defaults first, then whatever was saved on top.
 *
 * This order is the rule. A client mid program whose saved state was written by
 * an older version of this file is missing keys the new one reads, and building
 * defaults first means those keys exist. The other way round, a saved state
 * replaces the whole object and the app breaks for exactly the people who have
 * been using it longest.
 */
function load() {
  var defaults = {
    version: DATA.generatedAt,
    viewedWeek: currentWeekNumber(),
    viewedDate: openingDate(),
    logs: {},
    meals: {},
    habits: {},
    trackers: {},
    archive: {},
    queue: []
  };

  var saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch (error) {
    saved = null;
  }

  if (!saved || typeof saved !== "object") return defaults;
  return Object.assign(defaults, saved);
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // A full or blocked store is not a reason to lose the screen. The queue is
    // a convenience; the API is the record.
  }
}

// ---------------------------------------------------------------------------
// Dates
//
// Every date shown reflects THE DAY BEING VIEWED, never today. A client looking
// back at Tuesday on Thursday must not see Thursday's countdown, Thursday's
// "today" marker or Thursday's Monday-only cards.
// ---------------------------------------------------------------------------

function todayLocal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DATA.client.timezone }).format(new Date());
}

function addDays(date, days) {
  var parts = date.split("-").map(Number);
  var shifted = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
  return shifted.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  var toUtc = function (d) {
    var p = d.split("-").map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

function weekdayOf(date) {
  var p = date.split("-").map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
}

/**
 * The day the app opens on.
 *
 * Today when today is in the program. Before it starts, the first day; after it
 * ends, the last. Opening on a date the program does not contain showed "Rest
 * day. Nothing scheduled." to a client whose block starts on Monday, which
 * reads as a broken app rather than as a week that has not begun.
 */
function openingDate() {
  var today = todayLocal();
  if (dayFor(today)) return today;

  var first = firstDate();
  var last = lastDate();
  if (!first || !last) return today;
  return today < first ? first : last;
}

function firstDate() {
  for (var i = 0; i < DATA.weeks.length; i += 1) {
    if (DATA.weeks[i].days.length) return DATA.weeks[i].days[0].date;
  }
  return null;
}

function lastDate() {
  for (var i = DATA.weeks.length - 1; i >= 0; i -= 1) {
    var days = DATA.weeks[i].days;
    if (days.length) return days[days.length - 1].date;
  }
  return null;
}

function currentWeekNumber() {
  var today = todayLocal();
  var first = firstDate();
  // Before the block starts, week 1 rather than nothing. After it ends, the
  // last week, so a client looking back lands where they finished.
  if (first && today < first) return DATA.weeks.length ? DATA.weeks[0].weekNumber : 1;

  for (var i = DATA.weeks.length - 1; i >= 0; i -= 1) {
    if (DATA.weeks[i].startsOn <= today) return DATA.weeks[i].weekNumber;
  }
  return DATA.weeks.length ? DATA.weeks[0].weekNumber : 1;
}

function weekFor(number) {
  for (var i = 0; i < DATA.weeks.length; i += 1) {
    if (DATA.weeks[i].weekNumber === number) return DATA.weeks[i];
  }
  return null;
}

function dayFor(date) {
  for (var i = 0; i < DATA.weeks.length; i += 1) {
    var days = DATA.weeks[i].days;
    for (var j = 0; j < days.length; j += 1) {
      if (days[j].date === date) return days[j];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Week switching
//
// Non-destructive. The week being left is archived before the next is loaded,
// so a client who flicks back to week 3 sees what they actually logged rather
// than an empty week.
// ---------------------------------------------------------------------------

function switchWeek(number) {
  if (number === state.viewedWeek) return;

  state.archive[String(state.viewedWeek)] = {
    logs: JSON.parse(JSON.stringify(state.logs)),
    meals: JSON.parse(JSON.stringify(state.meals)),
    habits: JSON.parse(JSON.stringify(state.habits)),
    trackers: JSON.parse(JSON.stringify(state.trackers))
  };

  var restored = state.archive[String(number)];
  if (restored) {
    state.logs = restored.logs;
    state.meals = restored.meals;
    state.habits = restored.habits;
    state.trackers = restored.trackers;
  }

  state.viewedWeek = number;
  var week = weekFor(number);
  if (week && week.days.length) {
    // The viewed date follows the week, so nothing on screen is from a
    // different week than the strip says.
    state.viewedDate = week.days[0].date;
  }

  save();
  render();
}

function viewDate(date) {
  state.viewedDate = date;
  save();
  render();
}

// ---------------------------------------------------------------------------
// Rendering
//
// render() NEVER scrolls the page. No scrollIntoView anywhere, and the scroll
// position is captured before the DOM is replaced and restored after, because
// replacing innerHTML resets it. A client one tap into a session, whose screen
// jumps to the top every time they log a set, stops logging sets.
// ---------------------------------------------------------------------------

function render() {
  var scrollX = window.scrollX;
  var scrollY = window.scrollY;

  var root = document.getElementById("app");
  var html = "";

  // Each card in its own try/catch. One card throwing must not take the page
  // with it: a client with a malformed run on Thursday still needs Thursday's
  // nutrition.
  var cards = [
    ["goal", cardGoal],
    ["weeks", cardWeekStrip],
    ["days", cardDayStrip],
    ["profile", cardProfile],
    ["training", cardTraining],
    ["nutrition", cardNutrition],
    ["trackers", cardTrackers],
    ["monday", cardMonday],
    ["past", cardPastWeeks],
    ["reference", cardReference]
  ];

  for (var i = 0; i < cards.length; i += 1) {
    try {
      html += cards[i][1]();
    } catch (error) {
      html += '<section class="card err" data-card="' + cards[i][0] + '">' +
        '<p class="label">' + cards[i][0] + '</p>' +
        '<p class="mut">This part did not load. Everything else still works.</p>' +
        '</section>';
    }
  }

  root.innerHTML = html;
  bind();

  // Restored, not reset. Nothing here calls scrollIntoView.
  window.scrollTo(scrollX, scrollY);
}

// ---------------------------------------------------------------------------
// Cards, in the order the spec fixes them
// ---------------------------------------------------------------------------

function cardGoal() {
  var viewed = state.viewedDate;
  var out = '<section class="card" data-card="goal">';
  out += '<p class="label">' + esc(DATA.program.name) + '</p>';
  out += '<h1>' + esc(DATA.program.goalStatement) + '</h1>';

  if (DATA.program.raceDate) {
    // Counted from the day being viewed. Looking back at last Tuesday shows the
    // countdown as it was on that Tuesday.
    var out_days = daysBetween(viewed, DATA.program.raceDate);
    out += '<p class="big num">' + Math.max(0, out_days) + '</p>';
    out += '<p class="mut">days out on ' + esc(viewed) + '</p>';
  } else {
    var day = daysBetween(DATA.program.startDate, viewed) + 1;
    out += '<p class="big num">' + day + '</p>';
    out += '<p class="mut">of ' + (DATA.program.weeks * 7) + ' days</p>';
  }

  return out + '</section>';
}

function cardWeekStrip() {
  var out = '<section class="card" data-card="weeks"><p class="label">Weeks</p><div class="strip">';
  for (var i = 0; i < DATA.weeks.length; i += 1) {
    var week = DATA.weeks[i];
    var on = week.weekNumber === state.viewedWeek;
    out += '<button class="chip' + (on ? ' on' : '') + '" data-week="' + week.weekNumber + '">' +
      '<span class="num">' + week.weekNumber + '</span>' +
      (week.isDeload ? '<span class="label">Deload</span>' : '') +
      '</button>';
  }
  return out + '</div></section>';
}

function cardDayStrip() {
  var week = weekFor(state.viewedWeek);
  if (!week) return "";

  var names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var out = '<section class="card" data-card="days"><p class="label">Week ' + week.weekNumber +
    '</p><div class="strip">';

  for (var i = 0; i < week.days.length; i += 1) {
    var day = week.days[i];
    var on = day.date === state.viewedDate;
    out += '<button class="chip' + (on ? ' on' : '') + '" data-date="' + day.date + '">' +
      '<span class="label">' + names[weekdayOf(day.date)] + '</span>' +
      '<span class="num">' + Number(day.date.slice(8)) + '</span>' +
      '</button>';
  }
  return out + '</div></section>';
}

function cardProfile() {
  var out = '<section class="card compact" data-card="profile">';
  out += '<p class="label">' + esc(DATA.client.firstName) + '</p>';
  out += '<p class="mut">Week ' + state.viewedWeek + ' of ' + DATA.program.weeks +
    ' · ' + esc(DATA.client.units) + '</p>';
  return out + '</section>';
}

function cardTraining() {
  var day = dayFor(state.viewedDate);
  var out = '<section class="card" data-card="training"><p class="label">Training</p>';

  if (!day) {
    // A date outside the block. Saying "rest day" here is a lie, and a client
    // whose program starts Monday should be told that rather than shown an
    // empty screen.
    var first = firstDate();
    out += '<p class="mut">' +
      (first && state.viewedDate < first
        ? 'Your block starts on ' + esc(first) + '.'
        : 'That day is outside this block.') +
      '</p>';
    return out + '</section>';
  }

  if (day.isRest || !day.sessions.length) {
    out += '<p class="mut">Rest day. Nothing scheduled.</p>';
    return out + '</section>';
  }

  for (var s = 0; s < day.sessions.length; s += 1) {
    var session = day.sessions[s];
    out += '<h2>' + esc(session.name) + '</h2>';

    if (session.kind === "run" && session.run) {
      out += '<p class="mut">' +
        (session.run.distanceTarget ? session.run.distanceTarget + ' miles' : 'Distance open') +
        (session.run.paceMin ? ' · ' + session.run.paceMin + ' to ' + session.run.paceMax : '') +
        '</p>';
      if (session.run.fueling) out += '<p class="mut">' + esc(session.run.fueling) + '</p>';
      continue;
    }

    for (var e = 0; e < session.exercises.length; e += 1) {
      var exercise = session.exercises[e];
      out += '<div class="ex" data-exercise="' + exercise.id + '">';
      out += '<a class="vid" href="https://www.youtube.com/watch?v=' + esc(exercise.youtubeId) +
        '" target="_blank" rel="noreferrer">' + esc(exercise.name) + '</a>';

      for (var t = 0; t < exercise.sets.length; t += 1) {
        var target = exercise.sets[t];
        out += '<div class="set">';
        out += '<span class="label">Set ' + target.set + '</span>';
        out += '<span class="num">' +
          (target.reps ? target.reps + ' reps' : target.time ? target.time + 's' : '') + '</span>';

        // The weight box appears on rep based work and nowhere else. Never on a
        // timed hold, never on a run, never on a rest day.
        if (exercise.logsWeight) {
          var key = state.viewedDate + ':' + exercise.id + ':' + target.set;
          var logged = state.logs[key] || {};
          out += '<input class="w" type="number" inputmode="decimal" placeholder="weight" ' +
            'data-log="' + key + '" value="' + (logged.weight == null ? "" : logged.weight) + '">';
        }
        out += '</div>';
      }
      out += '</div>';
    }
  }

  return out + '</section>';
}

function cardNutrition() {
  var day = dayFor(state.viewedDate);
  var week = weekFor(state.viewedWeek);
  var calories = (day && day.calories) || (week && week.calories) || null;
  var protein = (day && day.protein) || (week && week.protein) || null;

  var out = '<section class="card" data-card="nutrition"><p class="label">Nutrition</p>';
  out += '<p class="big num">' + (calories == null ? "" : calories) + '</p>';
  out += '<p class="mut">' + (protein == null ? "" : protein + 'g protein') + '</p>';

  for (var i = 0; i < DATA.meals.length; i += 1) {
    var meal = DATA.meals[i];
    var key = state.viewedDate + ':' + meal.id;
    var ticked = state.meals[key] === true;
    out += '<button class="row' + (ticked ? ' on' : '') + '" data-meal="' + key + '">' +
      '<span>' + esc(meal.name) + '</span>' +
      '<span class="num">' + meal.calories + '</span>' +
      '</button>';
  }

  return out + '</section>';
}

function cardTrackers() {
  var out = '<section class="card" data-card="trackers"><p class="label">Today</p>';
  var fields = [
    ["steps", "Steps"],
    ["water", "Water"],
    ["sleep_hours", "Sleep"],
    ["energy", "Energy"]
  ];

  for (var i = 0; i < fields.length; i += 1) {
    var key = state.viewedDate + ':' + fields[i][0];
    out += '<div class="row"><span>' + fields[i][1] + '</span>' +
      '<input class="w" type="number" inputmode="numeric" data-tracker="' + key + '" value="' +
      (state.trackers[key] == null ? "" : state.trackers[key]) + '"></div>';
  }

  return out + '</section>';
}

function cardMonday() {
  // Monday of the day being VIEWED, not of today. Looking back at a Monday
  // three weeks ago shows that Monday's cards.
  if (weekdayOf(state.viewedDate) !== 1) return "";

  var out = '<section class="card" data-card="monday"><p class="label">Monday</p>';
  out += '<div class="row"><span>Fasted weight</span>' +
    '<input class="w" type="number" inputmode="decimal" data-tracker="' +
    state.viewedDate + ':weight" value="' +
    (state.trackers[state.viewedDate + ':weight'] == null ? "" : state.trackers[state.viewedDate + ':weight']) +
    '"></div>';
  out += '<div class="row"><span>Photos</span>' +
    '<input type="file" accept="image/*" capture="environment" data-photo="' + state.viewedDate + '"></div>';
  return out + '</section>';
}

function cardPastWeeks() {
  var out = '<section class="card" data-card="past"><p class="label">Past weeks</p>';
  for (var i = 0; i < DATA.weeks.length; i += 1) {
    var week = DATA.weeks[i];
    if (week.weekNumber >= state.viewedWeek) continue;
    out += '<button class="row" data-week="' + week.weekNumber + '">' +
      '<span>Week ' + week.weekNumber + '</span>' +
      '<span class="num">' + (week.calories == null ? "" : week.calories) + '</span>' +
      '</button>';
  }
  return out + '</section>';
}

function cardReference() {
  if (!DATA.reference.length) return "";
  var out = '<section class="card" data-card="reference"><p class="label">Reference</p>';
  for (var i = 0; i < DATA.reference.length; i += 1) {
    out += '<details><summary>' + esc(DATA.reference[i].title) + '</summary>' +
      '<p class="mut">' + esc(DATA.reference[i].body) + '</p></details>';
  }
  return out + '</section>';
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function bind() {
  var root = document.getElementById("app");

  root.querySelectorAll("[data-week]").forEach(function (node) {
    node.addEventListener("click", function () {
      switchWeek(Number(node.getAttribute("data-week")));
    });
  });

  root.querySelectorAll("[data-date]").forEach(function (node) {
    node.addEventListener("click", function () {
      viewDate(node.getAttribute("data-date"));
    });
  });

  root.querySelectorAll("[data-meal]").forEach(function (node) {
    node.addEventListener("click", function () {
      var key = node.getAttribute("data-meal");
      state.meals[key] = !state.meals[key];
      save();
      post("/meal-log", { date: key.split(":")[0], meal_id: key.split(":")[1], source: "plan_tick" });
      render();
    });
  });

  root.querySelectorAll("[data-log]").forEach(function (node) {
    node.addEventListener("change", function () {
      var key = node.getAttribute("data-log");
      var parts = key.split(":");
      state.logs[key] = { weight: node.value === "" ? null : Number(node.value) };
      save();
      post("/set-log", {
        session_exercise_id: parts[1],
        set_number: Number(parts[2]),
        actual: { weight: Number(node.value) },
        logged_for_date: parts[0]
      });
    });
  });

  root.querySelectorAll("[data-tracker]").forEach(function (node) {
    node.addEventListener("change", function () {
      var key = node.getAttribute("data-tracker");
      var parts = key.split(":");
      state.trackers[key] = node.value === "" ? null : Number(node.value);
      save();
      var body = { date: parts[0] };
      body[parts[1]] = Number(node.value);
      post("/daily-log", body);
    });
  });
}

// ---------------------------------------------------------------------------
// The API
//
// Posts when online, queues when not. The queue drains on the next successful
// call and on the online event, so a session logged in a basement arrives when
// the client walks out.
// ---------------------------------------------------------------------------

function post(path, body) {
  if (!navigator.onLine) {
    state.queue.push({ path: path, body: body, at: Date.now() });
    save();
    return Promise.resolve(false);
  }

  return fetch(DATA.apiBase + path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + token() },
    body: JSON.stringify(body)
  })
    .then(function (response) {
      if (!response.ok) throw new Error(String(response.status));
      drain();
      return true;
    })
    .catch(function () {
      state.queue.push({ path: path, body: body, at: Date.now() });
      save();
      return false;
    });
}

function drain() {
  if (!state.queue.length || !navigator.onLine) return;
  var pending = state.queue.slice();
  state.queue = [];
  save();

  pending.forEach(function (item) {
    fetch(DATA.apiBase + item.path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token() },
      body: JSON.stringify(item.body)
    }).catch(function () {
      state.queue.push(item);
      save();
    });
  });
}

function token() {
  try {
    return localStorage.getItem(STORAGE_KEY + ":token") || "";
  } catch (error) {
    return "";
  }
}

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
  });
}

window.addEventListener("online", drain);

var state = load();
render();
drain();
`;
