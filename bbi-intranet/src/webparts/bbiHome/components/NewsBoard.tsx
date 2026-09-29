import * as React from "react";
import styles from "./NewsBoard.module.scss";
import { IHomeNews } from "./homeData";

export interface INewsBoardProps {
  items: IHomeNews[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  isDemo: boolean;
  showDataNotices: boolean;
  loading: boolean;
  variant: "home" | "archive";
  onPageChange: (page: number) => void;
  onOpenNews: (id: number) => void;
  onViewAll: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

const formatDate = (value?: string): string => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const readMinutes = (item: IHomeNews): number => {
  const words = `${item.Body || ""} ${item.Summary || ""}`
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1).length;
  return Math.max(1, Math.round(words / 200));
};

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

const Pagination: React.FC<{
  page: number;
  hasMore: boolean;
  totalPages?: number;
  onChange: (page: number) => void;
}> = (props) => {
  const { page, hasMore, totalPages, onChange } = props;
  const knownLast = hasMore ? page + 1 : page;
  const start = Math.max(0, Math.min(page - 2, Math.max(0, knownLast - 4)));
  const numbers: number[] = [];
  for (let index = start; index <= knownLast; index += 1) {
    numbers.push(index);
  }
  return (
    <nav
      className={styles.pagination}
      data-bbi-news-pagination="true"
      aria-label="Pagination des actualités"
    >
      <button
        type="button"
        className={styles.pageButton}
        onClick={() => {
          onChange(0);
        }}
        disabled={page === 0}
        aria-label="Première page"
      >
        «
      </button>
      <button
        type="button"
        className={styles.pageButton}
        onClick={() => {
          onChange(page - 1);
        }}
        disabled={page === 0}
        aria-label="Page précédente"
      >
        ‹
      </button>
      {numbers.map((number) => (
        <button
          key={number}
          type="button"
          className={
            number === page
              ? `${styles.pageButton} ${styles.pageButtonActive}`
              : styles.pageButton
          }
          aria-current={number === page ? "page" : undefined}
          onClick={() => {
            onChange(number);
          }}
        >
          {number + 1}
        </button>
      ))}
      <button
        type="button"
        className={styles.pageButton}
        onClick={() => {
          onChange(page + 1);
        }}
        disabled={!hasMore}
        aria-label="Page suivante"
      >
        ›
      </button>
      <span className={styles.pageInfo}>
        Page {page + 1}
        {totalPages ? ` sur ${totalPages}` : ""}
      </span>
    </nav>
  );
};

/**
 * Fil d'actualités : une actualité à la une puis les suivantes, avec
 * pagination — prêt pour un grand volume d'actualités.
 */
const NewsBoard: React.FC<INewsBoardProps> = (props) => {
  const {
    items,
    page,
    hasMore,
    isDemo,
    showDataNotices,
    loading,
    variant,
    onPageChange,
    onOpenNews,
    onViewAll,
  } = props;

  const featured = variant === "home" ? items[0] : undefined;
  const rest = featured ? items.slice(1) : items;

  const renderCard = (item: IHomeNews): React.ReactNode => (
    <li className={styles.card} key={item.Id}>
      <button
        type="button"
        className={styles.cardButton}
        onClick={() => {
          onOpenNews(item.Id);
        }}
        aria-label={`Lire l'actualité : ${item.Title}`}
      >
        <span
          className={
            item.ImageUrl
              ? styles.cardImage
              : `${styles.cardImage} ${visualClass(item)}`
          }
          style={item.ImageUrl ? { backgroundImage: `url("${item.ImageUrl}")` } : undefined}
          role="img"
          aria-label=""
        />
        <span className={styles.cardBody}>
          {item.Category && <span className={styles.category}>{item.Category}</span>}
          <strong className={styles.cardTitle}>{item.Title}</strong>
          {item.Summary && <span className={styles.cardSummary}>{item.Summary}</span>}
          <span className={styles.cardMeta}>
            {formatDate(item.Published)}
            {item.AuthorName ? ` · ${item.AuthorName}` : ""} · {readMinutes(item)} min
          </span>
          <span className={styles.cardMore}>
            Lire l&apos;actualité <span aria-hidden="true">→</span>
          </span>
        </span>
      </button>
    </li>
  );

  return (
    <div className={variant === "home" ? styles.board : `${styles.board} ${styles.boardWide}`}>
      {showDataNotices && isDemo && (
        <p className={styles.demoNote}>
          Données de démonstration : la liste des actualités est absente, non créée ou vide.
        </p>
      )}

      {loading ? (
        <div className={styles.loading} role="status">
          Chargement des actualités…
        </div>
      ) : items.length === 0 ? (
        <p className={styles.empty}>Aucune actualité publiée.</p>
      ) : (
        <>
          {featured && (
            <article className={styles.featured}>
              <button
                type="button"
                className={styles.featuredButton}
                onClick={() => {
                  onOpenNews(featured.Id);
                }}
                aria-label={`Lire l'actualité : ${featured.Title}`}
              >
                <span
                  className={
                    featured.ImageUrl
                      ? styles.featuredImage
                      : `${styles.featuredImage} ${visualClass(featured)}`
                  }
                  style={
                    featured.ImageUrl
                      ? { backgroundImage: `url("${featured.ImageUrl}")` }
                      : undefined
                  }
                  role="img"
                  aria-label=""
                />
                <span className={styles.featuredBody}>
                  <span className={styles.category}>{featured.Category || "Vie BBI"}</span>
                  <strong className={styles.featuredTitle}>{featured.Title}</strong>
                  <span className={styles.featuredSummary}>{featured.Summary}</span>
                  <span className={styles.cardMeta}>
                    {formatDate(featured.Published)}
                    {featured.AuthorName ? ` · ${featured.AuthorName}` : ""} ·{" "}
                    {readMinutes(featured)} min de lecture
                  </span>
                  <span className={styles.featuredMore}>
                    Lire l&apos;actualité <span aria-hidden="true">→</span>
                  </span>
                </span>
              </button>
            </article>
          )}

          {rest.length > 0 && (
            <ul className={styles.grid}>{rest.map((item) => renderCard(item))}</ul>
          )}

          {(hasMore || page > 0) && (
            <Pagination page={page} hasMore={hasMore} onChange={onPageChange} />
          )}

          {variant === "home" && (
            <a className={styles.viewAll} href="#actualites" onClick={onViewAll}>
              Toutes les actualités <span aria-hidden="true">→</span>
            </a>
          )}
        </>
      )}
    </div>
  );
};

export default NewsBoard;
