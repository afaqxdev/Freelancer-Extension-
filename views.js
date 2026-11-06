// Upwork jobs + proposals, profile research, and the shared report exporter.
// Loaded after panel.js; uses its helpers (h, put, card, chips, copy, store, aiTool, readInTab, ...).

const ago = (iso) => {
  if (!iso) return '?';
  const hrs = (Date.now() - new Date(iso).getTime()) / 36e5;
  return hrs < 1 ? '<1h ago' : hrs < 48 ? `${Math.round(hrs)}h ago` : `${Math.round(hrs / 24)}d ago`;
};
const money = (n) => (n == null ? '?' : '$' + Math.round(n).toLocaleString());
const budget = (j) => (j.type === 'hourly' ? (j.hourlyMin || j.hourlyMax ? `$${j.hourlyMin ?? '?'}–$${j.hourlyMax ?? '?'}/hr` : 'Hourly') : j.fixed ? `Fixed ${money(j.fixed)}` : 'Fixed');
const statBox = (label, val) => h('div', { className: 'stat' }, h('b', {}, String(val)), h('span', {}, label));
const slug = (s) => String(s).replace(/\W+/g, '-').replace(/^-|-$/g, '').toLowerCase();

// ---------- report blocks → panel / Markdown / PDF (one source, so exports always match) ----------
// block: { h } heading · { p } paragraph · { li: [] } bullets · { ol: [] } numbered · { kv: [[k, v]] }
function blocksToMarkdown(title, sub, blocks) {
  const out = [`# ${title}`, `_${sub}_`, ''];
  blocks.forEach((b) => {
    if (b.h) out.push(`## ${b.h}`);
    if (b.p) out.push(b.p, '');
    if (b.li) out.push(...(b.li.length ? b.li.map((x) => `- ${x}`) : ['- (none)']), '');
    if (b.ol) out.push(...b.ol.map((x, i) => `${i + 1}. ${x}`), '');
    if (b.kv) out.push(...b.kv.map(([k, v]) => `- **${k}:** ${v}`), '');
  });
  return out.join('\n');
}

