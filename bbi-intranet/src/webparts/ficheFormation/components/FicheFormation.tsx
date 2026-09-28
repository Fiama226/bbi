import * as React from 'react';
import styles from './FicheFormation.module.scss';
import { IFicheFormationProps, IFicheFormationData } from './IFicheFormationProps';
import { demoResult, loadFicheFormation } from './ficheData';

type LoadStatus = 'loading' | 'ready' | 'empty';

const formatDateRange = (value?: string): string => {
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

const durationLabel = (value?: number | string): string => {
  if (value === undefined || value === '') {
    return '';
  }
  const numeric = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (Number.isNaN(numeric)) {
    return String(value);
  }
  const hours = Math.floor(numeric);
  const minutes = Math.round((numeric - hours) * 60);
  return minutes > 0 ? `${hours} h ${minutes < 10 ? '0' : ''}${minutes}` : `${hours} h`;
};

/** Découpe un champ texte multi-lignes en puces lorsque c'est pertinent. */
const toBullets = (value?: string): string[] =>
  (value || '')
    .split(/\n+|\s*•\s*/)
    .map((line) => line.replace(/^[-–\s]+/, '').trim())
    .filter((line) => line.length > 0);

const iconForFile = (fileName?: string): string => {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pptx':
    case 'ppt':
      return '📊';
    case 'docx':
    case 'doc':
      return '📘';
    case 'xlsx':
    case 'xls':
      return '📗';
    case 'pdf':
      return '📄';
    case 'mp4':
    case 'mov':
      return '🎬';
    default:
      return '📄';
  }
};

