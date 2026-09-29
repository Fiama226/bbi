import * as React from "react";
import styles from "./HomeHero.module.scss";
import { IHeroSlide, IKpi } from "./homeLayout";
import { safeHref, safeImageUrl } from "../../../shared/safeUrl";

export interface IHomeHeroProps {
  /** Diapositives configurées dans le volet de propriétés. */
  slides: IHeroSlide[];
  /** Sur-titre global, utilisé quand la diapositive n'en définit pas. */
  eyebrow: string;
  /** Repli mono-diapositive (anciennes instances : propriétés heroTitle…). */
  title: string;
  subtitle: string;
  imageUrl: string;
  primaryLabel: string;
  primaryUrl: string;
  secondaryLabel: string;
  secondaryUrl: string;
  kpis: IKpi[];
  compact: boolean;
  /** Salutation « Bonjour Prénom » : vide = masquée. */
  greeting: string;
  onExplore: () => void;
  onInternalNavigate: (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => void;
}

const AUTOPLAY_MS = 8000;
const twoDigits = (value: number): string => value < 10 ? `0${value}` : String(value);

/** Visuels BBI embarqués : utilisés quand la diapositive n'a pas d'image. */
interface IDemoVisuals {
  visualDemo0: string;
  visualDemo1: string;
  visualDemo2: string;
  visualDemo3: string;
}

const demoVisualClass = (index: number, css: IDemoVisuals): string => {
  switch (index % 4) {
    case 1:
      return css.visualDemo1;
    case 2:
      return css.visualDemo2;
    case 3:
      return css.visualDemo3;
    default:
      return css.visualDemo0;
  }
};

const prefersReducedMotion = (): boolean => {
  try {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
};

const HomeHero: React.FC<IHomeHeroProps> = (props) => {
  const {
    slides,
    eyebrow,
    title,
    subtitle,
    imageUrl,
    primaryLabel,
    primaryUrl,
    secondaryLabel,
    secondaryUrl,
    kpis,
    compact,
    greeting,
    onExplore,
    onInternalNavigate,
  } = props;

  /**
   * Diapositives effectives : la configuration détaillée gagne, sinon les
   * propriétés historiques (titre, accroche, image) forment une diapositive.
   * Chaque diapositive conserve du texte, même si elle n'a pas de visuel.
   */
  const carousel = React.useMemo<IHeroSlide[]>(() => {
    const configured = (slides || []).filter(
      (slide) => !!(slide.title || slide.imageUrl),
    );
    if (configured.length > 0) {
      return configured.map((slide) => ({
        ...slide,
        eyebrow: slide.eyebrow || eyebrow,
        ctaLabel: slide.ctaLabel || primaryLabel,
        ctaUrl: slide.ctaUrl || primaryUrl,
      }));
    }
    return [
      {
        imageUrl: imageUrl || "",
        eyebrow: eyebrow || "",
        title: title || "",
        subtitle: subtitle || "",
        ctaLabel: primaryLabel || "",
        ctaUrl: primaryUrl || "",
      },
    ];
  }, [slides, eyebrow, title, subtitle, imageUrl, primaryLabel, primaryUrl]);

  const [index, setIndex] = React.useState<number>(0);
  const [paused, setPaused] = React.useState<boolean>(false);
  const [animate, setAnimate] = React.useState<boolean>(true);
  const count = carousel.length;

  React.useEffect(() => {
    setAnimate(!prefersReducedMotion());
  }, []);

  // Défilement automatique : jamais pendant une saisie, un survol ou un
  // onglet en arrière-plan.
  React.useEffect(() => {
    if (count < 2 || paused || !animate) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        setIndex((current) => (current + 1) % count);
      }
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [count, paused, animate]);

  React.useEffect(() => {
    if (index > count - 1) {
      setIndex(0);
    }
  }, [count, index]);

  const go = React.useCallback(
    (delta: number): void => {
      setIndex((current) => (current + delta + count) % count);
    },
    [count],
  );

  const active =
    carousel[Math.min(index, Math.max(0, count - 1))] || carousel[0];
  const titleLines = (active.title || "").split("\n");

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.key === "ArrowRight") {
      go(1);
    } else if (event.key === "ArrowLeft") {
      go(-1);
    }
  };

  const textBlock = (): React.ReactNode => {
    const ctaUrl = safeHref(active.ctaUrl || "#formations") || "#formations";
    const secondaryHref = safeHref(secondaryUrl || "#ressources") || "#ressources";
    return (
    <div
      className={
        animate ? `${styles.text} ${styles.textAnimated}` : styles.text
      }
      key={`slide-${Math.min(index, count - 1)}`}
    >
      <p className={styles.eyebrow}>
        {active.eyebrow || "Business Builders International"}
      </p>
      {active.title && (
        <h1 id="bbi-home-title" className={styles.title}>
          {titleLines.map((line, lineIndex) => (
            <React.Fragment key={`${line}-${lineIndex}`}>
              {line}
              {lineIndex < titleLines.length - 1 && (
                <>
                  <br className={styles.titleBreak} />
                  <span className={styles.mobileTitleSpace}> </span>
                </>
              )}
            </React.Fragment>
          ))}
        </h1>
      )}
      {active.subtitle && <p className={styles.subtitle}>{active.subtitle}</p>}

      <div className={styles.actions}>
        {active.ctaLabel && (
          <a
            className={styles.primary}
            href={ctaUrl}
            onClick={(event) => {
              onInternalNavigate(event, ctaUrl);
            }}
          >
            {active.ctaLabel}
            <span aria-hidden="true"> →</span>
          </a>
        )}
        {secondaryLabel && (
          <a
            className={styles.secondary}
            href={secondaryHref}
            onClick={(event) => {
              onInternalNavigate(event, secondaryHref);
            }}
          >
            {secondaryLabel}
          </a>
        )}
      </div>
    </div>
    );
  };

