import * as React from 'react';
import { DataResult, Item, ModuleKey, PortalProps } from './models';
import { modules, moduleKeys } from './registry';
import {
  dateLabel,
  documentUrl,
  emailUrl,
  filterItems,
  parseSources,
  safeUrl
} from './utils';
import { demoItems } from './demo';
import styles from './Portal.module.scss';
import logo from './assets/logo.png';
import heroImage from './assets/hero-formation.jpg';
import newsImage from './assets/news-certification.jpg';

const icons: Record<ModuleKey, string> = {
  hero: 'spark',
  news: 'news',
  sessions: 'calendar',
  links: 'grid',
  catalog: 'book',
  documents: 'file',
  directory: 'users',
  metrics: 'chart',
  resources: 'layers',
  community: 'message',
  trainer: 'users',
  support: 'help'
};
const navLabels: Partial<Record<ModuleKey, string>> = {
  catalog: 'Formations',
  sessions: 'Agenda',
  documents: 'Ressources',
  directory: 'Annuaire',
  community: 'Communauté',
  support: 'Aide'
};
const paths: Record<string, string> = {
  book: 'M3 4h6a4 4 0 0 1 3 1 4 4 0 0 1 3-1h6v15h-6a4 4 0 0 0-3 1 4 4 0 0 0-3-1H3z M12 5v15',
  calendar: 'M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4 M8 14h2 M14 14h2',
  file: 'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 1 0 0-8 M18 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-4',
  message: 'M3 3h18v14H8l-5 4z M7 7h10 M7 11h7',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18 M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17h.01',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  chart: 'M4 3v18h17 M8 16v-4 M13 16V8 M18 16V5',
  layers: 'M12 3 2 8l10 5 10-5z M2 12l10 5 10-5 M2 16l10 5 10-5',
  news: 'M4 3h16v18H4z M8 7h8 M8 11h8 M8 15h5',
  spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  search: 'M10 3a7 7 0 1 0 0 14 7 7 0 1 0 0-14 M15 15l6 6'
};
const Icon: React.FC<{ name: string }> = ({ name }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={paths[name] || paths.grid} />
  </svg>
);
const initials = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
const itemUrl = (
  item: Item,
  props: PortalProps,
  key: ModuleKey
): string | undefined => {
  if (props.settings.demoMode) return undefined;
  if (key === 'documents')
    return documentUrl(item.FileRef, props.settings.siteUrl);
  const link = safeUrl(item.Lien, props.settings.siteUrl);
  if (link) return link;
  return undefined;
};
const Hero: React.FC<PortalProps> = (props) => {
  const settings = props.settings;
  const isHome = props.kind === 'home';
  const cta =
    safeUrl(settings.catalogUrl, settings.siteUrl) ||
    (isHome &&
    !settings.hiddenModules
      .split(',')
      .map((s) => s.trim())
      .includes('catalog')
      ? `#${props.instanceId}-catalog`
      : undefined);
  const trainer =
    safeUrl(settings.trainerUrl, settings.siteUrl) ||
    (isHome &&
    !settings.hiddenModules
      .split(',')
      .map((s) => s.trim())
      .includes('trainer')
      ? `#${props.instanceId}-trainer`
      : undefined);
  return (
    <section
      className={styles.hero}
      style={{
        backgroundImage: `linear-gradient(90deg, rgba(8,28,68,.97), rgba(8,28,68,.87) 43%, rgba(8,28,68,.18)), url("${safeUrl(settings.heroImageUrl, settings.siteUrl) || heroImage}")`
      }}
    >
      <div className={styles.heroContent}>
        <span className={styles.heroEyebrow}>
          BUSINESS BUILDERS INTERNATIONAL
        </span>
        <h1>{settings.heroTitle}</h1>
        <p>{settings.heroDescription}</p>
        <div className={styles.heroActions}>
          {cta && (
            <a className={styles.primary} href={cta}>
              Explorer les formations <Icon name="arrow" />
            </a>
          )}
          {trainer && (
            <a className={styles.secondary} href={trainer}>
              Espace formateurs <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
        <div className={styles.heroSignature}>
          <span /> Propulseur de croissance · Créateur d’impacts
        </div>
      </div>
      <span className={styles.heroCaption}>APPRENDRE. PARTAGER. GRANDIR.</span>
    </section>
  );
};
interface ModuleProps extends PortalProps {
  moduleKey: ModuleKey;
  compact?: boolean;
}
const Module: React.FC<ModuleProps> = (props) => {
  const { moduleKey: key, settings } = props;
  const definition = modules[key];
  const [result, setResult] = React.useState<DataResult>({
    items: [],
    truncated: false
  });
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [error, setError] = React.useState('');
  const [retry, setRetry] = React.useState(0);
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [visible, setVisible] = React.useState(settings.maxItems);
  let listTitle = definition.list;
  let sourceError = '';
  try {
    const sources = parseSources(settings.sourcesJson);
    listTitle =
      sources[key] ||
      (props.kind !== 'home' &&
        (settings.listTitle || settings.libraryTitle)) ||
      definition.list;
  } catch (e) {
    sourceError = (e as Error).message;
  }
  React.useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    const load = async (): Promise<void> => {
      try {
        if (sourceError) throw new Error(sourceError);
        const data = settings.demoMode
          ? { items: demoItems(key), truncated: false }
          : await props.source.load({
              key,
              siteUrl: settings.siteUrl,
              listTitle,
              userEmail: props.userEmail
            });
        if (!cancelled) {
          setResult(data);
          setStatus('ready');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erreur de connexion.');
          setStatus('error');
        }
      }
    };
    load().catch(() => {
      /* load handles all failures and exposes a retry state. */
    });
    return () => {
      cancelled = true;
    };
  }, [
    key,
    settings.demoMode,
    settings.siteUrl,
    listTitle,
    props.source,
    props.userEmail,
    retry,
    sourceError
  ]);
  React.useEffect(() => {
    setVisible(settings.maxItems);
  }, [query, category, settings.maxItems, listTitle, settings.demoMode]);
  const categories = Array.from(
    new Set(
      result.items.map((i) => i.Filiere || i.Categorie || '').filter(Boolean)
    )
  ).sort();
  const filtered = filterItems(result.items, query, category);
  const searchable =
    ['catalog', 'directory', 'documents', 'support', 'resources'].indexOf(
      key
    ) !== -1;
  const limit = Math.max(1, visible || 6);
  const sectionId = `${props.instanceId}-${key}`;
  const linkTo = (target: ModuleKey): string | undefined =>
    props.kind === 'home' &&
    !settings.hiddenModules
      .split(',')
      .map((s) => s.trim())
      .includes(target)
      ? `#${props.instanceId}-${target}`
      : undefined;
  const cards = filtered.slice(0, limit).map((item, index) => {
    const href = itemUrl(item, props, key);
    const action = href ? (
      <a
        className={styles.textLink}
        href={href}
        {...(key === 'documents'
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : {})}
      >
        {key === 'documents'
          ? 'Consulter dans le navigateur'
          : key === 'sessions' || key === 'trainer'
            ? 'Détails de la session'
            : 'En savoir plus'}{' '}
        <Icon name="arrow" />
        <span className={styles.srOnly}>
          {' '}
          : {item.Title}
          {key === 'documents' ? ' (nouvel onglet)' : ''}
        </span>
      </a>
    ) : undefined;
    if (key === 'support')
      return (
        <details className={styles.faq} key={item.Id}>
          <summary>
            {item.Title}
            <span aria-hidden="true">+</span>
          </summary>
          <p>{item.Description}</p>
        </details>
      );
    if (key === 'metrics')
      return (
        <article className={styles.metric} key={item.Id}>
          <strong>{item.Valeur || '—'}</strong>
          <h3>{item.Title}</h3>
          <small>{item.Periode}</small>
        </article>
      );
    if (key === 'directory')
      return (
        <article className={styles.person} key={item.Id}>
          <span className={styles.avatar}>{initials(item.Title)}</span>
          <div>
            <h3>{item.Title}</h3>
            <p>{item.Fonction}</p>
            <small>{item.Categorie}</small>
            {!settings.demoMode && emailUrl(item.Email) && (
              <a className={styles.textLink} href={emailUrl(item.Email)}>
                Contacter<span className={styles.srOnly}> {item.Title}</span> ↗
              </a>
            )}
          </div>
        </article>
      );
    if (key === 'sessions' || key === 'trainer') {
      const date = item.DateDebut ? new Date(item.DateDebut) : undefined;
      const valid = date && !isNaN(date.getTime());
      return (
        <article className={styles.event} key={item.Id}>
          <div className={styles.dateBox}>
            <strong>
              {valid ? date.getDate().toString().padStart(2, '0') : '—'}
            </strong>
            <span>
              {valid
                ? date.toLocaleDateString('fr-FR', { month: 'short' })
                : ''}
            </span>
          </div>
          <div>
            <h3>{item.Title}</h3>
            <p>
              {item.Modalite} · {item.Lieu}
            </p>
            <small>
              {dateLabel(item.DateDebut)} — {dateLabel(item.DateFin)}
            </small>
            {action}
          </div>
        </article>
      );
    }
    if (key === 'links') {
      const target = item.Categorie as ModuleKey;
      const url =
        safeUrl(item.Lien, settings.siteUrl) ||
        (moduleKeys.includes(target) ? linkTo(target) : undefined);
      const content = (
        <>
          <span className={styles.tileIcon}>
            <Icon name={icons[target] || 'grid'} />
          </span>
          <h3>{item.Title}</h3>
          <p>{item.Description}</p>
          {url && (
            <span className={styles.tileArrow} aria-hidden="true">
              ↗
            </span>
          )}
        </>
      );
      return url ? (
        <a className={styles.quickLink} href={url} key={item.Id}>
          {content}
        </a>
      ) : (
        <article className={styles.quickLink} key={item.Id}>
          {content}
        </article>
      );
    }
    if (key === 'catalog')
      return (
        <article className={styles.course} key={item.Id}>
          <div className={styles.courseTop}>
            <span className={styles.courseNumber} aria-hidden="true">
              0{index + 1}
            </span>
            <Icon name="book" />
            <span className={styles.tag}>{item.Filiere}</span>
          </div>
          <div className={styles.cardBody}>
            <small className={styles.code}>{item.CodeFormation}</small>
            <h3>{item.Title}</h3>
            <p>{item.Niveau}</p>
            <div className={styles.courseMeta}>
              <span>{item.Modalite}</span>
              <b>{item.DureeH || '—'} h</b>
            </div>
            {action}
          </div>
        </article>
      );
    if (key === 'documents')
      return (
        <article className={styles.document} key={item.Id}>
          <span className={styles.fileIcon}>
            <Icon name="file" />
          </span>
          <div>
            <small className={styles.code}>
              {(item.FileLeafRef || '').split('.').pop()?.toUpperCase()} ·{' '}
              {dateLabel(item.Modified)}
            </small>
            <h3>{item.Title || item.FileLeafRef}</h3>
            {action || (
              <small>
                {settings.demoMode
                  ? 'Document d’exemple — non disponible'
                  : 'Lien du document indisponible.'}
              </small>
            )}
          </div>
        </article>
      );
    if (key === 'news')
      return (
        <article className={styles.newsCard} key={item.Id}>
          {(safeUrl(item.ImageUrl, settings.siteUrl) ||
            (settings.demoMode && index === 0)) && (
            <img
              src={safeUrl(item.ImageUrl, settings.siteUrl) || newsImage}
              alt=""
              loading="lazy"
            />
          )}
          <div className={styles.cardBody}>
            <div className={styles.newsMeta}>
              <span>{item.Categorie || 'Actualité'}</span>
              <small>{dateLabel(item.DatePublication)}</small>
            </div>
            <h3>{item.Title}</h3>
            <p>{item.Description}</p>
            {action}
          </div>
        </article>
      );
    return (
      <article className={styles.resource} key={item.Id}>
        <span className={styles.tileIcon}>
          <Icon name={icons[key]} />
        </span>
        <span className={styles.code}>{item.Categorie}</span>
        <h3>{item.Title}</h3>
        <p>{item.Description}</p>
        {action ||
          (!settings.demoMode && (
            <small>Lien à renseigner dans la liste.</small>
          ))}
      </article>
    );
  });
  return (
    <section
      className={`${styles.module} ${props.compact ? styles.compact : ''}`}
      id={sectionId}
      aria-labelledby={`${sectionId}-title`}
    >
      <header className={styles.sectionHeader}>
        <div>
          <span className={styles.eyebrow}>{definition.eyebrow}</span>
          <h2 id={`${sectionId}-title`}>
            {props.kind !== 'home' && settings.title
              ? settings.title
              : definition.title}
          </h2>
        </div>
        <span className={styles.sectionIcon}>
          <Icon name={icons[key]} />
        </span>
      </header>
      {key === 'documents' && (
        <p className={styles.notice}>
          Consultation dans le navigateur. Les restrictions de téléchargement et
          d’impression dépendent des autorisations et politiques Microsoft 365,
          pas de ce webpart.
        </p>
      )}
      {key === 'trainer' && (
        <div className={styles.trainerIntro}>
          <p>
            Vos prochaines interventions
            {props.userName ? `, ${props.userName.split(' ')[0]}` : ''}.
            Préparez vos supports depuis votre espace de travail.
          </p>
          {safeUrl(settings.trainerUrl, settings.siteUrl) && (
            <a
              className={styles.textLink}
              href={safeUrl(settings.trainerUrl, settings.siteUrl)}
            >
              Ouvrir l’espace de travail ↗
            </a>
          )}
        </div>
      )}
      {status === 'loading' && (
        <div className={styles.state} role="status">
          Chargement de {definition.title.toLocaleLowerCase('fr')}…
        </div>
      )}
      {status === 'error' && (
        <div className={styles.error} role="alert">
          <strong>Impossible de charger « {listTitle} »</strong>
          <p>{error}</p>
          <button type="button" onClick={() => setRetry(retry + 1)}>
            Réessayer
          </button>
        </div>
      )}
      {status === 'ready' && (
        <>
          {searchable && (
            <div className={styles.filters}>
              <label className={styles.search}>
                <Icon name="search" />
                <span className={styles.srOnly}>
                  Rechercher dans {definition.title}
                </span>
                <input
                  type="search"
                  placeholder={
                    key === 'catalog'
                      ? 'Quelle compétence souhaitez-vous développer ?'
                      : 'Rechercher…'
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              {categories.length > 0 && (
                <div
                  className={styles.chips}
                  role="group"
                  aria-label="Filtrer par catégorie"
                >
                  {['', ...categories].map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      aria-pressed={category === cat}
                      className={category === cat ? styles.chipActive : ''}
                      onClick={() => setCategory(cat)}
                    >
                      {cat || 'Toutes'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {filtered.length === 0 ? (
            <div className={styles.state} role="status">
              <strong>
                {query || category
                  ? 'Aucun résultat pour ces critères.'
                  : key === 'trainer'
                    ? 'Aucune intervention à venir pour votre compte.'
                    : 'Aucun contenu pour le moment.'}
              </strong>
              <p>
                {query || category
                  ? 'Essayez un autre terme ou une autre catégorie.'
                  : 'Les contenus publiés dans la source SharePoint apparaîtront ici.'}
              </p>
              {(query || category) && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setCategory('');
                  }}
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          ) : (
            <div className={`${styles.items} ${styles[key]}`}>{cards}</div>
          )}
          {filtered.length > limit && (
            <button
              type="button"
              className={styles.more}
              onClick={() => setVisible(limit + settings.maxItems)}
            >
              Afficher plus ({filtered.length - limit} restants)
            </button>
          )}
          {result.truncated && (
            <p className={styles.notice}>
              Affichage limité aux 500 premiers éléments. Consultez la liste
              SharePoint pour l’ensemble du contenu.
            </p>
          )}
        </>
      )}
      {key === 'support' && safeUrl(settings.supportUrl, settings.siteUrl) && (
        <a
          className={styles.primary}
          href={safeUrl(settings.supportUrl, settings.siteUrl)}
        >
          Contacter le support <Icon name="arrow" />
        </a>
      )}
    </section>
  );
};
export const Portal: React.FC<PortalProps> = (props) => {
  const { settings, kind } = props;
  const hidden = settings.hiddenModules.split(',').map((s) => s.trim());
  const show = (key: ModuleKey): boolean => !hidden.includes(key);
  const renderModule = (
    key: ModuleKey,
    compact: boolean = false
  ): React.ReactNode =>
    show(key) ? (
      <Module {...props} moduleKey={key} compact={compact} key={key} />
    ) : undefined;
  return (
    <div className={styles.portal} lang="fr">
      {kind === 'home' && (
        <>
          <a className={styles.skip} href={`#${props.instanceId}-content`}>
            Aller au contenu
          </a>
          <header className={styles.brandHeader}>
            <img
              className={styles.logo}
              src={safeUrl(settings.logoUrl, settings.siteUrl) || logo}
              alt="Business Builders International"
            />
            <div className={styles.brandDivider} />
            <div className={styles.brandLabel}>
              <strong>{settings.title || 'BBI Intranet'}</strong>
              <span>Notre réseau. Notre force.</span>
            </div>
            <div className={styles.user}>
              <span className={styles.avatar}>
                {initials(props.userName || 'BBI')}
              </span>
              <span>
                Bienvenue,<b>{props.userName || 'dans votre intranet'}</b>
              </span>
            </div>
          </header>
          <nav
            className={styles.navigation}
            aria-label="Rubriques de l’accueil"
          >
            <span className={styles.navCurrent}>Accueil</span>
            {(
              [
                'catalog',
                'sessions',
                'documents',
                'directory',
                'community',
                'support'
              ] as ModuleKey[]
            )
              .filter(show)
              .map((key) => (
                <a key={key} href={`#${props.instanceId}-${key}`}>
                  {navLabels[key]}
                </a>
              ))}
          </nav>
        </>
      )}
      {settings.demoMode && (
        <div className={styles.demoBanner} role="status">
          MODE DÉMONSTRATION · Contenus, personnes et indicateurs fictifs.
          Désactivez ce mode dans les propriétés pour connecter vos listes
          SharePoint.
        </div>
      )}
      <div
        id={`${props.instanceId}-content`}
        className={kind === 'home' ? styles.canvas : styles.standalone}
      >
        {kind === 'home' ? (
          <>
            <div className={styles.welcome}>
              <span>VOTRE ESPACE COLLABORATIF</span>
              <time dateTime={new Date().toISOString().slice(0, 10)}>
                {new Date().toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </time>
            </div>
            {show('hero') && <Hero {...props} />}
            {renderModule('links')}
            <div className={styles.twoColumns}>
              {renderModule('news')}
              {renderModule('sessions', true)}
            </div>
            {renderModule('catalog')}
            <div className={styles.twoColumns}>
              {renderModule('documents')}
              {renderModule('directory', true)}
            </div>
            {renderModule('metrics')}
            <div className={styles.equalColumns}>
              {renderModule('resources')}
              {renderModule('community')}
            </div>
            {renderModule('trainer')}
            {renderModule('support')}
            <footer className={styles.footer}>
              <strong>Business Builders International</strong>
              <span>Propulseur de croissance · Créateur d’impacts</span>
              <a href={`#${props.instanceId}-content`}>Retour en haut ↑</a>
            </footer>
          </>
        ) : kind === 'hero' ? (
          <Hero {...props} />
        ) : (
          <Module {...props} moduleKey={kind} />
        )}
      </div>
    </div>
  );
};
