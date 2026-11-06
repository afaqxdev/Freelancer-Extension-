// Profile research: aggregate 40+ competitor profiles into numbers, compare yours against them,
// then Claude turns the evidence into a rewrite. Everything here is pure so it can be tested.
const PROFILE_TARGET = 40;
const PROFILE_MAX = 25; // enough for medians; fewer background pages = less captcha risk

const pctOf = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const quantile = (a, q) => { const s = a.filter((x) => x != null && !Number.isNaN(x)).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null; };
const emojiRe = /\p{Extended_Pictographic}|[\u{1D400}-\u{1D7FF}]/u; // emoji or "bold" unicode letters

// profiles: normalized records from content.js (Fiverr) or upwork.js (Upwork).
function aggregateProfiles(profiles) {
  const n = profiles.length;
  const byProof = [...profiles].sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
  const topN = Math.max(1, Math.round(n / 4));
  const top = byProof.slice(0, topN), rest = byProof.slice(topN);
  const skillCount = {};
  profiles.forEach((p) => new Set((p.skills || []).map((s) => s.toLowerCase())).forEach((s) => (skillCount[s] = (skillCount[s] || 0) + 1)));
  const titleWords = {};
  profiles.forEach((p) => new Set(String(p.title || '').toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 2)).forEach((w) => (titleWords[w] = (titleWords[w] || 0) + 1)));
  const group = (list) => ({
    count: list.length,
    titleLen: quantile(list.map((p) => (p.title || '').length), 0.5),
    overviewLen: quantile(list.map((p) => (p.overview || '').length), 0.5),
    skills: quantile(list.map((p) => (p.skills || []).length), 0.5),
    portfolio: quantile(list.map((p) => p.portfolio), 0.5),
    rate: quantile(list.map((p) => p.rate), 0.5),
    withVideo: pctOf(list.filter((p) => p.video).length, list.length),
    withCerts: pctOf(list.filter((p) => p.certs > 0).length, list.length),
    withEmployment: pctOf(list.filter((p) => p.employment > 0).length, list.length),
    withEducation: pctOf(list.filter((p) => p.education > 0).length, list.length),
    usesEmoji: pctOf(list.filter((p) => emojiRe.test((p.title || '') + (p.overview || '').slice(0, 300))).length, list.length),
    titleHasPipe: pctOf(list.filter((p) => /[|•·]/.test(p.title || '')).length, list.length),
  });
  return {
    n,
    reviews: { median: quantile(profiles.map((p) => p.reviews || 0), 0.5), topCutoff: top.at(-1)?.reviews ?? 0 },
    rate: { p25: quantile(profiles.map((p) => p.rate), 0.25), median: quantile(profiles.map((p) => p.rate), 0.5), p75: quantile(profiles.map((p) => p.rate), 0.75) },
    all: group(profiles),
    top: group(top),
    rest: group(rest),
    skills: Object.entries(skillCount).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([skill, c]) => ({ skill, pct: pctOf(c, n) })),
    titleWords: Object.entries(titleWords).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([word, c]) => ({ word, pct: pctOf(c, n) })),
    topExamples: top.slice(0, 8).map((p) => ({ name: p.name, title: p.title, reviews: p.reviews, rate: p.rate, url: p.url, opening: String(p.overview || '').split('\n').find((l) => l.trim())?.slice(0, 220) || '' })),
  };
}

