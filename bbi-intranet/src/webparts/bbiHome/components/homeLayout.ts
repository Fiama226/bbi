/** Séparateur tolérant : « | », « ; » ou tabulation. */
const splitParts = (line: string): string[] => line.split(/\s*[|;]\s*|\t+/).map((part) => part.trim());

const nonEmptyLines = (text: string): string[] =>
  (text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !!line && line.indexOf('#') !== 0);

import * as React from 'react';
import { safeHref } from '../../../shared/safeUrl';

export interface INavLink {
  label: string;
  url: string;
  emphasis?: boolean;
}

export interface IQuickLink {
  icon: string;
  title: string;
  subtitle: string;
  url: string;
}

export interface IKpi {
  value: string;
  label: string;
}

/**
 * Annonce du bandeau déroulant qui surmonte la barre de navigation.
 *
 * `label` est le texte affiché, `href` la page de détail atteinte au clic
 * (ancre du portail — `#actualite?id=12` — ou URL externe).
 */
export interface IAnnouncement {
  key: string;
  label: string;
  href: string;
}

/**
 * Diapositive du héros : un visuel de fond et/ou du texte.
 *
 * Format d'une ligne (séparateur « | ») :
 *   image | sur-titre | titre | accroche | libellé du bouton | lien du bouton
 *
 * · seule l'image est reconnue automatiquement (URL, chemin ou nom de fichier) ;
 * · si la ligne ne commence pas par une image, elle est entièrement textuelle :
 *   « titre | accroche | libellé du bouton | lien du bouton » ;
 * · une diapositive sans visuel s'affiche sur le fond bleu nuit BBI.
 */
export interface IHeroSlide {
  imageUrl: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaUrl: string;
}

const IMAGE_PATTERN = /\.(jpe?g|png|gif|webp|bmp|avif|svg)(\?.*)?$/i;

/** Une valeur ressemble-t-elle à un visuel (URL, chemin, nom de fichier) ? */
export const looksLikeImage = (value: string): boolean => {
  const candidate = (value || '').trim();
  if (!candidate) {
    return false;
  }
  if (IMAGE_PATTERN.test(candidate)) {
    return true;
  }
  if (/^(https?:)?\/\//i.test(candidate) || candidate.charAt(0) === '/') {
    return true;
  }
  return candidate.indexOf('/') !== -1 || /^(image|visuel|photo|assets?)\b/i.test(candidate);
};

/** Héros : une ligne par diapositive (voir IHeroSlide pour le format exact). */
export const parseHeroSlides = (text: string, defaults: IHeroSlide[]): IHeroSlide[] => {
  const lines = nonEmptyLines(text);
  if (lines.length === 0) {
    return defaults;
  }
  const slides: IHeroSlide[] = [];
  lines.forEach((line) => {
    const parts = splitParts(line);
    if (parts.length === 0) {
      return;
    }
    const hasImage = looksLikeImage(parts[0]);
    const textOnly = !hasImage && parts[0] === '';
    const slide: IHeroSlide = {
      imageUrl: hasImage ? parts[0] : '',
      eyebrow: '',
      title: '',
      subtitle: '',
      ctaLabel: '',
      ctaUrl: ''
    };
    if (hasImage || textOnly) {
      // « image | sur-titre | titre | accroche | bouton | lien » — les champs
      // vides restent facultatifs.
      const values = parts.slice(1);
      slide.eyebrow = values[0] || '';
      slide.title = values[1] || '';
      slide.subtitle = values[2] || '';
      slide.ctaLabel = values[3] || '';
      slide.ctaUrl = values[4] || '';
    } else {
      // Raccourci « titre | accroche | bouton | lien » (diapositive textuelle).
      slide.title = parts[0] || '';
      slide.subtitle = parts[1] || '';
      slide.ctaLabel = parts[2] || '';
      slide.ctaUrl = parts[3] || '';
    }
    if (slide.title || slide.imageUrl) {
      slides.push(slide);
    }
  });
  return slides.length > 0 ? slides : defaults;
};

/** Route interne du portail : #vue ou #vue?param=valeur (aussi #vue/12). */
export interface IPortalRoute {
  view: string;
  params: { [key: string]: string };
}

