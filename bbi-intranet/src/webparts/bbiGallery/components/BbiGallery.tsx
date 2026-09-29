import * as React from "react";
import * as ReactDOM from "react-dom";
import styles from "./BbiGallery.module.scss";
import { IBbiGalleryProps, IGalleryItem } from "./IBbiGalleryProps";
import {
  formatDateFr,
  isDemoItem,
  isVideo,
  loadGallery,
  previewUrlOf,
  thumbUrlOf,
} from "./galleryData";

type LoadStatus = "loading" | "ready";

const demoImageClass = (index: number | undefined): string => {
  switch ((index || 0) % 4) {
    case 1:
      return styles.demoImage1;
    case 2:
      return styles.demoImage2;
    case 3:
      return styles.demoImage3;
    default:
      return styles.demoImage0;
  }
};

const BbiGallery: React.FC<IBbiGalleryProps> = (props) => {
  const {
    siteUrl,
    libraryTitle,
    maxItems,
    columns,
    showCaptions,
    allowDownload,
    showDataNotices,
    albumFilter,
    spHttpClient,
    strings,
  } = props;

  const [status, setStatus] = React.useState<LoadStatus>("loading");
  const [items, setItems] = React.useState<IGalleryItem[]>([]);
  const [isDemo, setIsDemo] = React.useState(false);
  const [album, setAlbum] = React.useState("");
  const [lightboxIndex, setLightboxIndex] = React.useState<number>(-1);
  const closeButtonRef = React.useRef<HTMLButtonElement>(
    undefined as unknown as HTMLButtonElement,
  );
  const lastFocusedRef = React.useRef<HTMLElement | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadGallery(spHttpClient, siteUrl, libraryTitle, maxItems, albumFilter)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setItems(result.items);
        setIsDemo(result.isDemo);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setStatus("ready");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [spHttpClient, siteUrl, libraryTitle, maxItems, albumFilter]);

  const albums: string[] = React.useMemo(() => {
    const unique: { [key: string]: boolean } = {};
    items.forEach((item) => {
      const value = (item.Album || "").trim();
      if (value) {
        unique[value] = true;
      }
    });
    return Object.keys(unique).sort((a, b) => a.localeCompare(b, "fr"));
  }, [items]);

  const visibleItems: IGalleryItem[] = React.useMemo(
    () =>
      album ? items.filter((item) => (item.Album || "") === album) : items,
    [items, album],
  );

  const closeLightbox = React.useCallback((): void => {
    setLightboxIndex(-1);
  }, []);

  const step = React.useCallback(
    (delta: number): void => {
      setLightboxIndex((current) => {
        if (current < 0 || visibleItems.length === 0) {
          return current;
        }
        const next =
          (current + delta + visibleItems.length) % visibleItems.length;
        return next;
      });
    },
    [visibleItems.length],
  );

  // Navigation clavier + verrouillage du défilement pendant l'affichage plein écran.
  React.useEffect(() => {
    if (lightboxIndex < 0) {
      document.body.style.overflow = "";
      return undefined;
    }
    lastFocusedRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        closeLightbox();
      } else if (event.key === "ArrowRight") {
        step(1);
      } else if (event.key === "ArrowLeft") {
        step(-1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    if (closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      if (lastFocusedRef.current && lastFocusedRef.current.focus) {
        lastFocusedRef.current.focus();
      }
    };
  }, [lightboxIndex, closeLightbox, step]);

  const activeItem: IGalleryItem | undefined =
    lightboxIndex >= 0 ? visibleItems[lightboxIndex] : undefined;

  const openItem = (index: number): void => {
    setLightboxIndex(index);
  };

  const renderLightbox = (): React.ReactPortal | null => {
    if (!activeItem) {
      return null;
    }
    const poster = previewUrlOf(activeItem);
    const date = formatDateFr(activeItem.DatePhoto);
    const meta = [activeItem.Album, activeItem.Lieu, activeItem.Credit, date]
      .filter((part) => !!part)
      .join(" · ");

    return ReactDOM.createPortal(
      <div
        className={styles.lightbox}
        role="dialog"
        aria-modal="true"
        aria-label={activeItem.Title || strings.WebPartTitle}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeLightbox();
          }
        }}
      >
        <button
          ref={closeButtonRef}
          type="button"
          className={styles.lightboxClose}
          onClick={closeLightbox}
          aria-label={strings.CloseLabel}
        >
          ✕
        </button>
        {visibleItems.length > 1 && (
          <>
            <button
              type="button"
              className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
              onClick={() => {
                step(-1);
              }}
              aria-label={strings.PreviousLabel}
            >
              ‹
            </button>
            <button
              type="button"
              className={`${styles.lightboxNav} ${styles.lightboxNext}`}
              onClick={() => {
                step(1);
              }}
              aria-label={strings.NextLabel}
            >
              ›
            </button>
          </>
        )}
        <figure className={styles.lightboxFigure}>
          {isDemoItem(activeItem) ? (
            <div
              className={`${styles.lightboxImageCustom} ${demoImageClass(activeItem.DemoIndex as number)}`}
              role="img"
              aria-label={activeItem.Title || ""}
            />
          ) : isVideo(activeItem) && !poster ? (
            activeItem.VideoUrl ? (
              <iframe
                className={styles.lightboxVideo}
                src={activeItem.VideoUrl}
                title={activeItem.Title || strings.VideoBadge}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                className={styles.lightboxVideo}
                src={activeItem.FileRef}
                controls
              >
                {strings.VideoBadge}
              </video>
            )
          ) : (
            <img
              className={styles.lightboxImage}
              src={poster || activeItem.FileRef}
              alt={activeItem.Title || ""}
            />
          )}
          <figcaption className={styles.lightboxCaption}>
            <strong>{activeItem.Title || activeItem.FileLeafRef}</strong>
            {meta && <small>{meta}</small>}
            <div className={styles.lightboxActions}>
              <span className={styles.lightboxCounter}>
                {lightboxIndex + 1} / {visibleItems.length}
              </span>
              {allowDownload && activeItem.FileRef.indexOf("demo:") !== 0 && (
                <a
                  className={styles.lightboxLink}
                  href={activeItem.FileRef}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {strings.OpenLabel} ↗
                </a>
              )}
            </div>
          </figcaption>
        </figure>
      </div>,
      document.body,
    );
  };

  if (status === "loading") {
    return (
      <div className={styles.bbiGallery}>
        <div className={styles.placeholder} role="status">
          {strings.LoadingMessage}
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.bbiGallery}
      style={{ ["--bbi-gallery-cols" as string]: String(columns || 3) }}
    >
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{strings.WebPartTitle}</h2>
          <p className={styles.subtitle}>
            {visibleItems.length} {strings.CounterLabel}
            {visibleItems.length > 1 ? "s" : ""}
          </p>
        </div>
        {albums.length > 0 && !albumFilter && (
          <div className={styles.chips} role="tablist" aria-label="Albums">
            <button
              type="button"
              role="tab"
              aria-selected={album === ""}
              className={
                album === ""
                  ? `${styles.chip} ${styles.chipActive}`
                  : styles.chip
              }
              onClick={() => {
                setAlbum("");
              }}
            >
              {strings.AllAlbums}
            </button>
            {albums.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={album === value}
                className={
                  album === value
                    ? `${styles.chip} ${styles.chipActive}`
                    : styles.chip
                }
                onClick={() => {
                  setAlbum(value);
                }}
              >
                {value}
              </button>
            ))}
          </div>
        )}
      </div>

      {showDataNotices && isDemo && (
        <div className={styles.demoBanner}>💡 {strings.DemoBanner}</div>
      )}

      {visibleItems.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>{strings.EmptyStateTitle}</div>
          <div className={styles.emptyHint}>{strings.EmptyStateHint}</div>
        </div>
      ) : (
        <ul className={styles.grid}>
          {visibleItems.map((item, index) => {
            const thumb = thumbUrlOf(item, 800);
            const demoClass = isDemo
              ? demoImageClass(item.DemoIndex as number)
              : "";
            return (
              <li className={styles.card} key={item.Id}>
                <button
                  type="button"
                  className={styles.cardButton}
                  onClick={() => {
                    openItem(index);
                  }}
                  aria-label={`${strings.OpenLabel} : ${item.Title || item.FileLeafRef || ""}`}
                >
                  <span
                    className={`${styles.thumb} ${thumb ? "" : demoClass}`}
                    style={
                      thumb ? { backgroundImage: `url("${thumb}")` } : undefined
                    }
                    role="img"
                    aria-label={item.Title || ""}
                  >
                    {isVideo(item) && (
                      <span className={styles.videoBadge}>
                        ▶ {strings.VideoBadge}
                      </span>
                    )}
                    {isDemoItem(item) && (
                      <span className={styles.demoBadge}>
                        {strings.DemoBadge}
                      </span>
                    )}
                  </span>
                  {showCaptions && (
                    <span className={styles.caption}>
                      <strong>{item.Title || item.FileLeafRef}</strong>
                      {(item.Album || item.Lieu) && (
                        <small>
                          {[item.Album, item.Lieu]
                            .filter((part) => !!part)
                            .join(" · ")}
                        </small>
                      )}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {renderLightbox()}
    </div>
  );
};

export default BbiGallery;