/** Lit le paramètre ?code= de l'URL, avec repli sur #code= (pratique en workbench). */
const readCodeFromUrl = (): string => {
  try {
    const search = new URLSearchParams(window.location.search);
    const fromQuery = search.get('code') || search.get('Code') || search.get('formation');
    if (fromQuery) {
      return fromQuery.trim();
    }
    const hash = window.location.hash || '';
    const match = /[?#&]code=([^&]+)/i.exec(hash);
    if (match) {
      return decodeURIComponent(match[1]).trim();
    }
  } catch {
    /* URL illisible : on retombe sur la propriété de la web part */
  }
  return '';
};

const FicheFormation: React.FC<IFicheFormationProps> = (props) => {
  const [status, setStatus] = React.useState<LoadStatus>('loading');
  const [data, setData] = React.useState<IFicheFormationData>(() => ({
    sessions: [],
    documents: [],
    trainers: [],
    isDemo: false,
    availableFields: []
  }));
  const [code, setCode] = React.useState<string>(readCodeFromUrl() || props.defaultCode || '');

  React.useEffect(() => {
    const onHashChange = (): void => {
      const next = readCodeFromUrl();
      if (next) {
        setCode(next);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    loadFicheFormation(
      props.spHttpClient,
      props.siteUrl,
      props.formationsListTitle,
      props.sessionsListTitle,
      props.documentsLibraryTitle,
      props.trainersListTitle,
      code,
      { sessions: props.showSessions, documents: props.showDocuments, trainer: props.showTrainer }
    )
      .then((result) => {
        if (cancelled) {
          return;
        }
        setData(result);
        setStatus(result.formation ? 'ready' : 'empty');
      })
      .catch(() => {
        if (!cancelled) {
          setData(demoResult());
          setStatus('ready');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    props.spHttpClient,
    props.siteUrl,
    props.formationsListTitle,
    props.sessionsListTitle,
    props.documentsLibraryTitle,
    props.trainersListTitle,
    props.showSessions,
    props.showDocuments,
    props.showTrainer,
    code
  ]);

  if (status === 'loading') {
    return (
      <div className={styles.fiche}>
        <div className={styles.loading} role="status">
          {props.strings.LoadingMessage}
        </div>
      </div>
    );
  }

  const formation = data.formation;
  if (!formation || status === 'empty') {
    return (
      <div className={styles.fiche}>
        <div className={styles.empty}>
          <h3>{props.strings.EmptyStateTitle}</h3>
          <p>{props.strings.EmptyStateHint}</p>
          <a className={styles.primaryAction} href={`${props.siteUrl}/SitePages/catalogue.aspx`}>
            {props.strings.BackToCatalog}
          </a>
        </div>
      </div>
    );
  }

  const catalogUrl = `${props.siteUrl}/SitePages/catalogue.aspx`;
  const objectives = toBullets(formation.Objectifs);
  const programme = toBullets(formation.Programme);
  const prerequisites = toBullets(formation.Prerequis);

  const facts: { label: string; value: string }[] = [
    { label: props.strings.FactFiliere, value: formation.Filiere || '—' },
    { label: props.strings.FactModalite, value: formation.Modalite || '—' },
    { label: props.strings.FactDuree, value: durationLabel(formation.DureeH) || '—' },
    { label: props.strings.FactNiveau, value: formation.Niveau || '—' }
  ];

  return (
    <div className={styles.fiche}>
      {props.showDataNotices && data.isDemo && (
        <div className={styles.demoBanner}>💡 {props.strings.DemoBanner}</div>
      )}

      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <nav className={styles.breadcrumb} aria-label="Fil d'ariane">
            <a href={props.siteUrl}>{props.strings.BreadcrumbHome}</a>
            <span aria-hidden="true">›</span>
            <a href={catalogUrl}>{props.strings.BreadcrumbCatalog}</a>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{formation.Title}</span>
          </nav>
          <p className={styles.eyebrow}>
            {props.strings.WebPartTitle}
            {formation.Filiere ? ` · ${formation.Filiere}` : ''}
          </p>
          <h1 className={styles.title}>{formation.Title}</h1>
          <p className={styles.subtitle}>
            {[formation.CodeFormation, formation.Niveau, formation.Modalite]
              .filter((part) => !!part)
              .join(' · ')}
          </p>
          <div className={styles.heroActions}>
            {formation.LienInscription ? (
              <a className={styles.primaryAction} href={formation.LienInscription}>
                {props.strings.RegisterCta}
              </a>
            ) : (
              <a className={styles.primaryAction} href="#sessions">
                {props.strings.SessionsCta}
              </a>
            )}
            {props.showDocuments && data.documents.length > 0 && (
              <a className={styles.secondaryAction} href="#supports">
                {props.strings.DocumentsCta} <span aria-hidden="true">({data.documents.length})</span>
              </a>
            )}
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <section className={styles.main}>
          {formation.Description && (
            <section className={styles.block}>
              <h2>{props.strings.AboutTitle}</h2>
              <p className={styles.paragraph}>{formation.Description}</p>
            </section>
          )}

          {objectives.length > 0 && (
            <section className={styles.block}>
              <h2>{props.strings.ObjectivesTitle}</h2>
              <ul className={styles.bullets}>
                {objectives.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {programme.length > 0 && (
            <section className={styles.block}>
              <h2>{props.strings.ProgramTitle}</h2>
              <ol className={styles.program}>
                {programme.map((item, index) => (
                  <li key={item}>
                    <span className={styles.programIndex} aria-hidden="true">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {prerequisites.length > 0 && (
            <section className={styles.block}>
              <h2>{props.strings.PrerequisitesTitle}</h2>
              <ul className={styles.bullets}>
                {prerequisites.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {props.showSessions && (
            <section className={styles.block} id="sessions">
              <h2>{props.strings.SessionsTitle}</h2>
              {data.sessions.length === 0 ? (
                <p className={styles.muted}>{props.strings.NoSessions}</p>
              ) : (
                <ul className={styles.sessionList}>
                  {data.sessions.map((session) => (
                    <li className={styles.session} key={session.Id}>
                      <div className={styles.sessionWhen}>
                        <strong>{formatDateRange(session.StartDate)}</strong>
                        <small>
                          {[session.Modality, session.Location].filter((part) => !!part).join(' · ')}
                        </small>
                      </div>
                      {session.RegistrationUrl ? (
                        <a className={styles.sessionAction} href={session.RegistrationUrl}>
                          {session.Status || props.strings.RegisterCta}
                        </a>
                      ) : (
                        <span className={styles.sessionBadge}>
                          {session.Status || props.strings.NoSessions}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {props.showDocuments && data.documents.length > 0 && (
            <section className={styles.block} id="supports">
              <h2>{props.strings.DocumentsTitle}</h2>
              <p className={styles.secureNote}>🔒 {props.strings.ReadOnlyNote}</p>
              <div className={styles.documentGrid}>
                {data.documents.map((document) => (
                  <a
                    className={styles.document}
                    key={document.Id}
                    href={document.FileRef.indexOf('http') === 0 ? `${document.FileRef}?web=1` : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className={styles.documentIcon} aria-hidden="true">
                      {iconForFile(document.FileLeafRef)}
                    </span>
                    <span>
                      <strong>{document.Title || document.FileLeafRef}</strong>
                      <small>{document.TypeSupport || document.FileLeafRef.split('.').pop()}</small>
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </section>

        <aside className={styles.sidebar} aria-label={props.strings.FactsTitle}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>{props.strings.FactsTitle}</h3>
            <ul className={styles.facts}>
              {facts.map((fact) => (
                <li key={fact.label}>
                  <span>{fact.label}</span>
                  <strong>{fact.value}</strong>
                </li>
              ))}
            </ul>
          </div>

          {formation.PublicVise && (
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>{props.strings.AudienceTitle}</h3>
              <p className={styles.cardText}>{formation.PublicVise}</p>
            </div>
          )}

          {props.showTrainer && data.trainers.length > 0 && (
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>{props.strings.TrainersTitle}</h3>
              <ul className={styles.trainerList}>
                {data.trainers.map((trainer) => (
                  <li key={trainer.Id}>
                    <span className={styles.avatar}>
                      {trainer.Initials ||
                        trainer.Title.split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part.charAt(0))
                          .join('')}
                    </span>
                    <span>
                      <strong>{trainer.Title}</strong>
                      <small>
                        {[trainer.Role, trainer.Filiere].filter((part) => !!part).join(' · ')}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {formation.ContactReferent && (
            <div className={`${styles.card} ${styles.cardAccent}`}>
              <h3 className={styles.cardTitle}>{props.strings.ContactTitle}</h3>
              <p className={styles.cardText}>
                {formation.ContactReferent.indexOf('@') !== -1 ? (
                  <a href={`mailto:${formation.ContactReferent}`}>{formation.ContactReferent}</a>
                ) : (
                  formation.ContactReferent
                )}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default FicheFormation;
