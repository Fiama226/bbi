import * as React from "react";
import styles from "./LinkDirectory.module.scss";
import { ILinkGroup } from "./linkDirectoryData";

export interface ILinkDirectoryProps {
  groups: ILinkGroup[];
  isDemo: boolean;
  showDataNotices: boolean;
  /** Texte du bandeau « données de démonstration ». */
  demoNote: string;
}

/** Annuaire de liens : groupes thématiques de tuiles icône + libellé (style tableau de bord). */
const LinkDirectory: React.FC<ILinkDirectoryProps> = (props) => {
  const { groups, isDemo, showDataNotices, demoNote } = props;
  if (groups.length === 0) {
    return null;
  }
  return (
    <div className={styles.wrap} data-bbi-link-directory="">
      {showDataNotices && isDemo && <p className={styles.demoNote}>{demoNote}</p>}
      {groups.map((group) => (
        <div className={styles.group} key={group.title}>
          <h3 className={styles.groupTitle}>{group.title}</h3>
          <ul className={styles.tiles}>
            {group.items.map((item) => {
              const body = (
                <>
                  <span className={styles.icon} aria-hidden="true">{item.icon}</span>
                  <span className={styles.text}>
                    <span className={styles.label}>{item.label}</span>
                    {item.hint && <small className={styles.hint}>{item.hint}</small>}
                  </span>
                </>
              );
              return (
                <li key={item.key} className={styles.tile}>
                  {item.href ? (
                    <a className={styles.link} href={item.href} target="_blank" rel="noopener noreferrer">
                      {body}
                    </a>
                  ) : (
                    <span className={`${styles.link} ${styles.linkInert}`}>{body}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default LinkDirectory;
