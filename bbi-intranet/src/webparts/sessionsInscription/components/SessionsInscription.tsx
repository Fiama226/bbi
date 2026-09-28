import * as React from 'react';
import styles from './SessionsInscription.module.scss';
import {
  ISessionsInscriptionProps,
  ISessionItem,
  ISessionsResult
} from './ISessionsInscriptionProps';
import { loadSessions } from './sessionsData';

type LoadStatus = 'loading' | 'ready';

const MONTHS_FR: string[] = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'
];

const fullDate = (value?: string): string => {
  if (!value) {
    return 'Date à préciser';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Date à préciser';
  }
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
};

const monthLabel = (value?: string): string => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : MONTHS_FR[date.getMonth()];
};

const dayLabel = (value?: string): string => {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }
  const day = date.getDate();
  return day < 10 ? `0${day}` : String(day);
};

/** Lien « ajouter à mon agenda » (Outlook Web) — fonctionne sans code serveur. */
const outlookUrl = (session: ISessionItem): string => {
  if (!session.StartDate) {
    return '';
  }
  const start = new Date(session.StartDate);
  const end = session.EndDate ? new Date(session.EndDate) : new Date(start.getTime() + 7 * 3600 * 1000);
  const body = [
    session.CodeFormation ? `Formation : ${session.CodeFormation}` : '',
    session.Location ? `Lieu : ${session.Location}` : ''
  ]
    .filter((part) => !!part)
    .join('\n');
  return (
    'https://outlook.office.com/calendar/0/deeplink/compose' +
    `?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=${encodeURIComponent(session.Title)}` +
    `&startdt=${start.toISOString()}&enddt=${end.toISOString()}` +
    `&body=${encodeURIComponent(body)}` +
    (session.Location ? `&location=${encodeURIComponent(session.Location)}` : '')
  );
};

