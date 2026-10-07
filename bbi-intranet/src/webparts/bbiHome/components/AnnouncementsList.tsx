import * as React from "react";
import styles from "./AnnouncementsList.module.scss";
import { IHomeAnnouncement, isAnnouncementActive } from "./homeData";
import { safeHref } from "../../../shared/safeUrl";

export interface IAnnouncementsListProps {
  announcements: IHomeAnnouncement[];
  isDemo: boolean;
  showDataNotices: boolean;
}

/** Annonces actives, dans l'ordre fourni par le chargeur (Ordre). */
const AnnouncementsList: React.FC<IAnnouncementsListProps> = (props) => {
  const { announcements, isDemo, showDataNotices } = props;
  const active = announcements.filter((a) => isAnnouncementActive(a));
  if (active.length === 0) {
    return <p className={styles.empty}>Aucune annonce en cours.</p>;
  }
  return (
    <div className={styles.wrap}>
      {showDataNotices && isDemo && (
        <p className={styles.demoNote}>Données de démonstration : la liste « Annonces » est absente, non créée ou vide.</p>
      )}
      <ul className={styles.list}>
        {active.map((a) => {
          const href = a.LienUrl ? safeHref(a.LienUrl) : undefined;
          return (
            <li key={a.Id} className={styles.item} data-bbi-level={a.Niveau || "Info"}>
              <span className={styles.level}>{a.Niveau || "Info"}</span>
              <div className={styles.text}>
                <strong>{a.Title}</strong>
                {a.Message && <p>{a.Message}</p>}
                {href && (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    En savoir plus <span aria-hidden="true">→</span>
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default AnnouncementsList;
