// Upwork jobs: market summary for a job search, an explainable score for one job, and the proposal schema.
const median2 = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };

function jobsMarket(jobs) {
  const hourly = jobs.filter((j) => j.type === 'hourly');
  const fixed = jobs.filter((j) => j.type === 'fixed');
  const count = (key) => { const c = {}; jobs.forEach((j) => { const v = key(j); if (v) c[v] = (c[v] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]); };
  const skills = {};
  jobs.forEach((j) => new Set(j.skills || []).forEach((s) => (skills[s] = (skills[s] || 0) + 1)));
  return {
    n: jobs.length,
    hourlyShare: jobs.length ? Math.round((hourly.length / jobs.length) * 100) : 0,
    hourlyMin: median2(hourly.map((j) => j.hourlyMin)),
    hourlyMax: median2(hourly.map((j) => j.hourlyMax)),
    fixedMedian: median2(fixed.map((j) => j.fixed)),
    levels: count((j) => j.level),
    durations: count((j) => j.duration),
    proposals: count((j) => j.proposals),
    verifiedPct: jobs.length ? Math.round((jobs.filter((j) => j.client?.verified).length / jobs.length) * 100) : 0,
    skills: Object.entries(skills).sort((a, b) => b[1] - a[1]).slice(0, 20),
  };
}

// 0-100 from what a single job page shows: client trust 35 + competition 30 + freshness 15 + budget fit 20.
// Parts are returned so the UI can explain the number.
function jobScore(job, myRate = null, now = Date.now()) {
  const c = job.client || {}, a = job.activity || {};
  const flags = [];
  const trust = Math.min(35,
    (c.verified ? 10 : 0)
    + (c.spent ? Math.min(12, Math.round(Math.log10(c.spent + 1) * 3)) : 0)
    + (c.reviews && c.rating >= 4.5 ? 8 : c.reviews ? 4 : 0)
    + (c.hires ? 5 : 0));
  if (!c.verified) flags.push('Payment method not verified');
  if (!c.spent) flags.push('Client has no spend history yet');
  if (c.reviews && c.rating < 4) flags.push(`Client rating ${c.rating}`);
  const ap = a.applicants;
  const competition = ap == null ? 13 : ap < 5 ? 30 : ap < 10 ? 24 : ap < 20 ? 17 : ap < 50 ? 8 : 2;
  if (ap >= 20) flags.push(`${ap} applicants already`);
  if (a.hired > 0) flags.push('Client has already hired someone');
  const hrs = job.posted ? (now - new Date(job.posted).getTime()) / 36e5 : null;
  const freshness = hrs == null ? 6 : hrs < 6 ? 15 : hrs < 24 ? 11 : hrs < 72 ? 6 : 2;
  if (hrs != null && hrs > 72) flags.push(`Posted ${Math.round(hrs / 24)} days ago`);
  let budgetFit = 10; // neutral when we can't compare
  if (myRate && job.type === 'hourly' && job.hourlyMax) {
    budgetFit = job.hourlyMax >= myRate ? 20 : job.hourlyMax >= myRate * 0.7 ? 12 : 0;
    if (!budgetFit) flags.push(`Budget up to $${job.hourlyMax}/hr is well below your $${myRate}/hr`);
  }
  return {
    score: trust + competition + freshness + budgetFit,
    parts: { trust, competition, freshness, budgetFit },
    evidence: [
      `client: ${c.verified ? 'verified' : 'unverified'}, spent $${Math.round(c.spent || 0)}, ${c.hires ?? 0} hires, rating ${c.rating ?? '-'} (${c.reviews ?? 0})`,
      `applicants ${ap ?? '?'}, interviewing ${a.interviewing ?? '?'}, invites ${a.invites ?? '?'}`,
      `posted ${hrs == null ? '?' : hrs < 1 ? '<1h' : hrs < 48 ? Math.round(hrs) + 'h' : Math.round(hrs / 24) + 'd'} ago`,
      myRate ? `budget ${job.type === 'hourly' ? `$${job.hourlyMin ?? '?'}–$${job.hourlyMax ?? '?'}/hr` : 'fixed'} vs your $${myRate}/hr` : 'set your hourly rate in ⚙ to score budget fit',
    ],
    flags,
  };
}

const PROPOSAL_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'object', properties: { apply: { type: 'boolean' }, reason: { type: 'string' } }, required: ['apply', 'reason'] },
    bid: { type: 'object', properties: { amount: { type: 'number' }, unit: { type: 'string', description: '"per hour" or "fixed"' }, rationale: { type: 'string' } }, required: ['amount', 'unit', 'rationale'] },
    opening_lines: { type: 'array', items: { type: 'string' }, description: '3 first lines; the first ~200 chars are what the client sees in the list' },
    cover_letter: { type: 'string', description: '900-1600 characters, specific to this job, ends with one clear question' },
    questions_for_client: { type: 'array', items: { type: 'string' } },
    screening_answers: { type: 'array', items: { type: 'object', properties: { q: { type: 'string' }, a: { type: 'string' } }, required: ['q', 'a'] } },
    portfolio_to_attach: { type: 'array', items: { type: 'string' } },
    claims_to_verify: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'bid', 'opening_lines', 'cover_letter', 'questions_for_client', 'screening_answers', 'portfolio_to_attach', 'claims_to_verify'],
};

function normalizeProposal(p = {}) {
  const arr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
  const str = (v) => (v == null ? '' : String(v));
  return {
    verdict: { apply: p.verdict?.apply !== false, reason: str(p.verdict?.reason) },
    bid: { amount: Number(p.bid?.amount) || 0, unit: str(p.bid?.unit), rationale: str(p.bid?.rationale) },
    opening_lines: arr(p.opening_lines).map(str),
    cover_letter: str(p.cover_letter),
    questions_for_client: arr(p.questions_for_client).map(str),
    screening_answers: arr(p.screening_answers).map((x) => ({ q: str(x.q), a: str(x.a) })),
    portfolio_to_attach: arr(p.portfolio_to_attach).map(str),
    claims_to_verify: arr(p.claims_to_verify).map(str),
  };
}

if (typeof module !== 'undefined') module.exports = { jobsMarket, jobScore, PROPOSAL_SCHEMA, normalizeProposal };
