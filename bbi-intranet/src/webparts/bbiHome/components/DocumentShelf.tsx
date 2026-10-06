import * as React from "react";
import styles from "./DocumentShelf.module.scss";
import { IHomeAdminDocument } from "./homeData";

export interface IDocumentShelfProps {
  documents: IHomeAdminDocument[];
  isDemo: boolean;
  showDataNotices: boolean;
}

const iconFor = (fileName: string): string => {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  switch (ext) {
    case "pptx":
    case "ppt":
      return "📊";
    case "docx":
    case "doc":
      return "📘";
    case "xlsx":
    case "xls":
      return "📗";
    case "pdf":
      return "📄";
    default:
      return "📁";
  }
};

const formatDate = (iso?: string): string => {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

/** Documents administratifs (RH, juridique, finance, qualité, modèles) — distincts des supports pédagogiques. */
const DocumentShelf: React.FC<IDocumentShelfProps> = (props) => {
  const { documents, isDemo, showDataNotices } = props;

  if (documents.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrap}>
      {showDataNotices && isDemo && (
        <p className={styles.demoNote}>
          Données de démonstration : la bibliothèque « Documents administratifs » est absente, non créée ou vide.
        </p>
      )}
      <ul className={styles.list}>
        {documents.map((doc) => {
          const canOpen = !!doc.FileRef && doc.FileRef !== "#";
          return (
            <li className={styles.item} key={doc.Id}>
              <span className={styles.icon} aria-hidden="true">
                {iconFor(doc.FileLeafRef)}
              </span>
              <span className={styles.text}>
                <strong>{doc.Title || doc.FileLeafRef}</strong>
                <small>
                  {[doc.Categorie, doc.Reference, formatDate(doc.Modified)]
                    .filter((part) => !!part)
                    .join(" · ")}
                </small>
                {doc.DateValidite && (
                  <small className={styles.validity}>
                    Valide jusqu&apos;au {formatDate(doc.DateValidite)}
                  </small>
                )}
              </span>
              <a
                className={styles.open}
                href={canOpen ? `${doc.FileRef}?web=1` : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!canOpen}
                tabIndex={canOpen ? 0 : -1}
                onClick={(event) => {
                  if (!canOpen) {
                    event.preventDefault();
                  }
                }}
              >
                Ouvrir
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default DocumentShelf;
