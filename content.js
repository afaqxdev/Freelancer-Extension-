// Reads data Fiverr already embeds in the page you opened. No extra requests to Fiverr.
function initialProps() {
  const el = document.getElementById('perseus-initial-props');
  try { return el ? JSON.parse(el.textContent) : null; } catch { return null; }
}

function searchData(p) {
  const gigs = p?.listings?.[0]?.gigs;
  if (!Array.isArray(gigs)) return null;
  const urlQuery = new URLSearchParams(location.search).get('query');
  const query = p.displayData?.searchComponentData?.query || urlQuery || document.title;
  // Fiverr can switch searches without a page load, leaving the embedded data from the previous search.
  if (urlQuery && query.trim().toLowerCase() !== urlQuery.trim().toLowerCase()) return { kind: 'stale', query: urlQuery };
  return {
    kind: 'search',
    query,
    total: p.rawListingData?.num_found ?? p.appData?.pagination?.total ?? null,
    page: Number(new URLSearchParams(location.search).get('page') || 1),
    gigs: gigs.map((g) => ({
      pos: g.pos,
      title: g.title,
      seller: g.seller_name,
      level: g.seller_level || 'new',
      country: g.seller_country,
      rating: g.buying_review_rating ?? g.seller_rating?.score ?? null,
      reviews: g.buying_review_rating_count ?? g.seller_rating?.count ?? 0,
      price: g.price_i ?? g.packages?.recommended?.price ?? null,
      days: g.packages?.recommended?.duration ?? null,
      pro: !!g.is_pro,
      choice: !!g.is_fiverr_choice,
      ad: !!g.is_featured,
      attrs: (g.metadata || []).flatMap((m) => m.value || []),
      url: 'https://www.fiverr.com' + g.gig_url,
    })),
  };
}

// --- gig page ---
// Known gig-page shape (verified on a live gig, Oct 2026): description.content (HTML), faq.questionsAndAnswers,
// tags.tagsGigList, packages.packageList with price in USD cents and duration in hours.
// The key-name walk below is only a fallback in case Fiverr renames these.
function walk(o, visit, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 14) return;
  for (const [k, v] of Object.entries(o)) {
    visit(k, v);
    walk(v, visit, depth + 1);
  }
}

