const STOP = new Set('i will you your for and or the a an to of in on with my me be by as at is are do any all from it that this up best top pro professional high quality'.split(' '));

function ngrams(title, n) {
  const w = title.toLowerCase().replace(/[^a-z0-9+#\s]/g, ' ').split(/\s+/).filter(Boolean);
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) {
    const g = w.slice(i, i + n);
    if (STOP.has(g[0]) || STOP.has(g[n - 1])) continue; // phrases must start/end on a real word
    out.add(g.join(' '));
  }
  return out;
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

// gigs: search-page gigs in rank order; tagCounts: {tag: count} from competitor gig pages you opened.
function analyze(gigs, total, tagCounts = {}) {
  const N = gigs.length || 1;
  const top = Math.min(10, N);
  const stats = new Map();
  gigs.forEach((g, rank) => {
    const grams = new Set([1, 2, 3].flatMap((n) => [...ngrams(g.title, n)]));
    grams.forEach((k) => {
      const s = stats.get(k) || { keyword: k, gigs: 0, inTop: 0, reviews: 0 };
      s.gigs++;
      if (rank < top) s.inTop++;
      s.reviews += g.reviews || 0;
      stats.set(k, s);
    });
  });
  const rows = [...stats.values()].map((s) => ({
    ...s,
    usage: s.gigs / N,
    lift: (s.inTop / top) / (s.gigs / N), // >1 means over-represented in the top 10
    score: s.gigs * Math.log10(10 + s.reviews / s.gigs) * (1 + s.inTop / top),
  }));

  const mustUse = rows.filter((r) => r.usage >= 0.15 && r.keyword.split(' ').length <= 2).sort((a, b) => b.score - a.score).slice(0, 12);
  const winning = rows.filter((r) => r.inTop >= 2 && r.lift > 1.2).sort((a, b) => b.lift * b.inTop - a.lift * a.inTop).slice(0, 12);
  const longTail = rows.filter((r) => r.keyword.split(' ').length >= 2 && r.gigs >= 2 && r.usage < 0.1).sort((a, b) => b.reviews / b.gigs - a.reviews / a.gigs).slice(0, 12);

  const reviews = gigs.map((g) => g.reviews || 0);
  const prices = gigs.map((g) => g.price).filter((p) => p != null);
  const medRev = median(reviews);
  const weak = gigs.filter((g) => (g.reviews || 0) < 20).length;
  const difficulty = Math.round(Math.min(100, (Math.log10(medRev + 1) / 3) * 60 + (Math.log10((total || N) + 1) / 6) * 40));
  const levels = {};
  gigs.forEach((g) => (levels[g.level] = (levels[g.level] || 0) + 1));
  const attrs = {};
  gigs.forEach((g) => (g.attrs || []).forEach((a) => (attrs[a] = (attrs[a] || 0) + 1)));
  const tags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);

  return {
    market: { total, medianReviews: medRev, medianPrice: median(prices), minPrice: Math.min(...prices), maxPrice: Math.max(...prices), weakGigsOnPage: weak, difficulty, levels },
    mustUse, winning, longTail, tags,
    attrs: Object.entries(attrs).sort((a, b) => b[1] - a[1]).slice(0, 10),
  };
}

// 0-100, higher = better opportunity, with its parts so the number is explainable.
// Built from one page-1 snapshot: it measures competition and price room, not buyer demand.
function opportunityScore(m, n) {
  const weakShare = n ? m.weakGigsOnPage / n : 0;
  const parts = {
    beatable: Math.round(weakShare * 40), // share of page-1 gigs with < 20 reviews
    competition: Math.round((1 - m.difficulty / 100) * 40), // inverse of difficulty
    priceRoom: Math.round(Math.min((m.medianPrice || 0) / 300, 1) * 20), // median start price vs $300
  };
  return {
    score: parts.beatable + parts.competition + parts.priceRoom,
    parts,
    evidence: `${m.weakGigsOnPage}/${n} gigs under 20 reviews · difficulty ${m.difficulty} · median $${m.medianPrice}, ${m.medianReviews} reviews`,
    confidence: n >= 40 ? 'medium (one page-1 snapshot)' : 'low (few gigs on page)',
  };
}

if (typeof module !== 'undefined') module.exports = { analyze, ngrams, opportunityScore };
