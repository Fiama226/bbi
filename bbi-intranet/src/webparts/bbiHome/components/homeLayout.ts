import * as React from 'react';

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

/** Séparateur tolérant : « | », « ; » ou tabulation. */
const splitParts = (line: string): string[] => line.split(/\s*[|;]\s*|\t+/).map((part) => part.trim());

const nonEmptyLines = (text: string): string[] =>
  (text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !!line && line.indexOf('#') !== 0);

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
      const emphasis = parts[0].indexOf('*') !== -1;
      links.push({
        label: parts[0].replace(/\*/g, '').trim(),
        url: parts[1],
        emphasis
      });
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
      links.push({
        icon: parts.length >= 4 ? parts[0] : '◆',
        title: parts.length >= 4 ? parts[1] : parts[0],
        subtitle: parts.length >= 4 ? parts[2] : parts[1],
        url: parts.length >= 4 ? parts[3] : (parts[2] || '#')
      });
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
 * Mesure la hauteur du « chrome » SharePoint situé au-dessus de la web part
 * (barre de suite Microsoft, en-tête de site…) afin de calculer une hauteur
 * de héros réellement plein écran, y compris dans le workbench.
 *
 * Expose aussi `--bbi-sticky-top` : le positionnement de la barre de
 * navigation collante. Sur le workbench hébergé, le bandeau supérieur défile
 * avec la page → la barre remonte progressivement jusqu'en haut de l'écran,
 * comme sur un site classique. Sur une page moderne, le chrome SharePoint
 * reste visible → offset constant.
 */
export const useChromeOffset = (
  ref: React.RefObject<HTMLElement>
): void => {
  React.useEffect(() => {
    if (!ref.current) {
      return undefined;
    }

    const isWorkbench =
      /workbench\.aspx/i.test(window.location.href) ||
      !!document.getElementById('workbenchPageContent');

    let chromeTop = 0;

    const applyStickyTop = (): void => {
      const node = ref.current;
      if (!node) {
        return;
      }
      const stickyTop = isWorkbench
        ? Math.max(0, Math.round(chromeTop - window.scrollY))
        : chromeTop;
      node.style.setProperty('--bbi-sticky-top', `${stickyTop}px`);
    };

    const measure = (): void => {
      const node = ref.current;
      if (!node) {
        return;
      }
      const rect = node.getBoundingClientRect();

      // 1) Hauteur du « chrome » SharePoint au-dessus de la web part.
      const top = Math.round(rect.top + window.scrollY);
      chromeTop = Math.max(0, Math.min(140, top));
      node.style.setProperty('--bbi-chrome-offset', `${chromeTop}px`);

      // 2) Débordement latéral bord-à-bord : on mesure la marge naturelle
      //    (hors débordement déjà appliqué) et on la neutralise. Plafond
      //    volontairement large : même sur écran ultra-large, le portail
      //    doit occuper toute la largeur comme un site classique.
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

      applyStickyTop();
    };

    measure();
    const timers: number[] = [
      window.setTimeout(measure, 120),
      window.setTimeout(measure, 600),
      window.setTimeout(measure, 1600)
    ];
    let frame = 0;
    const onScroll = (): void => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        applyStickyTop();
      });
    };
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('resize', measure);
      window.removeEventListener('load', measure);
      window.removeEventListener('scroll', onScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [ref]);
};

/** Vrai dès que la page est défilée au-delà du seuil (barre de navigation opaque). */
export const useScrolled = (threshold: number = 48): boolean => {
  const [scrolled, setScrolled] = React.useState<boolean>(false);
  React.useEffect(() => {
    let frame = 0;
    const onScroll = (): void => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setScrolled(window.scrollY > threshold);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener('scroll', onScroll);
    };
  }, [threshold]);
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
    window.addEventListener('scroll', onScroll, { passive: true });
    evaluate();
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener('scroll', onScroll);
    };
  }, [ids]);
  return active;
};