// Drops ids, urls, images and tracking so the JSON stays small enough to send to Claude.
function slim(o, depth = 0) {
  if (o == null || typeof o !== 'object') return typeof o === 'string' ? o.slice(0, 300) : o;
  if (depth > 4) return undefined;
  if (Array.isArray(o)) return o.slice(0, 12).map((x) => slim(x, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (/(^id$|Id$|_id$|url|img|image|asset|track|currency|impression|attachment|video)/i.test(k)) continue;
    const s = slim(v, depth + 1);
    if (s !== undefined && s !== '' && !(Array.isArray(s) && !s.length)) out[k] = s;
  }
  return out;
}

const stripHtml = (s) => s.replace(/<br\s*\/?>|<\/p>|<\/li>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();

const tagName = (t) => (typeof t === 'string' ? t : t?.name || t?.slug || t?.title || '').toLowerCase().replace(/[-_]/g, ' ').trim();

// One readable line per package so Claude never sees cents/hours.
function packageText(list) {
  return list.map((pk, i) => {
    const days = pk.duration ? Math.max(1, Math.round(pk.duration / 24)) : '?';
    const r = pk.revisions;
    const rev = !r || r.included === false ? '0' : r.value === -1 ? 'unlimited' : r.value ?? '?';
    const feats = (pk.features || []).filter((f) => f.included !== false)
      .map((f) => { const name = f.label || f.name; return f.type === 'BOOLEAN' || f.value == null ? name : `${name}: ${f.value}`; }).filter(Boolean);
    return `${pk.title || pk.name || ['Basic', 'Standard', 'Premium'][i]}: $${Math.round(pk.price / 100)}, ${days} days, ${rev} revisions. ${stripHtml(pk.description || '')}${feats.length ? ' | Includes: ' + feats.join(', ') : ''}`;
  }).join('\n');
}

// Fiverr's bot check ("It needs a human touch") can show on any URL.
const isCaptcha = (p) => /human touch/i.test(document.title) || (!p && /human touch/i.test(document.body?.innerText || ''));

// Gig URLs are fiverr.com/<seller>/<gig-slug>. Everything else (seller edit pages, inbox, categories, share
// links) used to fall through to gigData and be treated as a competitor gig.
function isGigPath() {
  const seg = location.pathname.split('/').filter(Boolean);
  return seg.length === 2 && !['sellers', 'users', 'categories', 'inbox', 's', 'search'].includes(seg[0]);
}

function gigData(p) {
  let description = p?.description?.content || '';
  let faq = p?.faq?.questionsAndAnswers || null;
  const tags = new Set((p?.tags?.tagsGigList || []).map(tagName).filter(Boolean));
  const list = p?.packages?.packageList;
  let packages = Array.isArray(list) && list.length ? packageText(list) : '';

  // fallback for an unknown shape
  if (p && (!description || !faq || !tags.size || !packages)) {
    let raw = null;
    const isObjArray = (v, pred) => Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object' && pred(x));
    walk(p, (k, v) => {
      if (!tags.size && /^tags/i.test(k) && Array.isArray(v)) v.map(tagName).filter((t) => t && t.length < 60).forEach((t) => tags.add(t));
      if (!p.description?.content && /^(content|description|text)$/i.test(k) && typeof v === 'string' && v.length > description.length && v.length > 150) description = v;
      if (!raw && isObjArray(v, (x) => 'price' in x && ('title' in x || 'name' in x))) raw = v;
      if (!faq && isObjArray(v, (x) => 'question' in x && 'answer' in x)) faq = v;
    });
    if (!packages && raw) packages = JSON.stringify(slim(raw)).slice(0, 2500);
  }

  if (!description) description = document.querySelector('.description-content, [class*="description"]')?.innerText || '';
  return {
    kind: 'gig',
    captcha: isCaptcha(p),
    url: location.href.split('?')[0],
    title: document.querySelector('h1')?.textContent.trim() || document.title,
    tags: [...tags].slice(0, 15),
    description: stripHtml(description).slice(0, 1500),
    packages: packages.slice(0, 2500),
    faq: (faq || []).slice(0, 8).map((f) => ({ q: stripHtml(String(f.question)).slice(0, 200), a: stripHtml(String(f.answer)).slice(0, 400) })),
    // last resort so Claude still sees something when nothing matched
    pageText: description || packages ? '' : (document.querySelector('main') || document.body)?.innerText.slice(0, 4000) || '',
  };
}

// --- seller profile (fiverr.com/<username>), shape verified on a live profile, Oct 2026 ---
function profileData(p) {
  const s = p?.seller;
  // gig pages carry the same seller block, so only fiverr.com/<username> without packages is a profile
  const onProfileUrl = location.pathname.split('/').filter(Boolean).length === 1;
  if (!s || !onProfileUrl || p.packages?.packageList || !('oneLinerTitle' in s || 'activeStructuredSkills' in s)) return null;
  const prices = (p.gigsData || []).map((g) => g.price_i).filter((x) => x != null);
  return {
    platform: 'fiverr',
    kind: 'profile',
    url: `https://www.fiverr.com/${s.user?.name || location.pathname.split('/')[1]}`,
    name: s.user?.profile?.displayName || s.user?.name,
    title: s.oneLinerTitle || '',
    overview: String(s.description || '').slice(0, 5000),
    skills: (s.activeStructuredSkills || []).map((k) => k.name).filter(Boolean),
    rate: prices.length ? Math.min(...prices) : null, // lowest gig start price; Fiverr profiles have no hourly rate by default
    rating: s.rating?.score ?? null,
    reviews: s.rating?.count ?? 0,
    jobs: null,
    hours: null,
    badge: String(s.sellerLevel || s.achievementLevel || 'new').toLowerCase(),
    jss: null,
    hireAgain: null,
    portfolio: s.portfolios?.totalCount ?? 0,
    certs: (s.certifications || []).length,
    education: (s.activeEducations || []).length,
    employment: (s.workExperiences || []).length,
    languages: (s.user?.languages || []).map((l) => `${l.code} ${String(l.level || '').toLowerCase().replace(/_/g, ' ')}`),
    video: !!s.introVideo?.url,
    response: s.responseTime?.inHours != null ? `${s.responseTime.inHours}h` : null,
    memberSince: s.user?.joinedAt ? new Date(s.user.joinedAt * 1000).toISOString() : null,
    gigs: s.approvedGigsCount ?? (s.gigs?.nodes || []).length,
    pro: !!s.isPro,
  };
}

// guard: the panel may inject this file into a tab that already has it
if (!globalThis.__gigSpyListening) {
  globalThis.__gigSpyListening = true;
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg !== 'extract') return;
    const p = initialProps();
    reply(searchData(p) || profileData(p) || (isGigPath() ? gigData(p) : { kind: 'other', captcha: isCaptcha(p), url: location.href.split('?')[0] }));
  });
}
