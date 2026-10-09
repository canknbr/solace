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
 * Solace Tree is only on iPhone. Someone opening a shared link on Android is
 * not sent to an App Store page they cannot use: the page tells them,
 * plainly and in the language of the link, that it is an iPhone app.
 */

const CAMPAIGN = /^[a-z0-9_-]{1,30}$/;
const ANDROID = /\bAndroid\b/i;
const DIGITS = /^\d+$/;

export const SEARCH_URL = 'https://apps.apple.com/search?term=Solace%20Tree';

/** The campaign from a query string: `ct` when it is safe, otherwise "web". */
export function campaignFrom(search) {
  const value = new URLSearchParams(search).get('ct');
  return value !== null && CAMPAIGN.test(value) ? value : 'web';
}

/**
 * Where to send someone. A value that is not digits — including a
 * placeholder the build left unfilled — counts as not configured.
 */
export function appStoreUrl({ appStoreId, providerToken, campaign }) {
  const id = DIGITS.test(appStoreId ?? '') ? appStoreId : null;
  const token = DIGITS.test(providerToken ?? '') ? providerToken : null;
  if (id && token) {
    return `https://apps.apple.com/app/apple-store/id${id}?pt=${token}&ct=${campaign}&mt=8`;
  }
  if (id) return `https://apps.apple.com/app/id${id}`;
  return SEARCH_URL;
}

/** Forward this page's visitor; returns where they were sent. */
export function redirect(win, { appStoreId, providerToken }) {
  const target = appStoreUrl({
    appStoreId,
    providerToken,
    campaign: campaignFrom(win.location.search),
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
  const { appStoreId, providerToken } = doc.documentElement.dataset;
  const target = redirect(win, { appStoreId, providerToken });
  // For the moment before the browser leaves, or a browser that will not.
  doc.getElementById('app-store-link')?.setAttribute('href', target);
  return target;
}
