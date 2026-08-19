/**
 * Reference Checker Engine
 * Validates article URLs before publishing to ensure all news references
 * point to real, accessible sources. Rejects placeholder/example URLs.
 */

const BLOCKED_DOMAINS = [
  'example.com', 'example.org', 'example.net',
  'test.com', 'localhost', '127.0.0.1', 'placeholder.com',
  'dummy.com', 'fake.com', 'sample.com', 'demo.com',
  'yoursite.com', 'website.com', 'domain.com',
];

const TRUSTED_DOMAINS = [
  // Major MENA news agencies
  'aljazeera.com', 'aljazeera.net', 'alarabiya.net', 'middleeasteye.net',
  'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'theguardian.com',
  'nytimes.com', 'washingtonpost.com', 'ft.com', 'bloomberg.com',
  'cnn.com', 'france24.com', 'dw.com', 'rfi.fr',
  // Arab language outlets
  'skynewsarabia.com', 'aawsat.com', 'arabi21.com', 'alquds.com',
  'almasryalyoum.com', 'youm7.com', 'masrawy.com', 'elwatannews.com',
  'albawabhnews.com', 'dostor.org', 'tahrirnews.com',
  // Gulf outlets
  'khaleejtimes.com', 'gulfnews.com', 'thenationalnews.com',
  'arabnews.com', 'saudigazette.com.sa', 'riyadhdaily.com',
  'zawya.com', 'menafn.com', 'albayan.ae', 'alittihad.ae',
  // Levant outlets
  'naharnet.com', 'dailystar.com.lb', 'annahar.com', 'lorientlejour.com',
  'jordantimes.com', 'petra.gov.jo', 'ammonews.net',
  'sana.sy', 'tishreen.info',
  // North Africa
  'moroccoworldnews.com', 'hespress.com', 'le360.ma',
  'tsa-algerie.com', 'elwatan.com', 'elmoujahid.com',
  'tunisienumerique.com', 'businessnews.com.tn',
  // International
  'haaretz.com', 'timesofisrael.com', 'jpost.com',
  'tehrantimes.com', 'irna.ir', 'presstv.ir',
  'turkishminute.com', 'hurriyetdailynews.com', 'dailysabah.com',
  // Wire services
  'wam.ae', 'spa.gov.sa', 'kuna.net.kw', 'qna.org.qa',
  'mena.org.eg', 'tap.info.tn', 'map.ma', 'aps.dz',
  // UN / official
  'un.org', 'unhcr.org', 'ocha.org', 'reliefweb.int',
  'worldbank.org', 'imf.org', 'who.int', 'unicef.org',
  // Google News
  'news.google.com',
];

export interface ReferenceCheckResult {
  isValid: boolean;
  isBlocked: boolean;
  isTrusted: boolean;
  domain: string;
  reason?: string;
  score: number; // 0-100 trust score
}

export function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function checkReference(url: string): ReferenceCheckResult {
  if (!url || url.trim() === '') {
    return { isValid: false, isBlocked: true, isTrusted: false, domain: '', reason: 'Empty URL', score: 0 };
  }

  // Must start with http or https
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { isValid: false, isBlocked: true, isTrusted: false, domain: '', reason: 'Invalid URL scheme', score: 0 };
  }

  const domain = extractDomain(url);
  if (!domain) {
    return { isValid: false, isBlocked: true, isTrusted: false, domain: '', reason: 'Cannot parse domain', score: 0 };
  }

  // Check blocked domains
  const isBlocked = BLOCKED_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));
  if (isBlocked) {
    return { isValid: false, isBlocked: true, isTrusted: false, domain, reason: `Blocked domain: ${domain}`, score: 0 };
  }

  // Check for placeholder patterns in path
  const urlLower = url.toLowerCase();
  const placeholderPatterns = [
    '/article-1', '/article-2', '/article-3', '/article-4', '/article-5',
    '/news-1', '/news-2', '/post-1', '/post-2',
    'example', 'placeholder', 'dummy', 'test-article',
    '/article-id/', '/article-slug',
  ];
  const hasPlaceholder = placeholderPatterns.some(p => urlLower.includes(p));
  if (hasPlaceholder) {
    return { isValid: false, isBlocked: true, isTrusted: false, domain, reason: 'Placeholder URL pattern detected', score: 0 };
  }

  // Check trusted domains
  const isTrusted = TRUSTED_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));

  // Score calculation
  let score = 50; // base score for unknown domains
  if (isTrusted) score = 90;
  if (url.startsWith('https://')) score += 5;
  if (domain.includes('.gov.') || domain.endsWith('.gov')) score += 10;
  if (domain.includes('.org')) score += 5;
  score = Math.min(100, score);

  return { isValid: true, isBlocked: false, isTrusted, domain, score };
}

export function checkReferences(urls: string[]): { valid: string[]; invalid: string[]; results: Record<string, ReferenceCheckResult> } {
  const results: Record<string, ReferenceCheckResult> = {};
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const url of urls) {
    const result = checkReference(url);
    results[url] = result;
    if (result.isValid) {
      valid.push(url);
    } else {
      invalid.push(url);
    }
  }

  return { valid, invalid, results };
}

/**
 * Validates an article before insertion.
 * Returns the article with a verification status and rejects if URL is invalid.
 */
export function validateArticleBeforeInsert(article: {
  url: string;
  title: string;
  agencyId: number;
  [key: string]: any;
}): { isValid: boolean; reason?: string; verificationScore: number } {
  const urlCheck = checkReference(article.url);

  if (!urlCheck.isValid) {
    return {
      isValid: false,
      reason: urlCheck.reason || 'Invalid URL',
      verificationScore: 0,
    };
  }

  // Title must be non-empty and not a placeholder
  if (!article.title || article.title.trim().length < 10) {
    return { isValid: false, reason: 'Title too short or empty', verificationScore: 0 };
  }

  const titleLower = article.title.toLowerCase();
  const placeholderTitles = ['test article', 'sample news', 'placeholder', 'lorem ipsum', 'untitled'];
  if (placeholderTitles.some(p => titleLower.includes(p))) {
    return { isValid: false, reason: 'Placeholder title detected', verificationScore: 0 };
  }

  return {
    isValid: true,
    verificationScore: urlCheck.score,
  };
}

/**
 * Batch check multiple article references.
 */
export async function batchCheckReferences(
  articles: Array<{ url: string; title?: string }>
): Promise<Array<{ url: string; title?: string; result: ReferenceCheckResult }>> {
  return articles.map(a => ({
    url: a.url,
    title: a.title,
    result: checkReference(a.url),
  }));
}

/**
 * Filter a list of articles, returning only those with valid references.
 * Articles with example.com or placeholder URLs are excluded.
 */
export function filterVerifiedArticles<T extends { url: string; title?: string | null }>(articles: T[]): T[] {
  return articles.filter(a => {
    if (!a.url) return false;
    const check = checkReference(a.url);
    return check.isValid;
  });
}