// Deterministic gaps between your profile and what the top quarter does. Each one cites its numbers.
function profileGaps(own, agg) {
  if (!own) return [];
  const gaps = [];
  const mine = new Set((own.skills || []).map((s) => s.toLowerCase()));
  const missing = agg.skills.filter((s) => s.pct >= 30 && !mine.has(s.skill)).slice(0, 8);
  if (missing.length) gaps.push({ area: 'Skills', gap: `Missing skills used by many competitors: ${missing.map((s) => `${s.skill} (${s.pct}%)`).join(', ')}`, evidence: `${agg.n} profiles studied` });
  const t = agg.top;
  if ((own.overview || '').length < (t.overviewLen || 0) * 0.6) gaps.push({ area: 'Overview', gap: `Your overview is ${(own.overview || '').length} chars; top profiles median ${t.overviewLen}`, evidence: `top ${t.count} by reviews` });
  if ((own.portfolio || 0) < (t.portfolio || 0)) gaps.push({ area: 'Portfolio', gap: `You show ${own.portfolio || 0} portfolio items; top profiles median ${t.portfolio}`, evidence: `top ${t.count} by reviews` });
  if (!own.video && t.withVideo >= 25) gaps.push({ area: 'Video', gap: `No intro video; ${t.withVideo}% of top profiles have one`, evidence: `rest: ${agg.rest.withVideo}%` });
  if (!own.certs && t.withCerts >= 30) gaps.push({ area: 'Certifications', gap: `No certifications; ${t.withCerts}% of top profiles list some`, evidence: `rest: ${agg.rest.withCerts}%` });
  if (!own.employment && t.withEmployment >= 30) gaps.push({ area: 'Experience', gap: `No employment history; ${t.withEmployment}% of top profiles show it`, evidence: `rest: ${agg.rest.withEmployment}%` });
  if (own.rate != null && agg.rate.median != null) {
    if (own.rate < (agg.rate.p25 ?? 0)) gaps.push({ area: 'Rate', gap: `Your rate $${own.rate} is below the bottom quarter ($${agg.rate.p25})`, evidence: `median $${agg.rate.median}, top quarter $${agg.rate.p75}` });
    else if (own.rate > (agg.rate.p75 ?? Infinity) && (own.reviews || 0) < agg.reviews.topCutoff) gaps.push({ area: 'Rate', gap: `Your rate $${own.rate} is above 75% of competitors without matching review count`, evidence: `median $${agg.rate.median}; top profiles have ${agg.reviews.topCutoff}+ reviews` });
  }
  if ((own.title || '').length < (t.titleLen || 0) * 0.5) gaps.push({ area: 'Title', gap: `Your title is ${(own.title || '').length} chars; top profiles median ${t.titleLen}`, evidence: `top title words: ${agg.titleWords.slice(0, 6).map((w) => w.word).join(', ')}` });
  return gaps;
}

// You vs the field, one row per profile field: your value, the field median, the top quarter's median,
// and the share of competitors you beat. Rate/price is shown as a position, not as ahead/behind.
const FIELDS = [
  { key: 'reviews', label: 'Reviews' },
  { key: 'rating', label: 'Rating' },
  { key: 'jobs', label: 'Jobs done', platform: 'upwork' },
  { key: 'jss', label: 'Job Success %', platform: 'upwork' },
  { key: 'rate', label: 'Rate / start price', position: true },
  { key: 'titleLen', label: 'Title length', get: (p) => (p.title || '').length },
  { key: 'overviewLen', label: 'Overview length', get: (p) => (p.overview || '').length },
  { key: 'skills', label: 'Skills listed', get: (p) => (p.skills || []).length },
  { key: 'portfolio', label: 'Portfolio items' },
  { key: 'certs', label: 'Certifications' },
  { key: 'employment', label: 'Employment entries' },
  { key: 'education', label: 'Education entries' },
  { key: 'languages', label: 'Languages', get: (p) => (p.languages || []).length },
  { key: 'video', label: 'Intro video', get: (p) => (p.video ? 1 : 0), yesNo: true },
];

