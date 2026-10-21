/**
 * /get/ — where every shared Solace Tree link lands, on its way to the App Store.
 *
 * The app shares https://…/get/?ct=<source> (lib/links.ts). This page turns
 * that into Apple's campaign link, so App Store Connect can say which kind of
 * sharing (settings, keepsake, the site itself) brought an install —
 * never who shared it. Nothing is stored or sent anywhere else: the page
 * reads its own address and forwards.
 *
 * The campaign token is copied into a link on apple.com, so it is held to a
 * short allowlist of at most 30 characters, Apple's own limit for `ct`;
 * anything else becomes "web". Until the app's App Store id and the provider
 * token are known, the page sends people to the app's page without a
 * campaign, or — before the app exists — to a search.
 *
 * A link may also name one of the custom product pages of store/cpp.json:
 * `?page=keeping-their-memory`. Once that page's App Store id is known (its
 * `ppid` in cpp.json, which the build copies onto <html> as
 * data-product-pages), the App Store link opens that page instead of the
 * default one. A page whose id is not known yet, or a name that is not one of
 * them, opens the default page, as if no page were named.
 *
 * Solace Tree is only on iPhone. Someone opening a shared link on Android is
 * not sent to an App Store page they cannot use: the page tells them,
 * plainly and in the language of the link, that it is an iPhone app.
 */

const CAMPAIGN = /^[a-z0-9_-]{1,30}$/;
const PAGE = /^[a-z0-9-]{1,64}$/;
const PPID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ANDROID = /\bAndroid\b/i;
const DIGITS = /^\d+$/;

export const SEARCH_URL = 'https://apps.apple.com/search?term=Solace%20Tree';

/** The campaign from a query string: `ct` when it is safe, otherwise "web". */
export function campaignFrom(search) {
  const value = new URLSearchParams(search).get('ct');
  return value !== null && CAMPAIGN.test(value) ? value : 'web';
}

/**
 * The custom product pages whose App Store id is known, from the build's
 * JSON (page id → ppid). Anything else — empty, an unfilled placeholder,
 * malformed JSON, an id that is not one — is left out.
 */
export function productPagesFrom(json) {
  let parsed;
  try {
    parsed = JSON.parse(json || '{}');
  } catch {
    return new Map();
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return new Map();
  return new Map(
    Object.entries(parsed).filter(
      ([page, ppid]) => PAGE.test(page) && typeof ppid === 'string' && PPID.test(ppid),
    ),
  );
}

/** The ppid of the custom product page a query names, or null for the default page. */
export function ppidFrom(search, productPages) {
  const page = new URLSearchParams(search).get('page');
  if (page === null || !PAGE.test(page)) return null;
  return productPages.get(page) ?? null;
}

/**
 * Where to send someone. A value that is not digits — including a
 * placeholder the build left unfilled — counts as not configured. A custom
 * product page needs the app's id: a search cannot open one.
 */
export function appStoreUrl({ appStoreId, providerToken, campaign, ppid = null }) {
  const id = DIGITS.test(appStoreId ?? '') ? appStoreId : null;
  const token = DIGITS.test(providerToken ?? '') ? providerToken : null;
  const page = ppid && PPID.test(ppid) ? ppid : null;
  if (id && token) {
    const base = `https://apps.apple.com/app/apple-store/id${id}?pt=${token}&ct=${campaign}&mt=8`;
    return page ? `${base}&ppid=${page}` : base;
  }
  if (id)
    return page
      ? `https://apps.apple.com/app/id${id}?ppid=${page}`
      : `https://apps.apple.com/app/id${id}`;
  return SEARCH_URL;
}

/** Forward this page's visitor; returns where they were sent. */
export function redirect(win, { appStoreId, providerToken, productPages = '' }) {
  const target = appStoreUrl({
    appStoreId,
    providerToken,
    campaign: campaignFrom(win.location.search),
    ppid: ppidFrom(win.location.search, productPagesFrom(productPages)),
  });
  win.location.replace(target);
  return target;
}

/** Whether this visitor is on Android, where there is no Solace Tree to get. */
export function isAndroid(userAgent) {
  return ANDROID.test(userAgent ?? '');
}

/**
 * What the page does when it opens: an Android visitor reads why there is no
 * app for them, and stays; everyone else goes on to the App Store. Returns
 * where they were sent, or null for a visitor who stays.
 */
export function arrive(win, doc) {
  if (isAndroid(win.navigator?.userAgent)) {
    doc.getElementById('app-store')?.setAttribute('hidden', '');
    doc.getElementById('android')?.removeAttribute('hidden');
    return null;
  }
  const { appStoreId, providerToken, productPages } = doc.documentElement.dataset;
  const target = redirect(win, { appStoreId, providerToken, productPages });
  // For the moment before the browser leaves, or a browser that will not.
  doc.getElementById('app-store-link')?.setAttribute('href', target);
  return target;
}