export const parsePortalRoute = (rawHash: string): IPortalRoute => {
  const raw = (rawHash || '').replace(/^#/, '').trim();
  if (!raw) {
    return { view: '', params: {} };
  }
  const separator = raw.indexOf('?');
  const path = separator === -1 ? raw : raw.slice(0, separator);
  const params: { [key: string]: string } = {};
  if (separator !== -1) {
    raw
      .slice(separator + 1)
      .split('&')
      .forEach((pair) => {
        const chunks = pair.split('=');
        const key = decodeURIComponent(chunks[0] || '').toLowerCase();
        if (key) {
          params[key] = decodeURIComponent(chunks.slice(1).join('=') || '');
        }
      });
  }
  const segments = path.split('/').filter((segment) => !!segment);
  const view = (segments[0] || '').toLowerCase();
  if (segments.length > 1 && !params.id) {
    params.id = segments.slice(1).join('/');
  }
  return { view, params };
};

/**
 * Navigation : une ligne par lien — « Libellé | URL » ou « Libellé | #ancre ».
 * Un libellé peut porter un astérisque final pour être mis en avant (« Espace formateurs* »).
 */
export const parseNavLinks = (text: string, defaults: INavLink[]): INavLink[] => {
  const lines = nonEmptyLines(text);
  if (lines.length === 0) {
    return defaults;
  }
  const links: INavLink[] = [];
  lines.forEach((line) => {
    const parts = splitParts(line);
    if (parts.length >= 2) {
      const safeUrl = safeHref(parts[1]);
      if (safeUrl) {
        const emphasis = parts[0].indexOf('*') !== -1;
        links.push({
          label: parts[0].replace(/\*/g, '').trim(),
          url: safeUrl,
          emphasis
        });
      }
    } else if (parts.length === 1) {
      links.push({ label: parts[0], url: '#', emphasis: false });
    }
  });
  return links.length > 0 ? links : defaults;
};

/** Liens rapides : « icône | titre | sous-titre | URL ». */
export const parseQuickLinks = (text: string, defaults: IQuickLink[]): IQuickLink[] => {
  const lines = nonEmptyLines(text);
  if (lines.length === 0) {
    return defaults;
  }
  const links: IQuickLink[] = [];
  lines.forEach((line) => {
    const parts = splitParts(line);
    if (parts.length >= 2) {
      const url = safeHref(parts.length >= 4 ? parts[3] : (parts[2] || '#'));
      if (url) {
        links.push({
          icon: parts.length >= 4 ? parts[0] : '◆',
          title: parts.length >= 4 ? parts[1] : parts[0],
          subtitle: parts.length >= 4 ? parts[2] : parts[1],
          url
        });
      }
    }
  });
  return links.length > 0 ? links : defaults;
};

/** Indicateurs : « valeur | libellé », 4 maximum affichés. */
export const parseKpis = (text: string): IKpi[] => {
  const lines = nonEmptyLines(text);
  const kpis: IKpi[] = [];
  lines.forEach((line) => {
    const parts = splitParts(line);
    if (parts.length >= 2) {
      kpis.push({ value: parts[0], label: parts.slice(1).join(' ') });
    }
  });
  return kpis.slice(0, 4);
};

/**
 * Annonces du bandeau déroulant : une ligne par annonce.
 *
 *   libellé | lien
 *
 * Le lien peut être une ancre du portail (`#actualite?id=12`, `#sessions`…)
 * ou une URL externe. Sans lien, l'annonce mène à la liste des actualités :
 * une annonce sans destination n'aurait aucun sens au clic.
 */
export const parseAnnouncements = (text: string): IAnnouncement[] => {
  const lines = nonEmptyLines(text);
  const announcements: IAnnouncement[] = [];
  lines.forEach((line, index) => {
    const parts = splitParts(line);
    const label = (parts[0] || '').trim();
    if (!label) {
      return;
    }
    const raw = (parts[1] || '').trim();
    const href = raw ? (safeHref(raw) || '#actualites') : '#actualites';
    announcements.push({ key: `annonce-${index}`, label, href });
  });
  return announcements;
};

/**
 * Conteneur qui défile réellement.
 *
 * · Plein écran BBI : l'hôte `[data-bbi-scroller]` (calque fixe qui couvre toute
 *   la fenêtre) défile, pas la fenêtre ;
 * · page moderne SharePoint : la zone `contentScrollRegion` défile, pas
 *   la fenêtre non plus (c'est pourquoi `window.scrollY` valait toujours 0) ;
 * · sinon : la fenêtre.
 */
export type ScrollerTarget = HTMLElement | Window;

export const findScroller = (node: HTMLElement | null): ScrollerTarget => {
  let current: HTMLElement | null = node ? node.parentElement : null;
  while (current && current !== document.body && current !== document.documentElement) {
    if (current.hasAttribute('data-bbi-scroller')) {
      return current;
    }
    const overflowY = window.getComputedStyle(current).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight + 1) {
      return current;
    }
    current = current.parentElement;
  }
  return window;
};

export const isInBbiOverlay = (node: HTMLElement | null): boolean =>
  !!node && !!node.closest('[data-bbi-scroller]');

export const getScrollTop = (target: ScrollerTarget): number =>
  target instanceof Window
    ? window.pageYOffset || document.documentElement.scrollTop || 0
    : target.scrollTop;

