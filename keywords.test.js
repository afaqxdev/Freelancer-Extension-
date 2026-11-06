// node keywords.test.js
const assert = require('assert');
const { analyze, ngrams } = require('./keywords.js');

assert.deepStrictEqual([...ngrams('I will design a modern logo', 2)], ['design a', 'modern logo'].filter((g) => !g.endsWith(' a')));
assert.ok(![...ngrams('for the best logo', 1)].includes('the'));

const gigs = Array.from({ length: 20 }, (_, i) => ({
  pos: i,
  title: i < 5 ? 'design minimalist logo for brand' : 'design logo for business',
  reviews: i < 5 ? 500 : 10,
  price: 10 + i,
  level: 'level_one_seller',
  attrs: ['flat'],
}));
const r = analyze(gigs, 1000, { 'logo design': 3, branding: 1 });
assert.ok(r.mustUse.some((x) => x.keyword === 'logo'));
assert.ok(r.winning.some((x) => x.keyword === 'minimalist logo'), 'top-10-heavy phrase should be "winning"');
assert.strictEqual(r.tags[0][0], 'logo design');
assert.strictEqual(r.market.weakGigsOnPage, 15);
assert.ok(r.market.difficulty >= 0 && r.market.difficulty <= 100);
console.log('ok');

const { validateGig, RULES } = require('./gig.js');
const good = {
  titles: ['I will develop your flutter mobile app for android and ios'],
  tags: ['flutter app', 'mobile app', 'ios app', 'android app', 'flutter developer'],
  description: 'x'.repeat(500),
  packages: [1, 2, 3].map((i) => ({ name: 'Basic app', description: 'One screen', price: 50 * i, days: 3, revisions: '2', includes: [] })),
  faq: [{ q: 'Do you publish?', a: 'Yes.' }],
};
assert.deepStrictEqual(validateGig(good), []);
const bad = { ...good, titles: ['I will ' + 'a'.repeat(80)], tags: ['flutter-app!'], description: 'short', packages: [{ ...good.packages[0], price: 47 }], faq: [{ q: 'q', a: 'call me on whatsapp' }] };
const fields = validateGig(bad).map((x) => x.field);
['titles[0]', 'tags', 'tags[0]', 'description', 'packages', 'packages[0].price', 'all'].forEach((f) => assert.ok(fields.includes(f), 'expected issue for ' + f));
assert.strictEqual(RULES.title, 80);
console.log('gig ok');

const { normalizeGig } = require('./gig.js');
const n = normalizeGig({ titles: 'I will x', packages: '[{"name":"A","price":"50","includes":"x"}]', faq: undefined });
assert.deepStrictEqual(n.titles, ['I will x']);
assert.strictEqual(n.packages[0].price, 50);
assert.deepStrictEqual(n.packages[0].includes, ['x']);
assert.deepStrictEqual(n.faq, []);
assert.deepStrictEqual(normalizeGig(undefined).extras, []);
console.log('normalize ok');

const { autoFixGig } = require('./gig.js');
const f = autoFixGig({ titles: ['build flutter apps', 'I will  do  x'], tags: ['Flutter-App!', 'flutter app', 'mobile app development services', 'ios'], packages: [{ price: 47, days: 0.4 }], extras: [{ price: 2 }] });
assert.deepStrictEqual(f.titles, ['I will build flutter apps', 'I will do x']);
assert.deepStrictEqual(f.tags, ['flutter app', 'mobile app', 'ios']);
assert.strictEqual(f.packages[0].price, 45);
assert.strictEqual(f.packages[0].days, 1);
assert.strictEqual(f.extras[0].price, 5);
assert.ok(f.tags.every((t) => t.length <= 20));
const { opportunityScore } = require('./keywords.js');
const easy = opportunityScore({ weakGigsOnPage: 30, difficulty: 30, medianPrice: 300 }, 48);
const hard = opportunityScore({ weakGigsOnPage: 2, difficulty: 85, medianPrice: 50 }, 48);
assert.ok(easy.score > hard.score && easy.score <= 100 && hard.score >= 0, `${easy.score} vs ${hard.score}`);
assert.strictEqual(easy.score, easy.parts.beatable + easy.parts.competition + easy.parts.priceRoom);
assert.ok(!/demand/i.test(easy.confidence + easy.evidence));
console.log('autofix + score ok');

const log = [];
autoFixGig({ titles: ['build apps'], tags: ['Flutter-App!', 'flutter app'], packages: [{ tier: 'Basic', price: 47, days: 3 }], extras: [] }, log);
assert.ok(log.some((x) => x.includes('Basic price $47 → $45')), log.join('\n'));
assert.ok(log.some((x) => x.startsWith('Tag "Flutter-App!"')));
assert.ok(log.some((x) => x.includes('starts with "I will"')));
const clean = []; autoFixGig({ titles: ['I will do x'], tags: ['ios'], packages: [{ price: 50, days: 2 }] }, clean);
assert.deepStrictEqual(clean, [], 'no changes → empty log');
console.log('autofix log ok');

