import { IHomeAdminDocument, IHomePedagogicalReference } from "./homeData";
import { safeHref } from "../../../shared/safeUrl";

export interface ILinkItem {
  key: string;
  icon: string;
  label: string;
  href?: string;
  hint?: string;
}

export interface ILinkGroup {
  title: string;
  items: ILinkItem[];
}

const ADMIN_CATEGORY_ORDER = ["RH", "Juridique", "Finance", "Qualité", "Modèles"];
const PEDAGOGICAL_CATEGORY_ORDER = ["Ouvrage", "Norme", "Méthode", "Étude", "Outil"];
const FALLBACK_CATEGORY = "Autres";

const PEDAGOGICAL_ICONS: { [category: string]: string } = {
  Ouvrage: "📚",
  Norme: "📜",
  Méthode: "🧭",
  Étude: "📈",
  Outil: "🧰"
};
const GENERIC_ICON = "📄";

/** Icône selon l'extension du fichier ; générique si inconnue ou absente. */
export const iconForFile = (fileName: string): string => {
  const parts = (fileName || "").split(".");
  const ext = parts.length > 1 ? (parts.pop() || "").toLowerCase() : "";
  switch (ext) {
    case "pdf":
      return "📕";
    case "doc":
    case "docx":
      return "📘";
    case "xls":
    case "xlsx":
      return "📗";
    case "ppt":
    case "pptx":
      return "📙";
    default:
      return GENERIC_ICON;
  }
};

const groupBy = <T>(
  items: T[],
  categoryOf: (item: T) => string | undefined,
  order: string[],
  toLink: (item: T) => ILinkItem
): ILinkGroup[] => {
  const buckets = new Map<string, ILinkItem[]>();
  items.forEach((item) => {
    const key = (categoryOf(item) || "").trim() || FALLBACK_CATEGORY;
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key)!.push(toLink(item));
  });
  const known = order.filter((c) => buckets.has(c));
  const extra = Array.from(buckets.keys())
    .filter((c) => order.indexOf(c) === -1 && c !== FALLBACK_CATEGORY)
    .sort((a, b) => a.localeCompare(b, "fr"));
  const tail = buckets.has(FALLBACK_CATEGORY) ? [FALLBACK_CATEGORY] : [];
  return [...known, ...extra, ...tail].map((title) => ({ title, items: buckets.get(title)! }));
};

export const adminDocumentsToGroups = (docs: IHomeAdminDocument[]): ILinkGroup[] =>
  groupBy(
    docs,
    (d) => d.Categorie,
    ADMIN_CATEGORY_ORDER,
    (d) => ({
      key: `doc-${d.Id}`,
      icon: iconForFile(d.FileLeafRef),
      label: d.Title || d.FileLeafRef,
      href: safeHref(d.FileRef),
      hint: d.Reference || d.FileLeafRef
    })
  );

export const pedagogicalReferencesToGroups = (refs: IHomePedagogicalReference[]): ILinkGroup[] =>
  groupBy(
    refs
      .slice()
      .sort((a, b) => (a.Ordre ?? Number.MAX_SAFE_INTEGER) - (b.Ordre ?? Number.MAX_SAFE_INTEGER)),
    (r) => r.Categorie,
    PEDAGOGICAL_CATEGORY_ORDER,
    (r) => ({
      key: `ref-${r.Id}`,
      icon: PEDAGOGICAL_ICONS[r.Categorie || ""] || GENERIC_ICON,
      label: r.Title,
      href: r.LienUrl ? safeHref(r.LienUrl) : undefined,
      hint: [r.Auteur, r.Annee ? String(r.Annee) : undefined].filter((p) => !!p).join(" · ") || undefined
    })
  );
