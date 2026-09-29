import * as React from "react";
import styles from "./TeamHighlights.module.scss";
import { IHomeCertification, IHomeEmployee } from "./homeData";

export interface ITeamHighlightsProps {
  employee?: IHomeEmployee;
  employeeIsDemo: boolean;
  certifications: IHomeCertification[];
  certificationsIsDemo: boolean;
  showDataNotices: boolean;
  /** Ouvre l'annuaire complet des formateurs (vue Communauté). */
  onOpenDirectory: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  onOpenOrgChart: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

const initialsOf = (value: string): string =>
  (value || "")
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

const monthLabel = (value?: string): string => {
  const clean = (value || "").trim();
  if (clean) {
    return clean;
  }
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date());
};

const formatDate = (value?: string): string => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);
};

const highlightList = (value?: string): string[] =>
  (value || "")
    .split(/\s*(?:·|;|\||\n)\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const employeeVisualClass = (index: number | undefined): string => {
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

const certBadgeClass = (index: number | undefined): string => {
  switch ((index || 0) % 4) {
    case 1:
      return styles.badge1;
    case 2:
      return styles.badge2;
    case 3:
      return styles.badge3;
    default:
      return styles.badge0;
  }
};

/**
 * Deux blocs de vie d'entreprise côte à côte :
 * · l'employé du mois (mise à l'honneur) ;
 * · les certifications et agréments de l'organisme.
 */
const TeamHighlights: React.FC<ITeamHighlightsProps> = (props) => {
  const {
    employee,
    employeeIsDemo,
    certifications,
    certificationsIsDemo,
    showDataNotices,
    onOpenDirectory,
    onOpenOrgChart,
  } = props;

  return (
    <div className={styles.wrap}>
      <article className={styles.employeeCard} aria-labelledby="bbi-employee-month">
        <p className={styles.eyebrow}>Employé du mois</p>
        <h2 id="bbi-employee-month" className={styles.title}>
          {monthLabel(employee && employee.Month)}
        </h2>
        {showDataNotices && employeeIsDemo && (
          <p className={styles.demoNote}>
            Données de démonstration : la liste « Employés du mois » est absente ou vide.
          </p>
        )}
        {employee ? (
          <div className={styles.employeeBody}>
            <span
              className={
                employee.PhotoUrl
                  ? styles.photo
                  : `${styles.photo} ${employeeVisualClass(employee.DemoIndex)}`
              }
              style={
                employee.PhotoUrl
                  ? { backgroundImage: `url("${employee.PhotoUrl}")` }
                  : undefined
              }
              role="img"
              aria-label={employee.Title}
            >
              {!employee.PhotoUrl && (
                <span className={styles.photoInitials}>{initialsOf(employee.Title)}</span>
              )}
            </span>
            <div className={styles.employeeText}>
              <strong className={styles.name}>{employee.Title}</strong>
              <span className={styles.role}>
                {[employee.Role, employee.Pole].filter((part) => !!part).join(" · ")}
              </span>
              {employee.Message && <p className={styles.message}>{employee.Message}</p>}
            </div>
            {highlightList(employee.Highlights).length > 0 && (
              <ul className={styles.facts}>
                {highlightList(employee.Highlights).map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className={styles.empty}>
            Aucun collaborateur mis à l&apos;honneur pour le moment : la mise en avant
            apparaîtra dès la première publication dans la liste.
          </p>
        )}
        <div className={styles.cardFooter}>
          <a className={styles.link} href="#communaute" onClick={onOpenDirectory}>
            Voir l&apos;équipe <span aria-hidden="true">→</span>
          </a>
          <a className={styles.link} href="#organigramme" onClick={onOpenOrgChart}>
            Organigramme <span aria-hidden="true">→</span>
          </a>
        </div>
      </article>

      <article className={styles.certCard} aria-labelledby="bbi-certifications">
        <p className={styles.eyebrow}>Qualité & conformité</p>
        <h2 id="bbi-certifications" className={styles.title}>
          Certifications & agréments
        </h2>
        {showDataNotices && certificationsIsDemo && (
          <p className={styles.demoNote}>
            Données de démonstration : la liste « Certifications » est absente ou vide.
          </p>
        )}
        {certifications.length > 0 ? (
          <ul className={styles.certList}>
            {certifications.map((certification) => {
              const validity = formatDate(certification.ValidUntil);
              return (
                <li className={styles.certItem} key={certification.Id}>
                  <span
                    className={`${styles.badge} ${certBadgeClass(certification.DemoIndex)}`}
                    aria-hidden="true"
                  >
                    {initialsOf(certification.Title)}
                  </span>
                  <span className={styles.certText}>
                    <strong>{certification.Title}</strong>
                    {certification.Issuer && <span>{certification.Issuer}</span>}
                    {certification.Scope && <small>{certification.Scope}</small>}
                  </span>
                  <span className={styles.certMeta}>
                    {certification.Status && <em>{certification.Status}</em>}
                    {validity && <small>Valide jusqu&apos;au {validity}</small>}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.empty}>Aucune certification publiée.</p>
        )}
      </article>
    </div>
  );
};

export default TeamHighlights;
