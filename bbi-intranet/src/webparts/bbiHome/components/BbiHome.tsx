import * as React from "react";
import styles from "./BbiHome.module.scss";
import { IBbiHomeProps } from "./IBbiHomeProps";
import {
  IHomeCertification,
  IHomeEmployee,

  IHomeSession,
  IHomeTrainer,
  IHomeListResult,
  loadEmployeeOfMonth,
  loadHomeCertifications,
  loadHomeSessions,
  loadHomeTrainers,
} from "./homeData";
import { IHomeNewsBundle, IHomeNewsPage, NEWS_PAGE_SIZE, loadNewsItem, loadNewsPage } from "./newsArchive";
import {
  PortalView,
  anchorIdFromHash,
  newsIdFromHash,
  viewFromHash,
  viewFromHref,
} from "./portalRoutes";
import { IOrgChartResult, loadOrgChart } from "./orgData";
import {
  IHeroSlide,
  IQuickLink,
  INavLink,
  IKpi,
  parseHeroSlides,
  parseKpis,
  parseNavLinks,
  parsePortalRoute,
  parseQuickLinks,
  useChromeOffset,
  useScrolled,
} from "./homeLayout";
import HomeHero from "./HomeHero";
import NewsBoard from "./NewsBoard";
import NewsDetail from "./NewsDetail";
import TrainerDirectory from "./TrainerDirectory";
import OrgChart from "./OrgChart";
import TeamHighlights from "./TeamHighlights";
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

const emptyResult = <T,>(): IHomeListResult<T> => ({
  items: [],
  isDemo: false,
});

const emptyNewsPage = (): IHomeNewsPage => ({
  items: [],
  page: 0,
  hasMore: false,
  isDemo: false,
});

const emptyOrgChart: IOrgChartResult = { nodes: [], isDemo: false };

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
  { label: "Organigramme", url: "#organigramme" },
];