function blocksToPdf(title, sub, blocks) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 48, CW = W - M * 2;
  const GREEN = [29, 191, 115], INK = [31, 32, 36], MUTED = [107, 110, 118];
  let y = 0;
  const ensure = (need) => { if (y + need > H - M) { doc.addPage(); y = M; } };
  const font = (size, style = 'normal', color = INK) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color); };
  const lines = (text, size, indent = 0, style = 'normal', color = INK, prefix = '') => {
    font(size, style, color);
    const ls = doc.splitTextToSize(pdfText(text), CW - indent - (prefix ? 14 : 0));
    ls.forEach((l, i) => { ensure(size * 1.45); if (prefix && i === 0) doc.text(prefix, M + indent, y); doc.text(l, M + indent + (prefix ? 14 : 0), y); y += size * 1.45; });
  };
  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 92, 'F');
  font(20, 'bold', [255, 255, 255]); doc.text(pdfText(title), M, 44);
  font(11, 'normal', [255, 255, 255]); doc.text(pdfText(sub), M, 66);
  y = 124;
  blocks.forEach((b) => {
    if (b.h) { ensure(50); y += 6; doc.setFillColor(...GREEN); doc.rect(M, y - 10, 3, 14, 'F'); font(13, 'bold'); doc.text(pdfText(b.h), M + 10, y + 1); y += 20; }
    if (b.p) { lines(b.p, 10.5); y += 6; }
    if (b.li) { (b.li.length ? b.li : ['(none)']).forEach((x) => lines(x, 10.5, 0, 'normal', INK, '•')); y += 4; }
    if (b.ol) { b.ol.forEach((x, i) => lines(x, 10.5, 0, 'normal', INK, `${i + 1}.`)); y += 4; }
    if (b.kv) { b.kv.forEach(([k, v]) => { lines(k, 9, 0, 'normal', MUTED); lines(v, 10.5); y += 3; }); y += 4; }
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { doc.setPage(i); font(8.5, 'normal', MUTED); doc.text(`Gig Spy · ${i}/${pages}`, W - M, H - 24, { align: 'right' }); }
  return doc;
}

const exportBar = (title, sub, blocks, file, onClear) => h('div', {},
  h('div', { className: 'actions' },
    h('button', { className: 'primary grow', textContent: 'Download PDF', onclick: () => blocksToPdf(title, sub, blocks).save(file + '.pdf') }),
    h('button', { className: 'secondary', textContent: 'Markdown', onclick: () => download(file + '.md', blocksToMarkdown(title, sub, blocks), 'text/markdown') }),
    h('button', { className: 'secondary', textContent: 'Copy all', onclick: () => copy(blocksToMarkdown(title, sub, blocks), 'Copied') })),
  onClear ? h('button', { className: 'link', textContent: 'Clear this result and start fresh', onclick: onClear }) : null);

// ---------- Upwork job search ----------
function showJobs(data) {
  current = { platform: 'upwork', kind: 'up-jobs', key: 'upwork-jobs:' + data.query, data, market: jobsMarket(data.jobs) };
  $('query').textContent = 'Upwork jobs · ' + (data.query || 'feed');
  setMode('up-jobs', 'upwork');
  const m = current.market, n = data.jobs.length;
  const noClientData = data.jobs.every((j) => !j.client?.verified && j.client?.spent == null);
  put($('tab-overview'),
    card('Job market for this search',
      h('div', { className: 'grid' },
        statBox('matching jobs', data.total?.toLocaleString() ?? '?'),
        statBox('hourly vs fixed', `${m.hourlyShare}% / ${100 - m.hourlyShare}%`),
        statBox('median hourly budget', m.hourlyMin != null ? `$${m.hourlyMin}–$${m.hourlyMax}` : '—'),
        statBox('median fixed budget', m.fixedMedian != null ? money(m.fixedMedian) : '—'),
        statBox('payment verified', noClientData ? 'sign in' : `${m.verifiedPct}%`),
        statBox('jobs on this page', n))),
    card('Experience level asked', chips(m.levels, (x) => '×' + x[1])),
    card('Project length', chips(m.durations, (x) => '×' + x[1])),
    m.proposals.length ? card('Proposals already sent', chips(m.proposals, (x) => '×' + x[1])) : null,
    h('p', { className: 'meta' }, `Based on the ${n} jobs on this page${noClientData ? '. Client details (spend, verification) need you to be signed in to Upwork' : ''}. Open any job to get a client check and a tailored proposal.`));

  const titleKw = analyze(data.jobs.map((j) => ({ title: j.title, reviews: 0, price: null, level: j.level })), data.total);
  put($('tab-keywords'),
    card('Skills clients ask for', chips(m.skills, (x) => `${x[1]}/${n}`)),
    card('Common words in job titles', chips(titleKw.mustUse, (x) => pct(x.usage))),
    h('p', { className: 'meta' }, 'Put the skills you really have from the top of this list into your profile title, skills and proposals.'));

  put($('tab-competitors'), card(`${n} jobs on this page`, ...data.jobs.map((j) => h('div', { className: 'comp' },
    h('div', { className: 'rank' }, '#' + (j.pos + 1)),
    h('div', {},
      h('a', { href: j.url, target: '_blank', textContent: j.title }),
      h('div', { className: 'meta' }, [budget(j), j.level, j.duration, ago(j.posted), j.proposals && `proposals: ${j.proposals}`].filter(Boolean).join(' · ')),
      j.client?.verified ? h('span', { className: 'badge' }, 'PAYMENT VERIFIED') : null,
      j.client?.spent ? h('span', { className: 'badge' }, `${money(j.client.spent)} SPENT`) : null,
      h('div', { className: 'meta' }, (j.skills || []).slice(0, 6).join(', ')))))));
  renderProfileTab();
  status(`${n} jobs · ${data.total?.toLocaleString() ?? '?'} total · open a job to write a proposal`);
}

// ---------- single Upwork job ----------
async function showJob(data) {
  const s = await store.get(['myRate', 'proposals']);
  const score = jobScore(data, Number(s.myRate) || null);
  current = { platform: 'upwork', kind: 'up-job', key: data.url, data, score };
  $('query').textContent = 'Upwork job';
  setMode('up-job', 'upwork');
  const band = score.score >= 65 ? 'good' : score.score >= 40 ? 'mid' : 'hard';
  const c = data.client, a = data.activity;
  put($('tab-overview'),
    h('div', { className: 'card hero ' + band },
      h('div', { className: 'hero-top' },
        h('div', { className: 'gauge-wrap' },
          h('div', { className: 'gauge', style: `--v:${score.score}`, role: 'img', 'aria-label': `Job score ${score.score} out of 100` }, h('b', {}, String(score.score)), h('span', {}, '/100')),
          h('div', { className: 'gauge-label' }, 'Job score')),
        h('div', { className: 'headline grow' }, { good: 'Worth applying', mid: 'Apply selectively', hard: 'Probably skip' }[band])),
      h('ul', { className: 'points' }, h('li', {}, `client trust ${score.parts.trust}/35 · competition ${score.parts.competition}/30 · freshness ${score.parts.freshness}/15 · budget fit ${score.parts.budgetFit}/20`), score.evidence.map((e) => h('li', {}, e))),
      score.flags.length ? h('div', { className: 'warn', style: 'margin:10px 0 0' }, h('b', {}, 'Watch out'), h('ul', {}, score.flags.map((f) => h('li', {}, f)))) : null,
      h('button', { className: 'primary', style: 'width:100%;margin-top:10px', textContent: 'Write my proposal →', onclick: () => showTab('proposal') })),
    card(data.title,
      h('div', { className: 'meta' }, [budget(data), data.level, data.duration, data.workload, data.category, ago(data.posted)].filter(Boolean).join(' · ')),
      h('div', { className: 'chips', style: 'margin:8px 0' }, data.skills.map((k) => h('span', { className: 'chip' }, k))),
      h('details', {}, h('summary', {}, 'Job description'), h('div', { className: 'text' }, data.description))),
    card('Client',
      h('div', { className: 'grid' },
        statBox('payment', c.verified ? 'verified' : 'not verified'),
        statBox('total spent', money(c.spent)),
        statBox('hires', c.hires ?? '?'),
        statBox('rating', c.reviews ? `${c.rating} (${c.reviews})` : 'none yet'),
        statBox('country', c.country || '?'),
        statBox('member since', c.since ? new Date(c.since).toLocaleDateString() : '?'))),
    card('Activity on this job',
      h('div', { className: 'grid' },
        statBox('applicants', a.applicants ?? '?'),
        statBox('interviewing', a.interviewing ?? '?'),
        statBox('invites sent', a.invites ?? '?'),
        statBox('client last seen', ago(a.lastSeen)))),
    h('p', { className: 'meta' }, 'The job score is this extension\'s estimate from the page data, not an Upwork metric.'));
  renderProposalTab((s.proposals || {})[data.url]);
  status(`${score.score}/100 · ${a.applicants ?? '?'} applicants`);
}

function renderProposalTab(saved) {
  const btn = h('button', { className: 'primary', style: 'width:100%', textContent: saved ? 'Write again' : 'Write my proposal', onclick: () => writeProposal(btn) });
  put($('tab-proposal'),
    card('Proposal for this job',
      h('p', { className: 'muted', style: 'margin:0 0 10px' }, 'The AI uses this job, the client data, your About you, rate and (if set in ⚙) your Upwork profile. It never invents experience.'),
      btn,
      h('div', { className: 'meta', id: 'proposalStatus' })),
    h('div', { id: 'proposalOut' }));
  if (saved) renderProposal(saved);
}

async function writeProposal(btn) {
  const job = current?.kind === 'up-job' ? current : null;
  if (!job) return;
  const s = await store.get(['apiKey', 'about', 'myRate', 'upworkProfile', 'profileCache', 'proposals']);
  if (!s.apiKey) { openSettings(['key']); return status(NO_KEY); }
  const mine = s.upworkProfile && (s.profileCache || {})[normUrl(s.upworkProfile)];
  btn.disabled = true;
  busy = true;
  $('proposalStatus').textContent = 'The AI is reading the job and writing… (~30-60 s)';
  try {
    const d = job.data;
    const prompt = `UPWORK JOB
Title: ${d.title}
Budget: ${budget(d)} · Level: ${d.level} · Duration: ${d.duration} · Workload: ${d.workload}
Skills: ${d.skills.join(', ')}
Description:
${d.description}
Screening questions: ${d.questions.length ? d.questions.join(' | ') : 'none shown'}

CLIENT: ${JSON.stringify(d.client)}
ACTIVITY: ${JSON.stringify(d.activity)}
JOB SCORE (extension estimate): ${job.score.score}/100 ${JSON.stringify(job.score.parts)}; flags: ${job.score.flags.join('; ') || 'none'}

ME
About me: ${s.about || 'not given — keep claims generic, invent nothing'}
My hourly rate: ${s.myRate ? '$' + s.myRate : 'not given'}
${mine ? `My Upwork profile: title "${mine.title}"; skills ${mine.skills.join(', ')}; ${mine.jobs} jobs, ${mine.reviews} reviews, rating ${mine.rating}, JSS ${mine.jss ?? '?'}%. Overview: ${mine.overview.slice(0, 1500)}` : 'My Upwork profile: not available'}

TASK: You are an expert Upwork freelancer who wins jobs with short, specific proposals.
- verdict: should I apply? Be honest; use the client data and competition.
- bid: amount + unit, with the reasoning (client budget, competition, my rate).
- opening_lines: 3 options. The first ~200 characters are all the client sees in the list: start with their problem, not "Hi, I am".
- cover_letter: 900-1600 characters. Refer to concrete details of THIS job, a short plan for how I'd do it, relevant proof only from ME, end with one specific question. No generic filler, no greetings longer than one word.
- questions_for_client: 2-3 smart questions that show understanding.
- screening_answers: answer each screening question shown (empty list if none).
- portfolio_to_attach: which kinds of proof to attach.
- claims_to_verify: every claim I must be able to prove. Never invent clients, numbers or years.`;
    const proposal = await aiTool(prompt, 'submit_proposal', PROPOSAL_SCHEMA, normalizeProposal, 'proposal');
    const saved = { proposal, title: d.title, url: d.url, score: job.score.score, at: Date.now() };
    const proposals = { ...(s.proposals || {}), [d.url]: saved };
    await store.set({ proposals });
    if (current?.key === d.url) renderProposalTab(saved);
    toast('Proposal ready');
  } catch (e) {
    $('proposalStatus').textContent = e.message;
  } finally {
    busy = false;
    btn.disabled = false;
  }
}

function proposalBlocks(saved) {
  const p = saved.proposal;
  return [
    { h: 'Verdict' }, { p: `${p.verdict.apply ? 'Apply' : 'Skip'}: ${p.verdict.reason}` },
    { h: 'Bid' }, { p: `$${p.bid.amount} ${p.bid.unit}. ${p.bid.rationale}` },
    { h: 'Opening line options' }, { ol: p.opening_lines },
    { h: `Cover letter (${p.cover_letter.length} chars)` }, { p: p.cover_letter },
    { h: 'Questions for the client' }, { li: p.questions_for_client },
    { h: 'Screening answers' }, { li: p.screening_answers.map((x) => `${x.q}: ${x.a}`) },
    { h: 'Portfolio to attach' }, { li: p.portfolio_to_attach },
    { h: 'Claims to verify before sending' }, { li: p.claims_to_verify },
  ];
}

function renderProposal(saved) {
  const p = saved.proposal;
  const title = 'Upwork proposal', sub = `${saved.title} · ${new Date(saved.at).toLocaleDateString()}`;
  put($('proposalOut'),
    h('div', { className: p.verdict.apply ? 'ok' : 'issues' }, h('b', {}, p.verdict.apply ? '✓ Apply' : 'Consider skipping'), ' · ' + p.verdict.reason),
    exportBar(title, sub, proposalBlocks(saved), 'upwork-proposal-' + slug(saved.title).slice(0, 40), async () => {
      const { proposals = {} } = await store.get('proposals');
      delete proposals[saved.url];
      await store.set({ proposals });
      renderProposalTab(null);
    }),
    p.claims_to_verify.length ? h('div', { className: 'warn' }, h('b', {}, 'Check before sending: can you prove each claim?'), h('ul', {}, p.claims_to_verify.map((x) => h('li', {}, x)))) : null,
    card('Bid', h('div', { className: 'price', style: 'font-size:20px;font-weight:700' }, `$${p.bid.amount} ${p.bid.unit}`), h('div', { className: 'meta' }, p.bid.rationale)),
    card('Opening line · pick one', ...p.opening_lines.map((t) => h('div', { className: 'line' }, h('div', { className: 'grow text' }, t), copyBtn(() => t)))),
    card(['Cover letter', counter(p.cover_letter.length, 1600), copyBtn(() => p.cover_letter)], h('div', { className: 'text' }, p.cover_letter)),
    card('Questions for the client', h('ul', {}, p.questions_for_client.map((x) => h('li', {}, x)))),
    p.screening_answers.length ? card('Screening answers', ...p.screening_answers.map((x) => h('div', { className: 'line' }, h('div', { className: 'grow' }, h('b', {}, x.q), h('div', { className: 'text' }, x.a)), copyBtn(() => x.a)))) : null,
    card('Portfolio to attach', h('ul', {}, p.portfolio_to_attach.map((x) => h('li', {}, x)))));
}

// ---------- profile research ----------
const normUrl = (u) => String(u || '').trim().replace(/\?.*$/, '').replace(/\/+$/, '').replace('://fiverr.com', '://www.fiverr.com').replace('://upwork.com', '://www.upwork.com').toLowerCase();

async function cacheProfile(d) {
  const { profileCache = {} } = await store.get('profileCache');
  profileCache[normUrl(d.url)] = { ...d, at: Date.now(), v: CACHE_VERSION };
  await store.set({ profileCache });
}

async function showProfilePage(data) {
  if (data.kind === 'profile') await cacheProfile(data);
  const keep = current && ['search', 'up-jobs'].includes(current.kind) && current.platform === data.platform && data.kind === 'profile';
  if (!keep) {
    current = { platform: data.platform, kind: data.kind, key: data.url || 'talent:' + data.query, data };
    $('query').textContent = `${data.platform === 'upwork' ? 'Upwork' : 'Fiverr'} · ${data.kind === 'profile' ? data.name : data.query}`;
    setMode(data.kind === 'profile' ? 'profile' : 'up-talent', data.platform);
  }
  const s = await store.get(['fiverrProfile', 'upworkProfile']);
  const own = normUrl(data.platform === 'upwork' ? s.upworkProfile : s.fiverrProfile);
  status(data.kind === 'profile' ? (own && own === normUrl(data.url) ? 'This is your profile (saved for comparison).' : `Viewing ${data.name}'s profile.`) : `${data.profiles.length} freelancers on this page · ${data.total?.toLocaleString() ?? '?'} total`);
  renderProfileTab();
}

async function renderProfileTab() {
  if (!current) return;
  const platform = current.platform;
  const s = await store.get(['fiverrProfile', 'upworkProfile', 'profileResults', 'lastNiche']);
  const niche0 = current.data?.query || (s.lastNiche || {})[platform] || '';
  const own0 = platform === 'upwork' ? s.upworkProfile : s.fiverrProfile;
  const niche = h('input', { value: niche0, placeholder: 'e.g. flutter developer', 'aria-label': 'Niche keyword' });
  const own = h('input', { value: own0 || '', placeholder: platform === 'upwork' ? 'https://www.upwork.com/freelancers/~…' : 'https://www.fiverr.com/yourname', 'aria-label': 'Your profile link' });
  const btn = h('button', { className: 'primary', style: 'width:100%', textContent: `Research ${PROFILE_TARGET}+ profiles & improve mine` });
  const steps = h('ol', { id: 'psteps', className: 'steps' }, ['Find', 'Read', 'Compare', 'Write'].map((t, i) => h('li', { 'data-step': String(i) }, t)));
  const bar = h('div', { className: 'bar' }, h('div', {}));
  const msg = h('div', { className: 'meta' });
  const stop = h('button', { className: 'secondary small', textContent: "Stop reading & write with what's collected", hidden: true, onclick: () => { stopReading = true; stop.disabled = true; } });
  const prog = h('div', { hidden: true, style: 'margin-top:10px' }, steps, bar, msg, stop);
  const out = h('div', { id: 'profileOut' });
  const both = h('button', { className: 'secondary', style: 'width:100%;margin-top:8px', textContent: 'Research both Fiverr + Upwork' });
  const combo = h('div');
  const ui = { prog, steps, bar: bar.firstChild, msg, stop };
  btn.onclick = () => researchProfiles({ platform, niche: niche.value.trim(), ownUrl: own.value.trim(), ui: { ...ui, btn, out } });
  both.onclick = () => researchBoth(niche.value.trim(), own.value.trim(), platform, { ...ui, btn: both }, combo, out);
  put($('tab-profile'),
    card(`Improve my ${platform === 'upwork' ? 'Upwork' : 'Fiverr'} profile`,
      h('p', { className: 'muted', style: 'margin:0 0 8px' }, `Reads ${PROFILE_TARGET}-${PROFILE_MAX} freelancers in the same field (background tabs, ~5-7 min first time), compares your profile field by field with them and with the top quarter, then writes evidence-based fixes.`),
      h('label', {}, 'Your field (leave empty to detect it from your profile)', niche),
      h('label', {}, 'Your profile link', own),
      btn, both, prog),
    combo, out);
  const results = s.profileResults || {};
  const saved = results[`${platform}:${niche0.toLowerCase()}`];
  if (saved) renderProfileReport(saved, out);
  renderStanding(combo, latestPerPlatform(results));
}

const latestPerPlatform = (results) => ['fiverr', 'upwork'].map((p) => Object.values(results).filter((r) => r.platform === p).sort((a, b) => b.at - a.at)[0]).filter(Boolean);

// "Where you stand" across platforms: average share of competitors you beat, and the fields you're behind on.
function renderStanding(el, results) {
  const withYou = results.filter((r) => r.fields?.length);
  if (!withYou.length) return put(el);
  put(el, card('Where you stand', ...withYou.map((r) => {
    const behind = r.fields.filter((f) => f.status === 'behind').map((f) => f.field);
    const ahead = r.fields.filter((f) => f.status === 'ahead').map((f) => f.field);
    return h('div', { className: 'kw' },
      h('div', { className: 'kw-score', title: 'Average share of competitors you beat' }, r.standing + '%'),
      h('div', { className: 'grow' },
        h('b', {}, `${r.platform === 'upwork' ? 'Upwork' : 'Fiverr'} · "${r.niche}"`),
        h('div', { className: 'meta' }, `You beat ${r.standing}% of ${r.studied} freelancers in this field on average`),
        ahead.length ? h('div', { className: 'meta' }, '▲ Ahead: ' + ahead.join(', ')) : null,
        behind.length ? h('div', { className: 'meta' }, '▼ Behind: ' + behind.join(', ')) : null));
  }), h('p', { className: 'meta', style: 'margin:6px 0 0' }, 'Estimate from public profile fields of the freelancers studied, not a platform ranking.')));
}

async function researchBoth(niche, ownHere, here, ui, combo, out) {
  const s = await store.get(['fiverrProfile', 'upworkProfile']);
  const links = { fiverr: here === 'fiverr' ? ownHere : s.fiverrProfile, upwork: here === 'upwork' ? ownHere : s.upworkProfile };
  if (!links.fiverr || !links.upwork) return toast('Add both your Fiverr and Upwork profile links (⚙ Settings) to compare on both');
  const outs = { fiverr: h('details', { className: 'card', open: true }, h('summary', {}, 'Fiverr report')), upwork: h('details', { className: 'card', open: true }, h('summary', {}, 'Upwork report')) };
  put(out, outs.fiverr, outs.upwork);
  const done = [];
  for (const platform of ['fiverr', 'upwork']) {
    const box = h('div');
    outs[platform].append(box);
    const r = await researchProfiles({ platform, niche, ownUrl: links[platform], ui: { ...ui, out: box } });
    if (r) done.push(r);
  }
  ui.btn.textContent = 'Research both Fiverr + Upwork';
  renderStanding(combo, done);
}

async function researchProfiles({ platform, niche, ownUrl, ui }) {
  if (!niche && !ownUrl) return toast('Enter your field or your profile link');
  const s = await store.get(['apiKey', 'about', 'profileCache', 'lastNiche', 'fiverrProfile', 'upworkProfile']);
  if (!s.apiKey) { openSettings(['key']); return status(NO_KEY); }
  const P = platform === 'upwork' ? 'Upwork' : 'Fiverr';
  let ownKey = normUrl(ownUrl); // updated if your link redirects to your edit page
  const cache = s.profileCache || {};
  const fresh = (u) => cache[u]?.v === CACHE_VERSION && Date.now() - cache[u].at < CACHE_DAYS * 864e5;
  const step = (n) => ui.steps.querySelectorAll('li').forEach((li) => (li.className = +li.dataset.step < n ? 'done' : +li.dataset.step === n ? 'active' : ''));
  const say = (t, frac) => { ui.msg.textContent = t; if (frac != null) ui.bar.style.width = Math.round(frac * 100) + '%'; };
  busy = true;
  stopReading = false;
  ui.btn.disabled = true;
  ui.prog.hidden = false;
  ui.stop.hidden = false;
  ui.stop.disabled = false;
  put(ui.out);
  const guard = captchaGuard(() => say(`${P} asked for a captcha. Solve it in the opened tab; reading continues automatically.`));
  let mine = null;
  try {
    // 0. your profile first: it defines "your field" when none is typed, and is always re-read so the comparison is current
    step(0);
    if (ownUrl) {
      say(`Reading your ${P} profile…`, 0.01);
      mine = await readInTab(ownUrl, 'profile', () => undefined, (x) => x.title || x.overview);
      // Fiverr share links (fiverr.com/s/…) send the logged-in owner to /sellers/<name>/edit: read the public profile instead
      const owner = !mine && !stopReading && readInTab.seen?.tabUrl?.match(/fiverr\.com\/sellers\/([^/?#]+)/i)?.[1];
      if (owner) {
        ownUrl = `https://www.fiverr.com/${owner}`;
        ownKey = normUrl(ownUrl);
        say(`Your link opened your edit page; reading your public profile ${ownUrl}…`, 0.01);
        mine = await readInTab(ownUrl, 'profile', () => undefined, (x) => x.title || x.overview);
      }
      if (mine) await cacheProfile(mine);
      else if (stopReading) throw new Error('Stopped.');
      else {
        // show exactly what the tab showed (page URL, page type, format keys; no profile content) so it can be fixed
        const report = JSON.stringify(readInTab.seen);
        ui.out.append(card(['Report: profile not read', h('span', { className: 'grow' }), copyBtn(() => report)],
          h('p', { className: 'muted', style: 'margin:0 0 6px' }, 'Copy this and send it. It shows what the background tab loaded (no personal content).'),
          h('pre', { style: 'white-space:pre-wrap;font-size:11px;margin:0' }, JSON.stringify(readInTab.seen, null, 1))));
        if (!niche) throw new Error(`Could not read your ${P} profile. Copy the report below and send it, or type your field instead.`);
        say(`Could not read your ${P} profile (report below); continuing with "${niche}" only.`);
      }
    }
    niche = niche || nicheFromProfile(mine);
    if (!niche) throw new Error('Could not detect your field from your profile; type it in.');
    await store.set({ lastNiche: { ...(s.lastNiche || {}), [platform]: niche }, ...(ownUrl ? { [platform === 'upwork' ? 'upworkProfile' : 'fiverrProfile']: ownUrl } : {}) });
    const enc = encodeURIComponent(niche);

    // 1. find freelancers in the same field
    const urls = new Map(); // normalized → url
    const add = (u) => { const k = normUrl(u); if (u && k !== ownKey && !urls.has(k)) urls.set(k, u); };
    if (platform === 'fiverr') {
      if (current?.kind === 'search' && current.platform === 'fiverr' && current.data.query.toLowerCase() === niche.toLowerCase()) current.data.gigs.forEach((g) => add(`https://www.fiverr.com/${g.seller}`));
      for (let page = 1; urls.size < PROFILE_TARGET && page <= 4 && !stopReading; page++) {
        if (page === 1 && urls.size) continue;
        say(`Finding sellers · search page ${page} · ${urls.size} so far`, 0.02 * page);
        const d = await readInTab(`https://www.fiverr.com/search/gigs?query=${enc}${page > 1 ? `&page=${page}` : ''}`, 'search', guard.handler, (x) => x.gigs?.length);
        (d?.gigs || []).forEach((g) => add(`https://www.fiverr.com/${g.seller}`));
      }
    } else {
      if (current?.kind === 'search' && current.platform === 'upwork') current.data.gigs.forEach((g) => g.profileUrl && add(g.profileUrl));
      for (let page = 1; urls.size < PROFILE_TARGET && page <= 6 && !stopReading; page++) {
        say(`Finding freelancers · talent page ${page} · ${urls.size} so far`, 0.02 * page);
        const d = current?.kind === 'up-talent' && current.data.query.toLowerCase() === niche.toLowerCase() && current.data.page === page
          ? current.data
          : await readInTab(`https://www.upwork.com/nx/search/talent/?q=${enc}&page=${page}`, 'up-talent', guard.handler, (x) => x.profiles?.length);
        (d?.profiles || []).forEach((p) => add(p.url));
      }
    }
    const list = [...urls.values()].slice(0, PROFILE_MAX);
    if (!list.length) throw new Error(`No ${P} profiles found for "${niche}".`);

    // 2. read every profile (cached ones are reused)
    step(1);
    const profiles = [];
    let readMs = 0, readCount = 0;
    for (const [i, url] of list.entries()) {
      if (stopReading) break;
      const left = list.length - i, per = readCount ? readMs / readCount : 9000;
      say(`Reading profile ${i + 1}/${list.length} · ~${Math.max(1, Math.ceil((left * per) / 60000))} min left`, 0.1 + 0.7 * (i / list.length));
      let d = fresh(normUrl(url)) ? cache[normUrl(url)] : null;
      if (!d) {
        const t0 = Date.now();
        d = await readInTab(url, 'profile', guard.handler, (x) => x.title || x.overview);
        if (d) await cacheProfile(d);
        await sleep(1500 + Math.random() * 2000); // pace like a person
        readMs += Date.now() - t0; readCount++;
      }
      if (d) profiles.push(d);
    }
    ui.stop.hidden = true;
    if (profiles.length < 10) throw new Error(guard.count >= 2
      ? `Stopped after 2 captchas with only ${profiles.length} profiles read (they are saved). Try again later; already-read profiles are skipped.`
      : `Only ${profiles.length} profiles could be read; that's too few to compare. Try again later.`);

    // 3. compare you with the field, field by field
    step(2);
    const agg = aggregateProfiles(profiles);
    const gaps = profileGaps(mine, agg);
    const fields = compareFields(mine, profiles, platform);

    // 4. write
    step(3);
    say(`The AI is writing your profile report from ${profiles.length} profiles… (~1 min)`, 0.88);
    const prompt = `PLATFORM: ${P}
NICHE: "${niche}"
RESEARCH: ${profiles.length} competitor profiles read. "top" = top quarter by reviews (${agg.top.count} profiles, ${agg.reviews.topCutoff}+ reviews).
AGGREGATES (all / top / rest): ${JSON.stringify({ all: agg.all, top: agg.top, rest: agg.rest, rate: agg.rate, reviews: agg.reviews })}
MOST COMMON SKILLS (% of profiles): ${agg.skills.map((x) => `${x.skill} ${x.pct}%`).join(', ')}
MOST COMMON TITLE WORDS (% of profiles): ${agg.titleWords.map((x) => `${x.word} ${x.pct}%`).join(', ')}
TOP PROFILE EXAMPLES (title | reviews | rate | first line):
${agg.topExamples.map((p) => `- ${p.title} | ${p.reviews} | ${p.rate ?? '?'} | ${p.opening}`).join('\n')}
MY PROFILE VS THE FIELD (field: me | field median | top-quarter median | % of competitors I beat): ${fields.length ? fields.map((f) => `${f.field}: ${f.you} | ${f.median} | ${f.top} | ${f.beat}%`).join('; ') : 'no profile given'}
GAPS FOUND BY CODE (mine vs top): ${gaps.length ? gaps.map((g) => `${g.area}: ${g.gap} (${g.evidence})`).join('; ') : mine ? 'none' : 'no profile given'}

MY PROFILE: ${mine ? JSON.stringify({ title: mine.title, overview: mine.overview, skills: mine.skills, rate: mine.rate, reviews: mine.reviews, jobs: mine.jobs, rating: mine.rating, badge: mine.badge, portfolio: mine.portfolio, certs: mine.certs, employment: mine.employment, video: mine.video, languages: mine.languages }) : 'not provided: write a strong profile from ABOUT ME'}
ABOUT ME: ${s.about || 'not given — keep claims generic, invent nothing'}

TASK: You are a ${P} profile expert. Using ONLY the research numbers above as evidence, tell me exactly how to improve my ${P} profile.
- Every "why" must cite a number from the research (e.g. "${agg.top.withVideo}% of top profiles have a video vs ${agg.rest.withVideo}% of the rest"). If the data doesn't support a claim, don't make it.
- title_options: 3, in the style the top profiles use (${P === 'Upwork' ? 'Upwork headline' : 'Fiverr one-liner'}), keyword first.
- overview: a full rewrite, structured like the top profiles (hook, what I do, proof, process, call to action). Use only facts from MY PROFILE and ABOUT ME; never invent clients, numbers, years or certifications. No contact details or links (against ${P} rules).
- skills_add / skills_remove with reasons from the skill percentages; only add skills I plausibly have from ABOUT ME / MY PROFILE.
- rate: a recommendation tied to the rate quartiles and my review count.
- priorities: 6-10 changes ordered by impact, each with effort low/medium/high.
- claims_to_verify: every claim I must be able to prove.`;
    const report = await aiTool(prompt, 'submit_profile_report', PROFILE_SCHEMA, normalizeProfileReport, 'profile report');
    const key = `${platform}:${niche.toLowerCase()}`;
    const result = {
      platform, niche, report, agg, gaps, fields, standing: standing(fields), studied: profiles.length, found: list.length, stoppedByCaptcha: guard.count >= 2, at: Date.now(),
      own: mine && { url: mine.url, title: mine.title, overviewLen: mine.overview.length, skills: mine.skills, rate: mine.rate, reviews: mine.reviews, portfolio: mine.portfolio },
    };
    const { profileResults = {} } = await store.get('profileResults');
    const prev = profileResults[key];
    if (prev && prev.studied > result.studied) result.unsaved = prev.studied; // a partial run never replaces a fuller one
    else { profileResults[key] = result; await store.set({ profileResults }); }
    step(4);
    say(`Done. Studied ${profiles.length} profiles.` + (result.stoppedByCaptcha ? ` Stopped after 2 captchas; run again later to read the rest (already-read profiles are skipped).` : ''), 1);
    toast(`${P} profile report ready`);
    renderProfileReport(result, ui.out);
    return result;
  } catch (e) {
    say(e.message);
    status(e.message);
    const { profileResults = {} } = await store.get('profileResults');
    const saved = niche && profileResults[`${platform}:${niche.toLowerCase()}`];
    if (saved) renderProfileReport(saved, ui.out); // a failed run never hides the last good report
    return null;
  } finally {
    busy = false;
    ui.btn.disabled = false;
    ui.btn.textContent = 'Research again';
    ui.stop.hidden = true;
  }
}

function profileBlocks(res) {
  const r = res.report, a = res.agg;
  const row = (label, k, fmt = (v) => v) => `${label}: all ${fmt(a.all[k])} · top quarter ${fmt(a.top[k])} · rest ${fmt(a.rest[k])}`;
  return [
    { h: 'Summary' }, { p: r.summary },
    ...(res.fields?.length ? [{ h: `You vs ${res.studied} freelancers in "${res.niche}" (you beat ${res.standing}% on average)` }, { li: res.fields.map((f) => `${f.field}: you ${f.you} · field median ${f.median} · top quarter ${f.top} · you beat ${f.beat}% (${f.status})`) }] : []),
    { h: 'Gaps found in your profile' }, { li: res.gaps.map((g) => `${g.area}: ${g.gap} (${g.evidence})`) },
    { h: 'Priorities' }, { ol: r.priorities.map((x) => `${x.change} [effort: ${x.effort}] Why: ${x.why}`) },
    { h: 'Title options' }, { li: r.title_options.map((t) => `${t} (${t.length} chars; top median ${a.top.titleLen})`) },
    { h: `Overview (${r.overview.length} chars; top median ${a.top.overviewLen})` }, { p: r.overview },
    { h: 'Skills to add' }, { li: r.skills_add.map((x) => `${x.skill}: ${x.why}`) },
    { h: 'Skills to remove' }, { li: r.skills_remove.map((x) => `${x.skill}: ${x.why}`) },
    { h: 'Rate' }, { p: `${r.rate.recommendation} (${r.rate.evidence})` },
    { h: 'Portfolio plan' }, { li: r.portfolio_plan },
    { h: 'What top profiles do' }, { li: r.what_top_profiles_do },
    { h: 'Research numbers' }, { li: [
      `${res.studied} profiles read; top quarter = ${a.top.count} profiles with ${a.reviews.topCutoff}+ reviews`,
      `Rate: 25% ${a.rate.p25 ?? '?'} · median ${a.rate.median ?? '?'} · 75% ${a.rate.p75 ?? '?'}`,
      row('Title length', 'titleLen'), row('Overview length', 'overviewLen'), row('Skills listed', 'skills'), row('Portfolio items', 'portfolio'),
      row('With video', 'withVideo', (v) => v + '%'), row('With certifications', 'withCerts', (v) => v + '%'), row('With employment history', 'withEmployment', (v) => v + '%'), row('Using emoji/bold text', 'usesEmoji', (v) => v + '%'),
      `Top skills: ${a.skills.slice(0, 12).map((x) => `${x.skill} ${x.pct}%`).join(', ')}`,
    ] },
    { h: 'Top profiles studied' }, { li: a.topExamples.map((p) => `${p.name}: ${p.title} (${p.reviews} reviews) ${p.url}`) },
    { h: 'Claims to verify before publishing' }, { li: r.claims_to_verify },
  ];
}

function renderProfileReport(res, out) {
  const r = res.report, a = res.agg, P = res.platform === 'upwork' ? 'Upwork' : 'Fiverr';
  const title = `${P} profile report`, sub = `"${res.niche}" · ${new Date(res.at).toLocaleDateString()} · ${res.studied} profiles studied`;
  const key = `${res.platform}:${res.niche.toLowerCase()}`;
  const blocks = profileBlocks(res);
  const numbers = blocks[blocks.findIndex((x) => x.h === 'Research numbers') + 1].li;
  put(out,
    res.unsaved ? h('div', { className: 'warn' }, `Built from ${res.studied} profiles, so it was not saved over your earlier report built from ${res.unsaved}. `,
      h('button', { className: 'link', textContent: 'Save this one instead', onclick: async () => {
        const { profileResults = {} } = await store.get('profileResults');
        delete res.unsaved;
        profileResults[key] = res;
        await store.set({ profileResults });
        renderProfileReport(res, out);
      } })) : null,
    h('div', { className: 'ok' }, h('b', {}, `✓ Built from ${res.studied} ${P} profiles`), ` · top quarter = ${a.top.count} profiles with ${a.reviews.topCutoff}+ reviews`, res.own ? '' : ' · add your profile link to get a personal comparison'),
    exportBar(title, sub, blocks, `${res.platform}-profile-report-${slug(res.niche)}`, async () => {
      const { profileResults = {} } = await store.get('profileResults');
      delete profileResults[key];
      await store.set({ profileResults });
      put(out);
    }),
    r.claims_to_verify.length ? h('div', { className: 'warn' }, h('b', {}, 'Check before publishing: can you prove each claim?'), h('ul', {}, r.claims_to_verify.map((x) => h('li', {}, x)))) : null,
    card('Summary', h('div', { className: 'text' }, r.summary)),
    res.fields?.length ? card([`You vs ${res.studied} in your field`, h('span', { className: 'grow' }), h('span', { className: 'meta' }, `beat ${res.standing}% avg`)],
      h('table', { className: 'cmp' },
        h('tr', {}, ['Field', 'You', 'Median', 'Top ¼', 'You beat'].map((t) => h('th', {}, t))),
        res.fields.map((f) => h('tr', { className: f.status },
          h('td', {}, f.field), h('td', {}, String(f.you)), h('td', {}, String(f.median)), h('td', {}, String(f.top)),
          h('td', {}, f.status === 'info' ? `${f.beat}%` : `${f.status === 'ahead' ? '▲' : f.status === 'behind' ? '▼' : '•'} ${f.beat}%`)))),
      h('div', { className: 'meta', style: 'margin-top:6px' }, '"You beat" = share of the studied freelancers with a lower value (equal counts half). Rate is a position, not good or bad.')) : null,
    res.gaps.length ? card('Gaps found in your profile', ...res.gaps.map((g) => h('div', { className: 'line' }, h('div', { className: 'grow' }, h('b', {}, g.area + ': '), g.gap, h('div', { className: 'meta' }, g.evidence))))) : null,
    card('Priorities', h('ol', {}, r.priorities.map((x) => h('li', {}, x.change, ' ', h('span', { className: 'badge' }, x.effort), h('div', { className: 'meta' }, 'Why: ' + x.why))))),
    card(['Title · pick one', h('span', { className: 'grow' }), h('span', { className: 'meta' }, `top median ${a.top.titleLen} chars`)], ...r.title_options.map((t) => h('div', { className: 'line' }, h('div', { className: 'grow text' }, t), h('span', { className: 'count' }, `${t.length}`), copyBtn(() => t)))),
    card(['Overview', h('span', { className: 'count' }, `${r.overview.length} · top median ${a.top.overviewLen}`), copyBtn(() => r.overview)], h('div', { className: 'text' }, r.overview)),
    card('Skills', h('div', { className: 'meta' }, 'Add'), h('ul', {}, r.skills_add.map((x) => h('li', {}, h('b', {}, x.skill), ' · ' + x.why))),
      r.skills_remove.length ? h('div', {}, h('div', { className: 'meta' }, 'Remove'), h('ul', {}, r.skills_remove.map((x) => h('li', {}, h('b', {}, x.skill), ' · ' + x.why)))) : null),
    card('Rate', h('div', {}, r.rate.recommendation), h('div', { className: 'meta' }, r.rate.evidence)),
    card('Portfolio plan', h('ul', {}, r.portfolio_plan.map((x) => h('li', {}, x)))),
    card('What top profiles do', h('ul', {}, r.what_top_profiles_do.map((x) => h('li', {}, x)))),
    h('details', { className: 'card' }, h('summary', {}, 'Research numbers'), h('ul', {}, numbers.map((x) => h('li', {}, x)))),
    h('details', { className: 'card' }, h('summary', {}, `Top ${a.topExamples.length} profiles studied`), ...a.topExamples.map((p) => h('div', { className: 'line' }, h('div', { className: 'grow' }, h('a', { href: p.url, target: '_blank', textContent: p.name || p.url }), h('div', { className: 'meta' }, `${p.title} · ${p.reviews} reviews`))))));
}

// ---------- home: pick platform, then task ----------
const GOALS = {
  fiverr: [
    { goal: 'gig', title: 'Write a gig', text: 'Study the top gigs for your keyword, then write a full gig: titles, tags, description, packages, FAQ and an action plan.' },
    { goal: 'profile', title: 'Improve my profile', text: 'Compare your profile field by field with up to 25 sellers in your field and get evidence-based fixes.' },
  ],
  upwork: [
    { goal: 'proposal', title: 'Write a proposal', text: 'Find jobs for your keyword, check each client, and write a tailored proposal with a bid.' },
    { goal: 'catalog', title: 'Project Catalog listing', text: 'Study the top catalog projects, then write your project: title, 3 tiers, description and FAQ.' },
    { goal: 'profile', title: 'Improve my profile', text: 'Compare your profile field by field with up to 25 freelancers in your field and get evidence-based fixes.' },
  ],
};
const P_NAME = { fiverr: 'Fiverr', upwork: 'Upwork' };
// where each task needs you to be, and the search page that gets you there
const NEEDS = {
  gig: { platform: 'fiverr', kinds: ['search'], url: (q) => `https://www.fiverr.com/search/gigs?query=${encodeURIComponent(q)}`, tab: () => 'gig' },
  catalog: { platform: 'upwork', kinds: ['search'], url: (q) => `https://www.upwork.com/services/search?q=${encodeURIComponent(q)}`, tab: () => 'gig' },
  proposal: { platform: 'upwork', kinds: ['up-jobs', 'up-job'], url: (q) => `https://www.upwork.com/nx/search/jobs/?q=${encodeURIComponent(q)}`, tab: (kind) => (kind === 'up-job' ? 'proposal' : 'competitors') },
};
const goalTitle = (t) => GOALS[t.platform].find((g) => g.goal === t.goal)?.title || '';

function showHome(platform = null) {
  document.body.classList.add('at-home');
  $('home').hidden = false;
  $('crumb').hidden = true;
  $('query').textContent = '';
  const choice = (title, text, onclick) => h('button', { className: 'choice', onclick }, h('b', {}, title), h('span', {}, text));
  if (!platform) {
    put($('home'),
      h('div', { className: 'home-title' }, 'What do you want to work on?'),
      choice('Fiverr', 'Write a gig or improve your seller profile', () => showHome('fiverr')),
      choice('Upwork', 'Write proposals, a Project Catalog listing, or improve your profile', () => showHome('upwork')));
  } else {
    // first time on this platform: ask only its questions, then come back to its task list
    if (!setupDone[platform]) return openSettings([platform], () => showHome(platform));
    put($('home'),
      h('div', { className: 'home-title' }, `${P_NAME[platform]}: what do you need?`),
      ...GOALS[platform].map((g) => choice(g.title, g.text, () => chooseTask({ platform, goal: g.goal }))),
      h('button', { className: 'link', textContent: '← Back', onclick: () => showHome() }));
  }
}

async function chooseTask(t) {
  task = t;
  await store.set({ task });
  document.body.classList.remove('at-home');
  $('home').hidden = true;
  lastTaskView = '';
  run();
}

let lastTaskView = ''; // only jump to the task's tab when the page (or task) changes, not on every refresh
async function applyTask() {
  if (!task) return;
  const P = P_NAME[task.platform];
  document.body.classList.remove('guiding');
  put($('crumb'), h('span', {}, `${P} › ${goalTitle(task)}`), h('button', { className: 'link', textContent: 'Change', onclick: () => $('homeBtn').click() }));
  $('crumb').hidden = false;

  if (task.goal === 'profile') {
    $('guide').hidden = true;
    const usable = current && current.platform === task.platform && ['search', 'up-jobs', 'up-talent', 'profile'].includes(current.kind);
    if (!usable) {
      current = { platform: task.platform, kind: 'profile', key: 'task:' + task.platform, data: {} };
      $('query').textContent = P;
    }
    setMode('profile', task.platform);
    if (lastTaskView !== current.key + task.goal) { lastTaskView = current.key + task.goal; renderProfileTab(); showTab('profile'); }
    return;
  }

  const need = NEEDS[task.goal];
  const onPage = current && current.platform === need.platform && need.kinds.includes(current.kind);
  if (!onPage) {
    // not on the right page yet: hide the tabs and show one clear next step
    document.body.classList.add('guiding');
    // the panel re-runs on every tab load; rebuilding this card would wipe what you're typing
    if (!$('guide').hidden && $('guide').dataset.goal === task.goal) return;
    $('guide').dataset.goal = task.goal;
    const { lastKeyword = {} } = await store.get('lastKeyword');
    const kw = h('input', { value: lastKeyword[task.goal] || '', placeholder: task.goal === 'proposal' ? 'e.g. flutter' : 'e.g. flutter app', 'aria-label': 'Keyword' });
    const go = async () => {
      const q = kw.value.trim();
      if (!q) return kw.focus();
      await store.set({ lastKeyword: { ...lastKeyword, [task.goal]: q } });
      const url = need.url(q);
      const tab = await activeTab();
      // reuse the tab if it's already on that site, otherwise open a new one
      if (tab?.url?.includes(need.platform === 'upwork' ? 'upwork.com' : 'fiverr.com')) await chrome.tabs.update(tab.id, { url });
      else await chrome.tabs.create({ url });
      status(`Opening ${P} search for "${q}"…`);
    };
    // a block body on purpose: returning false from onkeydown cancels the key, which blocked all typing
    kw.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    put($('guide'), card(`Step 1 · Search ${P}`,
      h('p', { className: 'muted', style: 'margin:0 0 8px' }, { gig: 'Type the keyword buyers search for. The panel reads the results and the top gigs, then writes your gig.', catalog: 'Type the keyword clients search for. The panel reads the top catalog projects, then writes your project.', proposal: 'Type your skill. The panel shows the job market; then click any job to check the client and get a proposal.' }[task.goal]),
      h('label', {}, 'Keyword', kw),
      h('button', { className: 'primary', style: 'width:100%', textContent: `Open ${P} search`, onclick: go })));
    $('guide').hidden = false;
    status(`Step 1: search ${P}`);
    return;
  }
  $('guide').hidden = true;
  if (task.goal === 'proposal' && current.kind === 'up-jobs') status('Step 2: click any job; the panel checks the client and writes your proposal.');
  const view = current.key + task.goal;
  if (lastTaskView !== view) { lastTaskView = view; showTab(need.tab(current.kind)); }
}

$('homeBtn').onclick = async () => {
  if (busy) return toast('Wait until the current run finishes');
  task = null;
  await store.remove('task');
  $('guide').hidden = true;
  showHome();
};

// ---------- start ----------
store.get([...SETTINGS, 'lastGig', 'gigResults', 'task', 'setupDone']).then(async (s) => {
  SETTINGS.forEach((k) => ($(k).value = s[k] || ''));
  showKeyHint();
  task = s.task || null;
  hasKey = !!providerOf(s.apiKey); // run() opens the key step when this is false
  // people who already filled "About you" before setup had steps aren't asked again
  setupDone = s.setupDone || (s.about ? { fiverr: true, upwork: true } : {});
  if (s.lastGig) { // one-time move from the old single-result format
    await store.set({ gigResults: { ...(s.gigResults || {}), [s.lastGig.query]: s.lastGig } });
    await store.remove('lastGig');
  }
  run(true);
});
