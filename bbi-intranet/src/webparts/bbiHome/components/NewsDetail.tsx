import * as React from "react";
import styles from "./NewsDetail.module.scss";
import { IHomeNews } from "./homeData";
import { IHomeNewsBundle } from "./newsArchive";
import { readingTimeOf, sanitizeHtml } from "../../articleActualite/components/articleData";

export interface INewsDetailProps {
  bundle: IHomeNewsBundle;
  loading: boolean;
  siteUrl: string;
  showDataNotices: boolean;
  onOpenNews: (id: number) => void;
  onBack: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

const formatLongDate = (value?: string): string => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const initialsOf = (value?: string): string =>
  (value || "")
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

const visualClass = (item: IHomeNews): string => {
  if (item.ImageUrl) {
    return "";
  }
  switch ((item.DemoIndex || 0) % 4) {
    case 1:
      return styles.visual1;
    case 2:
      return styles.visual2;
    case 3:
      return styles.visual3;
    default:
      return styles.visual0;
  }
};

/**
 * Page dédiée à une actualité : article complet, partage et navigation
 * éditoriale (actualité suivante, précédente et autres actualités).
 */
const NewsDetail: React.FC<INewsDetailProps> = (props) => {
  const { bundle, loading, siteUrl, showDataNotices, onOpenNews, onBack } = props;
  const [copied, setCopied] = React.useState(false);
  const article = bundle.article;

  React.useEffect(() => {
    setCopied(false);
  }, [article && article.Id]);

  if (loading) {
    return (
      <div className={styles.shell}>
        <div className={styles.loading} role="status">
          Chargement de l&apos;actualité…
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className={styles.shell}>
        <p className={styles.empty}>
          Cette actualité n&apos;est plus disponible.{" "}
          <a href="#actualites" onClick={onBack}>
            Retour aux actualités
          </a>
        </p>
      </div>
    );
  }

  const bodyHtml = article.Body ? sanitizeHtml(article.Body) : "";
  const minutes = readingTimeOf(article.Body, `${article.Summary || ""} ${article.Title}`);
  const shareUrl =
    (typeof window !== "undefined" && window.location.href) ||
    `${siteUrl}#actualite?id=${article.Id}`;
  const mailSubject = encodeURIComponent(article.Title || "");
  const mailBody = encodeURIComponent(`${article.Summary || ""}\n\n${shareUrl}`);

  const contextCard = (item: IHomeNews | undefined, direction: "prev" | "next"): React.ReactNode => {
    if (!item) {
      return null;
    }
    return (
      <button
        type="button"
        className={direction === "next" ? `${styles.context} ${styles.contextNext}` : styles.context}
        onClick={() => {
          onOpenNews(item.Id);
        }}
      >
        <span className={styles.contextLabel}>
          {direction === "next" ? "Actualité suivante" : "Actualité précédente"}
          <span aria-hidden="true">{direction === "next" ? " →" : " ←"}</span>
        </span>
        <strong>{item.Title}</strong>
        {item.Category && <small>{item.Category}</small>}
      </button>
    );
  };

  return (
    <div className={styles.shell}>
      {showDataNotices && bundle.isDemo && (
        <p className={styles.demoNote}>
          Données de démonstration : la liste des actualités est absente, non créée ou vide.
        </p>
      )}

      <nav className={styles.breadcrumb} aria-label="Fil d'ariane">
        <a href="#accueil" onClick={onBack}>
          Accueil
        </a>
        <span aria-hidden="true">›</span>
        <a href="#actualites" onClick={onBack}>
          Actualités
        </a>
        {article.Category && (
          <>
            <span aria-hidden="true">›</span>
            <span>{article.Category}</span>
          </>
        )}
      </nav>

      <div className={styles.layout}>
        <article className={styles.article}>
          <header className={styles.head}>
            {article.Category && <span className={styles.category}>{article.Category}</span>}
            <h1 className={styles.title}>{article.Title}</h1>
            {article.Summary && <p className={styles.standfirst}>{article.Summary}</p>}
            <div className={styles.byline}>
              {article.AuthorName && (
                <span className={styles.author}>
                  <span className={styles.authorAvatar} aria-hidden="true">
                    {initialsOf(article.AuthorName)}
                  </span>
                  {article.AuthorName}
                </span>
              )}
              <span aria-hidden="true">·</span>
              <time dateTime={article.Published}>{formatLongDate(article.Published)}</time>
              <span aria-hidden="true">·</span>
              <span>{minutes} min de lecture</span>
            </div>
          </header>

          <figure
            className={
              article.ImageUrl
                ? styles.figure
                : `${styles.figure} ${visualClass(article)}`
            }
            style={
              article.ImageUrl ? { backgroundImage: `url("${article.ImageUrl}")` } : undefined
            }
            role="img"
            aria-label={article.Title}
          />

          <div className={styles.body}>
            {bodyHtml ? (
              <div className={styles.rich} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            ) : (
              <p className={styles.richFallback}>
                {article.Summary ||
                  "Le détail de cette actualité sera publié prochainement. Contactez la communication BBI pour en savoir plus."}
              </p>
            )}

            {article.LinkUrl && (
              <p className={styles.external}>
                <a href={article.LinkUrl} target="_blank" rel="noopener noreferrer">
                  En savoir plus ↗
                </a>
              </p>
            )}

            <div className={styles.footerActions}>
              <button
                type="button"
                className={styles.backButton}
                onClick={(event) => {
                  onBack(event as unknown as React.MouseEvent<HTMLAnchorElement>);
                }}
              >
                <span aria-hidden="true">←</span> Toutes les actualités
              </button>
              <div className={styles.share}>
                <span className={styles.shareLabel}>Partager</span>
                <button
                  type="button"
                  className={styles.shareButton}
                  onClick={() => {
                    window.open(
                      `https://outlook.office.com/mail/deeplink/compose?subject=${mailSubject}&body=${mailBody}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                >
                  ✉ Outlook
                </button>
                <button
                  type="button"
                  className={styles.shareButton}
                  onClick={() => {
                    window.open(
                      `https://teams.microsoft.com/l/message/0/0?messageText=${encodeURIComponent(
                        `${article.Title} — ${shareUrl}`,
                      )}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                >
                  ⬦ Teams
                </button>
                <button
                  type="button"
                  className={styles.shareButton}
                  onClick={() => {
                    const clipboard = window.navigator.clipboard;
                    if (clipboard) {
                      clipboard
                        .writeText(shareUrl)
                        .then(() => {
                          setCopied(true);
                          window.setTimeout(() => setCopied(false), 2200);
                        })
                        .catch(() => setCopied(false));
                    }
                  }}
                  aria-live="polite"
                >
                  {copied ? "✓ Lien copié" : "⌘ Copier le lien"}
                </button>
              </div>
            </div>
          </div>
        </article>

        <aside className={styles.sidebar} aria-label="Navigation dans les actualités">
          {(bundle.previous || bundle.next) && (
            <div className={styles.contextGroup}>
              {contextCard(bundle.next, "next")}
              {contextCard(bundle.previous, "prev")}
            </div>
          )}

          {bundle.others.length > 0 && (
            <div className={styles.others}>
              <h2>Autres actualités</h2>
              <ul className={styles.othersList}>
                {bundle.others.map((item) => (
                  <li key={item.Id}>
                    <button
                      type="button"
                      className={styles.otherItem}
                      onClick={() => {
                        onOpenNews(item.Id);
                      }}
                    >
                      <span
                        className={
                          item.ImageUrl
                            ? styles.otherImage
                            : `${styles.otherImage} ${visualClass(item)}`
                        }
                        style={
                          item.ImageUrl
                            ? { backgroundImage: `url("${item.ImageUrl}")` }
                            : undefined
                        }
                        aria-hidden="true"
                      />
                      <span className={styles.otherText}>
                        <strong>{item.Title}</strong>
                        {item.Category && <small>{item.Category}</small>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <a className={styles.allNews} href="#actualites" onClick={onBack}>
                Toutes les actualités <span aria-hidden="true">→</span>
              </a>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default NewsDetail;
