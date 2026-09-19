"use client";

import { useState } from "react";
import { DAY_SHORT, STIMULUS_SHORT, type Stimulus } from "@/lib/program/types";
import type { WeekView } from "@/lib/program/view";

/**
 * The seven column day grid.
 *
 * Drag and drop is the native HTML5 API rather than a library: the whole
 * interaction is pick up a card, drop it on a day, and a dependency for that
 * would be more code than the thing it replaces.
 *
 * Moving a session is a state change, so the card it came from fades while the
 * write is in flight. That is one of the three motions the design allows.
 */

export type MoveHandler = (input: {
  sessionKey: string;
  fromDate: string;
  toDate: string;
}) => void;

export function DayGrid({
  week,
  peakDayStress,
  onMove,
  readOnly,
}: {
  week: WeekView;
  peakDayStress: number;
  onMove?: MoveHandler;
  readOnly?: boolean;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[840px] grid-cols-7 border-line [border-top-width:1px]"
        data-testid="day-grid"
      >
        {week.days.map((day) => {
          const isOver = over === day.date;
          return (
            <div
              key={day.date}
              data-testid="day-column"
              data-date={day.date}
              onDragOver={(e) => {
                if (readOnly) return;
                e.preventDefault();
                setOver(day.date);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                if (readOnly || !dragging) return;
                e.preventDefault();
                const [sessionKey, fromDate] = dragging.split("::");
                setOver(null);
                setDragging(null);
                if (fromDate === day.date) return;
                setSaving(sessionKey);
                onMove?.({ sessionKey, fromDate, toDate: day.date });
              }}
              className={[
                "min-h-[180px] border-line px-2 py-2 [border-right-width:1px]",
                isOver ? "bg-raised" : "",
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between">
                <span className="elvt-label">{DAY_SHORT[day.dayOfWeek]}</span>
                <span className="elvt-num text-caption text-txt-secondary">
                  {day.stress > 0 ? day.stress : ""}
                </span>
              </div>

              {/* A thin bar rather than a number, scaled against the block peak. */}
              <div className="mt-1 h-1 bg-raised">
                <div
                  aria-hidden="true"
                  className="h-1 bg-txt-dim"
                  style={{
                    width: `${Math.min(100, (day.stress / peakDayStress) * 100)}%`,
                  }}
                />
              </div>

              {day.sessions.length === 0 ? (
                <p className="mt-3 text-caption text-txt-tertiary">Rest</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {day.sessions.map((session) => {
                    const handle = `${session.key}::${day.date}`;
                    return (
                      <li
                        key={session.key}
                        draggable={!readOnly}
                        onDragStart={() => setDragging(handle)}
                        onDragEnd={() => {
                          setDragging(null);
                          setOver(null);
                        }}
                        data-testid="session-card"
                        className={[
                          "bg-raised px-2 py-2",
                          readOnly ? "" : "cursor-grab",
                          saving === session.key ? "elvt-row-saving" : "",
                        ].join(" ")}
                      >
                        <p className="truncate text-body">{session.name}</p>
                        <p className="elvt-label mt-1 truncate">
                          {STIMULUS_SHORT[session.stimulus as Stimulus] ??
                            session.stimulus}
                        </p>
                        <p className="mt-1 truncate text-caption text-txt-secondary">
                          {session.summary}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
