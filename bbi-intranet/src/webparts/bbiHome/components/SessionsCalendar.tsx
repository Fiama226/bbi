import * as React from "react";
import styles from "./SessionsCalendar.module.scss";
import { IHomeSession } from "./homeData";
import { buildMonthGrid } from "./sessionsCalendarGrid";

export interface ISessionsCalendarProps {
  sessions: IHomeSession[];
}

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** Vue calendrier mensuelle des sessions, dérivée de la même liste Sessions que le planning texte. */
const SessionsCalendar: React.FC<ISessionsCalendarProps> = (props) => {
  const { sessions } = props;
  const today = React.useMemo(() => new Date(), []);
  const [cursor, setCursor] = React.useState<{ year: number; month: number }>({
    year: today.getFullYear(),
    month: today.getMonth(),
  });

  const weeks = React.useMemo(
    () => buildMonthGrid(sessions, cursor.year, cursor.month, today),
    [sessions, cursor, today],
  );

  const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(cursor.year, cursor.month, 1),
  );

  const changeMonth = (delta: number): void => {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  return (
    <div className={styles.calendar}>
      <div className={styles.calendarHeader}>
        <button
          type="button"
          className={styles.navButton}
          onClick={() => changeMonth(-1)}
          aria-label="Mois précédent"
        >
          ←
        </button>
        <strong className={styles.monthLabel}>{monthLabel}</strong>
        <button
          type="button"
          className={styles.navButton}
          onClick={() => changeMonth(1)}
          aria-label="Mois suivant"
        >
          →
        </button>
      </div>
      <div className={styles.weekdays} aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className={styles.grid} role="grid" aria-label={`Sessions de ${monthLabel}`}>
        {weeks.map((week, weekIndex) => (
          <div className={styles.week} role="row" key={weekIndex}>
            {week.map((day) => (
              <div
                role="gridcell"
                key={day.date.toISOString()}
                className={
                  [
                    styles.day,
                    !day.inMonth ? styles.dayOutside : "",
                    day.isToday ? styles.dayToday : "",
                    day.sessions.length > 0 ? styles.dayHasSessions : "",
                  ]
                    .filter((part) => !!part)
                    .join(" ")
                }
              >
                <span className={styles.dayNumber}>{day.date.getDate()}</span>
                {day.sessions.slice(0, 2).map((session) => (
                  <span className={styles.dayPill} key={session.Id} title={session.Title}>
                    {session.Title}
                  </span>
                ))}
                {day.sessions.length > 2 && (
                  <span className={styles.dayMore}>+{day.sessions.length - 2}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SessionsCalendar;
