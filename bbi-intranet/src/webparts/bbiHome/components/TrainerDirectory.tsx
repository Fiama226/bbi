import * as React from "react";
import * as ReactDom from "react-dom";
import styles from "./TrainerDirectory.module.scss";
import {
  IHomeSession,
  IHomeTrainer,
  externalUrl,
  mailtoUrl,
  teamsChatUrl,
  telUrl,
  whatsAppUrl,
} from "./homeData";

export interface ITrainerDirectoryProps {
  trainers: IHomeTrainer[];
  isDemo: boolean;
  showDataNotices: boolean;
  sessions: IHomeSession[];
  maxItems: number;
}

const initialsOf = (trainer: IHomeTrainer): string => {
  if (trainer.Initials) {
    return trainer.Initials;
  }
  return (trainer.Title || "")
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
};

const visualClass = (index: number | undefined): string => {
  switch ((index || 0) % 4) {
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

const chipsOf = (value?: string): string[] =>
  (value || "")
    .split(/\s*(?:·|;|\||\n)\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const sessionDate = (value?: string): string => {
  if (!value) {
    return "Date à préciser";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Date à préciser";
  }
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

/**
 * Annuaire des formateurs référents : photo (ou monogramme), et fiche
 * détaillée au clic — téléphone, e-mail, WhatsApp, localisation, bio,
 * spécialités et sessions animées.
 */
const TrainerDirectory: React.FC<ITrainerDirectoryProps> = (props) => {
  const { trainers, isDemo, showDataNotices, sessions, maxItems } = props;
  const [openIndex, setOpenIndex] = React.useState<number>(-1);
  const closeButtonRef = React.useRef<HTMLButtonElement>(
    undefined as unknown as HTMLButtonElement,
  );
  const lastFocusedRef = React.useRef<HTMLElement | undefined>(undefined);

  const visible = trainers.slice(0, maxItems);
  const trainer = openIndex >= 0 ? visible[openIndex] : undefined;

  React.useEffect(() => {
    if (!trainer) {
      document.body.style.overflow = "";
      return undefined;
    }
    lastFocusedRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpenIndex(-1);
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
  }, [trainer]);

  const renderModal = (): React.ReactPortal | null => {
    if (!trainer) {
      return null;
    }
    const email = mailtoUrl(trainer.Email);
    const phone = telUrl(trainer.Phone);
    const whatsapp = whatsAppUrl(trainer.WhatsApp || trainer.Phone);
    const teams = teamsChatUrl(trainer.Email);
    const linkedin = externalUrl(trainer.LinkedIn);
    const upcoming = sessions.filter(
      (session) =>
        !!session.Trainer &&
        !!trainer.Title &&
        session.Trainer.toLowerCase().indexOf(trainer.Title.toLowerCase()) !== -1 &&
        (!session.StartDate || new Date(session.StartDate).getTime() >= Date.now()),
    );

    return ReactDom.createPortal(
      <div
        className={styles.overlay}
        role="dialog"
        aria-modal="true"
        aria-label={`Fiche de ${trainer.Title}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setOpenIndex(-1);
          }
        }}
      >
        <div className={styles.modal}>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.close}
            onClick={() => {
              setOpenIndex(-1);
            }}
            aria-label="Fermer la fiche"
          >
            ✕
          </button>

          <div className={styles.modalHead}>
            <span
              className={
                trainer.PhotoUrl
                  ? styles.modalPhoto
                  : `${styles.modalPhoto} ${visualClass(trainer.DemoIndex)}`
              }
              style={
                trainer.PhotoUrl ? { backgroundImage: `url("${trainer.PhotoUrl}")` } : undefined
              }
              role="img"
              aria-label={trainer.Title}
            >
              {!trainer.PhotoUrl && <span>{initialsOf(trainer)}</span>}
            </span>
            <div className={styles.modalIdentity}>
              <h2 className={styles.modalName}>{trainer.Title}</h2>
              {trainer.Role && <p className={styles.modalRole}>{trainer.Role}</p>}
              <ul className={styles.tags}>
                {trainer.Filiere && <li className={styles.tagPrimary}>{trainer.Filiere}</li>}
                {trainer.Location && <li>{trainer.Location}</li>}
              </ul>
            </div>
          </div>

          {(email || phone || whatsapp || teams) && (
            <div className={styles.actions}>
              {whatsapp && (
                <a className={`${styles.action} ${styles.actionWhatsApp}`} href={whatsapp} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              )}
              {email && (
                <a className={styles.action} href={email}>
                  Envoyer un e-mail
                </a>
              )}
              {phone && (
                <a className={styles.action} href={phone}>
                  Appeler
                </a>
              )}
              {teams && (
                <a className={styles.action} href={teams} target="_blank" rel="noopener noreferrer">
                  Discuter sur Teams
                </a>
              )}
            </div>
          )}

          <dl className={styles.details}>
            {trainer.Phone && (
              <div>
                <dt>Téléphone</dt>
                <dd>{trainer.Phone}</dd>
              </div>
            )}
            {trainer.Email && (
              <div>
                <dt>E-mail</dt>
                <dd>{trainer.Email}</dd>
              </div>
            )}
            {trainer.WhatsApp && (
              <div>
                <dt>WhatsApp</dt>
                <dd>{trainer.WhatsApp}</dd>
              </div>
            )}
            {trainer.Location && (
              <div>
                <dt>Localisation</dt>
                <dd>{trainer.Location}</dd>
              </div>
            )}
            {trainer.LinkedIn && (
              <div>
                <dt>Profil</dt>
                <dd>
                  <a href={linkedin} target="_blank" rel="noopener noreferrer">
                    Voir le profil ↗
                  </a>
                </dd>
              </div>
            )}
          </dl>

          {trainer.Bio && <p className={styles.bio}>{trainer.Bio}</p>}

          {chipsOf(trainer.Specialites).length > 0 && (
            <section className={styles.modalSection}>
              <h3>Spécialités</h3>
              <ul className={styles.chips}>
                {chipsOf(trainer.Specialites).map((chip) => (
                  <li key={chip}>{chip}</li>
                ))}
              </ul>
            </section>
          )}

          {chipsOf(trainer.Certifications).length > 0 && (
            <section className={styles.modalSection}>
              <h3>Certifications</h3>
              <ul className={styles.chips}>
                {chipsOf(trainer.Certifications).map((chip) => (
                  <li key={chip} className={styles.chipCert}>
                    {chip}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {upcoming.length > 0 && (
            <section className={styles.modalSection}>
              <h3>Sessions animées</h3>
              <ul className={styles.sessionList}>
                {upcoming.slice(0, 3).map((session) => (
                  <li key={session.Id}>
                    <strong>{session.Title}</strong>
                    <small>
                      {sessionDate(session.StartDate)}
                      {session.Modality ? ` · ${session.Modality}` : ""}
                      {session.Location ? ` · ${session.Location}` : ""}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>,
      (document.getElementById("bbi-portal-host") || document.body),
    );
  };

  if (visible.length === 0) {
    return <p className={styles.empty}>Aucun formateur référent publié.</p>;
  }

  return (
    <div className={styles.directory}>
      {showDataNotices && isDemo && (
        <p className={styles.demoNote}>
          Données de démonstration : la liste « Formateurs » est absente, non créée ou vide.
        </p>
      )}

      <ul className={styles.grid}>
        {visible.map((item, index) => (
          <li className={styles.card} key={item.Id}>
            <button
              type="button"
              className={styles.cardButton}
              onClick={() => {
                setOpenIndex(index);
              }}
              aria-label={`Afficher la fiche de ${item.Title}`}
            >
              <span
                className={
                  item.PhotoUrl
                    ? styles.photo
                    : `${styles.photo} ${visualClass(item.DemoIndex !== undefined ? item.DemoIndex : index)}`
                }
                style={
                  item.PhotoUrl ? { backgroundImage: `url("${item.PhotoUrl}")` } : undefined
                }
                role="img"
                aria-label={item.Title}
              >
                {!item.PhotoUrl && <span className={styles.photoInitials}>{initialsOf(item)}</span>}
              </span>
              <span className={styles.identity}>
                <strong>{item.Title}</strong>
                <small>{item.Role || "Formateur référent"}</small>
                {item.Filiere && <em>{item.Filiere}</em>}
              </span>
              <span className={styles.hint}>
                Fiche & contact <span aria-hidden="true">→</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {renderModal()}
    </div>
  );
};

export default TrainerDirectory;