export const scrollToTop = (target: ScrollerTarget, top: number, smooth: boolean = true): void => {
  const options: ScrollToOptions = { top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' };
  if (target instanceof Window) {
    window.scrollTo(options);
  } else if (typeof target.scrollTo === 'function') {
    target.scrollTo(options);
  } else {
    target.scrollTop = options.top || 0;
  }
};

/** Position d'un élément dans le conteneur qui défile (haut du contenu = 0). */
export const offsetWithinScroller = (target: ScrollerTarget, element: HTMLElement): number => {
  const rect = element.getBoundingClientRect();
  if (target instanceof Window) {
    return rect.top + getScrollTop(target);
  }
  return rect.top - target.getBoundingClientRect().top + target.scrollTop;
};

/**
 * Écoute le défilement de n'importe quel conteneur : l'événement `scroll`
 * ne remonte pas, on l'attrape donc en phase de capture sur le document.
 */
export const onAnyScroll = (handler: () => void): (() => void) => {
  document.addEventListener('scroll', handler, { passive: true, capture: true });
  window.addEventListener('scroll', handler, { passive: true });
  return () => {
    document.removeEventListener('scroll', handler, true);
    window.removeEventListener('scroll', handler);
  };
};

/**
 * Mesure la hauteur du « chrome » SharePoint situé au-dessus de la web part
 * afin de calculer une hauteur de héros réellement plein écran.
 *
 * En plein écran BBI (calque fixe, workbench compris), il n'y a plus aucun
 * chrome au-dessus du portail : décalage, débordement et position de la
 * barre collante valent zéro. Sinon (page publiée, mode édition), on mesure
 * le décalage et le débordement latéral à neutraliser.
 *
 * `ready` doit passer à vrai quand le nœud est monté : le portail affiche
 * d'abord un écran de chargement, sans nœud racine à mesurer.
 */
export const useChromeOffset = (
  ref: React.RefObject<HTMLElement>,
  ready: boolean = true
): void => {
  React.useEffect(() => {
    if (!ready || !ref.current) {
      return undefined;
    }

    const measure = (): void => {
      const node = ref.current;
      if (!node) {
        return;
      }
      if (isInBbiOverlay(node)) {
        node.style.setProperty('--bbi-chrome-offset', '0px');
        node.style.setProperty('--bbi-sticky-top', '0px');
        node.style.setProperty('--bbi-bleed', '0px');
        return;
      }
      const scroller = findScroller(node);
      const rect = node.getBoundingClientRect();
      const scrollerTop = scroller instanceof Window ? 0 : scroller.getBoundingClientRect().top;
      // Distance entre le haut du conteneur qui défile et la web part.
      const chromeTop = Math.max(0, Math.min(140, Math.round(rect.top - scrollerTop + getScrollTop(scroller))));
      node.style.setProperty('--bbi-chrome-offset', `${chromeTop}px`);
      node.style.setProperty('--bbi-sticky-top', '0px');

      // Débordement latéral bord-à-bord : on mesure la marge naturelle
      // (hors débordement déjà appliqué) et on la neutralise.
      const applied = parseFloat(node.style.getPropertyValue('--bbi-bleed')) || 0;
      const naturalLeft = rect.left + applied;
      const innerWidth = window.innerWidth;
      const clientWidth = document.documentElement.clientWidth;
      const rightFromInner = innerWidth - rect.right + applied;
      const rightFromClient = clientWidth - rect.right + applied;
      const naturalRight =
        Math.abs(rightFromInner - naturalLeft) <= Math.abs(rightFromClient - naturalLeft)
          ? rightFromInner
          : rightFromClient;
      const symmetric = Math.abs(naturalLeft - naturalRight) <= 40;
      const candidate = Math.round(Math.min(naturalLeft, naturalRight));
      const bleed = symmetric && candidate > 0 && candidate <= 1200 ? candidate : 0;
      node.style.setProperty('--bbi-bleed', `${bleed}px`);
    };

    measure();
    const timers: number[] = [
      window.setTimeout(measure, 120),
      window.setTimeout(measure, 600),
      window.setTimeout(measure, 1600)
    ];
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('resize', measure);
      window.removeEventListener('load', measure);
    };
  }, [ref, ready]);
};

/** Vrai dès que la page est défilée au-delà du seuil (bouton « retour en haut »). */
export const useScrolled = (
  ref: React.RefObject<HTMLElement>,
  threshold: number = 48,
  ready: boolean = true
): boolean => {
  const [scrolled, setScrolled] = React.useState<boolean>(false);
  React.useEffect(() => {
    if (!ready) {
      return undefined;
    }
    let frame = 0;
    const onScroll = (): void => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setScrolled(getScrollTop(findScroller(ref.current)) > threshold);
      });
    };
    const off = onAnyScroll(onScroll);
    onScroll();
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      off();
    };
  }, [ref, threshold, ready]);
  return scrolled;
};

/** Section visible en cours (surbrillance du menu). */
export const useActiveSection = (ids: string[]): string => {
  const [active, setActive] = React.useState<string>('');
  React.useEffect(() => {
    let frame = 0;
    const evaluate = (): void => {
      let current = '';
      ids.forEach((id) => {
        const node = document.getElementById(id);
        if (!node) {
          return;
        }
        const rect = node.getBoundingClientRect();
        if (rect.top <= 160) {
          current = id;
        }
      });
      setActive(current);
    };
    const onScroll = (): void => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        evaluate();
      });
    };
    const off = onAnyScroll(onScroll);
    evaluate();
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      off();
    };
  }, [ids]);
  return active;
};
