import * as React from "react";
import styles from "./ClientReferences.module.scss";
import { IHomeClientReference, externalUrl } from "./homeData";

export interface IClientReferencesProps {
  references: IHomeClientReference[];
  isDemo: boolean;
  showDataNotices: boolean;
}

const initialsOf = (value: string): string =>
  (value || "")
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

/** Mur de références clients/partenaires : logo (ou monogramme), secteur et localisation. */
const ClientReferences: React.FC<IClientReferencesProps> = (props) => {
  const { references, isDemo, showDataNotices } = props;

  if (references.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrap}>
      {showDataNotices && isDemo && (
        <p className={styles.demoNote}>
          Données de démonstration : la liste « Nos références » est absente, non créée ou vide.
        </p>
      )}
      <ul className={styles.grid}>
        {references.map((reference) => {
          const url = externalUrl(reference.SiteWebUrl);
          const content = (
            <>
              <span
                className={
                  reference.LogoUrl
                    ? styles.logo
                    : `${styles.logo} ${styles.logoFallback}`
                }
                style={
                  reference.LogoUrl
                    ? { backgroundImage: `url("${reference.LogoUrl}")` }
                    : undefined
                }
                role="img"
                aria-label={reference.Title}
              >
                {!reference.LogoUrl && initialsOf(reference.Title)}
              </span>
              <span className={styles.name}>{reference.Title}</span>
              {(reference.Secteur || reference.Ville) && (
                <span className={styles.meta}>
                  {[reference.Secteur, reference.Ville].filter((part) => !!part).join(" · ")}
                </span>
              )}
            </>
          );
          return (
            <li key={reference.Id} className={styles.card}>
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className={styles.cardLink}>
                  {content}
                </a>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ClientReferences;
