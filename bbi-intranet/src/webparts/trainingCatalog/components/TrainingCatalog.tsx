import * as React from 'react';
import styles from './TrainingCatalog.module.scss';
import { ITrainingCatalogProps, IFormation } from './ITrainingCatalogProps';
import { SPHttpClient } from '@microsoft/sp-http';

type LoadStatus = 'loading' | 'ready';

const DEMO_FORMATIONS: IFormation[] = [
  { Id: 1, Title: "Management d'équipe", CodeFormation: 'BBI-MGT-101', Filiere: 'Management', Modalite: 'Présentiel', DureeH: 14, Niveau: 'Confirmé', StatutCatalogue: 'Actif' },
  { Id: 2, Title: "Coaching d'entrepreneurs", CodeFormation: 'BBI-COA-201', Filiere: 'Coaching', Modalite: 'Hybride', DureeH: 28, Niveau: 'Expert', StatutCatalogue: 'Actif' },
  { Id: 3, Title: 'Vendre la valeur, pas le prix', CodeFormation: 'BBI-COM-110', Filiere: 'Commerce', Modalite: 'Présentiel', DureeH: 7, Niveau: 'Débutant', StatutCatalogue: 'Actif' },
  { Id: 4, Title: 'Prospection digitale', CodeFormation: 'BBI-DIG-140', Filiere: 'Digital', Modalite: 'Distanciel', DureeH: 3.5, Niveau: 'Débutant', StatutCatalogue: 'Actif' },
  { Id: 5, Title: 'Fondamentaux Qualiopi', CodeFormation: 'BBI-QUA-301', Filiere: 'Qualité & Certification', Modalite: 'Distanciel', DureeH: 7, Niveau: 'Intermédiaire', StatutCatalogue: 'Actif' },
  { Id: 6, Title: 'Leadership & gestion du changement', CodeFormation: 'BBI-LDR-210', Filiere: 'Management', Modalite: 'Hybride', DureeH: 21, Niveau: 'Confirmé', StatutCatalogue: 'Actif' },
  { Id: 7, Title: 'Négociation commerciale avancée', CodeFormation: 'BBI-COM-220', Filiere: 'Commerce', Modalite: 'Présentiel', DureeH: 14, Niveau: 'Confirmé', StatutCatalogue: 'Actif' },
  { Id: 8, Title: 'Prise de parole en public', CodeFormation: 'BBI-SPK-120', Filiere: 'Soft skills', Modalite: 'Présentiel', DureeH: 7, Niveau: 'Débutant', StatutCatalogue: 'Actif' },
  { Id: 9, Title: 'Gestion de projet agile', CodeFormation: 'BBI-PRJ-150', Filiere: 'Digital', Modalite: 'Distanciel', DureeH: 10.5, Niveau: 'Intermédiaire', StatutCatalogue: 'Actif' },
  { Id: 10, Title: 'Bases du coaching professionnel', CodeFormation: 'BBI-COA-101', Filiere: 'Coaching', Modalite: 'Présentiel', DureeH: 28, Niveau: 'Débutant', StatutCatalogue: 'Actif' }
];

