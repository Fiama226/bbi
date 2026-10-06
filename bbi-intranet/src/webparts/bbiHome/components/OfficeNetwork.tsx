import * as React from "react";
import styles from "./OfficeNetwork.module.scss";
import { IHomeOffice, mailtoUrl, telUrl } from "./homeData";

export interface IOfficeNetworkProps {
  offices: IHomeOffice[];
  isDemo: boolean;
  showDataNotices: boolean;
}

/** Réseau d'implantations : le siège puis les filiales/antennes, triés par Ordre. */
const OfficeNetwork: React.FC<IOfficeNetworkProps> = (props) => {
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
        {offices.map((office) => (
          <li
            key={office.Id}
            className={
              office.EstSiege
                ? `${styles.card} ${styles.cardHq}`
                : styles.card
            }
          >
            {office.EstSiege && <span className={styles.hqBadge}>Siège</span>}
            <strong className={styles.name}>{office.Title}</strong>
            {(office.Ville || office.Pays) && (
              <span className={styles.place}>
                {[office.Ville, office.Pays].filter((part) => !!part).join(" · ")}
              </span>
            )}
            {office.Adresse && <p className={styles.address}>{office.Adresse}</p>}
            {office.Responsable && (
              <p className={styles.manager}>{office.Responsable}</p>
            )}
            <div className={styles.contactLinks}>
              {office.Telephone && (
                <a href={telUrl(office.Telephone)}>{office.Telephone}</a>
              )}
              {office.Email && <a href={mailtoUrl(office.Email)}>{office.Email}</a>}
              {office.LienCarte && (
                <a href={office.LienCarte} target="_blank" rel="noopener noreferrer">
                  Voir sur la carte ↗
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default OfficeNetwork;