const { UPWORK_RULES, rulesFor } = require('./gig.js');
assert.strictEqual(rulesFor('upwork'), UPWORK_RULES);
const ulog = [];
const ug = autoFixGig({ titles: ['flutter app for ios', 'You will get a flutter app'], tags: ['ios'], packages: [{ price: 499, days: 10 }] }, ulog, UPWORK_RULES);
assert.deepStrictEqual(ug.titles, ['You will get flutter app for ios', 'You will get a flutter app']);
assert.ok(validateGig(ug, UPWORK_RULES).every((x) => !x.msg.includes('must start')));
assert.ok(validateGig({ ...ug, titles: ['I will x y z abc def ghi'] }, UPWORK_RULES).some((x) => x.msg.includes('You will get')));
console.log('upwork rules ok');
assert.strictEqual(ug.packages[0].price, 499, 'Upwork prices are not rounded to $5');
console.log('upwork price ok');

// --- profile research (fixtures shaped like live Upwork/Fiverr reads) ---
const { aggregateProfiles, profileGaps, normalizeProfileReport } = require('./profile.js');
const mk = (i, extra = {}) => ({ name: 'p' + i, title: 'Flutter Developer | Firebase | iOS Android', overview: 'x'.repeat(800 + i * 20), skills: ['Flutter', 'Dart', 'Firebase', i % 2 ? 'FlutterFlow' : 'API Integration'], rate: 10 + i, reviews: i * 10, portfolio: i % 10, certs: i % 3 ? 1 : 0, employment: i % 2, education: 1, video: i > 30, url: 'u' + i, ...extra });
const crowd = Array.from({ length: 40 }, (_, i) => mk(i));
const agg = aggregateProfiles(crowd);
assert.strictEqual(agg.n, 40);
assert.strictEqual(agg.top.count, 10);
assert.ok(agg.top.withVideo > agg.rest.withVideo, 'top quarter (most reviews) has the videos');
assert.ok(agg.skills.find((s) => s.skill === 'flutter').pct === 100);
assert.ok(agg.rate.p25 <= agg.rate.median && agg.rate.median <= agg.rate.p75);
const own = { title: 'Dev', overview: 'short', skills: ['Flutter'], rate: 5, reviews: 2, portfolio: 0, certs: 0, employment: 0, video: false };
const gaps = profileGaps(own, agg).map((g) => g.area);
['Skills', 'Overview', 'Portfolio', 'Video', 'Rate', 'Title'].forEach((a) => assert.ok(gaps.includes(a), 'expected gap ' + a + ' in ' + gaps));
assert.deepStrictEqual(profileGaps(null, agg), []);
assert.deepStrictEqual(normalizeProfileReport(undefined).priorities, []);
console.log('profile research ok');

// --- jobs (fixture = the live FlutterFlow job read from Upwork) ---
const { jobsMarket, jobScore, normalizeProposal } = require('./jobs.js');
const liveJob = { type: 'hourly', hourlyMin: 5, hourlyMax: 7, posted: '2026-10-29T07:47:42.789Z', activity: { applicants: 41, hired: 0, interviewing: 3, invites: 3 }, client: { verified: true, spent: 56.03, hires: 1, rating: 5, reviews: 2 } };
const js = jobScore(liveJob, 25, new Date('2026-10-29T12:00:00Z').getTime());
assert.strictEqual(js.score, js.parts.trust + js.parts.competition + js.parts.freshness + js.parts.budgetFit);
assert.strictEqual(js.parts.competition, 8); // 41 applicants
assert.strictEqual(js.parts.freshness, 15); // ~4h old
assert.strictEqual(js.parts.budgetFit, 0); // $7/hr max vs $25/hr
assert.ok(js.score < 65, 'a $5-7/hr job with 41 applicants must not read "worth applying" for a $25/hr freelancer: ' + js.score);
assert.ok(jobScore(liveJob, null).parts.budgetFit === 10, 'no rate → neutral');
assert.ok(js.flags.some((f) => f.includes('41 applicants')) && js.flags.some((f) => f.includes('below your $25/hr')));
const badJob = jobScore({ type: 'fixed', fixed: 50, posted: '2026-10-20T00:00:00Z', activity: { applicants: 80 }, client: { verified: false } }, null, new Date('2026-10-29T12:00:00Z').getTime());
assert.ok(badJob.score < js.score && badJob.flags.includes('Payment method not verified'));
const mkt = jobsMarket([{ type: 'hourly', hourlyMin: 5, hourlyMax: 7, level: 'Intermediate', skills: ['Flutter', 'Firebase'], client: { verified: true } }, { type: 'fixed', fixed: 500, level: 'Expert', skills: ['Flutter'], client: {} }]);
assert.strictEqual(mkt.hourlyShare, 50);
assert.strictEqual(mkt.fixedMedian, 500);
assert.deepStrictEqual(mkt.skills[0], ['Flutter', 2]);
assert.strictEqual(normalizeProposal({}).verdict.apply, true);
console.log('jobs ok');

