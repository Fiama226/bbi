import * as React from "react";
import styles from "./PedagogicalReferences.module.scss";
import { IHomePedagogicalReference, externalUrl } from "./homeData";

export interface IPedagogicalReferencesProps {
  references: IHomePedagogicalReference[];
  isDemo: boolean;
  showDataNotices: boolean;
}

const CATEGORY_ORDER = ["Ouvrage", "Norme", "Méthode", "Étude", "Outil"];

/** Références pédagogiques regroupées par catégorie : ouvrages, normes, méthodes, études, outils. */
const PedagogicalReferences: React.FC<IPedagogicalReferencesProps> = (props) => {
  const { references, isDemo, showDataNotices } = props;

  const groups = React.useMemo(() => {
    const byCategory = new Map<string, IHomePedagogicalReference[]>();
    references.forEach((item) => {
      const key = item.Categorie || "Autre";
      if (!byCategory.has(key)) {
        byCategory.set(key, []);
      }
      byCategory.get(key)!.push(item);
    });
    const known = CATEGORY_ORDER.filter((category) => byCategory.has(category));
    const extra = Array.from(byCategory.keys()).filter(
      (category) => CATEGORY_ORDER.indexOf(category) === -1,
    );
    return [...known, ...extra].map((category) => ({
      category,
      items: byCategory.get(category) || [],
    }));
  }, [references]);

  if (references.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrap}>
      {showDataNotices && isDemo && (
        <p className={styles.demoNote}>
          Données de démonstration : la liste « Références pédagogiques » est absente, non créée ou vide.
        </p>
      )}
      <div className={styles.groups}>
        {groups.map((group) => (
          <div className={styles.group} key={group.category}>
            <h3 className={styles.groupTitle}>{group.category}</h3>
            <ul className={styles.list}>
              {group.items.map((item) => {
                const url = externalUrl(item.LienUrl);
                return (
                  <li className={styles.item} key={item.Id}>
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className={styles.itemTitle}>
                        {item.Title} ↗
                      </a>
                    ) : (
                      <span className={styles.itemTitle}>{item.Title}</span>
                    )}
                    <span className={styles.itemMeta}>
                      {[item.Auteur, item.Annee ? String(item.Annee) : undefined]
                        .filter((part) => !!part)
                        .join(" · ")}
                    </span>
                    {item.Resume && <p className={styles.itemResume}>{item.Resume}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PedagogicalReferences;
