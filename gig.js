// Fiverr gig editor limits. Adjust here if Fiverr changes them.
const RULES = { platform: 'Fiverr', prefix: 'I will ', title: 80, titleMin: 15, tags: 5, tag: 20, descMin: 120, desc: 1200, pkgName: 35, pkgDesc: 100, faqA: 300, minPrice: 5, priceStep: 5 };
// shortcut: Upwork Project Catalog limits are not published where we could verify them; these mirror Fiverr's and the UI says so.
const UPWORK_RULES = { ...RULES, platform: 'Upwork', prefix: 'You will get ', priceStep: 1, unverified: true }; // live catalog prices like $499, $4999 → no $5 steps
const rulesFor = (platform) => (platform === 'upwork' ? UPWORK_RULES : RULES);

const GIG_SCHEMA = {
  type: 'object',
  properties: {
    titles: { type: 'array', items: { type: 'string' }, description: '3 titles, each a full title starting with "I will", max 80 chars INCLUDING "I will "' },
    category: { type: 'string' },
    subcategory: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' }, description: 'exactly 5, letters/numbers/spaces only, max 20 chars each' },
    description: { type: 'string', description: '120-1200 chars, plain text with line breaks and • bullets' },
    packages: {
      type: 'array',
      description: 'exactly 3: Basic, Standard, Premium',
      items: {
        type: 'object',
        properties: {
          tier: { type: 'string' },
          name: { type: 'string', description: 'max 35 chars' },
          description: { type: 'string', description: 'max 100 chars' },
          price: { type: 'number' },
          days: { type: 'number' },
          revisions: { type: 'string' },
          includes: { type: 'array', items: { type: 'string' } },
        },
        required: ['tier', 'name', 'description', 'price', 'days', 'revisions', 'includes'],
      },
    },
    extras: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, price: { type: 'number' }, days: { type: 'number' } }, required: ['name', 'price'] } },
    faq: { type: 'array', items: { type: 'object', properties: { q: { type: 'string' }, a: { type: 'string', description: 'max 300 chars' } }, required: ['q', 'a'] } },
    requirements: { type: 'array', items: { type: 'string' } },
    image_idea: { type: 'string' },
    why_it_wins: { type: 'array', items: { type: 'string' } },
    competitor_insights: { type: 'array', items: { type: 'string' }, description: 'what the top gigs do in descriptions/packages/FAQ and the gaps they leave' },
    action_plan: {
      type: 'array',
      description: '8-12 ordered steps from publishing to first orders and ranking, each grounded in this data',
      items: {
        type: 'object',
        properties: { when: { type: 'string', description: 'e.g. "Day 1", "Week 2"' }, action: { type: 'string' }, why: { type: 'string', description: 'the data point that justifies it' } },
        required: ['when', 'action', 'why'],
      },
    },
    opportunity: {
      type: 'object',
      description: 'Gig Opportunity Report: the evidence-based case for this positioning, written BEFORE choosing the copy',
      properties: {
        best_keyword: { type: 'string' },
        evidence: { type: 'string', description: 'numbers from the data that support the keyword choice (hypothesis, not a guarantee)' },
        target_buyer: { type: 'string' },
        differentiator: { type: 'string', description: 'why a buyer picks me over the top gigs, based only on ABOUT ME' },
        price_range: { type: 'string', description: 'supported by comparable gigs, with the numbers' },
        competitor_gaps: { type: 'array', items: { type: 'string' } },
        test_first: { type: 'array', items: { type: 'string' }, description: 'what to change/measure first after publishing, one variable at a time' },
      },
      required: ['best_keyword', 'evidence', 'target_buyer', 'differentiator', 'price_range', 'competitor_gaps', 'test_first'],
    },
    claims_to_verify: { type: 'array', items: { type: 'string' }, description: 'every claim in the gig that needs proof (portfolio item, experience, result) before publishing' },
  },
  required: ['opportunity', 'titles', 'category', 'subcategory', 'tags', 'description', 'packages', 'extras', 'faq', 'requirements', 'image_idea', 'why_it_wins', 'competitor_insights', 'action_plan', 'claims_to_verify'],
};

// Models sometimes omit a field or return a nested array as a JSON string; coerce to the schema shape so rendering never crashes.
function normalizeGig(g = {}) {
  const parse = (v) => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return v; } };
  const arr = (v) => { v = parse(v); return Array.isArray(v) ? v : v == null || v === '' ? [] : [v]; };
  const str = (v) => (v == null ? '' : String(v));
  return {
    titles: arr(g.titles).map(str),
    category: str(g.category),
    subcategory: str(g.subcategory),
    tags: arr(g.tags).map(str),
    description: str(g.description),
    packages: arr(g.packages).map((p) => ({ tier: str(p.tier), name: str(p.name), description: str(p.description), price: Number(p.price) || 0, days: Number(p.days) || 0, revisions: str(p.revisions), includes: arr(p.includes).map(str) })),
    extras: arr(g.extras).map((x) => ({ name: str(x.name), price: Number(x.price) || 0, days: Number(x.days) || 0 })),
    faq: arr(g.faq).map((f) => ({ q: str(f.q), a: str(f.a) })),
    requirements: arr(g.requirements).map(str),
    image_idea: str(g.image_idea),
    why_it_wins: arr(g.why_it_wins).map(str),
    competitor_insights: arr(g.competitor_insights).map(str),
    action_plan: arr(g.action_plan).map((s) => ({ when: str(s.when), action: str(s.action ?? s), why: str(s.why) })),
    opportunity: ((o) => ({ best_keyword: str(o.best_keyword), evidence: str(o.evidence), target_buyer: str(o.target_buyer), differentiator: str(o.differentiator), price_range: str(o.price_range), competitor_gaps: arr(o.competitor_gaps).map(str), test_first: arr(o.test_first).map(str) }))(parse(g.opportunity) || {}),
    claims_to_verify: arr(g.claims_to_verify).map(str),
  };
}