const dbl = autoFixGig({ titles: ['I will build a flutter app', 'You will get x y'], tags: [], packages: [] }, [], UPWORK_RULES).titles;
assert.deepStrictEqual(dbl, ['You will get build a flutter app', 'You will get x y']);
assert.deepStrictEqual(autoFixGig({ titles: ['You will get an app built'] }, []).titles, ['I will an app built']);
console.log('prefix swap ok');

// --- content.js page routing (regression: gig pages carry a seller block and were read as profiles) ---
const vm = require('vm');
const src = require('fs').readFileSync(__dirname + '/content.js', 'utf8');
function readPage(pathname, props) {
  let reply;
  const ctx = {
    location: { pathname, search: '', href: 'https://www.fiverr.com' + pathname },
    URLSearchParams,
    document: { title: 'T', getElementById: () => ({ textContent: JSON.stringify(props) }), querySelector: () => null, body: { innerText: '' } },
    chrome: { runtime: { onMessage: { addListener: (f) => (reply = f) } } },
    globalThis: {},
  };
  vm.runInNewContext(src, ctx);
  let out; reply('extract', null, (d) => (out = d)); return out;
}
const sellerBlock = { oneLinerTitle: 'AI Product Engineer', activeStructuredSkills: [{ name: 'Flutter' }], rating: { score: 5, count: 119 }, user: { name: 'techoship' } };
const gigPage = readPage('/techoship/build-flutter-apps', { seller: sellerBlock, description: { content: '<p>Desc</p>' }, packages: { packageList: [{ title: 'MVP', price: 10000, duration: 168, revisions: { included: true, value: -1 }, features: [{ label: 'Source code', type: 'BOOLEAN', value: 0 }] }] }, tags: { tagsGigList: [{ name: 'app development' }] }, faq: { questionsAndAnswers: [] } });
assert.strictEqual(gigPage.kind, 'gig');
assert.ok(gigPage.packages.startsWith('MVP: $100, 7 days, unlimited revisions'), gigPage.packages);
const profilePage = readPage('/techoship', { seller: sellerBlock, gigsData: [{ price_i: 100 }] });
assert.strictEqual(profilePage.kind, 'profile');
assert.strictEqual(profilePage.rate, 100);
console.log('content routing ok');

const { compareFields, standing, nicheFromProfile } = require('./profile.js');
const meUp = { title: 'Flutter Developer | Firebase', overview: 'x'.repeat(2000), skills: ['Flutter', 'Dart', 'Firebase', 'FlutterFlow', 'Stripe'], rate: 25, reviews: 300, rating: 5, jobs: 50, jss: 100, portfolio: 1, certs: 0, employment: 0, education: 1, languages: ['English'], video: false };
const rows = compareFields(meUp, crowd, 'upwork');
const row = (f) => rows.find((r) => r.field === f);
assert.strictEqual(row('Reviews').status, 'ahead');   // 300 beats most of the crowd (0..390)
assert.strictEqual(row('Portfolio items').status, 'behind');
assert.strictEqual(row('Rate / start price').status, 'info');
assert.strictEqual(row('Intro video').you, 'no');
assert.ok(/% have one/.test(row('Intro video').median));
assert.ok(compareFields(meUp, crowd.map((p) => ({ ...p, jss: 90 })), 'upwork').some((r) => r.field === 'Job Success %'), 'Upwork-only fields on Upwork');
assert.ok(!compareFields(meUp, crowd, 'fiverr').some((r) => r.field === 'Job Success %'), 'and not on Fiverr');
const st = standing(rows);
assert.ok(st > 0 && st < 100);
assert.deepStrictEqual(compareFields(null, crowd, 'upwork'), []);
assert.strictEqual(nicheFromProfile(meUp), 'flutter');
assert.strictEqual(nicheFromProfile({ title: 'Mobile App Developer | iOS', skills: [] }), 'mobile app developer');
console.log('field comparison ok');
const tie = compareFields({ rating: 4.9, reviews: 10 }, Array.from({ length: 20 }, () => ({ rating: 4.9, reviews: 10 })), 'fiverr');
assert.ok(tie.every((r) => r.status === 'even' && r.beat === 50), JSON.stringify(tie));
console.log('ties ok');
