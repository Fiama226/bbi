import * as React from 'react';
import { SPHttpClient } from '@microsoft/sp-http';
import styles from './OffersCatalog.module.scss';
import {
  IOffer,
  OfferPole,
  OFFER_POLES,
  OFFER_PILLARS,
  loadOffers,
  activeOffers,
  countByPole,
  filterOffers,
  filieresOf,
  previewOffers
} from './offersData';

export interface IOffersCatalogProps {
  siteUrl: string;
  listTitle: string;
  spHttpClient: SPHttpClient;
  showDataNotices: boolean;
  /** Filtre de pôle, piloté par le portail (URL `#offres?pole=conseil`). */
  pole: OfferPole | '';
  onPoleChange: (pole: OfferPole | '') => void;
  initialQuery?: string;
  /** Aperçu de l'accueil : quelques offres par pôle, sans filtres. */
  compact?: boolean;
  perPole?: number;
}

const POLE_CLASS: { [pole: string]: string } = {
  Formation: styles.poleFormation,
  Conseil: styles.poleConseil,
  Coaching: styles.poleCoaching
};

const PILLAR_CLASS: { [pole: string]: string } = {
  Formation: styles.pillarFormation,
  Conseil: styles.pillarConseil,
  Coaching: styles.pillarCoaching
};

const OfferCard: React.FC<{ offer: IOffer }> = ({ offer }) => (
  <article className={styles.card}>
    <div className={styles.cardTop}>
      <span className={`${styles.badge} ${POLE_CLASS[offer.Pole] || styles.poleFormation}`}>{offer.Pole}</span>
      {offer.CodeOffre ? <span className={styles.code}>{offer.CodeOffre}</span> : null}
    </div>
    <h3 className={styles.cardTitle}>{offer.Title}</h3>
    <div className={styles.meta}>
      {offer.Format ? <span>{offer.Format}</span> : null}
      {offer.Duree ? <span>{offer.Duree}</span> : null}
      {offer.Niveau ? <span>{offer.Niveau}</span> : null}
    </div>
    {offer.PublicCible ? <p className={styles.audience}>{offer.PublicCible}</p> : null}
  </article>
);

export const OffersCatalog: React.FC<IOffersCatalogProps> = (props) => {
  const { siteUrl, listTitle, spHttpClient, showDataNotices, pole, onPoleChange, compact } = props;

  const [ready, setReady] = React.useState(false);
  const [items, setItems] = React.useState<IOffer[]>([]);
  const [isDemo, setIsDemo] = React.useState(false);
  const [query, setQuery] = React.useState(props.initialQuery || '');
  const [filiere, setFiliere] = React.useState('');

  React.useEffect(() => {
    if (props.initialQuery !== undefined) {
      setQuery(props.initialQuery);
    }
  }, [props.initialQuery]);

  React.useEffect(() => {
    setFiliere('');
  }, [pole]);

  React.useEffect(() => {
    let cancelled = false;
    setReady(false);
    loadOffers(spHttpClient, siteUrl, listTitle)
      .then((result) => {
        if (cancelled) { return; }
        setItems(result.items);
        setIsDemo(result.isDemo);
        setReady(true);
      })
      .catch(() => { /* loadOffers ne rejette jamais : repli intégré */ });
    return () => { cancelled = true; };
  }, [siteUrl, listTitle, spHttpClient]);

  const active = React.useMemo(() => activeOffers(items), [items]);
  const counts = React.useMemo(() => countByPole(active), [active]);
  const filieres = React.useMemo(
    () => filieresOf(filterOffers(items, { pole })),
    [items, pole]
  );
  const filtered = React.useMemo(
    () => filterOffers(items, { pole, filiere, query }),
    [items, pole, filiere, query]
  );

  if (!ready) {
    return (
      <div className={styles.offers}>
        <div className={styles.placeholder}>Nos offres — ⏳</div>
      </div>
    );
  }

  const banner = showDataNotices && isDemo ? (
    <div className={styles.demoBanner}>
      💡 Données de démonstration : la liste « Offres » est absente, non créée ou vide.
    </div>
  ) : null;

  if (compact) {
    const preview = previewOffers(items, props.perPole || 2);
    return (
      <div className={styles.offers}>
        {banner}
        {preview.length > 0 && (
          <div className={styles.grid}>
            {preview.map((offer) => <OfferCard key={offer.Id} offer={offer} />)}
          </div>
        )}
      </div>
    );
  }

  const poleIsEmpty = !!pole && counts[pole] === 0;
  const nothingPublished = active.length === 0 && !pole && !query && !filiere;

  return (
    <div className={styles.offers}>
      {banner}
      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.search}
          placeholder="Rechercher une offre"
          value={query}
          onChange={(event) => { setQuery(event.target.value); }}
          aria-label="Rechercher une offre"
        />
        <div className={styles.poleChips} role="group" aria-label="Pôles">
          <button
            type="button"
            aria-pressed={pole === ''}
            className={pole === '' ? `${styles.chip} ${styles.chipActive}` : styles.chip}
            onClick={() => { onPoleChange(''); }}
          >
            Tous les pôles<span className={styles.count}>{active.length}</span>
          </button>
          {OFFER_POLES.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={pole === p}
              className={pole === p ? `${styles.chip} ${styles.chipActive}` : styles.chip}
              onClick={() => { onPoleChange(p); }}
            >
              {p}<span className={styles.count}>{counts[p]}</span>
            </button>
          ))}
        </div>
        {filieres.length > 1 && (
          <div className={styles.filiereChips} role="group" aria-label="Filières">
            <button
              type="button"
              aria-pressed={filiere === ''}
              className={filiere === '' ? `${styles.chip} ${styles.chipActive}` : styles.chip}
              onClick={() => { setFiliere(''); }}
            >
              Toutes les filières
            </button>
            {filieres.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filiere === f}
                className={filiere === f ? `${styles.chip} ${styles.chipActive}` : styles.chip}
                onClick={() => { setFiliere(f); }}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>
            {nothingPublished
              ? 'Aucune offre publiée pour le moment.'
              : poleIsEmpty && !query && !filiere
                ? `Aucune offre publiée pour le pôle ${pole} pour le moment.`
                : 'Aucune offre ne correspond à votre recherche.'}
          </div>
          {!nothingPublished && (
            <div className={styles.emptyHint}>Essayez un autre pôle ou une autre filière.</div>
          )}
          {!nothingPublished && (
            <button
              type="button"
              className={styles.reset}
              onClick={() => { setQuery(''); setFiliere(''); onPoleChange(''); }}
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((offer) => <OfferCard key={offer.Id} offer={offer} />)}
        </div>
      )}
    </div>
  );
};

export interface IPillarsStripProps {
  onNavigate: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}

export const PillarsStrip: React.FC<IPillarsStripProps> = ({ onNavigate }) => (
  <div className={styles.pillars}>
    {OFFER_PILLARS.map((pillar) => {
      const href = `#offres?pole=${pillar.pole.toLowerCase()}`;
      return (
        <a
          key={pillar.pole}
          className={`${styles.pillarCard} ${PILLAR_CLASS[pillar.pole] || styles.pillarFormation}`}
          href={href}
          onClick={(event) => { onNavigate(event, href); }}
        >
          <span className={styles.pillarIcon} aria-hidden="true">{pillar.icon}</span>
          <span className={styles.pillarTitle}>{pillar.pole}</span>
          <span className={styles.pillarText}>{pillar.promise}</span>
          <span className={styles.pillarLink}>Voir les offres →</span>
        </a>
      );
    })}
  </div>
);

export default OffersCatalog;