const SessionsInscription: React.FC<ISessionsInscriptionProps> = (props) => {
  const {
    siteUrl,
    sessionsListTitle,
    formationsListTitle,
    maxItems,
    showPast,
    showDataNotices,
    spHttpClient,
    strings
  } = props;
  const [status, setStatus] = React.useState<LoadStatus>('loading');
  const [result, setResult] = React.useState<ISessionsResult>({ items: [], isDemo: false, empty: false });
  const [filiere, setFiliere] = React.useState<string>(props.defaultFiliere || '');
  const [modality, setModality] = React.useState<string>('');
  const [includePast, setIncludePast] = React.useState<boolean>(showPast);
  const [query, setQuery] = React.useState<string>('');

  React.useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    loadSessions(spHttpClient, siteUrl, sessionsListTitle, formationsListTitle, Math.max(maxItems, 12), includePast)
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        setResult(loaded);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('ready');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [spHttpClient, siteUrl, sessionsListTitle, formationsListTitle, maxItems, includePast]);

  const filieres: string[] = React.useMemo(() => {
    const unique: { [key: string]: boolean } = {};
    result.items.forEach((item) => {
      if (item.Filiere) {
        unique[item.Filiere] = true;
      }
    });
    return Object.keys(unique).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [result.items]);

  const modalities: string[] = React.useMemo(() => {
    const unique: { [key: string]: boolean } = {};
    result.items.forEach((item) => {
      if (item.Modality) {
        unique[item.Modality] = true;
      }
    });
    return Object.keys(unique);
  }, [result.items]);

  const filtered: ISessionItem[] = React.useMemo(() => {
    const search = query.trim().toLowerCase();
    return result.items.filter((item) => {
      const matchFiliere = !filiere || (item.Filiere || '') === filiere;
      const matchModality = !modality || (item.Modality || '') === modality;
      const matchQuery =
        !search ||
        item.Title.toLowerCase().indexOf(search) !== -1 ||
        (item.CodeFormation || '').toLowerCase().indexOf(search) !== -1 ||
        (item.Location || '').toLowerCase().indexOf(search) !== -1;
      return matchFiliere && matchModality && matchQuery;
    });
  }, [result.items, filiere, modality, query]);

  // Regroupement par mois pour un planning lisible.
  const grouped: { label: string; items: ISessionItem[] }[] = React.useMemo(() => {
    const groups: { label: string; items: ISessionItem[] }[] = [];
    filtered.forEach((item) => {
      const label = item.StartDate
        ? new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(item.StartDate))
        : strings.NoDate;
      const existing = groups.filter((group) => group.label === label)[0];
      if (existing) {
        existing.items.push(item);
      } else {
        groups.push({ label, items: [item] });
      }
    });
    return groups.map((group) => ({
      label: group.label.charAt(0).toUpperCase() + group.label.slice(1),
      items: group.items
    }));
  }, [filtered, strings.NoDate]);

  if (status === 'loading') {
    return (
      <div className={styles.sessions}>
        <div className={styles.loading} role="status">
          {strings.LoadingMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sessions}>
      {showDataNotices && result.isDemo && <div className={styles.demoBanner}>💡 {strings.DemoBanner}</div>}

      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>{strings.Eyebrow}</p>
          <h1 className={styles.title}>{strings.WebPartTitle}</h1>
          <p className={styles.subtitle}>
            {filtered.length} {filtered.length > 1 ? strings.CountPlural : strings.CountSingular}
          </p>
        </div>
        <div className={styles.headActions}>
          <a
            className={styles.ghostAction}
            href={`${siteUrl}/Lists/${encodeURIComponent(sessionsListTitle)}/AllItems.aspx`}
          >
            {strings.ListLink}
          </a>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={() => {
              window.open(
                'https://outlook.office.com/calendar/0/view/month',
                '_blank',
                'noopener,noreferrer'
              );
            }}
          >
            {strings.CalendarCta}
          </button>
        </div>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{strings.SearchLabel}</span>
          <input
            type="search"
            value={query}
            placeholder={strings.SearchPlaceholder}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </label>

        {filieres.length > 1 && (
          <div className={styles.chips} role="group" aria-label={strings.FiliereLabel}>
            <span className={styles.chipsLabel}>{strings.FiliereLabel}</span>
            <button
              type="button"
              className={filiere === '' ? `${styles.chip} ${styles.chipActive}` : styles.chip}
              onClick={() => {
                setFiliere('');
              }}
            >
              {strings.FilterAll}
            </button>
            {filieres.map((value) => (
              <button
                key={value}
                type="button"
                className={filiere === value ? `${styles.chip} ${styles.chipActive}` : styles.chip}
                onClick={() => {
                  setFiliere(value);
                }}
              >
                {value}
              </button>
            ))}
          </div>
        )}

        {modalities.length > 1 && (
          <div className={styles.chips} role="group" aria-label={strings.ModalityLabel}>
            <span className={styles.chipsLabel}>{strings.ModalityLabel}</span>
            <button
              type="button"
              className={modality === '' ? `${styles.chip} ${styles.chipActive}` : styles.chip}
              onClick={() => {
                setModality('');
              }}
            >
              {strings.FilterAll}
            </button>
            {modalities.map((value) => (
              <button
                key={value}
                type="button"
                className={modality === value ? `${styles.chip} ${styles.chipActive}` : styles.chip}
                onClick={() => {
                  setModality(value);
                }}
              >
                {value}
              </button>
            ))}
          </div>
        )}

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={includePast}
            onChange={(event) => {
              setIncludePast(event.target.checked);
            }}
          />
          <span>{strings.IncludePastLabel}</span>
        </label>
      </div>

      {grouped.length === 0 ? (
        <div className={styles.empty}>
          <h3>{strings.EmptyStateTitle}</h3>
          <p>{strings.EmptyStateHint}</p>
        </div>
      ) : (
        grouped.map((group) => (
          <section className={styles.group} key={group.label} aria-label={group.label}>
            <h2 className={styles.groupTitle}>{group.label}</h2>
            <ul className={styles.list}>
              {group.items.map((session) => {
                const isPast = !!session.StartDate && new Date(session.StartDate).getTime() < Date.now();
                const sessionsCatalogueUrl = session.CodeFormation
                  ? `${siteUrl}/SitePages/formation.aspx?code=${encodeURIComponent(session.CodeFormation)}`
                  : `${siteUrl}/SitePages/catalogue.aspx`;
                return (
                  <li className={isPast ? `${styles.row} ${styles.rowPast}` : styles.row} key={session.Id}>
                    <div className={styles.date}>
                      <strong>{dayLabel(session.StartDate)}</strong>
                      <span>{monthLabel(session.StartDate)}</span>
                    </div>
                    <div className={styles.info}>
                      <h3>{session.Title}</h3>
                      <p className={styles.meta}>
                        {[session.Modality, session.Location].filter((part) => !!part).join(' · ') ||
                          strings.ModalityUnknown}
                      </p>
                      <p className={styles.dateText}>{fullDate(session.StartDate)}</p>
                      <div className={styles.tags}>
                        {session.Filiere && <span className={styles.tag}>{session.Filiere}</span>}
                        {session.CodeFormation && <span className={styles.tagCode}>{session.CodeFormation}</span>}
                        {isPast && <span className={styles.tagPast}>{strings.PastBadge}</span>}
                      </div>
                    </div>
                    <div className={styles.actions}>
                      {session.RegistrationUrl ? (
                        <a className={styles.register} href={session.RegistrationUrl}>
                          {session.Status || strings.RegisterCta}
                        </a>
                      ) : (
                        <span className={styles.status}>{session.Status || strings.ComingSoon}</span>
                      )}
                      <a className={styles.secondary} href={sessionsCatalogueUrl}>
                        {strings.SheetCta}
                      </a>
                      {session.StartDate && !isPast && (
                        <a
                          className={styles.tertiary}
                          href={outlookUrl(session)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {strings.CalendarLink}
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <p className={styles.footNote}>
        {strings.RegistrationNote.split('{url}')[0]}
        <a href={`${siteUrl}/SitePages/support.aspx`}>{strings.SupportLink}</a>
        {strings.RegistrationNote.split('{url}')[1] || ''}
      </p>
    </div>
  );
};

export default SessionsInscription;