export const TrainingCatalog: React.FC<ITrainingCatalogProps> = (props) => {
  const { siteUrl, listTitle, maxItems, showDataNotices, spHttpClient, strings, embedded } = props;

  const [status, setStatus] = React.useState<LoadStatus>('loading');
  const [items, setItems] = React.useState<IFormation[]>([]);
  const [isDemo, setIsDemo] = React.useState(false);
  const [query, setQuery] = React.useState(props.initialQuery || '');
  const [filiere, setFiliere] = React.useState('');

  React.useEffect(() => {
    if (props.initialQuery !== undefined) {
      setQuery(props.initialQuery);
    }
  }, [props.initialQuery]);

  React.useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      setStatus('loading');
      const endpoint: string =
        `${siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/items` +
        `?$select=Id,Title,CodeFormation,Filiere,Modalite,DureeH,Niveau,StatutCatalogue` +
        `&$orderby=Title&$top=300`;
      try {
        const response = await spHttpClient.get(endpoint, SPHttpClient.configurations.v1);
        if (cancelled) { return; }
        if (!response.ok) { throw new Error(`HTTP ${response.status}`); }
        const json = await response.json();
        if (cancelled) { return; }
        const loaded = (json && json.value ? json.value : []) as IFormation[];
        if (loaded.length === 0) {
          // Liste créée mais encore vide : on sert le catalogue de démonstration.
          setItems(DEMO_FORMATIONS);
          setIsDemo(true);
        } else {
          setItems(loaded);
          setIsDemo(false);
        }
        setStatus('ready');
      } catch {
        if (cancelled) { return; }
        setItems(DEMO_FORMATIONS);
        setIsDemo(true);
        setStatus('ready');
      }
    };
    load().catch(() => { /* géré dans load() */ });
    return () => { cancelled = true; };
  }, [siteUrl, listTitle, spHttpClient]);

  const filieres: string[] = React.useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => { const f = (i.Filiere || '').trim(); if (f) { set.add(f); } });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [items]);

  const activeItems: IFormation[] = React.useMemo(
    () => items.filter((i) => !i.StatutCatalogue || i.StatutCatalogue === 'Actif'),
    [items]
  );

  const filtered: IFormation[] = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeItems
      .filter((i) => {
        const matchFiliere = !filiere || (i.Filiere || '') === filiere;
        const matchQuery = !q
          || (i.Title || '').toLowerCase().indexOf(q) !== -1
          || (i.CodeFormation || '').toLowerCase().indexOf(q) !== -1;
        return matchFiliere && matchQuery;
      })
      .slice(0, maxItems);
  }, [activeItems, filiere, query, maxItems]);

  if (status === 'loading') {
    return (
      <div className={styles.bbiCatalog}>
        <div className={styles.placeholder}>{strings.WebPartTitle} — ⏳</div>
      </div>
    );
  }

  return (
    <div className={styles.bbiCatalog}>
      {!embedded && (
        <div className={styles.header}>
          <h2 className={styles.title}>{strings.WebPartTitle}</h2>
        </div>
      )}

      {showDataNotices && isDemo && <div className={styles.demoBanner}>💡 {strings.DemoBanner}</div>}

      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.search}
          placeholder={strings.SearchPlaceholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); }}
          aria-label={strings.SearchPlaceholder}
        />
        <div className={styles.chips} role="tablist" aria-label="Filières">
          <button
            type="button"
            className={filiere === '' ? `${styles.chip} ${styles.chipActive}` : styles.chip}
            onClick={() => { setFiliere(''); }}
          >
            {strings.FilterAll}
          </button>
          {filieres.map((f) => (
            <button
              key={f}
              type="button"
              className={filiere === f ? `${styles.chip} ${styles.chipActive}` : styles.chip}
              onClick={() => { setFiliere(f); }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>{strings.NoResultTitle}</div>
          <div className={styles.emptyHint}>{strings.NoResultHint.replace('{QUERY}', query.trim())}</div>
          <button
            type="button"
            className={styles.reset}
            onClick={() => { setQuery(''); setFiliere(''); }}
          >
            {strings.ResetFilters}
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((f) => (
            <article key={f.Id} className={styles.card}>
              <div className={styles.cardTop}>
                {f.CodeFormation ? <span className={styles.codeBadge}>{f.CodeFormation}</span> : null}
                <h3 className={styles.cardTitle}>{f.Title}</h3>
              </div>
              <div className={styles.cardMeta}>
                {f.Niveau ? <span>👥 {f.Niveau}</span> : null}
                {f.Modalite ? <span>{f.Modalite === 'Distanciel' ? '💻' : f.Modalite === 'Hybride' ? '🔀' : '🏢'} {f.Modalite}</span> : null}
              </div>
              <div className={styles.cardFoot}>
                {f.DureeH ? <span className={styles.duration}>{String(f.DureeH)}{strings.HoursSuffix}</span> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrainingCatalog;