  return (
    <section
      className={styles.heroWrap}
      id="accueil"
      data-bbi-view="accueil"
      data-bbi-block="hero"
      aria-roledescription="carrousel"
      aria-label="À la une — Business Builders International"
      onMouseEnter={() => {
        setPaused(true);
      }}
      onMouseLeave={() => {
        setPaused(false);
      }}
      onFocus={() => {
        setPaused(true);
      }}
      onBlur={() => {
        setPaused(false);
      }}
      onKeyDown={onKeyDown}
    >
      <div
        className={
          compact ? `${styles.stage} ${styles.stageCompact}` : styles.stage
        }
        data-bbi-hero-stage="true"
      >
        {carousel.map((slide, slideIndex) => {
          const isActive = slideIndex === Math.min(index, count - 1);
          const slideImageUrl = safeImageUrl(slide.imageUrl);
          return (
            <div
              key={`media-${slideIndex}`}
              className={
                isActive
                  ? `${styles.media} ${styles.mediaActive}`
                  : styles.media
              }
              data-bbi-hero-slide={slideIndex}
              aria-hidden="true"
            >
              <div
                className={
                  slideImageUrl
                    ? styles.mediaImage
                    : `${styles.mediaImage} ${demoVisualClass(slideIndex, styles)}`
                }
                style={
                  slideImageUrl
                    ? { backgroundImage: `url("${slideImageUrl}")` }
                    : undefined
                }
              />
            </div>
          );
        })}
        <div className={styles.veil} aria-hidden="true" />

        <div className={styles.inner}>
          {greeting && (
            <p className={styles.greeting}>
              <span className={styles.greetingWave} aria-hidden="true">
                👋
              </span>
              {greeting}
            </p>
          )}
          {textBlock()}
        </div>

        <div className={styles.controls}>
          <div className={styles.controlsInner}>
            {count > 1 ? (
              <div className={styles.controlGroup}>
                <p className={styles.slideCount} aria-hidden="true">
                  {twoDigits(Math.min(index, count - 1) + 1)}
                  <span>/</span>
                  {twoDigits(count)}
                </p>
                <ul className={styles.dots} aria-label="Choix de la diapositive">
                  {carousel.map((slide, dotIndex) => {
                    const isActive = dotIndex === Math.min(index, count - 1);
                    return (
                      <li key={`dot-${dotIndex}`}>
                        <button
                          type="button"
                          className={styles.dot}
                          aria-label={`Diapositive ${dotIndex + 1} sur ${count}${
                            slide.title ? ` : ${slide.title.replace(/\n/g, " ")}` : ""
                          }`}
                          aria-current={isActive ? "true" : undefined}
                          onClick={() => setIndex(dotIndex)}
                        >
                          <span className={styles.dotTrack} aria-hidden="true">
                            {isActive && animate && !paused && (
                              <span
                                key={`progress-${Math.min(index, count - 1)}`}
                                className={styles.dotProgress}
                                style={{ animationDuration: `${AUTOPLAY_MS}ms` }}
                              />
                            )}
                          </span>
                          <span className={styles.visuallyHidden}>{dotIndex + 1}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className={styles.arrows}>
                  <button
                    type="button"
                    className={styles.arrow}
                    onClick={() => go(-1)}
                    aria-label="Diapositive précédente"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className={styles.arrow}
                    onClick={() => go(1)}
                    aria-label="Diapositive suivante"
                  >
                    ›
                  </button>
                </div>
              </div>
            ) : <span />}
            <button
              type="button"
              className={styles.explore}
              onClick={onExplore}
              aria-label="Descendre dans la page"
            >
              Explorer <span aria-hidden="true">↓</span>
            </button>
          </div>
        </div>

        {/* Annonce aux lecteurs d'écran du changement de diapositive. */}
        <p className={styles.visuallyHidden} aria-live="polite">
          {`Diapositive ${Math.min(index, count - 1) + 1} sur ${count}${
            active.title ? ` : ${active.title}` : ""
          }`}
        </p>
      </div>

      {kpis.length > 0 && (
        <ul
          className={styles.kpiBand}
          data-bbi-kpi-band="true"
          aria-label="Chiffres clés BBI"
        >
          {kpis.map((kpi) => (
            <li key={`${kpi.value}-${kpi.label}`} className={styles.kpi}>
              <strong>{kpi.value}</strong>
              <span>{kpi.label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default HomeHero;
