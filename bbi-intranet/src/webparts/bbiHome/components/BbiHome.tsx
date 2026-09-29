import * as React from "react";
import styles from "./BbiHome.module.scss";
import { IBbiHomeProps } from "./IBbiHomeProps";
import {
  IHomeNews,
  IHomeSession,
  IHomeTrainer,
  IHomeListResult,
  loadHomeNews,
  loadHomeSessions,
  loadHomeTrainers,
} from "./homeData";
import {
  IQuickLink,
  INavLink,
  IKpi,
  parseKpis,
  parseNavLinks,
  parseQuickLinks,
  useChromeOffset,
  useScrolled,
} from "./homeLayout";
import HomeHero from "./HomeHero";
import TrainingCatalog from "../../trainingCatalog/components/TrainingCatalog";
import { ITrainingCatalogProps } from "../../trainingCatalog/components/ITrainingCatalogProps";
import trainingStrings from "TrainingCatalogWebPartStrings";
import SecureDocuments from "../../secureDocuments/components/SecureDocuments";
import { ISecureDocumentsProps } from "../../secureDocuments/components/ISecureDocumentsProps";
import documentStrings from "SecureDocumentsWebPartStrings";
import BbiGallery from "../../bbiGallery/components/BbiGallery";
import { IBbiGalleryProps } from "../../bbiGallery/components/IBbiGalleryProps";
import galleryStrings from "BbiGalleryWebPartStrings";

type HomeStatus = "loading" | "ready";
type PortalView = "accueil" | "formations" | "sessions" | "actualites" | "ressources" | "communaute" | "recherche";

const VIEW_FROM_HASH: { [key: string]: PortalView } = {
  accueil: "accueil", home: "accueil", acces: "accueil",
  formations: "formations", catalogue: "formations",
  sessions: "sessions",
  actualites: "actualites", news: "actualites", "vie-bbi": "actualites",
  ressources: "ressources", documents: "ressources", galerie: "ressources",
  communaute: "communaute", formateurs: "communaute", support: "communaute", "espace-formateurs": "communaute",
  recherche: "recherche",
};

const viewFromHref = (href: string): PortalView | undefined => {
  if (!href) { return undefined; }
  if (href.charAt(0) === "#") {
    return VIEW_FROM_HASH[href.slice(1).split(/[?&]/)[0].toLowerCase()];
  }
  // Anciennes propriétés SharePoint (déjà enregistrées sur des instances en place)
  // continuent d'ouvrir la vue correspondante au lieu de quitter le portail.
  const legacyUrl = href.toLowerCase();
  if (legacyUrl.indexOf("catalogue.aspx") !== -1) { return "formations"; }
  if (legacyUrl.indexOf("sessions.aspx") !== -1) { return "sessions"; }
  if (legacyUrl.indexOf("vie-bbi.aspx") !== -1 || legacyUrl.indexOf("article.aspx") !== -1) { return "actualites"; }
  if (legacyUrl.indexOf("galerie.aspx") !== -1 || legacyUrl.indexOf("supports publiés") !== -1) { return "ressources"; }
  if (legacyUrl.indexOf("espace-formateurs") !== -1 || legacyUrl.indexOf("formation.aspx") !== -1) { return "communaute"; }
  return undefined;
};

