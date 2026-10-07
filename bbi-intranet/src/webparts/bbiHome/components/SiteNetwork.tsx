import * as React from "react";
import styles from "./SiteNetwork.module.scss";
import { IHomeOffice, mailtoUrl, telUrl } from "./homeData";

export interface ISiteNetworkProps {
  offices: IHomeOffice[];
  isDemo: boolean;
  showDataNotices: boolean;
}

/** Réseau des sites BBI : une carte par implantation (siège en tête), style tableau de bord. */
const SiteNetwork: React.FC<ISiteNetworkProps> = (props) => {
  const { offices, isDemo, showDataNotices } = props;
  if (offices.length === 0) {
    return null;
  }
  return (
    <div className={styles.wrap}>
      {showDataNotices && isDemo && (
        <p className={styles.demoNote}>
          Données de démonstration : la liste « Implantations » est absente, non créée ou vide.
        </p>
      )}
      <ul className={styles.grid}>
        {offices.map((office) => {
          const accent = office.Couleur || "var(--bbi-navy)";
          return (
            <li
              key={office.Id}
              className={office.EstSiege ? `${styles.card} ${styles.cardHq}` : styles.card}
              data-bbi-site-card=""
            >
              <div className={styles.band} style={{ background: accent }}>
                <span className={styles.logo} style={{ color: accent }} aria-hidden="true">
                  {office.Initiales || "BBI"}
                </span>
                <span className={styles.kind}>{office.EstSiege ? "Siège" : "Filiale"}</span>
              </div>
              <div className={styles.body}>
                <strong className={styles.name}>{office.Title}</strong>
                {(office.Ville || office.Pays) && (
                  <span className={styles.place}>
                    {[office.Ville, office.Pays].filter((part) => !!part).join(" · ")}
                  </span>
                )}
                {office.Responsable && <p className={styles.manager}>{office.Responsable}</p>}
                {office.SiteUrl && (
                  <a
                    className={styles.open}
                    href={office.SiteUrl}
                    data-bbi-site-open=""
                    style={{ background: accent }}
                  >
                    Ouvrir le site <span aria-hidden="true">→</span>
                  </a>
                )}
                <div className={styles.contactLinks}>
                  {office.Telephone && <a href={telUrl(office.Telephone)}>{office.Telephone}</a>}
                  {office.Email && <a href={mailtoUrl(office.Email)}>{office.Email}</a>}
                  {office.LienCarte && (
                    <a href={office.LienCarte} target="_blank" rel="noopener noreferrer">
                      Voir sur la carte ↗
                    </a>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default SiteNetwork;
