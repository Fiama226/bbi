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
  useActiveSection,
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

type HomeStatus = "loading" | "ready";

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
  { label: "Accès directs", url: "#acces" },
  { label: "Actualités", url: "#actualites" },
  { label: "Catalogue", url: "#formations" },
  { label: "Ressources", url: "#ressources" },
  { label: "Espace formateurs", url: "#formateurs" },
];

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
    url: "#actualites",
  },
  {
    icon: "▤",
    title: "Supports publiés",
    subtitle: "Consultation en lecture seule",
    url: "#ressources",
  },
  {
    icon: "◎",
    title: "Formateurs référents",
    subtitle: "Votre réseau d’experts",
    url: "#formateurs",
  },
  {
    icon: "✆",
    title: "Support & FAQ",
    subtitle: "Une question, une demande",
    url: "#support",
  },
];

const SECTION_IDS: string[] = [
  "accueil",
  "acces",
  "actualites",
  "formations",
  "ressources",
  "vie-bbi",
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
  const [menuOpen, setMenuOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const scrolled = useScrolled(40);
  const activeSection = useActiveSection(SECTION_IDS);
  useChromeOffset(rootRef);
  console.info("[BBI-HOME] initial hooks completed", status);

  React.useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    Promise.all([
      loadHomeNews(
        props.spHttpClient,
        props.siteUrl,
        props.newsListTitle,
        props.maxItems,
      ),
      loadHomeSessions(
        props.spHttpClient,
        props.siteUrl,
        props.sessionsListTitle,
        props.maxItems,
      ),
      loadHomeTrainers(
        props.spHttpClient,
        props.siteUrl,
        props.trainersListTitle,
        props.maxItems,
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

  const searchSite = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const query = search.trim();
    if (query) {
      window.location.href = `${props.siteUrl.replace(/\/+$/, "")}/_layouts/15/search.aspx?q=${encodeURIComponent(query)}`;
    }
  };

  const currentNews = news.items[0];
  const upcomingSessions = sessions.items
    .filter(
      (session) =>
        !session.StartDate ||
        new Date(session.StartDate).getTime() >= Date.now(),
    )
    .slice(0, props.maxItems);

  const catalogProps: ITrainingCatalogProps = {
    siteUrl: props.siteUrl,
    listTitle: props.formationsListTitle,
    maxItems: props.maxItems,
    spHttpClient: props.spHttpClient,
    showDataNotices: props.showDataNotices,
    isDarkTheme: false,
    hasTeamsContext: false,
    strings: trainingStrings,
  };
  const documentsProps: ISecureDocumentsProps = {
    siteUrl: props.siteUrl,
    libraryTitle: props.documentsLibraryTitle,
    maxItems: props.maxItems,
    spHttpClient: props.spHttpClient,
    showDataNotices: props.showDataNotices,
    isDarkTheme: false,
    hasTeamsContext: false,
    strings: documentStrings,
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
    <div className={styles.home} ref={rootRef} id="bbi-home-root">
      {showAnnouncement && (
        <div
          className={styles.announcement}
          role="region"
          aria-label="Information à la une"
        >
          <span className={styles.announcementDot} aria-hidden="true" />
          <span className={styles.announcementText}>{announcement}</span>
          {currentNews && currentNews.LinkUrl && (
            <a className={styles.announcementLink} href={currentNews.LinkUrl}>
              Lire <span aria-hidden="true">→</span>
            </a>
          )}
        </div>
      )}

      <header
        className={
          scrolled ? `${styles.topbar} ${styles.topbarSolid}` : styles.topbar
        }
      >
        <div className={styles.topbarInner}>
          <a
            className={styles.brand}
            href="#accueil"
            aria-label="BBI Intranet, accueil"
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
              const isActive =
                link.url.indexOf("#") === 0 &&
                link.url.length > 1 &&
                `#${activeSection}` === link.url;
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
                  onClick={() => {
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
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              placeholder="Rechercher"
            />
            <button type="submit" aria-label="Rechercher">
              ⌕
            </button>
          </form>
        </div>
      </header>

      <main className={styles.content}>
        <HomeHero
          eyebrow={props.heroEyebrow || "Business Builders International"}
          title={
            props.heroTitle ||
            "Faites grandir vos talents,\npropulsez vos projets."
          }
          subtitle={
            props.heroSubtitle ||
            "Le catalogue des formations BBI, vos prochaines sessions et tous vos supports pédagogiques, au même endroit."
          }
          imageUrl={props.heroImageUrl || ""}
          primaryLabel={props.primaryCtaLabel || "Explorer le catalogue"}
          primaryUrl={props.primaryCtaUrl || "#formations"}
          secondaryLabel={props.secondaryCtaLabel || "Consulter les ressources"}
          secondaryUrl={props.secondaryCtaUrl || "#ressources"}
          kpis={kpis}
          compact={props.layoutCompact === true}
          onExplore={() => {
            const target = document.getElementById("acces");
            if (target) {
              target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
        />

        <section
          className={styles.section}
          id="acces"
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
          className={styles.newsSessions}
          id="actualites"
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
                href={`${props.siteUrl}/SitePages/vie-bbi.aspx`}
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
          </div>

          <div className={styles.sessionsColumn}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>À venir</p>
                <h2>Prochaines sessions</h2>
              </div>
              <a
                className={styles.textLink}
                href={`${props.siteUrl}/Lists/${encodeURIComponent(props.sessionsListTitle)}/AllItems.aspx`}
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
          aria-label="Catalogue des formations"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Se former</p>
              <h2>Catalogue des formations</h2>
            </div>
            <a
              className={styles.textLink}
              href={`${props.siteUrl}/SitePages/catalogue.aspx`}
            >
              Voir tout le catalogue <span aria-hidden="true">→</span>
            </a>
          </div>
          <TrainingCatalog {...catalogProps} />
        </section>

        <section
          className={styles.resourcesPeople}
          id="ressources"
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
                href={`${props.siteUrl.replace(/\/+$/, "")}/${encodeURIComponent(props.documentsLibraryTitle)}/Forms/AllItems.aspx`}
              >
                Bibliothèque <span aria-hidden="true">→</span>
              </a>
            </div>
            <SecureDocuments {...documentsProps} />
          </div>
          <div className={styles.people} id="formateurs">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Votre réseau</p>
                <h2>Formateurs référents</h2>
              </div>
              <a
                className={styles.textLink}
                href={`${props.siteUrl}/Lists/${encodeURIComponent(props.trainersListTitle)}/AllItems.aspx`}
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
              <a className={styles.textLink} href="#vie-bbi">
                En savoir plus <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </section>

        <section
          className={styles.topicLinks}
          id="vie-bbi"
          aria-label="Vie d'entreprise et ressources pédagogiques"
        >
          <a href="#ressources" className={styles.topicLink}>
            <span aria-hidden="true">⌘</span>
            <strong>Méthodes &amp; outils d&apos;animation</strong>
            <small>Kits, modèles et trames de séquence</small>
          </a>
          <a href="#ressources" className={styles.topicLink}>
            <span aria-hidden="true">✳</span>
            <strong>Qualité &amp; certification</strong>
            <small>Qualiopi, évaluations, preuves de conformité</small>
          </a>
          <a href="#actualites" className={styles.topicLink}>
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
          <nav className={styles.footerNav} aria-label="Informations légales">
            <a href="#accueil">Accueil</a>
            <a href="#support">Support &amp; FAQ</a>
            <a href="#ressources">Confidentialité &amp; supports</a>
            <a href={`${props.siteUrl}/SitePages/mentions-legales.aspx`}>
              Mentions légales
            </a>
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
