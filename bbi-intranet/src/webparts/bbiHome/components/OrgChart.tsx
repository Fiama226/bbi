import * as React from "react";
import styles from "./OrgChart.module.scss";
import { IOrgNode, IOrgTreeNode, buildOrgTree, orgPoles } from "./orgData";
import { externalUrl, mailtoUrl, teamsChatUrl, telUrl } from "./homeData";

export interface IOrgChartProps {
  nodes: IOrgNode[];
  isDemo: boolean;
  showDataNotices: boolean;
  loading: boolean;
}

const initialsOf = (value: string): string =>
  (value || "")
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

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

const OrgAvatar: React.FC<{ node: IOrgNode; className?: string }> = ({ node, className }) => (
  <span
    className={
      node.PhotoUrl
        ? `${className || styles.avatar}`
        : `${className || styles.avatar} ${visualClass(node.DemoIndex)}`
    }
    style={node.PhotoUrl ? { backgroundImage: `url("${node.PhotoUrl}")` } : undefined}
    role="img"
    aria-label={node.Title}
  >
    {!node.PhotoUrl && <span>{initialsOf(node.Title)}</span>}
  </span>
);

/**
 * Organigramme de l'entreprise : arbre hiérarchique avec zoom, mise en avant
 * par pôle, fiche contact du poste sélectionné et vue liste (mobile, impression).
 */