const viewFromLocation = (): PortalView =>
  VIEW_FROM_HASH[window.location.hash.replace(/^#/, "").toLowerCase()] || "accueil";

const emptyResult = <T,>(): IHomeListResult<T> => ({
  items: [],
  isDemo: false,
});

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
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatDay = (value?: string): { day: string; month: string } => {
  if (!value) {
    return { day: "—", month: "" };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { day: "—", month: "" };
  }
  return {
    day: new Intl.DateTimeFormat("fr-FR", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("fr-FR", { month: "short" })
      .format(date)
      .replace(".", ""),
  };
};

const initialsOf = (trainer: IHomeTrainer): string => {
  if (trainer.Initials) {
    return trainer.Initials;
  }
  return trainer.Title.split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
};

const iconForModality = (modality?: string): string => {
  const value = (modality || "").toLowerCase();
  if (value.indexOf("distanciel") !== -1 || value.indexOf("web") !== -1) {
    return "◉";
  }
  if (value.indexOf("hybride") !== -1) {
    return "◐";
  }
  return "⌂";
};

const DEFAULT_NAV: INavLink[] = [
  { label: "Accueil", url: "#accueil" },
  { label: "Formations", url: "#formations" },
  { label: "Sessions", url: "#sessions" },
  { label: "Actualités", url: "#actualites" },
  { label: "Ressources", url: "#ressources" },
  { label: "Communauté", url: "#communaute" },
];

const SEARCH_SUGGESTIONS: string[] = [
  "Qualiopi",
  "Coaching",
  "Management",
  "Prospection",
  "Négociation",
  "Certification",
];

/** « Bonjour Prénom » à partir du nom affiché SharePoint (ou de l'adresse). */
const greetingOf = (name?: string): string => {
  const clean = (name || "").split("@")[0].trim();
  const first = clean.split(/\s+/).filter(Boolean)[0] || "";
  if (!first) {
    return "";
  }
  const formatted = first.charAt(0).toLocaleUpperCase("fr") + first.slice(1);
  return `Bonjour ${formatted}`;
};

const DEFAULT_QUICK_LINKS: IQuickLink[] = [
  {
    icon: "▦",
    title: "Catalogue des formations",
    subtitle: "Parcours, modalités et durées",
    url: "#formations",
  },
  {
    icon: "▣",
    title: "Prochaines sessions",
    subtitle: "Planning et inscriptions",
    url: "#sessions",
  },
  {
    icon: "▤",
    title: "Supports & médias",
    subtitle: "Documents, photos et vidéos",
    url: "#ressources",
  },
  {
    icon: "◎",
    title: "Communauté BBI",
    subtitle: "Formateurs et experts",
    url: "#communaute",
  },
  {
    icon: "✦",
    title: "Actualités BBI",
    subtitle: "Les nouvelles du réseau",
    url: "#actualites",
  },
];

const BbiHome: React.FC<IBbiHomeProps> = (props) => {
  console.info("[BBI-HOME] component entered");
  const [status, setStatus] = React.useState<HomeStatus>("loading");
  const [news, setNews] =
    React.useState<IHomeListResult<IHomeNews>>(emptyResult<IHomeNews>());
  const [sessions, setSessions] =
    React.useState<IHomeListResult<IHomeSession>>(emptyResult<IHomeSession>());
  const [trainers, setTrainers] =
    React.useState<IHomeListResult<IHomeTrainer>>(emptyResult<IHomeTrainer>());
  const [search, setSearch] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [activeView, setActiveView] = React.useState<PortalView>(viewFromLocation);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Dans la vue recherche sans requête, on recentre l'utilisateur sur la
  // saisie plutôt que de l'inviter devant « Résultats pour « » ».
  React.useEffect(() => {
    if (activeView === "recherche" && !searchQuery && searchInputRef.current) {
      searchInputRef.current.focus({ preventScroll: true });
    }
  }, [activeView, searchQuery]);

  const scrolled = useScrolled(40);
  useChromeOffset(rootRef);
  console.info("[BBI-HOME] initial hooks completed", status);

  React.useEffect(() => {
    const syncViewFromUrl = (): void => setActiveView(viewFromLocation());
    window.addEventListener("hashchange", syncViewFromUrl);
    window.addEventListener("popstate", syncViewFromUrl);
    return () => {
      window.removeEventListener("hashchange", syncViewFromUrl);
      window.removeEventListener("popstate", syncViewFromUrl);
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    Promise.all([
      loadHomeNews(
        props.spHttpClient,
        props.siteUrl,
        props.newsListTitle,
        Math.max(props.maxItems, 12),
      ),
      loadHomeSessions(
        props.spHttpClient,
        props.siteUrl,
        props.sessionsListTitle,
        Math.max(props.maxItems, 12),
      ),
      loadHomeTrainers(
        props.spHttpClient,
        props.siteUrl,
        props.trainersListTitle,
        Math.max(props.maxItems, 12),
      ),
    ])
      .then(([loadedNews, loadedSessions, loadedTrainers]) => {
        if (cancelled) {
          return;
        }
        setNews(loadedNews);
        setSessions(loadedSessions);
        setTrainers(loadedTrainers);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setNews(emptyResult<IHomeNews>());
          setSessions(emptyResult<IHomeSession>());
          setTrainers(emptyResult<IHomeTrainer>());
          setStatus("ready");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    props.spHttpClient,
    props.siteUrl,
    props.newsListTitle,
    props.sessionsListTitle,
    props.trainersListTitle,
    props.maxItems,
  ]);

  const navLinks = React.useMemo(
    () => parseNavLinks(props.navLinks, DEFAULT_NAV),
    [props.navLinks],
  );
  const quickLinks = React.useMemo(
    () => parseQuickLinks(props.quickLinks, DEFAULT_QUICK_LINKS),
    [props.quickLinks],
  );
  const kpis: IKpi[] = React.useMemo(() => parseKpis(props.kpis), [props.kpis]);

  const openView = (view: PortalView): void => {
    const hash = view === "accueil" ? "accueil" : view;
    if (window.location.hash !== `#${hash}`) {
      window.history.pushState(null, "", `#${hash}`);
    }
    setActiveView(view);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const followPortalLink = (event: React.MouseEvent<HTMLAnchorElement>, href: string): void => {
    const view = viewFromHref(href);
    if (view) {
      event.preventDefault();
      openView(view);
    }
  };

  const searchSite = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const query = search.trim();
    if (query) {
      setSearchQuery(query);
      openView("recherche");
    }
  };

  const currentNews = news.items[0];
  const upcomingSessions = sessions.items
    .filter(
      (session) =>
        !session.StartDate ||
        new Date(session.StartDate).getTime() >= Date.now(),
    )
    .slice(0, activeView === "sessions" ? 30 : props.maxItems);

  const needle = searchQuery.toLocaleLowerCase("fr");
  const searchResults = [
    ...news.items.map((item) => ({ title: item.Title, description: item.Summary || item.Category || "Actualité BBI", category: "Actualité", view: "actualites" as PortalView })),
    ...sessions.items.map((item) => ({ title: item.Title, description: [item.Modality, item.Location].filter(Boolean).join(" · ") || "Prochaine session", category: "Session", view: "sessions" as PortalView })),
    ...trainers.items.map((item) => ({ title: item.Title, description: [item.Role, item.Filiere].filter(Boolean).join(" · ") || "Communauté BBI", category: "Communauté", view: "communaute" as PortalView })),
  ].filter((item) => `${item.title} ${item.description}`.toLocaleLowerCase("fr").includes(needle));

  const catalogProps: ITrainingCatalogProps = {
    siteUrl: props.siteUrl,
    listTitle: props.formationsListTitle,
    maxItems: 300,
    initialQuery: searchQuery,
    spHttpClient: props.spHttpClient,
    showDataNotices: props.showDataNotices,
    isDarkTheme: false,
    hasTeamsContext: false,
    embedded: true,
    strings: trainingStrings,
  };
  const documentsProps: ISecureDocumentsProps = {
    siteUrl: props.siteUrl,
    libraryTitle: props.documentsLibraryTitle,
    maxItems: 30,
    spHttpClient: props.spHttpClient,
    showDataNotices: props.showDataNotices,
    isDarkTheme: false,
    hasTeamsContext: false,
    embedded: true,
    strings: documentStrings,
  };
  const galleryProps: IBbiGalleryProps = {
    siteUrl: props.siteUrl,
    libraryTitle: props.galleryLibraryTitle,
    maxItems: 36,
    columns: 4,
    showCaptions: true,
    allowDownload: true,
    showDataNotices: props.showDataNotices,
    albumFilter: "",
    spHttpClient: props.spHttpClient,
    isDarkTheme: false,
    hasTeamsContext: false,
    embedded: true,
    strings: galleryStrings,
  };
  const avatarStyles: string[] = [
    styles.avatar0,
    styles.avatar1,
    styles.avatar2,
    styles.avatar3,
  ];

  const announcement =
    (props.announcementText || "").trim() ||
    (currentNews
      ? `${currentNews.Category || "À la une"} — ${currentNews.Title}`
      : "");
  const showAnnouncement = props.enableAnnouncement !== false && !!announcement;

  if (status === "loading") {
    return (
      <div className={styles.loading} role="status">
        <span className={styles.loadingSpinner} aria-hidden="true" />
        {(props.strings && props.strings.LoadingMessage) ||
          "Chargement de votre espace…"}
      </div>
    );
  }

  return (
    <div className={styles.home} ref={rootRef} id="bbi-home-root" data-view={activeView}>
      {showAnnouncement && (
        <div
          className={styles.announcement}
          role="region"
          aria-label="Information à la une"
        >
          <span className={styles.announcementDot} aria-hidden="true" />
          <span className={styles.announcementText}>{announcement}</span>
          {currentNews && currentNews.LinkUrl && (
            <a className={styles.announcementLink} href="#actualites" onClick={(event) => { followPortalLink(event, "#actualites"); }}>
              Lire <span aria-hidden="true">→</span>
            </a>
          )}
        </div>
      )}

      <header
        className={
          scrolled || activeView !== "accueil"
            ? `${styles.topbar} ${styles.topbarSolid}`
            : styles.topbar
        }
      >
        <div className={styles.topbarInner}>
          <a
            className={styles.brand}
            href="#accueil"
            aria-label="BBI Intranet, accueil"
            onClick={(event) => { followPortalLink(event, "#accueil"); }}
          >
            <span className={styles.logoImage} role="img" aria-label="BBI" />
            <span className={styles.brandText}>
              <strong>BBI Intranet</strong>
              <small>Propulseur de croissance · Créateur d&apos;impacts</small>
            </span>
          </a>

          <button
            type="button"
            className={styles.menuButton}
            aria-expanded={menuOpen}
            aria-controls="bbi-home-nav"
            aria-label="Afficher la navigation"
            onClick={() => {
              setMenuOpen(!menuOpen);
            }}
          >
            <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span>
          </button>

          <nav
            id="bbi-home-nav"
            className={
              menuOpen
                ? `${styles.navigation} ${styles.navigationOpen}`
                : styles.navigation
            }
            aria-label="Navigation principale"
          >
            {navLinks.map((link) => {
              const linkedView = viewFromHref(link.url);
              const isActive = linkedView === activeView;
              const className = [
                styles.navLink,
                isActive ? styles.navActive : "",
                link.emphasis ? styles.navCta : "",
              ]
                .filter((part) => !!part)
                .join(" ");
              return (
                <a
                  key={`${link.label}-${link.url}`}
                  href={link.url}
                  className={className}
                  aria-current={isActive ? "true" : undefined}
                  onClick={(event) => {
                    followPortalLink(event, link.url);
                    setMenuOpen(false);
                  }}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          <form
            className={styles.searchForm}
            onSubmit={searchSite}
            role="search"
          >
            <label className={styles.visuallyHidden} htmlFor="bbi-home-search">
              Rechercher dans BBI Intranet
            </label>
            <input
              id="bbi-home-search"
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              placeholder="Rechercher dans BBI"
            />
            <button type="submit" aria-label="Rechercher">
              ⌕
            </button>
          </form>
        </div>
      </header>

      <main className={styles.content}>
        <section
          className={styles.section}
          id="recherche"
          data-bbi-view="recherche"
          aria-labelledby="search-results-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>
                {searchQuery ? "Recherche dans le portail" : "Portail BBI"}
              </p>
              <h2 id="search-results-title">
                {searchQuery
                  ? `Résultats pour « ${searchQuery} »`
                  : "Recherche dans le portail"}
              </h2>
            </div>
          </div>
          {searchQuery ? (
            searchResults.length > 0 ? (
              <ul className={styles.searchResultsList}>
                {searchResults.map((result, index) => (
                  <li key={`${result.category}-${result.title}-${index}`}>
                    <a href={`#${result.view}`} onClick={(event) => { event.preventDefault(); openView(result.view); }}>
                      <span className={styles.searchResultType}>{result.category}</span>
                      <strong>{result.title}</strong>
                      <small>{result.description}</small>
                      <span aria-hidden="true">→</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyState}>
                Aucun résultat pour « {searchQuery} » dans les actualités, les
                sessions ou la communauté. Essayez « management », « coaching »
                ou « Qualiopi », ou parcourez le catalogue ci-dessous.
              </p>
            )
          ) : (
            <div>
              <p className={styles.searchIntro}>
                Recherchez une formation, une session, une actualité ou un
                formateur dans le portail BBI. Utilisez la barre de recherche
                ci-dessus, ou partez de l’un des thèmes fréquents.
              </p>
              <p className={styles.searchSuggestionsLabel}>Recherches fréquentes</p>
              <div className={styles.searchSuggestions} aria-label="Recherches fréquentes">
                {SEARCH_SUGGESTIONS.map((term) => (
                  <button
                    key={term}
                    type="button"
                    className={styles.searchSuggestionChip}
                    onClick={() => {
                      setSearch(term);
                      setSearchQuery(term);
                    }}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button type="button" className={styles.searchCatalogButton} onClick={() => { openView("formations"); }}>
            Parcourir le catalogue des formations <span aria-hidden="true">→</span>
          </button>
        </section>

        <HomeHero
          eyebrow={props.heroEyebrow || "Business Builders International"}
          title={
            props.heroTitle ||
            "L'expertise qui fait grandir les dirigeants."
          }
          subtitle={
            props.heroSubtitle ||
            "Formations, accompagnement et intelligence collective pour transformer vos ambitions en résultats durables."
          }
          imageUrl={props.heroImageUrl || ""}
          primaryLabel={props.primaryCtaLabel || "Explorer les formations"}
          primaryUrl={props.primaryCtaUrl || "#formations"}
          secondaryLabel={props.secondaryCtaLabel || "Voir les prochaines sessions"}
          secondaryUrl={props.secondaryCtaUrl || "#sessions"}
          kpis={kpis}
          compact={props.layoutCompact === true}
          greeting={greetingOf(props.userName)}
          onExplore={() => {
            const target = document.getElementById("acces");
            if (target) {
              target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          onInternalNavigate={followPortalLink}
        />

        <section
          className={styles.section}
          id="acces"
          data-bbi-view="acces"
          aria-labelledby="bbi-quick-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Accès directs</p>
              <h2 id="bbi-quick-title">Vos espaces</h2>
            </div>
          </div>
          <div className={styles.quickGrid}>
            {quickLinks.map((link) => (
              <a
                className={styles.quickLink}
                href={link.url}
                key={`${link.title}-${link.url}`}
                onClick={(event) => { followPortalLink(event, link.url); }}
              >
                <span className={styles.quickIcon} aria-hidden="true">
                  {link.icon}
                </span>
                <strong>{link.title}</strong>
                <small>{link.subtitle}</small>
              </a>
            ))}
          </div>
        </section>

        <section className={styles.learningPath} aria-labelledby="bbi-path-title">
          <div className={styles.learningPathIntro}>
            <p className={styles.eyebrow}>La méthode BBI</p>
            <h2 id="bbi-path-title">De l’apprentissage à l’impact.</h2>
            <p>Une expérience qui relie les bons savoirs, la pratique sur le terrain et le partage entre pairs.</p>
          </div>
          <div className={styles.pathGrid}>
            <article className={styles.pathCard}>
              <span>01</span>
              <h3>Choisir son parcours</h3>
              <p>Repérez les compétences utiles à vos enjeux et trouvez la formation adaptée.</p>
              <a href="#formations" onClick={(event) => { followPortalLink(event, "#formations"); }}>Explorer le catalogue →</a>
            </article>
            <article className={styles.pathCard}>
              <span>02</span>
              <h3>Apprendre en pratiquant</h3>
              <p>Progressez avec des ateliers concrets, des formateurs experts et des mises en situation.</p>
              <a href="#sessions" onClick={(event) => { followPortalLink(event, "#sessions"); }}>Voir les sessions →</a>
            </article>
            <article className={styles.pathCard}>
              <span>03</span>
              <h3>Ancrer et transmettre</h3>
              <p>Retrouvez vos supports, échangez avec la communauté et faites vivre vos acquis.</p>
              <a href="#ressources" onClick={(event) => { followPortalLink(event, "#ressources"); }}>Accéder aux ressources →</a>
            </article>
          </div>
        </section>

        <section
          className={styles.newsSessions}
          id="actualites"
          data-bbi-view="actualites"
          aria-label="Actualités et prochaines sessions"
        >
          <div className={styles.newsColumn}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>À la une</p>
                <h2>Actualités BBI</h2>
              </div>
              <a
                className={styles.textLink}
                href="#actualites"
                onClick={(event) => { followPortalLink(event, "#actualites"); }}
              >
                Toutes les actualités <span aria-hidden="true">→</span>
              </a>
            </div>
            {props.showDataNotices && news.isDemo && (
              <p className={styles.demoNote}>
                Données de démonstration : la liste « {props.newsListTitle} »
                est absente, non créée ou vide.
              </p>
            )}
            {currentNews ? (
              <article className={styles.featuredNews}>
                <div
                  className={
                    currentNews.ImageUrl
                      ? styles.newsImage
                      : `${styles.newsImage} ${styles.newsImageFallback}`
                  }
                  style={
                    currentNews.ImageUrl
                      ? {
                          backgroundImage: `url("${new URL(currentNews.ImageUrl, props.siteUrl).toString()}")`,
                        }
                      : undefined
                  }
                  role="img"
                  aria-label={currentNews.Title}
                />
                <div className={styles.newsBody}>
                  <span className={styles.category}>
                    {currentNews.Category || "Vie BBI"}
                  </span>
                  <h3>{currentNews.Title}</h3>
                  <p>
                    {currentNews.Summary ||
                      "Retrouvez les dernières nouvelles de votre réseau BBI."}
                  </p>
                  <small>
                    {formatDate(currentNews.Published)}
                    {currentNews.AuthorName
                      ? ` · ${currentNews.AuthorName}`
                      : ""}
                  </small>
                  {currentNews.LinkUrl && (
                    <a href={currentNews.LinkUrl} className={styles.textLink}>
                      Lire l&apos;actualité <span aria-hidden="true">→</span>
                    </a>
                  )}
                </div>
              </article>
            ) : (
              <p className={styles.emptyState}>Aucune actualité publiée.</p>
            )}
            {news.items.length > 1 && (
              <div className={styles.newsArchive} aria-label="Autres actualités">
                {news.items.slice(1).map((item) => (
                  <article className={styles.newsArchiveItem} key={item.Id}>
                    <span className={styles.category}>{item.Category || "Vie BBI"}</span>
                    <h3>{item.Title}</h3>
                    <p>{item.Summary || "Une nouvelle de la communauté BBI."}</p>
                    <small>{formatDate(item.Published)}{item.AuthorName ? ` · ${item.AuthorName}` : ""}</small>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className={styles.sessionsColumn} id="sessions">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>À venir</p>
                <h2>Prochaines sessions</h2>
              </div>
              <a
                className={styles.textLink}
                href="#sessions"
                onClick={(event) => { followPortalLink(event, "#sessions"); }}
              >
                Tout voir <span aria-hidden="true">→</span>
              </a>
            </div>
            {props.showDataNotices && sessions.isDemo && (
              <p className={styles.demoNote}>
                Données de démonstration : la liste « {props.sessionsListTitle}{" "}
                » est absente, non créée ou vide.
              </p>
            )}
            {upcomingSessions.length > 0 ? (
              <ul className={styles.sessionList}>
                {upcomingSessions.map((session) => {
                  const date = formatDay(session.StartDate);
                  return (
                    <li className={styles.session} key={session.Id}>
                      <div className={styles.sessionDate}>
                        <strong>{date.day}</strong>
                        <span>{date.month}</span>
                      </div>
                      <div className={styles.sessionInfo}>
                        <h3>{session.Title}</h3>
                        <p>
                          <span aria-hidden="true">
                            {iconForModality(session.Modality)}
                          </span>{" "}
                          {session.Modality || "Modalité à préciser"}
                          {session.Location ? ` · ${session.Location}` : ""}
                        </p>
                      </div>
                      {session.RegistrationUrl ? (
                        <a
                          className={styles.sessionStatus}
                          href={session.RegistrationUrl}
                        >
                          {session.Status || "S’inscrire"}
                        </a>
                      ) : (
                        <span className={styles.sessionStatus}>
                          {session.Status || "À venir"}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.emptyState}>Aucune session à venir.</p>
            )}
          </div>
        </section>

        <section
          className={styles.section}
          id="formations"
          data-bbi-view="formations"
          aria-label="Catalogue des formations"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Se former</p>
              <h2>Catalogue des formations</h2>
            </div>
            <a
              className={styles.textLink}
              href="#formations"
              onClick={(event) => { followPortalLink(event, "#formations"); }}
            >
              Voir tout le catalogue <span aria-hidden="true">→</span>
            </a>
          </div>
          <TrainingCatalog {...catalogProps} />
        </section>

        <section
          className={styles.resourcesPeople}
          id="ressources"
          data-bbi-view="ressources"
          aria-label="Supports publiés et formateurs référents"
        >
          <div className={styles.resources}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Ressources</p>
                <h2>Derniers supports publiés</h2>
              </div>
              <a
                className={styles.textLink}
                href="#ressources"
                onClick={(event) => { followPortalLink(event, "#ressources"); }}
              >
                Bibliothèque <span aria-hidden="true">→</span>
              </a>
            </div>
            <SecureDocuments {...documentsProps} />
            <div className={styles.embeddedGallery} id="galerie">
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.eyebrow}>À voir</p>
                  <h2>Galerie de la communauté</h2>
                </div>
              </div>
              <BbiGallery {...galleryProps} />
            </div>
          </div>
          <div className={styles.people} id="formateurs">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Votre réseau</p>
                <h2>Formateurs référents</h2>
              </div>
              <a
                className={styles.textLink}
                href="#communaute"
                onClick={(event) => { followPortalLink(event, "#communaute"); }}
              >
                Annuaire <span aria-hidden="true">→</span>
              </a>
            </div>
            {props.showDataNotices && trainers.isDemo && (
              <p className={styles.demoNote}>
                Données de démonstration : la liste « {props.trainersListTitle}{" "}
                » est absente, non créée ou vide.
              </p>
            )}
            {trainers.items.length > 0 ? (
              <ul className={styles.peopleList}>
                {trainers.items
                  .slice(0, props.maxItems)
                  .map((trainer, index) => (
                    <li className={styles.person} key={trainer.Id}>
                      <span
                        className={`${styles.avatar} ${avatarStyles[index % 4]}`}
                      >
                        {initialsOf(trainer)}
                      </span>
                      <span>
                        <strong>{trainer.Title}</strong>
                        <small>
                          {trainer.Role || "Formateur"}
                          {trainer.Filiere ? ` · ${trainer.Filiere}` : ""}
                        </small>
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className={styles.emptyState}>
                Aucun formateur référent publié.
              </p>
            )}
            <div className={styles.community} id="support">
              <p className={styles.eyebrow}>Communauté</p>
              <h3>Réseau des formateurs</h3>
              <p>
                Échanges de pratiques, entraide pédagogique et veille :
                rejoignez la communauté BBI sur Teams et Viva Engage.
              </p>
              <a className={styles.textLink} href="#communaute" onClick={(event) => { followPortalLink(event, "#communaute"); }}>
                Découvrir la communauté <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </section>

        <section
          className={styles.topicLinks}
          id="vie-bbi"
          aria-label="Vie d'entreprise et ressources pédagogiques"
        >
          <a href="#ressources" className={styles.topicLink} onClick={(event) => { followPortalLink(event, "#ressources"); }}>
            <span aria-hidden="true">⌘</span>
            <strong>Méthodes &amp; outils d&apos;animation</strong>
            <small>Kits, modèles et trames de séquence</small>
          </a>
          <a href="#ressources" className={styles.topicLink} onClick={(event) => { followPortalLink(event, "#ressources"); }}>
            <span aria-hidden="true">✳</span>
            <strong>Qualité &amp; certification</strong>
            <small>Qualiopi, évaluations, preuves de conformité</small>
          </a>
          <a href="#actualites" className={styles.topicLink} onClick={(event) => { followPortalLink(event, "#actualites"); }}>
            <span aria-hidden="true">◈</span>
            <strong>Vie d&apos;entreprise</strong>
            <small>Événements, séminaires et temps forts</small>
          </a>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerBrand}>
            <span className={styles.footerLogo} role="img" aria-label="BBI" />
            <span>
              {props.footerNote ||
                "Business Builders International — Intranet collaboratif"}
            </span>
          </span>
          <nav className={styles.footerNav} aria-label="Navigation du portail">
            <a href="#accueil" onClick={(event) => { followPortalLink(event, "#accueil"); }}>Accueil</a>
            <a href="#formations" onClick={(event) => { followPortalLink(event, "#formations"); }}>Formations</a>
            <a href="#ressources" onClick={(event) => { followPortalLink(event, "#ressources"); }}>Ressources</a>
            <a href="#communaute" onClick={(event) => { followPortalLink(event, "#communaute"); }}>Communauté</a>
          </nav>
          <small className={styles.footerCopy}>
            © {new Date().getFullYear()} Business Builders International · Tous
            droits réservés
          </small>
        </div>
      </footer>

      <button
        type="button"
        className={
          scrolled
            ? `${styles.backToTop} ${styles.backToTopVisible}`
            : styles.backToTop
        }
        onClick={() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        aria-label="Revenir en haut de la page"
      >
        ↑
      </button>
    </div>
  );
};

export default BbiHome;
