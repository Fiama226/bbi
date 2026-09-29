import * as React from "react";
import styles from "./BbiHome.module.scss";
import { IKpi } from "./homeLayout";

export interface IHomeHeroProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  primaryLabel: string;
  primaryUrl: string;
  secondaryLabel: string;
  secondaryUrl: string;
  kpis: IKpi[];
  compact: boolean;
  onExplore: () => void;
  onInternalNavigate: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}

const HomeHero: React.FC<IHomeHeroProps> = (props) => {
  const {
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
    onExplore,
    onInternalNavigate,
  } = props;

  const backgroundStyle: React.CSSProperties | undefined = imageUrl
    ? {
        backgroundImage: `linear-gradient(100deg, rgba(9,20,48,.92) 0%, rgba(14,38,92,.72) 46%, rgba(14,38,92,.18) 100%), url("${imageUrl}")`,
      }
    : undefined;

  const titleLines = (title || "").split("\n");

  return (
    <section
      className={compact ? `${styles.hero} ${styles.heroCompact}` : styles.hero}
      id="accueil"
      aria-labelledby="bbi-home-title"
    >
      <div
        className={imageUrl ? styles.heroImageCustom : styles.heroImage}
        style={imageUrl ? backgroundStyle : undefined}
        aria-hidden="true"
      />
      <div className={styles.heroVeil} aria-hidden="true" />

      <div className={styles.heroInner}>
        <p className={styles.heroEyebrow}>{eyebrow}</p>
        <h1 id="bbi-home-title" className={styles.heroTitle}>
          {titleLines.map((line, index) => (
            <React.Fragment key={`${line}-${index}`}>
              {line}
              {index < titleLines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </h1>
        {subtitle && <p className={styles.heroSubtitle}>{subtitle}</p>}

        <div className={styles.heroActions}>
          {primaryLabel && (
            <a
              className={styles.heroPrimary}
              href={primaryUrl || "#formations"}
              onClick={(event) => { onInternalNavigate(event, primaryUrl || "#formations"); }}
            >
              {primaryLabel}
              <span aria-hidden="true"> →</span>
            </a>
          )}
          {secondaryLabel && (
            <a
              className={styles.heroSecondary}
              href={secondaryUrl || "#ressources"}
              onClick={(event) => { onInternalNavigate(event, secondaryUrl || "#ressources"); }}
            >
              {secondaryLabel}
            </a>
          )}
        </div>
      </div>

      {kpis.length > 0 && (
        <ul className={styles.kpiBand} aria-label="Chiffres clés BBI">
          {kpis.map((kpi) => (
            <li key={`${kpi.value}-${kpi.label}`} className={styles.kpi}>
              <strong>{kpi.value}</strong>
              <span>{kpi.label}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className={styles.scrollCue}
        onClick={onExplore}
        aria-label="Faire défiler la page"
      >
        <span className={styles.scrollCueDot} aria-hidden="true" />
      </button>
    </section>
  );
};

export default HomeHero;