/** Diapositives de repli : images et textes se succèdent automatiquement. */
const defaultHeroSlides = (props: IBbiHomeProps): IHeroSlide[] => [
  {
    imageUrl: props.heroImageUrl || "",
    eyebrow: props.heroEyebrow || "Business Builders International",
    title: props.heroTitle || "L'expertise qui fait grandir les dirigeants.",
    subtitle:
      props.heroSubtitle ||
      "Formations, accompagnement et intelligence collective pour transformer vos ambitions en résultats durables.",
    ctaLabel: props.primaryCtaLabel || "Explorer les formations",
    ctaUrl: props.primaryCtaUrl || "#formations",
  },
  {
    imageUrl: "",
    eyebrow: "Notre méthode",
    title: "Des parcours conçus pour le terrain.",
    subtitle:
      "Des mises en situation concrètes, des formateurs certifiés et un ancrage à 30 jours pour transformer les acquis en résultats.",
    ctaLabel: "Voir les prochaines sessions",
    ctaUrl: "#sessions",
  },
  {
    imageUrl: "",
    eyebrow: "Réseau international",
    title: "9 pays, une même exigence de qualité.",
    subtitle:
      "Un référentiel pédagogique unique, des antennes locales et une communauté de formateurs qui partagent les bonnes pratiques.",
    ctaLabel: "Découvrir l'organisation",
    ctaUrl: "#organigramme",
  },
  {
    imageUrl: "",
    eyebrow: "Qualité certifiée",
    title: "Qualiopi, un gage de confiance.",
    subtitle:
      "Des process audités, des preuves suivies et une amélioration continue au service de vos financeurs et de vos équipes.",
    ctaLabel: "Voir les certifications",
    ctaUrl: "#vie-equipe",
  },
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
    icon: "◈",
    title: "Organigramme",
    subtitle: "Équipes, pôles et contacts",
    url: "#organigramme",
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
  const [status, setStatus] = React.useState<HomeStatus>("loading");
  const [newsPage, setNewsPage] = React.useState<IHomeNewsPage>(emptyNewsPage());
  const [newsLoading, setNewsLoading] = React.useState<boolean>(true);
  const [pageIndex, setPageIndex] = React.useState<number>(0);
  const [newsBundle, setNewsBundle] = React.useState<IHomeNewsBundle>({
    others: [],
    isDemo: false,
  });
  const [newsBundleLoading, setNewsBundleLoading] = React.useState<boolean>(false);
  const [sessions, setSessions] =
    React.useState<IHomeListResult<IHomeSession>>(emptyResult<IHomeSession>());
  const [trainers, setTrainers] =
    React.useState<IHomeListResult<IHomeTrainer>>(emptyResult<IHomeTrainer>());
  const [employee, setEmployee] =
    React.useState<IHomeListResult<IHomeEmployee>>(emptyResult<IHomeEmployee>());
  const [certifications, setCertifications] =
    React.useState<IHomeListResult<IHomeCertification>>(emptyResult<IHomeCertification>());
  const [orgChart, setOrgChart] = React.useState<IOrgChartResult>(emptyOrgChart);
  const [orgLoading, setOrgLoading] = React.useState<boolean>(false);
  const [search, setSearch] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [activeView, setActiveView] = React.useState<PortalView>(() => viewFromHash(window.location.hash));
  const [newsId, setNewsId] = React.useState<number>(() => newsIdFromHash(window.location.hash));
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

  /** Défilement doux vers une section du portail, sous la barre collante. */
  const scrollToSection = (id: string): void => {
    const target = document.getElementById(id);
    if (!target) {
      return;
    }
    const node = rootRef.current;
    const rawOffset = node
      ? parseFloat(window.getComputedStyle(node).getPropertyValue("--bbi-chrome-offset"))
      : 0;
    const chrome = Number.isNaN(rawOffset) ? 0 : rawOffset;
    const top = target.getBoundingClientRect().top + window.pageYOffset - (chrome + 72);
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  React.useEffect(() => {
    const syncViewFromUrl = (): void => {
      const hash = window.location.hash;
      setActiveView(viewFromHash(hash));
      setNewsId(newsIdFromHash(hash));
      const anchor = anchorIdFromHash(hash);
      if (anchor) {
        window.setTimeout(() => { scrollToSection(anchor); }, 60);
      }
    };
    window.addEventListener("hashchange", syncViewFromUrl);
    window.addEventListener("popstate", syncViewFromUrl);
    return () => {
      window.removeEventListener("hashchange", syncViewFromUrl);
      window.removeEventListener("popstate", syncViewFromUrl);
    };
  }, []);

  // Sessions, formateurs, employé du mois et certifications : une seule fois.
  React.useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    Promise.all([
      loadHomeSessions(
        props.spHttpClient,
        props.siteUrl,
        props.sessionsListTitle,
        Math.max(props.maxItems, 30),
      ),
      loadHomeTrainers(
        props.spHttpClient,
        props.siteUrl,
        props.trainersListTitle,
        24,
      ),
      loadEmployeeOfMonth(props.spHttpClient, props.siteUrl, props.employeeListTitle),
      loadHomeCertifications(
        props.spHttpClient,
        props.siteUrl,
        props.certificationsListTitle,
        6,
      ),
    ])
      .then(([loadedSessions, loadedTrainers, loadedEmployee, loadedCertifications]) => {
        if (cancelled) {
          return;
        }
        setSessions(loadedSessions);
        setTrainers(loadedTrainers);
        setEmployee(loadedEmployee);
        setCertifications(loadedCertifications);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setSessions(emptyResult<IHomeSession>());
          setTrainers(emptyResult<IHomeTrainer>());
          setEmployee(emptyResult<IHomeEmployee>());
          setCertifications(emptyResult<IHomeCertification>());
          setStatus("ready");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    props.spHttpClient,
    props.siteUrl,
    props.sessionsListTitle,
    props.trainersListTitle,
    props.employeeListTitle,
    props.certificationsListTitle,
    props.maxItems,
  ]);

  // Pagination des actualités : la vue dédiée affiche plus d'éléments par page.
  const newsPageSize = activeView === "actualites" ? NEWS_PAGE_SIZE + 3 : NEWS_PAGE_SIZE - 1;

  React.useEffect(() => {
    let cancelled = false;
    setNewsLoading(true);
    loadNewsPage(
      props.spHttpClient,
      props.siteUrl,
      props.newsListTitle,
      pageIndex,
      newsPageSize,
    )
      .then((page) => {
        if (!cancelled) {
          setNewsPage(page);
          setNewsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNewsPage(emptyNewsPage());
          setNewsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [props.spHttpClient, props.siteUrl, props.newsListTitle, pageIndex, newsPageSize]);

  // Actualité détaillée (#actualite?id=12) : chargée à la demande.
  React.useEffect(() => {
    if (activeView !== "actualite") {
      return undefined;
    }
    let cancelled = false;
    setNewsBundleLoading(true);
    loadNewsItem(
      props.spHttpClient,
      props.siteUrl,
      props.newsListTitle,
      newsId,
      4,
    )
      .then((bundle) => {
        if (!cancelled) {
          setNewsBundle(bundle);
          setNewsBundleLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNewsBundle({ others: [], isDemo: false });
          setNewsBundleLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeView, newsId, props.spHttpClient, props.siteUrl, props.newsListTitle]);

  // Organigramme : chargé uniquement à l'ouverture de sa vue.
  const orgLoaded = React.useRef<boolean>(false);
  React.useEffect(() => {
    if (activeView !== "organigramme" || orgLoaded.current) {
      return undefined;
    }
    let cancelled = false;
    setOrgLoading(true);
    loadOrgChart(props.spHttpClient, props.siteUrl, props.orgChartListTitle)
      .then((result) => {
        if (!cancelled) {
          orgLoaded.current = true;
          setOrgChart(result);
          setOrgLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOrgChart(emptyOrgChart);
          setOrgLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeView, props.spHttpClient, props.siteUrl, props.orgChartListTitle]);

  const navLinks = React.useMemo(
    () => parseNavLinks(props.navLinks, DEFAULT_NAV),
    [props.navLinks],
  );
  const quickLinks = React.useMemo(
    () => parseQuickLinks(props.quickLinks, DEFAULT_QUICK_LINKS),
    [props.quickLinks],
  );
  const kpis: IKpi[] = React.useMemo(() => parseKpis(props.kpis), [props.kpis]);
  const heroSlides: IHeroSlide[] = React.useMemo(
    () => parseHeroSlides(props.heroSlides, defaultHeroSlides(props)),
    [props],
  );

  const openView = (view: PortalView, options?: { newsId?: number; silent?: boolean }): void => {
    const targetNewsId = options && options.newsId !== undefined ? options.newsId : 0;
    const hash =
      view === "actualite" && targetNewsId ? `actualite?id=${targetNewsId}` : view;
    if (window.location.hash !== `#${hash}`) {
      window.history.pushState(null, "", `#${hash}`);
    }
    setActiveView(view);
    setNewsId(targetNewsId);
    setMenuOpen(false);
    if (!options || !options.silent) {
      if (view === "actualites" || view === "accueil") {
        setPageIndex(0);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const openNews = (id: number): void => {
    openView("actualite", { newsId: id });
  };

  const followPortalLink = (event: React.MouseEvent<HTMLAnchorElement>, href: string): void => {
    // Ancre de section (`#vie-equipe`) : on garde la vue et on fait défiler,
    // au lieu de renvoyer l'utilisateur en haut de la page d'accueil.
    const anchor = anchorIdFromHash(href);
    if (anchor) {
      event.preventDefault();
      if (window.location.hash !== `#${anchor}`) {
        window.history.pushState(null, "", `#${anchor}`);
      }
      setActiveView("accueil");
      setMenuOpen(false);
      // Laisse React afficher la vue accueil avant de mesurer la position.
      window.setTimeout(() => { scrollToSection(anchor); }, 60);
      return;
    }
    const view = viewFromHref(href);
    if (view) {
      event.preventDefault();
      const route = parsePortalRoute(href);
      const parsedId = parseInt(route.params.id || "", 10);
      openView(view, { newsId: Number.isNaN(parsedId) ? 0 : parsedId });
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

  const upcomingSessions = sessions.items
    .filter(
      (session) =>
        !session.StartDate ||
        new Date(session.StartDate).getTime() >= Date.now(),
    )
    .slice(0, activeView === "sessions" ? 40 : Math.max(props.maxItems, 4));

  const needle = searchQuery.toLocaleLowerCase("fr");
  const searchResults = [
    ...newsPage.items.map((item) => ({
      title: item.Title,
      description: item.Summary || item.Category || "Actualité BBI",
      category: "Actualité",
      view: "actualite" as PortalView,
      newsId: item.Id,
    })),
    ...sessions.items.map((item) => ({
      title: item.Title,
      description: [item.Modality, item.Location].filter(Boolean).join(" · ") || "Prochaine session",
      category: "Session",
      view: "sessions" as PortalView,
      newsId: 0,
    })),
    ...trainers.items.map((item) => ({
      title: item.Title,
      description: [item.Role, item.Filiere].filter(Boolean).join(" · ") || "Communauté BBI",
      category: "Communauté",
      view: "communaute" as PortalView,
      newsId: 0,
    })),
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
    maxItems: 24,
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

  const announcement =
    (props.announcementText || "").trim() ||
    (newsPage.items[0]
      ? `${newsPage.items[0].Category || "À la une"} — ${newsPage.items[0].Title}`
      : "");
  const showAnnouncement = props.enableAnnouncement !== false && !!announcement;
  const featuredNews = newsPage.items[0];

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
          {featuredNews && (
            <a
              className={styles.announcementLink}
              href="#actualites"
              onClick={(event) => {
                event.preventDefault();
                openView("actualites");
              }}
            >
              Voir les actualités <span aria-hidden="true">→</span>
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
            onClick={(event) => {
              event.preventDefault();
              openView("accueil");
            }}
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

          <form className={styles.searchForm} onSubmit={searchSite} role="search">
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
                    <a
                      href={`#${result.view}`}
                      onClick={(event) => {
                        event.preventDefault();
                        openView(result.view, { newsId: result.newsId });
                      }}
                    >
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
                ci-dessus, ou partez de l&apos;un des thèmes fréquents.
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
          <button
            type="button"
            className={styles.searchCatalogButton}
            onClick={() => {
              openView("formations");
            }}
          >
            Parcourir le catalogue des formations <span aria-hidden="true">→</span>
          </button>
        </section>

        <HomeHero
          slides={heroSlides}
          eyebrow={props.heroEyebrow || "Business Builders International"}
          title={props.heroTitle || "L'expertise qui fait grandir les dirigeants."}
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
          data-bbi-view="accueil"
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
                onClick={(event) => {
                  followPortalLink(event, link.url);
                }}
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

        <section
          className={styles.learningPath}
          data-bbi-view="accueil"
          aria-labelledby="bbi-path-title"
        >
          <div className={styles.learningPathIntro}>
            <p className={styles.eyebrow}>La méthode BBI</p>
            <h2 id="bbi-path-title">De l&apos;apprentissage à l&apos;impact.</h2>
            <p>
              Une expérience qui relie les bons savoirs, la pratique sur le
              terrain et le partage entre pairs.
            </p>
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
                onClick={(event) => {
                  followPortalLink(event, "#actualites");
                }}
              >
                Toutes les actualités <span aria-hidden="true">→</span>
              </a>
            </div>
            <NewsBoard
              items={newsPage.items}
              page={pageIndex}
              pageSize={newsPageSize}
              hasMore={newsPage.hasMore}
              isDemo={newsPage.isDemo}
              showDataNotices={props.showDataNotices}
              loading={newsLoading}
              variant={activeView === "actualites" ? "archive" : "home"}
              onPageChange={(page) => {
                setPageIndex(Math.max(0, page));
              }}
              onOpenNews={openNews}
              onViewAll={(event) => {
                followPortalLink(event, "#actualites");
              }}
            />
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
                onClick={(event) => {
                  followPortalLink(event, "#sessions");
                }}
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
                        {session.Trainer && <small>Animé par {session.Trainer}</small>}
                      </div>
                      {session.RegistrationUrl ? (
                        <a className={styles.sessionStatus} href={session.RegistrationUrl}>
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
            <div className={styles.agendaCard}>
              <p className={styles.eyebrow}>Agenda</p>
              <h3>
                {sessions.items.length} session{sessions.items.length > 1 ? "s" : ""}{" "}
                planifiée{sessions.items.length > 1 ? "s" : ""} cette saison
              </h3>
              <p>
                Inscrivez-vous en un clic, ajoutez la session à votre agenda
                Outlook et retrouvez les supports dès la fin de la formation.
              </p>
              <a
                className={styles.textLink}
                href="#sessions"
                onClick={(event) => {
                  followPortalLink(event, "#sessions");
                }}
              >
                Ouvrir le planning complet <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </section>

        <section
          className={styles.teamSection}
          id="vie-equipe"
          data-bbi-view="accueil"
          aria-label="Vie de l'équipe"
        >
          <TeamHighlights
            employee={employee.items[0]}
            employeeIsDemo={employee.isDemo}
            certifications={certifications.items}
            certificationsIsDemo={certifications.isDemo}
            showDataNotices={props.showDataNotices}
            onOpenDirectory={(event) => {
              followPortalLink(event, "#communaute");
            }}
            onOpenOrgChart={(event) => {
              followPortalLink(event, "#organigramme");
            }}
          />
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
              onClick={(event) => {
                followPortalLink(event, "#formations");
              }}
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
          aria-label="Supports publiés, galerie et formateurs référents"
        >
          <div className={styles.resources}>
            <div className={styles.documents}>
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.eyebrow}>Ressources</p>
                  <h2>Derniers supports publiés</h2>
                </div>
                <a
                  className={styles.textLink}
                  href="#ressources"
                  onClick={(event) => {
                    followPortalLink(event, "#ressources");
                  }}
                >
                  Bibliothèque <span aria-hidden="true">→</span>
                </a>
              </div>
              <SecureDocuments {...documentsProps} />
            </div>
            <div className={styles.gallery} id="galerie">
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
                onClick={(event) => {
                  followPortalLink(event, "#communaute");
                }}
              >
                Annuaire complet <span aria-hidden="true">→</span>
              </a>
            </div>
            <TrainerDirectory
              trainers={trainers.items}
              isDemo={trainers.isDemo}
              showDataNotices={props.showDataNotices}
              sessions={sessions.items}
              maxItems={activeView === "communaute" ? 24 : 8}
            />
            <div className={styles.community} id="support">
              <div>
                <p className={styles.eyebrow}>Communauté</p>
                <h3>Réseau des formateurs</h3>
                <p>
                  Échanges de pratiques, entraide pédagogique et veille :
                  rejoignez la communauté BBI sur Teams et Viva Engage.
                </p>
              </div>
              <div className={styles.communityActions}>
                <a
                  className={styles.textLink}
                  href="#organigramme"
                  onClick={(event) => {
                    followPortalLink(event, "#organigramme");
                  }}
                >
                  Voir l&apos;organigramme <span aria-hidden="true">→</span>
                </a>
                <a
                  className={styles.textLink}
                  href="#communaute"
                  onClick={(event) => {
                    followPortalLink(event, "#communaute");
                  }}
                >
                  Découvrir la communauté <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section
          className={styles.section}
          id="actualite"
          data-bbi-view="actualite"
          aria-label="Actualité"
        >
          <NewsDetail
            bundle={newsBundle}
            loading={newsBundleLoading}
            siteUrl={props.siteUrl}
            showDataNotices={props.showDataNotices}
            onOpenNews={openNews}
            onBack={(event) => {
              event.preventDefault();
              openView("actualites");
            }}
          />
        </section>

        <section
          className={styles.section}
          id="organigramme"
          data-bbi-view="organigramme"
          aria-label="Organigramme de l'entreprise"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Notre organisation</p>
              <h2>Organigramme BBI</h2>
              <p className={styles.sectionLead}>
                Direction, pôles et antennes : cliquez sur un poste pour afficher
                la fiche et les coordonnées du collaborateur.
              </p>
            </div>
            <a
              className={styles.textLink}
              href="#communaute"
              onClick={(event) => {
                followPortalLink(event, "#communaute");
              }}
            >
              Annuaire des formateurs <span aria-hidden="true">→</span>
            </a>
          </div>
          <OrgChart
            nodes={orgChart.nodes}
            isDemo={orgChart.isDemo}
            showDataNotices={props.showDataNotices}
            loading={orgLoading}
          />
        </section>

        <section
          className={styles.topicLinks}
          id="vie-bbi"
          data-bbi-view="accueil"
          aria-label="Vie d'entreprise et ressources pédagogiques"
        >
          <a href="#ressources" className={styles.topicLink} onClick={(event) => { followPortalLink(event, "#ressources"); }}>
            <span aria-hidden="true">⌘</span>
            <strong>Méthodes &amp; outils d&apos;animation</strong>
            <small>Kits, modèles et trames de séquence</small>
          </a>
          <a href="#vie-equipe" className={styles.topicLink} onClick={(event) => { followPortalLink(event, "#vie-equipe"); }}>
            <span aria-hidden="true">✳</span>
            <strong>Qualité &amp; certification</strong>
            <small>Qualiopi, évaluations, preuves de conformité</small>
          </a>
          <a href="#actualites" className={styles.topicLink} onClick={(event) => { followPortalLink(event, "#actualites"); }}>
            <span aria-hidden="true">◈</span>
            <strong>Vie d&apos;entreprise</strong>
            <small>Événements, séminaires et temps forts</small>
          </a>
          <a href="#organigramme" className={styles.topicLink} onClick={(event) => { followPortalLink(event, "#organigramme"); }}>
            <span aria-hidden="true">⌗</span>
            <strong>Organisation &amp; contacts</strong>
            <small>Pôles, antennes et responsables</small>
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
            <a href="#sessions" onClick={(event) => { followPortalLink(event, "#sessions"); }}>Sessions</a>
            <a href="#actualites" onClick={(event) => { followPortalLink(event, "#actualites"); }}>Actualités</a>
            <a href="#ressources" onClick={(event) => { followPortalLink(event, "#ressources"); }}>Ressources</a>
            <a href="#organigramme" onClick={(event) => { followPortalLink(event, "#organigramme"); }}>Organigramme</a>
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