const OrgChart: React.FC<IOrgChartProps> = (props) => {
  const { nodes, isDemo, showDataNotices, loading } = props;
  const [zoom, setZoom] = React.useState<number>(1);
  const [pole, setPole] = React.useState<string>("");
  const [listView, setListView] = React.useState<boolean>(false);
  const [selectedId, setSelectedId] = React.useState<number>(-1);

  const tree = React.useMemo(() => buildOrgTree(nodes), [nodes]);
  const poles = React.useMemo(() => orgPoles(nodes), [nodes]);
  const flat = React.useMemo(() => {
    const ordered: IOrgTreeNode[] = [];
    const walk = (list: IOrgTreeNode[]): void => {
      list.forEach((node) => {
        ordered.push(node);
        walk(node.children);
      });
    };
    walk(tree);
    return ordered;
  }, [tree]);

  const selected = flat.filter((node) => node.Id === selectedId)[0];

  const matchesPole = (node: IOrgNode): boolean => !pole || node.Pole === pole;

  const renderNode = (node: IOrgTreeNode): React.ReactNode => {
    const isSelected = node.Id === selectedId;
    const dimmed = !matchesPole(node);
    const className = [
      styles.nodeCard,
      node.Depth === 0 ? styles.nodeRoot : "",
      isSelected ? styles.nodeSelected : "",
      dimmed ? styles.nodeDimmed : "",
    ]
      .filter((part) => !!part)
      .join(" ");
    return (
      <li className={styles.nodeWrap} key={`wrap-${node.Id}`}>
        <button
          type="button"
          className={className}
          onClick={() => {
            setSelectedId(node.Id);
          }}
          aria-pressed={isSelected}
        >
          <OrgAvatar node={node} />
          <span className={styles.nodeIdentity}>
            <strong>{node.Title}</strong>
            <small>{node.Role || "Poste à préciser"}</small>
          </span>
          {node.children.length > 0 && (
            <span className={styles.nodeCount} aria-label={`${node.children.length} rattachement(s)`}>
              {node.children.length}
            </span>
          )}
        </button>
        {node.children.length > 0 && (
          <ul className={styles.childList}>{node.children.map((child) => renderNode(child))}</ul>
        )}
      </li>
    );
  };

  const contactRow = (label: string, value: React.ReactNode): React.ReactNode => (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );

  return (
    <div className={styles.chart}>
      {showDataNotices && isDemo && (
        <p className={styles.demoNote}>
          Données de démonstration : la liste « Organigramme » est absente, non créée ou vide.
        </p>
      )}

      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Mettre en avant un pôle">
          <button
            type="button"
            className={pole === "" ? `${styles.chip} ${styles.chipActive}` : styles.chip}
            aria-pressed={pole === ""}
            onClick={() => {
              setPole("");
            }}
          >
            Tous les pôles
          </button>
          {poles.map((value) => (
            <button
              key={value}
              type="button"
              className={pole === value ? `${styles.chip} ${styles.chipActive}` : styles.chip}
              aria-pressed={pole === value}
              onClick={() => {
                setPole(pole === value ? "" : value);
              }}
            >
              {value}
            </button>
          ))}
        </div>

        <div className={styles.tools}>
          <div className={styles.zoom} role="group" aria-label="Zoom de l'organigramme">
            <button
              type="button"
              className={styles.toolButton}
              onClick={() => {
                setZoom((current) => Math.max(0.6, Math.round((current - 0.1) * 10) / 10));
              }}
              aria-label="Réduire l'organigramme"
            >
              −
            </button>
            <span className={styles.zoomValue}>{Math.round(zoom * 100)} %</span>
            <button
              type="button"
              className={styles.toolButton}
              onClick={() => {
                setZoom((current) => Math.min(1.4, Math.round((current + 0.1) * 10) / 10));
              }}
              aria-label="Agrandir l'organigramme"
            >
              +
            </button>
          </div>
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => {
              setListView(!listView);
            }}
            aria-pressed={listView}
          >
            {listView ? "Vue arbre" : "Vue liste"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className={styles.state} role="status">
          Chargement de l&apos;organigramme…
        </p>
      ) : flat.length === 0 ? (
        <p className={styles.state}>Aucun poste publié dans l&apos;organigramme.</p>
      ) : listView ? (
        <ul className={styles.listView}>
          {flat.map((node) => (
            <li
              key={`list-${node.Id}`}
              className={!matchesPole(node) ? styles.listItemDimmed : undefined}
              style={{ paddingLeft: `${node.Depth * 22 + 14}px` }}
            >
              <button
                type="button"
                className={styles.listButton}
                onClick={() => {
                  setSelectedId(node.Id);
                }}
              >
                <OrgAvatar node={node} className={styles.listAvatar} />
                <span>
                  <strong>{node.Title}</strong>
                  <small>
                    {[node.Role, node.Pole, node.Location].filter((part) => !!part).join(" · ")}
                  </small>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.canvas}>
          <div className={styles.treeZoom} style={{ zoom }}>
            <ul className={styles.tree}>{tree.map((node) => renderNode(node))}</ul>
          </div>
        </div>
      )}

      {selected && (
        <aside className={styles.detail} aria-label={`Fiche de ${selected.Title}`}>
          <OrgAvatar node={selected} className={styles.detailAvatar} />
          <div className={styles.detailText}>
            <strong>{selected.Title}</strong>
            <span>{selected.Role || "Poste à préciser"}</span>
            {selected.Pole && <em>{selected.Pole}</em>}
          </div>
          <dl className={styles.detailList}>
            {selected.Email &&
              contactRow(
                "E-mail",
                <a href={mailtoUrl(selected.Email)}>{selected.Email}</a>,
              )}
            {selected.Phone &&
              contactRow("Téléphone", <a href={telUrl(selected.Phone)}>{selected.Phone}</a>)}
            {selected.Location && contactRow("Localisation", selected.Location)}
          </dl>
          <div className={styles.detailActions}>
            {selected.Email && (
              <a
                className={styles.detailAction}
                href={teamsChatUrl(selected.Email)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Discuter sur Teams
              </a>
            )}
            {selected.Phone && (
              <a className={styles.detailAction} href={telUrl(selected.Phone)}>
                Appeler
              </a>
            )}
            {selected.PhotoUrl && (
              <a
                className={styles.detailAction}
                href={externalUrl(selected.PhotoUrl)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Voir la photo ↗
              </a>
            )}
          </div>
        </aside>
      )}
    </div>
  );
};

export default OrgChart;
