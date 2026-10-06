import { IHomeSession } from "./homeData";

export interface ICalendarDay {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  sessions: IHomeSession[];
}

export type ICalendarWeek = ICalendarDay[];

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Lundi = 0 ... dimanche = 6 (semaine française). */
const mondayIndex = (jsDay: number): number => (jsDay + 6) % 7;

/**
 * Construit une grille de semaines (lundi → dimanche) couvrant le mois donné,
 * avec les jours de bordure des mois adjacents pour compléter la première et
 * la dernière semaine. Chaque session multi-jours apparaît sur chacune des
 * journées de son intervalle [StartDate, EndDate].
 *
 * Fonction pure : aucun accès réseau ni horloge autre que `today` (paramètre
 * explicite), pour rester testable sans dépendance au jour d'exécution.
 */
export const buildMonthGrid = (
  sessions: IHomeSession[],
  year: number,
  month: number,
  today: Date = new Date(),
): ICalendarWeek[] => {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = mondayIndex(firstOfMonth.getDay());
  const gridStart = new Date(year, month, 1 - startOffset);

  const lastOfMonth = new Date(year, month + 1, 0);
  const endOffset = 6 - mondayIndex(lastOfMonth.getDay());
  const gridEnd = new Date(year, month + 1, endOffset);

  const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000) + 1;

  const sessionRanges = sessions
    .map((session) => {
      const start = session.StartDate ? new Date(session.StartDate) : undefined;
      if (!start || Number.isNaN(start.getTime())) {
        return undefined;
      }
      const end = session.EndDate ? new Date(session.EndDate) : start;
      const validEnd = Number.isNaN(end.getTime()) ? start : end;
      return { session, start, end: validEnd };
    })
    .filter((entry): entry is { session: IHomeSession; start: Date; end: Date } => !!entry);

  const days: ICalendarDay[] = [];
  for (let i = 0; i < totalDays; i += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayEnd = dayStart + 86400000 - 1;
    const sessionsOnDay = sessionRanges
      .filter((entry) => entry.start.getTime() <= dayEnd && entry.end.getTime() >= dayStart)
      .map((entry) => entry.session);
    days.push({
      date,
      inMonth: date.getMonth() === month,
      isToday: sameDay(date, today),
      sessions: sessionsOnDay,
    });
  }

  const weeks: ICalendarWeek[] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
};
