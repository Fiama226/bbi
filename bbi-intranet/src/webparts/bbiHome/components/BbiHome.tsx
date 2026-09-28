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
import TrainingCatalog from "../../trainingCatalog/components/TrainingCatalog";
import { ITrainingCatalogProps } from "../../trainingCatalog/components/ITrainingCatalogProps";
import * as trainingStrings from "TrainingCatalogWebPartStrings";
import SecureDocuments from "../../secureDocuments/components/SecureDocuments";
import { ISecureDocumentsProps } from "../../secureDocuments/components/ISecureDocumentsProps";
import * as documentStrings from "SecureDocumentsWebPartStrings";

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

const BbiHome: React.FC<IBbiHomeProps> = (props) => {
  const [status, setStatus] = React.useState<HomeStatus>("loading");
  const [news, setNews] =
    React.useState<IHomeListResult<IHomeNews>>(emptyResult<IHomeNews>());
  const [sessions, setSessions] =
    React.useState<IHomeListResult<IHomeSession>>(emptyResult<IHomeSession>());
  const [trainers, setTrainers] =
    React.useState<IHomeListResult<IHomeTrainer>>(emptyResult<IHomeTrainer>());
  const [search, setSearch] = React.useState("");

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
    isDarkTheme: false,
    hasTeamsContext: false,
    strings: trainingStrings,
  };
  const documentsProps: ISecureDocumentsProps = {
    siteUrl: props.siteUrl,
    libraryTitle: props.documentsLibraryTitle,
    maxItems: props.maxItems,
    spHttpClient: props.spHttpClient,
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

  if (status === "loading") {
    return (
      <div className={styles.loading} role="status">
        {props.strings.LoadingMessage}
      </div>
    );
  }

  return (
    <div className={styles.home}>
      <header className={styles.header}>
        <a
          className={styles.brand}
          href={props.siteUrl}
          aria-label="BBI Intranet, accueil"
        >
          <span className={styles.logoImage} role="img" aria-label="BBI" />
          <span>
            <strong>BBI Intranet</strong>
            <small>Propulseur de croissance · Créateur d&apos;impacts</small>
          </span>
        </a>
        <form className={styles.searchForm} onSubmit={searchSite} role="search">
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
            placeholder="Rechercher dans BBI Intranet"
          />
          <button type="submit" aria-label="Rechercher">
            ⌕
          </button>
        </form>
        <nav className={styles.navigation} aria-label="Navigation principale">
          <a href="#accueil" className={styles.navActive}>
            Accueil
          </a>
          <a href="#formations">Catalogue</a>
          <a href="#sessions">Sessions</a>
          <a href="#actualites">Actualités</a>
          <a href="#formateurs">Formateurs</a>
        </nav>
      </header>

      <main className={styles.content}>
        <section
          className={styles.hero}
          id="accueil"
          aria-labelledby="bbi-home-title"
        >
          <div className={styles.heroImage} aria-hidden="true" />
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Business Builders International</p>
            <h1 id="bbi-home-title">
              Faites grandir vos talents,
              <br />
              propulsez vos projets.
            </h1>
            <p>
              Le catalogue des formations BBI, vos sessions à venir et tous vos
              supports pédagogiques, au même endroit.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryAction} href="#formations">
                Explorer le catalogue
              </a>
              <a className={styles.secondaryAction} href="#formateurs">
                Espace formateurs
              </a>
            </div>
          </div>
        </section>

        <section
          className={styles.newsSessions}
          aria-label="Actualités et prochaines sessions"
        >
          <div className={styles.newsColumn} id="actualites">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>À la une</p>
                <h2>Actualités BBI</h2>
              </div>
            </div>
            {news.isDemo && (
              <p className={styles.demoNote}>
                Exemples affichés : créez la liste « {props.newsListTitle} »
                pour publier vos actualités.
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

          <div className={styles.sessionsColumn} id="sessions">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>À venir</p>
                <h2>Prochaines sessions</h2>
              </div>
              <a
                href={`${props.siteUrl}/Lists/${encodeURIComponent(props.sessionsListTitle)}/AllItems.aspx`}
                className={styles.textLink}
              >
                Tout voir <span aria-hidden="true">→</span>
              </a>
            </div>
            {sessions.isDemo && (
              <p className={styles.demoNote}>
                Exemples affichés : créez la liste « {props.sessionsListTitle} »
                pour gérer les sessions.
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
          className={styles.quickLinks}
          aria-labelledby="quick-links-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Accès directs</p>
              <h2 id="quick-links-title">Vos espaces</h2>
            </div>
          </div>
          <div className={styles.quickGrid}>
            <a href="#formations" className={styles.quickLink}>
              <span className={styles.quickIcon} aria-hidden="true">
                ▦
              </span>
              <strong>Catalogue des formations</strong>
              <small>Parcours, modalités et durées</small>
            </a>
            <a href="#formateurs" className={styles.quickLink}>
              <span className={styles.quickIcon} aria-hidden="true">
                ◎
              </span>
              <strong>Espace formateurs</strong>
              <small>Vos référents et leur expertise</small>
            </a>
            <a href="#sessions" className={styles.quickLink}>
              <span className={styles.quickIcon} aria-hidden="true">
                ▣
              </span>
              <strong>Mon planning</strong>
              <small>Les prochaines sessions BBI</small>
            </a>
            <a href="#supports" className={styles.quickLink}>
              <span className={styles.quickIcon} aria-hidden="true">
                ↗
              </span>
              <strong>Supports publiés</strong>
              <small>Ressources en consultation</small>
            </a>
          </div>
        </section>

        <section
          className={styles.catalogSection}
          id="formations"
          aria-label="Catalogue des formations"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Se former</p>
              <h2>Catalogue des formations</h2>
            </div>
            <a
              href={`${props.siteUrl}/Lists/${encodeURIComponent(props.formationsListTitle)}/AllItems.aspx`}
              className={styles.textLink}
            >
              Voir tout le catalogue <span aria-hidden="true">→</span>
            </a>
          </div>
          <TrainingCatalog {...catalogProps} />
        </section>

        <section
          className={styles.resourcesPeople}
          aria-label="Supports publiés et formateurs référents"
        >
          <div className={styles.resources} id="supports">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Ressources</p>
                <h2>Derniers supports publiés</h2>
              </div>
              <a
                href={`${props.siteUrl.replace(/\/+$/, "")}/${encodeURIComponent(props.documentsLibraryTitle)}/Forms/AllItems.aspx`}
                className={styles.textLink}
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
                href={`${props.siteUrl}/Lists/${encodeURIComponent(props.trainersListTitle)}/AllItems.aspx`}
                className={styles.textLink}
              >
                Annuaire <span aria-hidden="true">→</span>
              </a>
            </div>
            {trainers.isDemo && (
              <p className={styles.demoNote}>
                Exemples affichés : créez la liste « {props.trainersListTitle} »
                pour gérer vos référents.
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
          </div>
        </section>

        <section
          className={styles.topicLinks}
          aria-label="Ressources pédagogiques"
        >
          <a href="#supports" className={styles.topicLink}>
            <span aria-hidden="true">⌘</span>
            <strong>Méthodes &amp; outils d&apos;animation</strong>
            <small>Kits, modèles et supports à consulter</small>
          </a>
          <a href="#supports" className={styles.topicLink}>
            <span aria-hidden="true">✳</span>
            <strong>Certification &amp; qualité</strong>
            <small>Ressources et référentiels pédagogiques</small>
          </a>
          <div className={styles.community}>
            <p className={styles.eyebrow}>Communauté</p>
            <h2>Réseau des formateurs</h2>
            <p>
              Retrouvez les échanges et les bonnes pratiques de la communauté
              BBI.
            </p>
            <a href="#formateurs" className={styles.textLink}>
              Voir les référents <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>
          © {new Date().getFullYear()} Business Builders International
        </span>
        <nav aria-label="Informations légales">
          <a href="#accueil">Accueil</a>
          <a href="#supports">Confidentialité et supports</a>
          <a href="#actualites">Actualités</a>
        </nav>
      </footer>
    </div>
  );
};

export default BbiHome;
