import * as React from "react";
import styles from "./AnnouncementDetail.module.scss";
import { IAnnouncementItem, iconForAnnouncement } from "./announcementData";
import { sanitizeHtml } from "../../articleActualite/components/articleData";

export interface IAnnouncementDetailProps {
  items: IAnnouncementItem[];
  announcementId: number;
  isDemo: boolean;
  onOpen: (id: number) => void;
  onBack: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

const formatDate = (value?: string): string => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
};

/**
 * Annonces internes : dernières annonces (#annonces) et détail (#annonce?id=3).
 * Cette page ne lit ni ne réutilise les articles de la liste Actualites.
 */
const AnnouncementDetail: React.FC<IAnnouncementDetailProps> = (props) => {
  const { items, announcementId, isDemo, onOpen, onBack } = props;
  const item = items.find((candidate) => candidate.Id === announcementId);
  const others = items.filter((other) => other.Id !== announcementId).slice(0, 4);

  const announcementList = (entries: IAnnouncementItem[]): React.ReactElement => (
    <ul className={styles.list}>
      {entries.map((entry) => (
        <li key={entry.Id}>
          <a
            href={`#annonce?id=${entry.Id}`}
            onClick={(event) => {
              // Conserver l'ouverture native dans un nouvel onglet.
              if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
                event.preventDefault();
                onOpen(entry.Id);
              }
            }}
          >
            <span className={styles.icon} aria-hidden="true">
              {iconForAnnouncement(entry.Type)}
            </span>
            <span>
              <strong>{entry.Title}</strong>
              <small>
                {[entry.Type, formatDate(entry.EventDate || entry.Created)]
                  .filter((part) => !!part)
                  .join(" · ")}
              </small>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={styles.shell}>
      <nav className={styles.breadcrumb} aria-label="Fil d'Ariane">
        <a href="#accueil" onClick={onBack}>← Retour à l&apos;accueil</a>
        <span aria-hidden="true">/</span>
        <span>Annonces</span>
      </nav>

      {isDemo && (
        <p className={styles.notice} role="status">
          Annonces fictives de démonstration : la source des annonces est indisponible.
        </p>
      )}

      {!announcementId ? (
        <section className={styles.overview} aria-labelledby="bbi-announcements-title">
          <h1 id="bbi-announcements-title">Annonces de l&apos;équipe</h1>
          <p className={styles.intro}>
            Mariages, anniversaires, naissances, arrivées… Les dernières annonces
            partagées au sein de BBI.
          </p>
          {items.length > 0 ? announcementList(items) : (
            <p className={styles.empty}>Aucune annonce en cours pour le moment.</p>
          )}
        </section>
      ) : (
        <div className={others.length > 0 ? styles.layout : styles.layoutSingle}>
          {item ? (
            <article className={styles.card}>
              {item.ImageUrl && (
                <img className={styles.visual} src={item.ImageUrl} alt={item.Title} />
              )}
              <div className={styles.body}>
                <p className={styles.type}>
                  <span aria-hidden="true">{iconForAnnouncement(item.Type)}</span>
                  {item.Type || "Annonce"}
                </p>
                <h1>{item.Title}</h1>
                <p className={styles.meta}>
                  {[formatDate(item.EventDate || item.Created), item.Author ? `Publié par ${item.Author}` : ""]
                    .filter((part) => !!part)
                    .join(" · ")}
                </p>
                {item.Body ? (
                  <div className={styles.content} dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.Body) }} />
                ) : (
                  <p className={styles.content}>Aucun détail supplémentaire pour cette annonce.</p>
                )}
              </div>
            </article>
          ) : (
            <article className={styles.card}>
              <div className={styles.body}>
                <h1>Annonce introuvable</h1>
                <p className={styles.content}>
                  Cette annonce a été retirée ou n&apos;est pas accessible.
                </p>
              </div>
            </article>
          )}

          {others.length > 0 && (
            <aside className={styles.aside} aria-label="Autres annonces">
              <h2>Autres annonces</h2>
              {announcementList(others)}
            </aside>
          )}
        </div>
      )}
    </div>
  );
};

export default AnnouncementDetail;
