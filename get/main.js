/**
 * Runs /get/ and its translations (/get/tr/ …). The page's configuration sits
 * on <html> as data attributes, filled in when the site is published
 * (scripts/publish-site.mjs); what happens on arrival — the App Store, or the
 * note for an Android visitor — is in redirect.js, where it can be tested.
 */

import { arrive } from './redirect.js';

arrive(window, document);
