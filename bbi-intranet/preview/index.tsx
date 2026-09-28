import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Portal } from '../src/shared/Portal';
import { defaults, moduleKeys, modules } from '../src/shared/registry';
import { DataSource, WebPartKind } from '../src/shared/models';
import { demoItems } from '../src/shared/demo';
const Preview: React.FC = () => {
  const [kind, setKind] = React.useState<WebPartKind>('home');
  const [mode, setMode] = React.useState('demo');
  const source = React.useMemo<DataSource>(() => ({ load: async request => {
    if (mode === 'error') throw new Error('Simulation HTTP 403 · Accès refusé. Vérifiez les autorisations SharePoint.');
    return { items: mode === 'empty' ? [] : demoItems(request.key), truncated: false };
  } }), [mode]);
  return <><div id="preview-toolbar"><strong>APERÇU INTERACTIF · HORS SHAREPOINT</strong><label>Webpart<select value={kind} onChange={e => setKind(e.target.value as WebPartKind)}><option value="home">Accueil composite</option>{moduleKeys.map(key => <option key={key} value={key}>{modules[key].title}</option>)}</select></label><label>État<select value={mode} onChange={e => setMode(e.target.value)}><option value="demo">Démonstration</option><option value="empty">Listes vides (simulation)</option><option value="error">Accès refusé (simulation)</option></select></label><span>Les données réelles nécessitent votre tenant Microsoft 365.</span></div><Portal key={kind} kind={kind} settings={{ ...defaults, title: kind === 'home' ? 'BBI Intranet' : '', demoMode: mode === 'demo', siteUrl: window.location.origin, maxItems: 4 }} source={source} userName="Alex Morgan" userEmail="" instanceId="bbi-preview" /></>;
};
ReactDom.render(<Preview />, document.getElementById('root'));
