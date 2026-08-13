import type { ReminderKind, TrainingSchool } from './types.js';

const HOST_WWW = 'www.neopets.com';
const HOST_NCMALL = 'ncmall.neopets.com';

const SCHOOL_PATHS: Record<TrainingSchool, string> = {
  pirate: '/pirates/academy.phtml',
  mystery: '/island/training.phtml',
  ninja: '/island/fight_training.phtml',
};

const PATH_TO_SCHOOL: Record<string, TrainingSchool> = {
  '/pirates/academy.phtml': 'pirate',
  '/island/training.phtml': 'mystery',
  '/island/fight_training.phtml': 'ninja',
};

export type PageClass =
  | { kind: 'training'; school: TrainingSchool }
  | { kind: 'hospital' }
  | { kind: 'grave-danger' }
  | { kind: 'healing-springs' }
  | { kind: 'coltzan' }
  | { kind: 'expellibox' };

export function canonicalTrainingUrl(school: TrainingSchool): string {
  return `https://${HOST_WWW}${SCHOOL_PATHS[school]}?type=status`;
}

export function canonicalUrlForKind(
  kind: ReminderKind,
  school?: TrainingSchool,
): string {
  switch (kind) {
    case 'training':
      return canonicalTrainingUrl(school ?? 'mystery');
    case 'hospital':
      return `https://${HOST_WWW}/hospital/volunteer.phtml`;
    case 'grave-danger':
      return `https://${HOST_WWW}/halloween/gravedanger/`;
    case 'healing-springs':
      return `https://${HOST_WWW}/faerieland/springs.phtml`;
    case 'coltzan':
      return `https://${HOST_WWW}/desert/shrine.phtml`;
    case 'expellibox':
      return `https://${HOST_NCMALL}/mall/shop.phtml?page=giveaway`;
  }
}

/**
 * Runtime admission for content-script pages.
 * Training still requires type=status.
 */
export function classifyPageUrl(urlString: string): PageClass | null {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;

  if (url.hostname === HOST_NCMALL) {
    if (
      url.pathname === '/mall/shop.phtml' &&
      url.searchParams.get('page') === 'giveaway'
    ) {
      return { kind: 'expellibox' };
    }
    // Alternate giveaway surfaces sometimes used
    if (url.pathname.includes('giveaway')) {
      return { kind: 'expellibox' };
    }
    return null;
  }

  if (url.hostname !== HOST_WWW) return null;

  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (PATH_TO_SCHOOL[url.pathname]) {
    if (url.searchParams.get('type') !== 'status') return null;
    return { kind: 'training', school: PATH_TO_SCHOOL[url.pathname]! };
  }

  if (
    path === '/hospital/volunteer' ||
    url.pathname === '/hospital/volunteer.phtml'
  ) {
    return { kind: 'hospital' };
  }

  if (
    path === '/halloween/gravedanger' ||
    path === '/halloween/gravedanger/index' ||
    url.pathname === '/halloween/gravedanger/' ||
    url.pathname === '/halloween/gravedanger/index.phtml'
  ) {
    return { kind: 'grave-danger' };
  }

  if (
    path === '/faerieland/springs' ||
    url.pathname === '/faerieland/springs.phtml'
  ) {
    return { kind: 'healing-springs' };
  }

  if (path === '/desert/shrine' || url.pathname === '/desert/shrine.phtml') {
    return { kind: 'coltzan' };
  }

  return null;
}

export function classifyTrainingUrl(urlString: string): TrainingSchool | null {
  const c = classifyPageUrl(urlString);
  return c?.kind === 'training' ? c.school : null;
}

export function isAllowlistedTrainingUrl(urlString: string): boolean {
  return classifyTrainingUrl(urlString) !== null;
}