function compareFields(own, profiles, platform) {
  if (!own || !profiles.length) return [];
  const top = [...profiles].sort((a, b) => (b.reviews || 0) - (a.reviews || 0)).slice(0, Math.max(1, Math.round(profiles.length / 4)));
  return FIELDS.filter((f) => !f.platform || f.platform === platform).map((f) => {
    const get = f.get || ((p) => p[f.key]);
    const vals = profiles.map(get).filter((v) => v != null && !Number.isNaN(v));
    const you = get(own);
    if (!vals.length || you == null) return null;
    // ties count half, so matching the field reads as "even", not "behind"
    const beat = Math.round(((vals.filter((v) => v < you).length + vals.filter((v) => v === you).length / 2) / vals.length) * 100);
    const status = f.position ? 'info' : beat >= 60 ? 'ahead' : beat <= 40 ? 'behind' : 'even';
    const fmt = (v) => (v == null ? '?' : f.yesNo ? `${Math.round(v * 100)}% have one` : Math.round(v * 10) / 10);
    return {
      field: f.label,
      you: f.yesNo ? (you ? 'yes' : 'no') : you,
      median: fmt(f.yesNo ? vals.reduce((a, b) => a + b, 0) / vals.length : quantile(vals, 0.5)),
      top: fmt(f.yesNo ? top.map(get).reduce((a, b) => a + b, 0) / top.length : quantile(top.map(get), 0.5)),
      beat,
      status,
    };
  }).filter(Boolean);
}

// Overall standing: average "beat %" over the fields that have a direction.
function standing(rows) {
  const scored = rows.filter((r) => r.status !== 'info');
  return scored.length ? Math.round(scored.reduce((a, r) => a + r.beat, 0) / scored.length) : null;
}

// Search keyword for "your field": your first listed skill, else the first words of your title.
function nicheFromProfile(own) {
  if (!own) return '';
  const skill = (own.skills || [])[0];
  if (skill) return skill.toLowerCase();
  return String(own.title || '').toLowerCase().split(/[|,•·\-–]/)[0].trim().split(/\s+/).slice(0, 3).join(' ');
}

const PROFILE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '2-3 sentences: where my profile stands vs the researched competitors' },
    title_options: { type: 'array', items: { type: 'string' }, description: '3 profile titles/headlines based on what top profiles use' },
    overview: { type: 'string', description: 'rewritten overview/description using only facts from ABOUT ME and MY PROFILE' },
    skills_add: { type: 'array', items: { type: 'object', properties: { skill: { type: 'string' }, why: { type: 'string' } }, required: ['skill', 'why'] } },
    skills_remove: { type: 'array', items: { type: 'object', properties: { skill: { type: 'string' }, why: { type: 'string' } }, required: ['skill', 'why'] } },
    rate: { type: 'object', properties: { recommendation: { type: 'string' }, evidence: { type: 'string' } }, required: ['recommendation', 'evidence'] },
    portfolio_plan: { type: 'array', items: { type: 'string' } },
    priorities: {
      type: 'array',
      description: '6-10 changes in order of impact; each why must cite numbers from the research',
      items: { type: 'object', properties: { change: { type: 'string' }, why: { type: 'string' }, effort: { type: 'string', description: 'low | medium | high' } }, required: ['change', 'why', 'effort'] },
    },
    what_top_profiles_do: { type: 'array', items: { type: 'string' } },
    claims_to_verify: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'title_options', 'overview', 'skills_add', 'skills_remove', 'rate', 'portfolio_plan', 'priorities', 'what_top_profiles_do', 'claims_to_verify'],
};

function normalizeProfileReport(r = {}) {
  const arr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
  const str = (v) => (v == null ? '' : String(v));
  return {
    summary: str(r.summary),
    title_options: arr(r.title_options).map(str),
    overview: str(r.overview),
    skills_add: arr(r.skills_add).map((x) => ({ skill: str(x.skill ?? x), why: str(x.why) })),
    skills_remove: arr(r.skills_remove).map((x) => ({ skill: str(x.skill ?? x), why: str(x.why) })),
    rate: { recommendation: str(r.rate?.recommendation), evidence: str(r.rate?.evidence) },
    portfolio_plan: arr(r.portfolio_plan).map(str),
    priorities: arr(r.priorities).map((x) => ({ change: str(x.change ?? x), why: str(x.why), effort: str(x.effort) })),
    what_top_profiles_do: arr(r.what_top_profiles_do).map(str),
    claims_to_verify: arr(r.claims_to_verify).map(str),
  };
}

if (typeof module !== 'undefined') module.exports = { aggregateProfiles, profileGaps, compareFields, standing, nicheFromProfile, normalizeProfileReport, PROFILE_SCHEMA, PROFILE_TARGET };
