import * as React from 'react';
import styles from './ArticleActualite.module.scss';
import { IArticleActualiteProps, IArticleResult } from './IArticleActualiteProps';
import { loadArticle, readingTimeOf, sanitizeHtml } from './articleData';

type LoadStatus = 'loading' | 'ready';

const formatLongDate = (value?: string): string => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
};

const readItemIdFromUrl = (): number => {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('itemid') || params.get('ItemId') || params.get('id');
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
    const hashMatch = /[?#&]itemid=(\d+)/i.exec(window.location.hash || '');
    if (hashMatch) {
      return parseInt(hashMatch[1], 10);
    }
  } catch {
    /* URL illisible */
  }
  return 0;
};

const ArticleActualite: React.FC<IArticleActualiteProps> = (props) => {
  const { siteUrl, newsListTitle, maxRelated, showDataNotices, shareUrl, spHttpClient, strings } = props;
  const [status, setStatus] = React.useState<LoadStatus>('loading');
  const [result, setResult] = React.useState<IArticleResult>({ related: [], isDemo: false });
  const [copied, setCopied] = React.useState(false);
  const [itemId, setItemId] = React.useState<number>(readItemIdFromUrl() || props.defaultItemId || 0);

  React.useEffect(() => {
    const onHashChange = (): void => {
      const next = readItemIdFromUrl();
      if (next) {
        setItemId(next);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    loadArticle(spHttpClient, siteUrl, newsListTitle, itemId, maxRelated)
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        setResult(loaded);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('ready');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [spHttpClient, siteUrl, newsListTitle, itemId, maxRelated]);

  if (status === 'loading') {
    return (
      <div className={styles.article}>
        <div className={styles.loading} role="status">
          {strings.LoadingMessage}
        </div>
      </div>
    );
  }

  const article = result.article;
  if (!article) {
    return (
      <div className={styles.article}>
        <div className={styles.empty}>
          <h3>{strings.EmptyStateTitle}</h3>
          <p>{strings.EmptyStateHint}</p>
          <a className={styles.backAction} href={`${siteUrl}/SitePages/vie-bbi.aspx`}>
            {strings.BackToNews}
          </a>
        </div>
      </div>
    );
  }

  const bodyHtml = article.Body ? sanitizeHtml(article.Body) : '';
  const minutes = readingTimeOf(article.Body, `${article.Summary || ''} ${article.Title || ''}`);
  const canonicalUrl =
    shareUrl ||
    `${siteUrl}/SitePages/article.aspx${itemId ? `?itemid=${itemId}` : ''}`;
  const newsUrl = `${siteUrl}/SitePages/vie-bbi.aspx`;
  const mailSubject = encodeURIComponent(article.Title || '');
  const mailBody = encodeURIComponent(`${article.Summary || ''}\n\n${canonicalUrl}`);

  return (
    <div className={styles.article}>
      {showDataNotices && result.isDemo && (
        <div className={styles.demoBanner}>💡 {strings.DemoBanner}</div>
      )}

      <article className={styles.shell}>
        <nav className={styles.breadcrumb} aria-label="Fil d'ariane">
          <a href={siteUrl}>{strings.BreadcrumbHome}</a>
          <span aria-hidden="true">›</span>
          <a href={newsUrl}>{strings.BreadcrumbNews}</a>
          {article.Category && (
            <>
              <span aria-hidden="true">›</span>
              <span>{article.Category}</span>
            </>
          )}
        </nav>

        <header className={styles.head}>
          {article.Category && <span className={styles.category}>{article.Category}</span>}
          <h1 className={styles.title}>{article.Title}</h1>
          {article.Summary && <p className={styles.standfirst}>{article.Summary}</p>}
          <div className={styles.byline}>
            {article.AuthorName && (
              <span className={styles.author}>
                <span className={styles.avatar} aria-hidden="true">
                  {article.AuthorName.split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part.charAt(0))
                    .join('')
                    .toUpperCase()}
                </span>
                {article.AuthorName}
              </span>
            )}
            <span className={styles.dot} aria-hidden="true">
              ·
            </span>
            <span>{formatLongDate(article.Published)}</span>
            <span className={styles.dot} aria-hidden="true">
              ·
            </span>
            <span>
              {minutes} {minutes > 1 ? strings.ReadingTimePlural : strings.ReadingTimeSingular}
            </span>
          </div>
        </header>

        {article.ImageUrl ? (
          <figure className={styles.figure}>
            <img
              className={styles.image}
              src={
                article.ImageUrl.indexOf('http') === 0
                  ? article.ImageUrl
                  : new URL(article.ImageUrl, siteUrl).toString()
              }
              alt={article.Title || ''}
            />
          </figure>
        ) : result.isDemo ? (
          <figure className={styles.figure}>
            <div
              className={styles.figureImage}
              role="img"
              aria-label={article.Title || ''}
            />
          </figure>
        ) : null}

        <div className={styles.layout}>
          <div className={styles.content}>
            {bodyHtml ? (
              /* HTML éditorial nettoyé (scripts et événements retirés) */
              <div className={styles.rich} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            ) : (
              <p className={styles.richFallback}>
                {article.Summary || strings.NoContent}
              </p>
            )}

            {article.LinkUrl && (
              <p className={styles.externalLink}>
                <a href={article.LinkUrl} target="_blank" rel="noopener noreferrer">
                  {strings.ExternalLink} ↗
                </a>
              </p>
            )}
          </div>

          <aside className={styles.sidebar} aria-label={strings.ShareTitle}>
            <div className={styles.shareCard}>
              <h3>{strings.ShareTitle}</h3>
              <div className={styles.shareActions}>
                <button
                  type="button"
                  className={styles.shareButton}
                  onClick={() => {
                    window.open(
                      `https://outlook.office.com/mail/deeplink/compose?subject=${mailSubject}&body=${mailBody}`,
                      '_blank',
                      'noopener,noreferrer'
                    );
                  }}
                >
                  ✉ {strings.ShareMail}
                </button>
                <button
                  type="button"
                  className={styles.shareButton}
                  onClick={() => {
                    window.open(
                      `https://teams.microsoft.com/l/message/0/0?messageText=${encodeURIComponent(
                        `${article.Title} — ${canonicalUrl}`
                      )}`,
                      '_blank',
                      'noopener,noreferrer'
                    );
                  }}
                >
                  ⬦ {strings.ShareTeams}
                </button>
                <button
                  type="button"
                  className={styles.shareButton}
                  onClick={() => {
                    const copy = window.navigator.clipboard;
                    if (copy) {
                      copy
                        .writeText(canonicalUrl)
                        .then(() => {
                          setCopied(true);
                          window.setTimeout(() => setCopied(false), 2200);
                        })
                        .catch(() => {
                          setCopied(false);
                        });
                    }
                  }}
                  aria-live="polite"
                >
                  {copied ? `✓ ${strings.Copied}` : `⌘ ${strings.CopyLink}`}
                </button>
              </div>
              <a className={styles.newsLink} href={newsUrl}>
                {strings.BackToNews} <span aria-hidden="true">→</span>
              </a>
            </div>
          </aside>
        </div>
      </article>

      {result.related.length > 0 && (
        <section className={styles.related} aria-label={strings.RelatedTitle}>
          <h2>{strings.RelatedTitle}</h2>
          <ul className={styles.relatedList}>
            {result.related.map((entry) => (
              <li key={entry.Id}>
                <a
                  className={styles.relatedCard}
                  href={`${siteUrl}/SitePages/article.aspx?itemid=${entry.Id}`}
                >
                  {entry.Category && <span className={styles.relatedCategory}>{entry.Category}</span>}
                  <strong>{entry.Title}</strong>
                  <small>{formatLongDate(entry.Published)}</small>
                  <span className={styles.relatedMore}>
                    {strings.ReadMore} <span aria-hidden="true">→</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default ArticleActualite;
