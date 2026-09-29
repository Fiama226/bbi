import * as React from 'react';
import styles from './SecureDocuments.module.scss';
import { ISecureDocumentsProps, ISecureDocument } from './ISecureDocumentsProps';
import { SPHttpClient } from '@microsoft/sp-http';
import { safeHref } from '../../../shared/safeUrl';
import { listApiUrl } from '../../../shared/sharePointRest';

type LoadStatus = 'loading' | 'ready';

const DEMO_DOCS: ISecureDocument[] = [
  { Id: 1, Title: 'MGT-101 · Slides animateur — Management d’équipe', FileRef: '#', FileLeafRef: 'MGT-101 Slides animateur v2026.2.pptx', Modified: '2026-09-22T10:00:00Z' },
  { Id: 2, Title: 'COA-201 · Manuel participant — Coaching (module 1)', FileRef: '#', FileLeafRef: 'COA-201 Manuel participant v2026.1.docx', Modified: '2026-09-19T10:00:00Z' },
  { Id: 3, Title: 'COM-110 · Exercices & cas pratiques', FileRef: '#', FileLeafRef: 'COM-110 Exercices v2026.1.pdf', Modified: '2026-09-15T10:00:00Z' },
  { Id: 4, Title: 'QUA-301 · Évaluation à chaud (QCM)', FileRef: '#', FileLeafRef: 'QUA-301 Evaluation v2025.4.docx', Modified: '2026-09-10T10:00:00Z' },
  { Id: 5, Title: 'MGT-101 · Grille d’évaluation animateur', FileRef: '#', FileLeafRef: 'MGT-101 Grille evaluation v2026.1.xlsx', Modified: '2026-09-05T10:00:00Z' },
  { Id: 6, Title: 'DIG-140 · Module 2 — prospection sur LinkedIn', FileRef: '#', FileLeafRef: 'DIG-140 Module 2 v2026.1.mp4', Modified: '2026-08-28T10:00:00Z' },
  { Id: 7, Title: 'LDR-210 · Kit d’animation — leadership', FileRef: '#', FileLeafRef: 'LDR-210 Kit animation v2026.1.zip', Modified: '2026-08-15T10:00:00Z' },
  { Id: 8, Title: 'COM-220 · Étude de cas — négociation complexe', FileRef: '#', FileLeafRef: 'COM-220 Etude de cas v2025.3.pdf', Modified: '2026-08-02T10:00:00Z' }
];

const iconFor = (fileName: string): string => {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'pptx':
    case 'ppt':
      return '📊';
    case 'docx':
    case 'doc':
      return '📘';
    case 'xlsx':
    case 'xls':
      return '📗';
    case 'pdf':
      return '📄';
    case 'mp4':
    case 'mov':
      return '🎬';
    case 'zip':
      return '🗜️';
    default:
      return '📄';
  }
};

const titleOf = (doc: ISecureDocument): string =>
  doc.Title && doc.Title.length > 0 ? doc.Title : doc.FileLeafRef;

const formatDate = (iso?: string): string => {
  if (!iso) { return ''; }
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

export const SecureDocuments: React.FC<ISecureDocumentsProps> = (props) => {
  const { siteUrl, libraryTitle, maxItems, showDataNotices, spHttpClient, strings, embedded } = props;

  const [status, setStatus] = React.useState<LoadStatus>('loading');
  const [docs, setDocs] = React.useState<ISecureDocument[]>([]);
  const [isDemo, setIsDemo] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      setStatus('loading');
      const endpoint: string = listApiUrl(
        siteUrl,
        libraryTitle,
        'items',
        `?$select=Id,Title,FileRef,FileLeafRef,Modified&$orderby=Modified%20desc&$top=${maxItems}`
      );
      try {
        const response = await spHttpClient.get(endpoint, SPHttpClient.configurations.v1);
        if (cancelled) { return; }
        if (!response.ok) { throw new Error(`HTTP ${response.status}`); }
        const json = await response.json();
        if (cancelled) { return; }
        const loaded = ((json && json.value ? json.value : []) as ISecureDocument[]).map((doc) => ({
          ...doc,
          FileRef: safeHref(doc.FileRef) || ''
        }));
        if (loaded.length === 0) {
          // Bibliothèque créée mais encore vide : on sert les supports de démonstration.
          setDocs(DEMO_DOCS);
          setIsDemo(true);
        } else {
          setDocs(loaded);
          setIsDemo(false);
        }
        setStatus('ready');
      } catch {
        if (cancelled) { return; }
        setDocs(DEMO_DOCS);
        setIsDemo(true);
        setStatus('ready');
      }
    };
    load().catch(() => { /* géré dans load() */ });
    return () => { cancelled = true; };
  }, [siteUrl, libraryTitle, maxItems, spHttpClient]);

  const openDoc = (doc: ISecureDocument): void => {
    const href = safeHref(doc.FileRef);
    if (!href || href === '#') {
      return; // données de démonstration : pas d'ouverture
    }
    const viewerUrl = new URL(href, window.location.href);
    viewerUrl.searchParams.set('web', '1');
    window.open(viewerUrl.href, '_blank', 'noopener,noreferrer');
  };

  if (status === 'loading') {
    return (
      <div className={styles.bbiSecure}>
        <div className={styles.placeholder}>{strings.WebPartTitle} — ⏳</div>
      </div>
    );
  }

  return (
    <div className={styles.bbiSecure}>
      {!embedded && (
        <div className={styles.header}>
          <h2 className={styles.title}>🔒 {strings.WebPartTitle}</h2>
        </div>
      )}

      {showDataNotices && isDemo && <div className={styles.demoBanner}>💡 {strings.DemoBanner}</div>}

      <div className={styles.banner}>{strings.ProtectionBanner}</div>

      {docs.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>{strings.EmptyStateTitle}</div>
          <div className={styles.emptyHint}>{strings.EmptyStateHint}</div>
        </div>
      ) : (
        <div className={styles.grid}>
          {docs.map((doc) => (
            <article key={doc.Id} className={styles.doc}>
              <span className={styles.lock}>{strings.ReadOnlyBadge}</span>
              <span className={styles.icon} aria-hidden="true">{iconFor(doc.FileLeafRef)}</span>
              <h3 className={styles.docTitle}>{titleOf(doc)}</h3>
              <small className={styles.docMeta}>
                {formatDate(doc.Modified)}
                {doc.FileLeafRef ? <> · {doc.FileLeafRef.split('.').pop()?.toUpperCase()}</> : null}
              </small>
              <button
                type="button"
                className={styles.openBtn}
                onClick={() => { openDoc(doc); }}
                disabled={!doc.FileRef || doc.FileRef === '#'}
                title={!doc.FileRef || doc.FileRef === '#' ? strings.DemoOpenDisabled : undefined}
              >
                {strings.OpenInBrowser} →
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default SecureDocuments;