// Mechanical fixes done in code so Claude is only asked about wording problems.
// Every change is pushed to `log` so the user can see what code altered.
function autoFixGig(gig, log = [], rules = RULES) {
  const g = normalizeGig(gig);
  const round5 = (n) => Math.max(rules.minPrice, Math.round(n / rules.priceStep) * rules.priceStep);
  const fitTag = (t) => {
    t = t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    while (t.length > rules.tag && t.includes(' ')) t = t.slice(0, t.lastIndexOf(' '));
    return t.slice(0, rules.tag);
  };
  g.tags.forEach((t) => { const f = fitTag(t); if (f !== t) log.push(`Tag "${t}" → "${f}"`); });
  const tags = [...new Set(g.tags.map(fitTag).filter(Boolean))];
  if (tags.length > rules.tags) log.push(`Dropped extra tags: ${tags.slice(rules.tags).join(', ')}`);
  else if (tags.length < g.tags.length) log.push('Removed duplicate tags');
  g.tags = tags.slice(0, rules.tags);
  g.titles = g.titles.map((t) => {
    const clean = t.trim().replace(/\s+/g, ' ');
    // drop either platform's prefix ("I will" / "You will get") before adding the right one
    const fixed = rules.prefix + clean.replace(/^(i will|you will get)\s+/i, '');
    if (fixed !== clean) log.push(`Title now starts with "${rules.prefix.trim()}": ${fixed}`);
    return fixed;
  });
  g.packages.forEach((p) => {
    const price = round5(p.price), days = Math.max(1, Math.round(p.days));
    if (price !== p.price) log.push(`${p.tier || 'Package'} price $${p.price} → $${price}`);
    if (days !== p.days) log.push(`${p.tier || 'Package'} delivery ${p.days} → ${days} days`);
    Object.assign(p, { price, days });
  });
  g.extras.forEach((x) => { const price = round5(x.price); if (price !== x.price) log.push(`Extra "${x.name}" price $${x.price} → $${price}`); x.price = price; });
  return g;
}

const CONTACT = /(@[a-z0-9-]+\.[a-z]{2,}|https?:\/\/|www\.|whatsapp|skype|telegram|\+?\d[\d\s-]{8,}\d)/i;

// Returns [{field, msg}] for every Fiverr rule the gig breaks.
function validateGig(g, rules = RULES) {
  const bad = [];
  const add = (field, msg) => bad.push({ field, msg });
  (g.titles || []).forEach((t, i) => {
    if (!t.startsWith(rules.prefix)) add(`titles[${i}]`, `must start with "${rules.prefix}"`);
    if (t.length > rules.title) add(`titles[${i}]`, `${t.length}/${rules.title} chars`);
    if (t.length < rules.titleMin) add(`titles[${i}]`, 'too short');
  });
  if ((g.tags || []).length !== rules.tags) add('tags', `needs exactly ${rules.tags} tags`);
  (g.tags || []).forEach((t, i) => {
    if (t.length > rules.tag) add(`tags[${i}]`, `"${t}" is ${t.length}/${rules.tag} chars`);
    if (/[^a-z0-9 ]/i.test(t)) add(`tags[${i}]`, `"${t}" has symbols (letters/numbers only)`);
  });
  const d = g.description || '';
  if (d.length > rules.desc) add('description', `${d.length}/${rules.desc} chars`);
  if (d.length < rules.descMin) add('description', `too short (${d.length}, min ${rules.descMin})`);
  if ((g.packages || []).length !== 3) add('packages', 'needs 3 packages');
  (g.packages || []).forEach((p, i) => {
    if ((p.name || '').length > rules.pkgName) add(`packages[${i}].name`, `${p.name.length}/${rules.pkgName} chars`);
    if ((p.description || '').length > rules.pkgDesc) add(`packages[${i}].description`, `${p.description.length}/${rules.pkgDesc} chars`);
    if (!(p.price >= rules.minPrice) || p.price % rules.priceStep) add(`packages[${i}].price`, `prices are multiples of $${rules.priceStep}, min $${rules.minPrice}`);
    if (!(p.days >= 1)) add(`packages[${i}].days`, 'delivery must be at least 1 day');
  });
  (g.faq || []).forEach((f, i) => f.a.length > rules.faqA && add(`faq[${i}]`, `answer ${f.a.length}/${rules.faqA} chars`));
  if (CONTACT.test(JSON.stringify(g))) add('all', 'contains contact info / links (against Fiverr ToS)');
  return bad;
}

if (typeof module !== 'undefined') module.exports = { RULES, UPWORK_RULES, rulesFor, GIG_SCHEMA, validateGig, normalizeGig, autoFixGig };
