import * as React from "react";
import styles from "./AnnouncementTicker.module.scss";
import { IAnnouncement } from "./homeLayout";

export interface IAnnouncementTickerProps {
  /** Annonces à faire défiler (paramétrées ou issues de la liste Annonces). */
  items: IAnnouncement[];
  /** Ouvre la page de détail d'une annonce ; signature alignée sur les liens du portail. */
  onOpen: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  /** Lien permanent vers les dernières annonces. */
  onSeeAll: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

/** Durée d'un cycle : assez lente pour être lue, assez vive pour Innover. */
const SECONDS_PER_ITEM = 7;
const MIN_CYCLE_SECONDS = 22;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  } catch {
    return false;
  }
};

/**
 * Bandeau d'annonces déroulant, au-dessus de la barre de navigation.
 *
 * Le ruban défile en boucle continue ; il se fige au survol et dès qu'un
 * élément reçoit le focus (au clavier comme à la souris), et s'immobilise
 * si l'utilisateur a demandé « animations réduites » — la liste devient
 * alors simplement défilable au doigt ou à la molette.
 *
 * Chaque annonce est un vrai lien vers sa page de détail partageable
 * (`#annonce?id=12`). La seconde copie du ruban, celle qui « rentre » par
 * la droite, est masquée aux lecteurs d'écran et retirée du parcours de
 * tabulation : chaque annonce n'est donc annoncée et atteinte qu'une fois.
 */
const AnnouncementTicker: React.FC<IAnnouncementTickerProps> = (props) => {
  const { items, onOpen, onSeeAll } = props;
  const [hovered, setHovered] = React.useState<boolean>(false);
  const [focused, setFocused] = React.useState<boolean>(false);
  const [still, setStill] = React.useState<boolean>(prefersReducedMotion);

  // Le réglage « animations réduites » peut changer pendant la session.
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (): void => {
      setStill(query.matches);
    };
    onChange();
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    }
    // Safari 13 et antérieurs.
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, []);

  if (!items || items.length === 0) {
    return null;
  }

  // Une seule annonce n'a rien à faire défiler : inutile d'animer le ruban.
  const isMarquee = items.length > 1 && !still;
  const paused = hovered || focused || !isMarquee;
  const cycleSeconds = Math.max(MIN_CYCLE_SECONDS, items.length * SECONDS_PER_ITEM);

  const group = (duplicate: boolean): React.ReactElement => (
    <ul
      className={styles.group}
      aria-label={duplicate ? undefined : "Annonces BBI"}
      aria-hidden={duplicate ? "true" : undefined}
    >
      {items.map((item) => (
        <li className={styles.item} key={`${duplicate ? "copie-" : ""}${item.key}`}>
          <a
            className={styles.link}
            href={item.href || "#annonces"}
            /* La copie dupliquée reste cliquable à la souris, mais n'est pas
               un arrêt de tabulation supplémentaire. */
            tabIndex={duplicate ? -1 : undefined}
            onClick={(event) => {
              onOpen(event, item.href || "#annonces");
            }}
          >
            <span className={styles.itemTag} aria-hidden="true">
              Vie de l’équipe
            </span>
            <span className={styles.itemLabel}>{item.label}</span>
            <span className={styles.itemCta} aria-hidden="true">
              Lire la suite →
            </span>
          </a>
        </li>
      ))}
    </ul>
  );

  const trackStyle = { "--bbi-ticker-cycle": `${cycleSeconds}s` } as React.CSSProperties;

  return (
    <div
      className={styles.ticker}
      role="region"
      aria-label="Annonces BBI"
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
      onFocusCapture={() => {
        setFocused(true);
      }}
      onBlurCapture={(event) => {
        // Le focus qui sort réellement du bandeau suffit à relancer le défilement.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
    >
      <p className={styles.badge}>
        <span className={styles.badgeDot} aria-hidden="true" />
        Annonces
      </p>

      <div className={isMarquee ? styles.viewport : `${styles.viewport} ${styles.viewportStill}`}>
        <div
          className={paused ? `${styles.track} ${styles.trackPaused}` : styles.track}
          style={trackStyle}
        >
          {group(false)}
          {isMarquee ? group(true) : null}
        </div>
      </div>

      <a
        className={styles.seeAll}
        href="#annonces"
        onClick={(event) => {
          onSeeAll(event);
        }}
      >
        Les annonces <span aria-hidden="true">→</span>
      </a>
    </div>
  );
};

export default AnnouncementTicker;
