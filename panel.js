const $ = (id) => document.getElementById(id);
const store = chrome.storage.local;
const CACHE_DAYS = 7;
const CACHE_VERSION = 2; // bump when content.js gig format changes so old cached gigs are re-read
const MAX_STUDY = 15; // top 15 carry the positioning signal; fewer background pages = less load on Fiverr/Upwork and less captcha risk
let stopReading = false;
let current = null; // what the active tab shows: { platform, kind, key, data, ... }
let busy = false; // true while Generate runs; auto-refresh must not swap the search underneath it
let reloadedFor = ''; // query we already reloaded a stale page for, so we never loop

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) k.includes('-') ? el.setAttribute(k, v) : (el[k] = v);
  kids.flat().forEach((k) => k != null && k !== false && el.append(k));
  return el;
}
const status = (t) => ($('status').textContent = t);
function toast(t) {
  const el = $('toast');
  el.textContent = t;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 1600);
}
const copy = (text, what = 'Copied') => navigator.clipboard.writeText(text).then(() => toast(`${what} ✓`));
// replaceChildren would print "null" for skipped optional sections
const put = (el, ...kids) => el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
const pct = (x) => Math.round(x * 100) + '%';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const level = (l) => (l || 'new').replace(/_seller|level_/g, '').replace('top_rated', 'top rated');

// ---------- tabs ----------
const TABS = ['overview', 'keywords', 'competitors', 'gig', 'proposal', 'profile'];
function showTab(name) {
  document.querySelectorAll('nav button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === name));
  TABS.forEach((t) => ($('tab-' + t).hidden = t !== name));
}
// Which tabs exist (and what they're called) depends on the page you're on.
const MODES = {
  search: { tabs: ['overview', 'keywords', 'competitors', 'gig', 'profile'] },
  'up-jobs': { tabs: ['overview', 'keywords', 'competitors', 'profile'], labels: { overview: 'Market', keywords: 'Skills', competitors: 'Jobs' } },
  'up-job': { tabs: ['overview', 'proposal'], labels: { overview: 'Job', proposal: 'Proposal ✦' } },
  'up-talent': { tabs: ['profile'] },
  profile: { tabs: ['profile'] },
  none: { tabs: ['overview'] },
};
const DEFAULT_LABELS = { overview: 'Overview', keywords: 'Keywords', competitors: 'Competitors', gig: 'My Gig ✦', proposal: 'Proposal ✦', profile: 'Profile ✦' };
function setMode(kind, platform) {
  const m = MODES[kind] || MODES.none;
  const labels = { ...DEFAULT_LABELS, ...(platform === 'upwork' && kind === 'search' ? { gig: 'My Project ✦' } : {}), ...m.labels };
  document.querySelectorAll('nav button').forEach((b) => { b.hidden = !m.tabs.includes(b.dataset.tab); b.textContent = labels[b.dataset.tab]; });
  const sel = document.querySelector('nav button[aria-selected="true"]')?.dataset.tab;
  if (!m.tabs.includes(sel)) showTab(m.tabs[0]);
}
document.querySelectorAll('nav button').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
// Setup is asked in steps: the AI key first, then each platform's fields the first time you pick that platform.
let hasKey = false; // set at start and after a key passes the check
let setupDone = {}; // { fiverr: true, upwork: true } once that platform's questions were saved
let afterSave = null;
const SETUP_TEXT = {
  key: ['Step 1 · Connect your AI', 'Paste a Claude, ChatGPT or Gemini API key. It is checked, then saved in this browser only.'],
  fiverr: ['Fiverr · about you', 'Used to write your gigs and compare your profile. Only "About you" really matters; the rest is optional.'],
  upwork: ['Upwork · about you', 'Used to score jobs, bid and write proposals. Only "About you" really matters; the rest is optional.'],
};
function openSettings(parts, then = null) {
  afterSave = then;
  const step = parts.length === 1 ? SETUP_TEXT[parts[0]] : null;
  $('settingsTitle').textContent = step ? step[0] : 'Settings';
  $('settingsIntro').textContent = step ? step[1] : '';
  $('settingsIntro').hidden = !step;
  $('settings').querySelectorAll('[data-for]').forEach((el) => (el.hidden = !el.dataset.for.split(' ').some((x) => parts.includes(x))));
  $('save').textContent = step && parts[0] === 'key' ? 'Check key & continue' : step ? 'Save & continue' : 'Save';
  $('clearCache').hidden = !!step;
  document.body.classList.toggle('setup', !!step); // a setup step replaces everything until it's saved
  $('settings').hidden = false;
}
$('settingsBtn').onclick = () => {
  if (!$('settings').hidden && hasKey) return ($('settings').hidden = true);
  openSettings(task ? ['key', task.platform] : ['key', 'fiverr', 'upwork']);
};

// ---------- reading Fiverr / Upwork pages ----------
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

const isUpwork = (url) => /^https:\/\/www\.upwork\.com\//.test(url || '');
// Fiverr: content script. Upwork: upwork.js injected into the page (its profile data lives in a page JS variable).
async function readTab(tab) {
  if (isUpwork(tab.url)) {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', files: ['upwork.js'] });
    return r?.result;
  }
  try {
    return { platform: 'fiverr', ...(await chrome.tabs.sendMessage(tab.id, 'extract')) };
  } catch (e) {
    // tab was open before the extension (re)loaded, so it has no content script yet: add it instead of asking for a reload
    if (!/^https:\/\/www\.fiverr\.com\//.test(tab.url || '')) throw e;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    return { platform: 'fiverr', ...(await chrome.tabs.sendMessage(tab.id, 'extract')) };
  }
}

async function extract(tab) {
  try {
    const d = await readTab(tab);
    if (!d) throw new Error();
    return d;
  } catch {
    throw new Error('Not a Fiverr or Upwork page, or it was open before the extension loaded. Reload the tab (Cmd+R) and try again.');
  }
}

function emptyState(title, text) {
  current = null;
  $('query').textContent = '';
  setMode('none');
  put($('tab-overview'), h('div', { className: 'empty' }, h('b', {}, title), text));
  showGigFor(null);
}

let task = null; // { platform, goal } picked on the home screen (views.js)

// The panel follows the task you picked; reading the page is the same for every task.
async function run(auto = false) {
  if (busy) return;
  if (!hasKey) return openSettings(['key']); // step 1 of setup: nothing else until the AI key works
  if (!task) return showHome();
  await readPage(auto);
  applyTask();
}

// auto = triggered by tab change / page load (silent about non-Fiverr pages).
async function readPage(auto = false) {
  const tab = await activeTab();
  let data;
  try {
    data = await extract(tab);
  } catch (e) {
    if (auto || !current) return emptyState('Open Fiverr or Upwork', 'Fiverr: a gig search. Upwork: a job search, a job, Project Catalog, talent search or a profile. This panel reads it automatically.');
    return status(e.message);
  }
  try {
    if (data.captcha) return status(`${data.platform === 'upwork' ? 'Upwork' : 'Fiverr'} is showing a captcha on this tab. Solve it, then click ↻.`);
    if (data.kind === 'up-jobs') return showJobs(data);
    if (data.kind === 'up-job') return showJob(data);
    if (data.kind === 'up-job-link') return openJobFromSlider(data.url);
    if (data.kind === 'up-talent' || data.kind === 'profile') return showProfilePage(data);
    if (data.kind === 'other') {
      emptyState(...(data.platform === 'upwork'
        ? ['Nothing to read on this Upwork page', 'Open a job search, a job, Project Catalog, talent search or a freelancer profile.']
        : ['Nothing to read on this Fiverr page', 'Open a gig search, a gig, or a seller profile (fiverr.com/username).']));
      // a profile/job page landing here means Upwork changed its format: let the user copy the details for a fix
      if (/\/(freelancers|jobs|services)\//.test(data.debug?.url || '')) {
        const info = JSON.stringify(data.debug, null, 1);
        $('tab-overview').append(card(['This page should be readable', h('span', { className: 'grow' }), copyBtn(() => info)],
          h('p', { className: 'muted', style: 'margin:0 0 6px' }, 'Upwork may have changed this page. Copy these page-format details (no personal content) and send them so the reader can be updated.'),
          h('pre', { style: 'white-space:pre-wrap;font-size:11px;margin:0' }, info)));
      }
      return;
    }
    if (data.kind === 'stale') {
      if (reloadedFor === data.query) return status('Fiverr page did not refresh. Press Cmd+R on the Fiverr tab.');
      reloadedFor = data.query;
      status(`Loading results for "${data.query}"…`);
      return chrome.tabs.reload(tab.id); // onUpdated re-runs us when it finishes
    }
    if (data.kind === 'gig') {
      await cacheGig(data); // reused when you Generate
      const what = data.platform === 'upwork' ? 'project' : 'gig';
      if (!current) emptyState(`Viewing a single ${what}`, 'Go back to the search results to analyze competitors.');
      return status(`Viewing a ${what}. Go back to search results to analyze.`);
    }
    if (!data.gigs.length) return status('No results found on this page.');
    const key = resultKey(data.platform, data.query);
    const s = await store.get(['gigCache', 'username', 'history', 'searches']);
    const report = analyze(data.gigs, data.total, tagCounts(s.gigCache));

    const me = data.platform === 'fiverr' ? (s.username || '').toLowerCase() : ''; // Upwork shows short names only, so no rank match
    const mine = me ? data.gigs.filter((g) => g.seller?.toLowerCase() === me) : [];
    const history = s.history || {};
    if (mine.length) {
      const pos = (data.page - 1) * data.gigs.length + mine[0].pos + 1;
      const today = new Date().toISOString().slice(0, 10);
      const h0 = (history[key] ||= []);
      if (h0.at(-1)?.at === today) h0[h0.length - 1].pos = pos; // one entry per day, not per refresh
      else h0.push({ at: today, pos });
      history[key] = h0.slice(-30);
      await store.set({ history });
    }
    const opp = opportunityScore(report.market, data.gigs.length);
    const searches = { ...(s.searches || {}), [key]: { at: Date.now(), ...opp, n: data.gigs.length } };
    await store.set({ searches });
    const changed = current?.key !== key;
    current = { platform: data.platform, kind: 'search', key, data, report, mine, rankHistory: history[key] || [], searches };
    reloadedFor = '';
    $('query').textContent = (data.platform === 'upwork' ? 'Upwork · ' : '') + data.query;
    setMode('search', data.platform);
    renderProfileTab();
    renderOverview();
    renderKeywords();
    renderCompetitors();
    if (changed) await showGigFor(key);
    status(`${data.gigs.length} ${data.platform === 'upwork' ? 'projects' : 'gigs'} · page ${data.page} · ${data.total?.toLocaleString() ?? '?'} total`);
  } catch (e) {
    status(e.message);
  }
}

// A job opened in Upwork's slide-over has no job data in the page, so read its full page in a background tab.
const jobPages = new Map();
async function openJobFromSlider(url) {
  if (current?.kind === 'up-job' && current.key === url) return;
  if (!jobPages.has(url)) {
    busy = true;
    status('Reading this job…');
    try {
      const d = await readInTab(url, 'up-job', () => undefined, (x) => x.title);
      if (d) jobPages.set(url, d);
    } finally {
      busy = false;
    }
  }
  const d = jobPages.get(url);
  return d ? showJob(d) : status('Could not read this job. Open it in its own tab and click ↻.');
}

// Fiverr keys stay the bare query (older saved data); other platforms are prefixed so searches never mix.
const resultKey = (platform, query) => (platform === 'upwork' ? 'upwork:' + query : query);

// Each search has its own generated gig; a new search starts clean.
async function showGigFor(key) {
  const { gigResults = {} } = await store.get('gigResults');
  const noun = current?.platform === 'upwork' ? 'project' : 'gig';
  $('progress').hidden = true;
  $('gigBtn').textContent = `Generate my ${noun}`;
  $('gigTitle').textContent = `Generate my ${noun}`;
  $('gigIntro').hidden = false;
  const last = key && gigResults[key];
  if (last) { renderGig(last); $('gigBtn').textContent = 'Generate again'; }
  else put($('gigOut'));
}

function tagCounts(cache = {}) {
  const c = {};
  Object.values(cache).forEach((g) => (g.tags || []).forEach((t) => (c[t] = (c[t] || 0) + 1)));
  return c;
}

async function cacheGig(d) {
  const { gigCache = {} } = await store.get('gigCache');
  gigCache[d.url] = { ...d, at: Date.now(), v: CACHE_VERSION };
  await store.set({ gigCache });
}

// Opens a page in a background tab, waits until it can be read as `kind`, closes the tab.
// If the site shows a captcha, onCaptcha() decides: 'stop' closes the tab and gives up on this page,
// otherwise the tab is brought forward so you can solve it and reading resumes automatically.
// After a null result, readInTab.seen says what the tab really showed, so a failure can be reported instead of guessed.
async function readInTab(url, kind, onCaptcha, ready = () => true) {
  const created = await chrome.tabs.create({ url, active: false });
  let shown = false;
  let wrong = 0; // seconds the fully loaded page has been some other kind of page
  const seen = (readInTab.seen = { wanted: kind, url: url.split('?')[0], tabUrl: null, status: null, kind: null, debug: null, error: null });
  try {
    for (let i = 0; i < 180; i++) {
      if (stopReading) return null; // Stop button
      await sleep(1000);
      let d, tab;
      try {
        tab = await chrome.tabs.get(created.id);
        Object.assign(seen, { tabUrl: tab.url?.split('?')[0] || null, status: tab.status });
        d = await readTab(tab);
        Object.assign(seen, { kind: d?.kind ?? null, debug: d?.debug ?? null, error: null });
      } catch (e) { seen.error = String(e?.message || e).slice(0, 200); continue; } // still loading
      // loaded, no captcha, but not the page we wanted (login redirect, changed page format…): give up after 15 s, not 3 min
      if (!d?.captcha && d?.kind !== kind && tab.status === 'complete' && ++wrong >= 15) return null;
      if (d?.captcha) {
        if (!shown) {
          shown = true;
          if (onCaptcha() === 'stop') return null;
          await chrome.tabs.update(created.id, { active: true });
        }
        continue;
      }
      if (d?.kind !== kind) continue;
      if (ready(d) || i > 10) return d;
    }
    return null;
  } finally {
    chrome.tabs.remove(created.id).catch(() => {});
  }
}

// Shared captcha policy for every multi-page read: first captcha → you solve it; second → stop collecting.
function captchaGuard(onFirst) {
  const g = { count: 0 };
  g.handler = () => {
    if (++g.count >= 2) { stopReading = true; return 'stop'; }
    onFirst();
  };
  return g;
}

// ---------- AI (Claude, ChatGPT or Gemini: whichever key the user saved) ----------
// shortcut: default models are hardcoded; the optional Model field in Settings overrides them when a name is retired.
const PROVIDERS = {
  claude: { name: 'Claude', model: 'claude-opus-5-5', keys: 'https://console.anthropic.com/settings/keys' },
  openai: { name: 'ChatGPT', model: 'gpt-5', keys: 'https://platform.openai.com/api-keys' },
  gemini: { name: 'Gemini', model: 'gemini-2.5-pro', keys: 'https://aistudio.google.com/apikey' },
};
// The key's prefix says which AI it belongs to (Claude sk-ant-…, OpenAI sk-…, Google AIza…).
const providerOf = (key = '') => (key.startsWith('sk-ant-') ? 'claude' : key.startsWith('AIza') ? 'gemini' : key.startsWith('sk-') ? 'openai' : null);
const NO_KEY = 'Add your Claude, ChatGPT or Gemini API key in Settings (⚙).';

const aiHeaders = (p, key) => ({
  'content-type': 'application/json',
  ...(p === 'claude' && { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }),
  ...(p === 'openai' && { authorization: 'Bearer ' + key }),
  ...(p === 'gemini' && { 'x-goog-api-key': key }),
});

async function aiSettings() {
  const { apiKey, aiModel } = await store.get(['apiKey', 'aiModel']);
  const p = providerOf(apiKey);
  if (!p) throw new Error(NO_KEY);
  return { p, key: apiKey, model: aiModel || PROVIDERS[p].model, name: PROVIDERS[p].name };
}

// Free check on Save: asks the provider for the model's info, which fails on a bad key or unknown model.
async function checkKey(key, model) {
  const p = providerOf(key);
  if (!p) return 'Unknown key. Claude keys start with "sk-ant-", ChatGPT keys with "sk-", Gemini keys with "AIza".';
  model ||= PROVIDERS[p].model;
  const url = { claude: 'https://api.anthropic.com/v1/models/', openai: 'https://api.openai.com/v1/models/', gemini: 'https://generativelanguage.googleapis.com/v1beta/models/' }[p] + model;
  try {
    const res = await fetch(url, { headers: aiHeaders(p, key) });
    if (res.ok) return null;
    const j = await res.json().catch(() => ({}));
    return `${PROVIDERS[p].name} said no to this key or model "${model}": ${j.error?.message || res.status}`;
  } catch {
    return `Could not reach ${PROVIDERS[p].name}. Check your connection.`;
  }
}

// One call to whichever AI is set up. tool = {name, description, schema} asks for structured output.
// Returns { text, input } where input is the tool's arguments (or null if the model answered in text).
async function ai(prompt, { tool = null, maxTokens = 8000 } = {}) {
  const { p, key, model, name } = await aiSettings();
  // GPT-5 and Gemini 2.5 count their hidden reasoning against the output limit, so they get more room.
  const room = p === 'claude' ? maxTokens : maxTokens * 4;
  const req = {
    claude: () => ['https://api.anthropic.com/v1/messages', {
      model, max_tokens: room, messages: [{ role: 'user', content: prompt }],
      // Opus 5.5 rejects forced tool_choice ("tool"/"any"), so it's "auto" plus the text fallback in aiTool.
      ...(tool && { tools: [{ name: tool.name, description: tool.description, input_schema: tool.schema }], tool_choice: { type: 'auto' } }),
    }],
    openai: () => ['https://api.openai.com/v1/chat/completions', {
      model, max_completion_tokens: room, messages: [{ role: 'user', content: prompt }],
      ...(tool && { tools: [{ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.schema } }], tool_choice: { type: 'function', function: { name: tool.name } } }),
    }],
    gemini: () => [`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: room },
      ...(tool && { tools: [{ functionDeclarations: [{ name: tool.name, description: tool.description, parameters: tool.schema }] }], toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [tool.name] } } }),
    }],
  }[p];
  const [url, body] = req();
  const res = await fetch(url, { method: 'POST', headers: aiHeaders(p, key), body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`${name}: ${json.error?.message || res.statusText}`);
  const full = () => new Error(`${name} ran out of space. Try fewer gigs.`);

  if (p === 'claude') {
    if (json.stop_reason === 'max_tokens') throw full();
    return { text: json.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n'), input: json.content.find((c) => c.type === 'tool_use')?.input || null };
  }
  if (p === 'openai') {
    const c = json.choices?.[0];
    if (c?.finish_reason === 'length') throw full();
    const args = c?.message?.tool_calls?.[0]?.function?.arguments;
    return { text: c?.message?.content || '', input: args ? JSON.parse(args) : null };
  }
  const c = json.candidates?.[0];
  if (c?.finishReason === 'MAX_TOKENS') throw full();
  const parts = c?.content?.parts || [];
  return { text: parts.filter((x) => x.text).map((x) => x.text).join('\n'), input: parts.find((x) => x.functionCall)?.functionCall.args || null };
}

// Structured answer via a tool call, with a JSON-in-text fallback.
async function aiTool(prompt, name, schema, normalize, what) {
  const r = await ai(prompt + `\n\nSubmit your answer by calling the ${name} tool.`, { tool: { name, description: `Submit the finished ${what}.`, schema } });
  if (r.input) return normalize(r.input);
  const m = r.text.match(/\{[\s\S]*\}/);
  try { return normalize(JSON.parse(m[0])); } catch { throw new Error(`The AI did not return a ${what}. Try again.`); }
}
const aiGig = (prompt) => aiTool(prompt, 'submit_gig', GIG_SCHEMA, normalizeGig, 'listing');

function marketContext(s) {
  const { data, report: r } = current;
  return `SEARCH: "${data.query}"
MARKET: ${JSON.stringify(r.market)}
MUST-USE KEYWORDS (keyword, % of titles on page 1): ${r.mustUse.map((x) => `${x.keyword} ${pct(x.usage)}`).join('; ')}
OVER-REPRESENTED IN TOP 10: ${r.winning.map((x) => x.keyword).join('; ')}
LONG-TAIL: ${r.longTail.map((x) => x.keyword).join('; ')}
COMMON GIG ATTRIBUTES: ${r.attrs.map((a) => a.join(' ×')).join('; ')}
PLATFORM: ${current.platform === 'upwork' ? 'Upwork Project Catalog' : 'Fiverr'}
ALL ${data.gigs.length} RESULTS (rank | title | level | rating (reviews) | start $ | days):
${data.gigs.map((g) => `${g.pos + 1} | ${g.title} | ${level(g.level)} | ${g.rating} (${g.reviews}) | ${g.price} | ${g.days}`).join('\n')}
${s.myTitle ? `MY CURRENT TITLE: "${s.myTitle}"` : ''}
ABOUT ME: ${s.about || 'not given — keep claims generic, no invented numbers'}`;
}

// ---------- My Gig ----------
async function generateGig() {
  if (current?.kind !== 'search') return status('Open a Fiverr search or Upwork Project Catalog search first.');
  const rules = rulesFor(current.platform);
  const noun = current.platform === 'upwork' ? 'project' : 'gig';
  const s = await store.get(['apiKey', 'about', 'myTitle', 'gigCache']);
  if (!s.apiKey) { openSettings(['key']); return status(NO_KEY); }

  const targets = current.data.gigs.slice(0, MAX_STUDY);
  const n = targets.length;
  const cache = s.gigCache || {};
  const fresh = (u) => cache[u]?.v === CACHE_VERSION && Date.now() - cache[u].at < CACHE_DAYS * 864e5;
  const btn = $('gigBtn');
  busy = true;
  put($('gigOut'));
  btn.disabled = true;
  btn.textContent = 'Working… keep this panel open';
  $('progress').hidden = false;
  $('stopBtn').hidden = false;
  $('stopBtn').disabled = false;
  stopReading = false;
  const prog = (i, text) => { $('progressBar').style.width = Math.round((i / (n + 2)) * 100) + '%'; $('progressText').textContent = text; };
  const step = (name) => {
    const order = ['read', 'write', 'check', 'done'];
    document.querySelectorAll('#steps li').forEach((li) => {
      const d = order.indexOf(li.dataset.step) - order.indexOf(name);
      li.className = d < 0 || name === 'done' ? 'done' : d === 0 ? 'active' : '';
    });
  };
  step('read');
  const guard = captchaGuard(() => prog(i0, `${rules.platform} asked for a captcha. Solve it in the opened tab; reading continues automatically.`));
  let i0 = 0;
  let toRead = targets.filter((g) => !fresh(g.url)).length, readMs = 0, readCount = 0;
  const eta = () => { const per = readCount ? readMs / readCount : 9000; const sec = Math.round((toRead * per) / 1000) + 40; return sec > 90 ? `~${Math.ceil(sec / 60)} min left` : `~${sec}s left`; };

  try {
    const details = [];
    for (const [i, g] of targets.entries()) {
      if (stopReading) break;
      i0 = i;
      prog(i, `Reading ${noun} ${i + 1}/${n} · ${eta()} · ${g.title.slice(0, 50)}`);
      let d = fresh(g.url) ? cache[g.url] : null;
      if (!d) {
        const t0 = Date.now();
        // after a second captcha we stop; everything read so far is cached, so "Generate again" resumes
        d = await readInTab(g.url, 'gig', guard.handler, (x) => x.description || x.packages);
        if (d) await cacheGig(d);
        await sleep(1500 + Math.random() * 2000); // pace requests like a person
        readMs += Date.now() - t0; readCount++; toRead--;
      }
      if (d) details.push({ rank: g.pos + 1, reviews: g.reviews, price: g.price, ...d });
    }
    $('stopBtn').hidden = true;
    // re-run keyword analysis so freshly collected tags are included
    current.report = analyze(current.data.gigs, current.data.total, tagCounts((await store.get('gigCache')).gigCache));
    renderKeywords();

    const block = details.map((d) => `### #${d.rank} — ${d.title} (${d.reviews} reviews, from $${d.price})
TAGS: ${(d.tags || []).join(', ') || '-'}
DESCRIPTION: ${d.description || '-'}
PACKAGES:
${(d.packages || '-').slice(0, 1500)}
FAQ: ${(d.faq || []).map((f) => `Q: ${f.q} A: ${f.a}`).join(' | ') || '-'}
${d.pageText ? 'PAGE TEXT: ' + d.pageText : ''}`).join('\n\n');

    if (!details.length) throw new Error(`Could not read any competitor ${noun}s. Reload the tab and try again.`);
    step('write');
    prog(n, `The AI is writing your ${noun} from ${details.length} competitor ${noun}s… (~1 min)`);
    const prompt = `${marketContext(s)}

DETAILED COMPETITOR ${noun.toUpperCase()}S (the top ${details.length}, read in full; the results list above shows the wider market):
${block}

TASK: You are a top-rated ${rules.platform} seller and ${rules.platform} SEO expert. Study ALL the data above: titles, keywords, tags, descriptions, packages, prices, FAQ. Use these detailed competitors for positioning and pricing; use the full results list for market trends.
FIRST fill "opportunity" (Gig Opportunity Report): best keyword + the numbers behind it (a hypothesis, not a guarantee; never claim demand you can't see), target buyer, my differentiator (only from ABOUT ME), the price range comparable gigs support (with numbers), competitor gaps, and what to test first after publishing (one variable at a time). THEN write the gig so it follows that report.
- Titles: each starts with "${rules.prefix.trim()}", max ${rules.title} characters INCLUDING "${rules.prefix}". Put the strongest keyword in the first words. Count the characters.
- Tags: exactly ${rules.tags}, max ${rules.tag} chars, letters/numbers/spaces only, chosen from what top ${noun}s and buyers use.
- Description: ${rules.descMin}-${rules.desc} characters. Hook, what I deliver, why me, process, • benefit bullets, call to action. Use must-use and winning keywords naturally, no stuffing. Must be original; never copy competitor sentences.
- Packages: ${current.platform === 'upwork' ? 'Starter/Standard/Advanced' : 'Basic/Standard/Premium'}. Name max ${rules.pkgName} chars, description max ${rules.pkgDesc} chars${rules.priceStep > 1 ? `, prices multiples of $${rules.priceStep}` : ''}, priced to win against these competitors as a newer seller while staying profitable.
- FAQ answers max ${rules.faqA} chars. 5 FAQs that answer what competitors leave unanswered.
- No contact details, links, or off-platform mentions (${rules.platform} ToS). Never invent testimonials, client results, download numbers, certifications, years or expertise: use only facts from ABOUT ME.
- claims_to_verify: list every claim in the gig I must be able to prove (portfolio item, experience, result).
- competitor_insights: what the top gigs do and the gaps you exploited.
- action_plan: 8-12 ordered steps (Day 1, Week 1, Week 2, Month 1...) telling me exactly what to do after publishing: gig image/video, pricing changes, buyer requests, how to get the first reviews, when to raise prices, which keywords to add later, how to stay active. Each step's "why" must cite a concrete number or pattern from the data above (e.g. median reviews, price spread, what the top 10 do).`;

    const autoFixed = [];
    let gig = autoFixGig(await aiGig(prompt), autoFixed, rules); // tags, prices, days, title prefix fixed in code
    step('check');
    let issues = validateGig(gig, rules);
    if (issues.length) {
      // only wording problems (lengths, missing items) are left for the AI
      prog(n + 1, `Rewording ${issues.length} part(s) to fit ${rules.platform} limits…`);
      const fixed = await aiGig(`Here is a ${rules.platform} listing as JSON:\n${JSON.stringify(gig)}\n\nIt breaks these Fiverr rules:\n${issues.map((x) => `- ${x.field}: ${x.msg}`).join('\n')}\n\nFix ONLY those problems (shorten/rephrase, keep keywords and meaning) and submit the full corrected listing. Limits: ${JSON.stringify(rules)}.`);
      // keep original sections the fix reply left empty
      const kept = (k, v) => (k === 'opportunity' ? v.best_keyword : Array.isArray(v) ? v.length : v);
      gig = autoFixGig(Object.fromEntries(Object.entries(fixed).map(([k, v]) => [k, kept(k, v) ? v : gig[k]])), autoFixed, rules);
      issues = validateGig(gig, rules);
    }
    const r = current.report;
    const lastGig = { gig, platform: current.platform, key: current.key, query: current.data.query, studied: details.length, total: n, autoFixed: [...new Set(autoFixed)], at: Date.now(),
      market: r.market, keywords: { mustUse: r.mustUse.map((x) => x.keyword), winning: r.winning.map((x) => x.keyword), longTail: r.longTail.map((x) => x.keyword), tags: r.tags.map((t) => t[0]) } };
    const { gigResults = {} } = await store.get('gigResults');
    const prev = gigResults[lastGig.key];
    // a partial scan (Stop / captcha) must not replace a result built from more gigs
    if (prev && prev.studied > lastGig.studied) lastGig.unsaved = prev.studied;
    else { gigResults[lastGig.key] = lastGig; await store.set({ gigResults }); }
    step('done');
    prog(n + 2, `Done. Studied ${details.length} ${noun}s.` + (guard.count >= 2 ? ` Stopped after 2 captchas; click Generate again later to read the other ${n - details.length} (already-read ones are skipped).` : ''));
    toast(`Your ${noun} is ready`);
    renderGig(lastGig);
    status(`Your ${noun} is ready.`);
  } catch (e) {
    $('progressText').textContent = e.message;
    status(e.message);
    const { gigResults = {} } = await store.get('gigResults');
    if (gigResults[current.key]) renderGig(gigResults[current.key]); // a failed run never hides the last good result
  } finally {
    busy = false;
    btn.disabled = false;
    btn.textContent = 'Generate again';
    $('stopBtn').hidden = true;
  }
}

// ---------- rendering ----------
const copyBtn = (getText) => h('button', { className: 'secondary small', textContent: 'Copy', title: 'Copy to clipboard', onclick: () => copy(getText()) });
const counter = (len, max) => h('span', { className: 'count' + (len > max ? ' over' : ''), textContent: `${len}/${max}` });
const card = (title, ...kids) => h('div', { className: 'card' }, h('h3', {}, ...[].concat(title)), ...kids);
const chips = (rows, label) => h('div', { className: 'chips' }, rows.length
  ? rows.map((r) => { const k = r.keyword || r[0]; return h('button', { className: 'chip', title: 'Click to copy', onclick: () => copy(k, `"${k}" copied`) }, k, h('small', {}, label(r))); })
  : h('span', { className: 'muted' }, 'None'));

// One verdict that always agrees with the gauge: the band comes from difficulty, the nuance from the evidence.
function verdict(m, gigs) {
  const n = gigs.length;
  const prices = gigs.map((g) => g.price).filter((p) => p != null).sort((a, b) => a - b);
  const p25 = prices[Math.floor(prices.length / 4)] ?? m.medianPrice;
  const beatable = m.weakGigsOnPage / n >= 0.2;
  const band = m.difficulty >= 70 ? 'hard' : m.difficulty >= 45 ? 'mid' : 'good';
  const headline = {
    good: 'Easy to enter',
    mid: beatable ? 'Medium: winnable' : 'Medium competition',
    hard: beatable ? 'Hard, but new gigs still rank' : 'Hard: target long-tail',
  }[band];
  const points = [
    `Top sellers have a median of ${m.medianReviews} reviews`,
    `${m.weakGigsOnPage} of ${n} page-1 gigs have under 20 reviews${beatable ? ', so there is room for new sellers' : ''}`,
    `Typical entry price $${p25}–$${m.medianPrice} (a quarter of gigs start at $${p25} or less)`,
    band === 'hard' && !beatable ? 'Target the long-tail keywords in the Keywords tab' : `Compete with a sharper title, clearer packages and an entry price near $${p25}`,
  ];
  return { band, headline, points };
}

function renderOverview() {
  const { data, report: r, mine, rankHistory } = current;
  const m = r.market;
  const n = data.gigs.length;
  const stat = (label, val) => h('div', { className: 'stat' }, h('b', {}, String(val)), h('span', {}, label));
  const v = verdict(m, data.gigs);
  const levels = Object.entries(m.levels).sort((a, b) => b[1] - a[1]);
  put($('tab-overview'), 
    h('div', { className: 'card hero ' + v.band },
      h('div', { className: 'hero-top' },
        h('div', { className: 'gauge-wrap' },
          h('div', { className: 'gauge', style: `--v:${m.difficulty}`, role: 'img', 'aria-label': `Difficulty ${m.difficulty} out of 100` }, h('b', {}, String(m.difficulty)), h('span', {}, '/100')),
          h('div', { className: 'gauge-label' }, 'Difficulty')),
        h('div', { className: 'headline grow' }, v.headline)),
      h('ul', { className: 'points' }, v.points.map((p) => h('li', {}, p))),
      h('button', { className: 'primary', style: 'width:100%;margin-top:10px', textContent: 'Generate my gig →', onclick: () => showTab('gig') })),
    card('Market',
      h('div', { className: 'grid' },
        stat('competing gigs', m.total?.toLocaleString() ?? '?'),
        stat('median reviews (page 1)', m.medianReviews),
        stat('median start price', '$' + m.medianPrice),
        stat('price range', `$${m.minPrice}–$${m.maxPrice}`),
        stat('gigs under 20 reviews', `${m.weakGigsOnPage}/${n}`),
        stat('your rank (estimate)', mine.length ? '#' + rankHistory.at(-1).pos : '—'))),
    card('Seller levels on page 1', ...levels.map(([k, v]) => h('div', { style: 'margin:6px 0' },
      h('div', { className: 'meta', style: 'display:flex' }, h('span', { className: 'grow' }, level(k)), h('span', {}, `${v} · ${pct(v / n)}`)),
      h('div', { className: 'bar' }, h('div', { style: `width:${(v / n) * 100}%` }))))),
    rankHistory.length ? card('Your rank history', h('div', { className: 'chips' }, rankHistory.map((x) => h('span', { className: 'chip' }, '#' + x.pos, h('small', {}, x.at))))) : null,
    !mine.length ? h('p', { className: 'muted' }, 'Tip: set your username in ⚙ Settings to track your rank for this search.') : null,
  );
}

function renderKeywords() {
  const r = current.report;
  const adviceOut = h('div', { className: 'text' });
  const adviceBtn = h('button', { className: 'secondary small', textContent: 'Ask AI', onclick: async () => {
    adviceBtn.disabled = true;
    adviceOut.textContent = 'Thinking…';
    try {
      const s = await store.get(['about', 'myTitle']);
      const r = await ai(`${marketContext(s)}\n\nAs a Fiverr SEO expert, reply in short plain text: 1) primary keyword to rank for and why, 2) 5 long-tail keywords a newer gig can rank for, 3) keywords to repeat in the description, 4) the biggest gap competitors leave.`, { maxTokens: 2000 });
      adviceOut.textContent = r.text;
    } catch (e) { adviceOut.textContent = e.message; } finally { adviceBtn.disabled = false; }
  } });
  put($('tab-keywords'), 
    card('Must-use · most competitors use these', chips(r.mustUse, (x) => pct(x.usage))),
    card('Winning · over-represented in the top 10', chips(r.winning, (x) => `${x.inTop}/10 · ${x.lift.toFixed(1)}×`)),
    card('Long-tail · fewer gigs, strong reviews', chips(r.longTail, (x) => `${x.gigs} gigs`)),
    card('Competitor tags', r.tags.length ? chips(r.tags, (x) => '×' + x[1]) : h('div', { className: 'muted' }, 'Collected automatically when you Generate my gig.')),
    card('Gig attributes', chips(r.attrs, (x) => '×' + x[1])),
    card(['AI keyword advice', h('span', { className: 'grow' }), adviceBtn], adviceOut),
    compareCard(),
  );
}

function renderCompetitors() {
  const { data, mine } = current;
  const meSet = new Set(mine.map((g) => g.url));
  const sorts = { rank: (a, b) => a.pos - b.pos, reviews: (a, b) => b.reviews - a.reviews, cheap: (a, b) => a.price - b.price, pricey: (a, b) => b.price - a.price, fast: (a, b) => a.days - b.days };
  const q = h('input', { type: 'search', placeholder: 'Filter by title, seller, level…', 'aria-label': 'Filter competitors' });
  const sort = h('select', { 'aria-label': 'Sort competitors' }, [['rank', 'Sort: rank'], ['reviews', 'Most reviews'], ['cheap', 'Cheapest'], ['pricey', 'Most expensive'], ['fast', 'Fastest delivery']].map(([v, t]) => h('option', { value: v, textContent: t })));
  const list = h('div');
  const draw = () => {
    const term = q.value.toLowerCase();
    const rows = data.gigs.filter((g) => !term || `${g.title} ${g.seller} ${level(g.level)}`.toLowerCase().includes(term)).sort(sorts[sort.value]);
    list.replaceChildren(...(rows.length ? rows.map((g) => h('div', { className: 'comp' + (meSet.has(g.url) ? ' me' : '') },
      h('div', { className: 'rank' }, '#' + (g.pos + 1)),
      h('div', {},
        h('a', { href: g.url, target: '_blank', textContent: rulesFor(current.platform).prefix + g.title }),
        h('div', { className: 'meta' },
          `${g.seller} · ${level(g.level)} · ★ ${g.rating ?? '-'} (${g.reviews}) · $${g.price ?? '-'} · ${g.days ?? '-'}d`,
          g.pro && h('span', { className: 'badge' }, 'PRO'), g.choice && h('span', { className: 'badge' }, 'CHOICE'), g.ad && h('span', { className: 'badge' }, 'AD'))))) : [h('div', { className: 'muted' }, 'No match.')]));
  };
  q.oninput = draw;
  sort.onchange = draw;
  draw();
  put($('tab-competitors'), card([`${data.gigs.length} competitors`, h('span', { className: 'grow' }), h('button', { className: 'secondary small', textContent: 'CSV', title: 'Download as CSV', onclick: downloadCsv })], h('div', { className: 'filters' }, q, sort), list));
}

// One wording for the rule check, used by the panel, PDF and Markdown so they never disagree.
const RULE_NOTE = "These are this extension's format checks (title, tags, description, package text, prices, no contact info). They are not a guarantee of platform approval and do not cover category-specific requirements: review before publishing.";
function ruleSummary(last) {
  const issues = validateGig(normalizeGig(last.gig), rulesFor(last.platform));
  return { issues, fixes: last.autoFixed || [], note: RULE_NOTE + (last.platform === 'upwork' ? ' Upwork Project Catalog limits are not published where we could verify them; these mirror Fiverr\'s.' : ''), headline: issues.length ? `${issues.length} item(s) need manual editing` : 'Format checks passed' };
}

function compareCard() {
  const rows = Object.entries(current.searches || {}).sort((a, b) => b[1].score - a[1].score);
  const remove = async (k) => {
    const { searches = {} } = await store.get('searches');
    delete searches[k];
    await store.set({ searches });
    current.searches = searches;
    renderKeywords();
  };
  return h('details', { className: 'card' },
    h('summary', {}, `Compare searches you analyzed (${rows.length})`),
    h('p', { className: 'meta' }, 'Opportunity score out of 100 from page-1 competition and price room (not buyer demand). Analyze related searches to compare them.'),
    ...rows.map(([k, o]) => h('div', { className: 'kw' + (k === current.key ? ' me' : '') },
      h('div', { className: 'kw-score' }, String(o.score)),
      h('div', { className: 'grow' },
        h('b', {}, k.replace(/^upwork:/, 'Upwork · ')),
        h('div', { className: 'meta' }, `beatable ${o.parts.beatable}/40 · competition ${o.parts.competition}/40 · price ${o.parts.priceRoom}/20`),
        h('div', { className: 'meta' }, o.evidence)),
      h('button', { className: 'icon-btn', textContent: '×', title: 'Remove', 'aria-label': `Remove ${k}`, onclick: () => remove(k) }))));
}

function gigAsMarkdown(last) {
  const RL = rulesFor(last.platform), noun = last.platform === 'upwork' ? 'project' : 'gig';
  const g = normalizeGig(last.gig), o = g.opportunity, rc = ruleSummary(last), k = last.keywords || {};
  const list = (a) => (a.length ? a.map((x) => `- ${x}`).join('\n') : '- (none)');
  const cell = (v) => String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [
    `# ${RL.platform} ${noun} plan: "${last.query}"`, `_${new Date(last.at || Date.now()).toLocaleDateString()} · built from ${last.studied} competitor ${noun}s_`, '',
    '## Opportunity report', `- **Best keyword:** ${o.best_keyword}`, `- **Evidence:** ${o.evidence}`, `- **Target buyer:** ${o.target_buyer}`, `- **Differentiator:** ${o.differentiator}`, `- **Price range:** ${o.price_range}`,
    '', '**Competitor gaps**', list(o.competitor_gaps), '', '**Test first**', list(o.test_first), '',
    '## Claims to verify before publishing', list(g.claims_to_verify), '',
    '## Action plan', ...g.action_plan.map((x, i) => `${i + 1}. **${x.when}:** ${x.action}  \n   _Why: ${x.why}_`), '',
    '## Titles', list(g.titles.map((t) => `${t} (${t.length}/${RL.title})`)), '',
    `## Category\n${g.category} > ${g.subcategory}`, '',
    `## Tags\n${g.tags.join(', ')}`, '',
    `## Description (${g.description.length}/${RL.desc})`, g.description, '',
    '## Packages', '| Tier | Name | Price | Days | Revisions | Description |', '|---|---|---|---|---|---|',
    ...g.packages.map((p) => `| ${cell(p.tier)} | ${cell(p.name)} | $${p.price} | ${p.days} | ${cell(p.revisions)} | ${cell(p.description)} |`), '',
    '**Included per package**', ...g.packages.map((p) => `- ${p.tier}: ${p.includes.join(', ') || '-'}`), '',
    '## Extras', list(g.extras.map((x) => `${x.name}: $${x.price}`)), '',
    '## FAQ', ...g.faq.map((f) => `**${f.q}**  \n${f.a}\n`), '',
    '## Buyer requirements', list(g.requirements), '',
    `## Gig image idea\n${g.image_idea}`, '',
    '## Why this gig wins', list(g.why_it_wins), '',
    '## What competitors do', list(g.competitor_insights), '',
    '## Keyword research', `- Must-use: ${(k.mustUse || []).join(', ')}`, `- Winning (top 10): ${(k.winning || []).join(', ')}`, `- Long-tail: ${(k.longTail || []).join(', ')}`, `- Competitor tags: ${(k.tags || []).join(', ')}`, '',
    `## Rule check: ${rc.headline}`, list(rc.issues.map((x) => `${x.field}: ${x.msg}`)), '', '**Changed automatically by code**', list(rc.fixes), '', `_${rc.note}_`,
  ].join('\n');
}

const download = (name, text, type) => h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name }).click();

function renderGig(last) {
  const RL = rulesFor(last.platform), noun = last.platform === 'upwork' ? 'project' : 'gig';
  const { gig, query, studied } = last;
  const g = normalizeGig(gig);
  const rc = ruleSummary(last);
  const issues = rc.issues;
  const line = (text, max) => h('div', { className: 'line' }, h('div', { className: 'grow text' }, text), max ? counter(text.length, max) : null, copyBtn(() => text));
  put($('gigOut'), 
    last.unsaved ? h('div', { className: 'warn' }, `Built from ${studied} gigs, so it was not saved over your earlier result built from ${last.unsaved} gigs. `,
      h('button', { className: 'link', textContent: 'Save this one instead', onclick: async () => {
        const { gigResults = {} } = await store.get('gigResults');
        delete last.unsaved;
        gigResults[last.key || query] = last;
        await store.set({ gigResults });
        renderGig(last);
        toast('Saved');
      } })) : null,
    h('div', { className: issues.length ? 'issues' : 'ok' },
      h('b', {}, (issues.length ? '' : '✓ ') + rc.headline), ` · built from ${studied}${last.total ? '/' + last.total : ''} competitor ${noun}s for “${query}”`,
      issues.length ? h('ul', {}, issues.map((x) => h('li', {}, `${x.field}: ${x.msg}`))) : null,
      rc.fixes.length ? h('details', {}, h('summary', {}, `${rc.fixes.length} change(s) made automatically by code`), h('ul', {}, rc.fixes.map((x) => h('li', {}, x)))) : null,
      h('div', { className: 'meta' }, rc.note)),
    h('div', { className: 'actions' },
      h('button', { className: 'primary grow', textContent: 'Download PDF', onclick: () => buildPdf(last).save(`fiverr-gig-${query.replace(/\W+/g, '-')}.pdf`) }),
      h('button', { className: 'secondary', textContent: 'Markdown', title: 'Download as .md', onclick: () => download(`fiverr-gig-${query.replace(/\W+/g, '-')}.md`, gigAsMarkdown(last), 'text/markdown') }),
      h('button', { className: 'secondary', textContent: 'Copy all', onclick: () => copy(gigAsMarkdown(last), 'Whole gig copied') })),
    h('button', { className: 'link', textContent: 'Clear this result and start fresh', onclick: async () => {
      const { gigResults = {} } = await store.get('gigResults');
      delete gigResults[last.key || query];
      await store.set({ gigResults });
      showGigFor(last.key || query);
      toast('Cleared');
    } }),
    g.opportunity.best_keyword ? card('Opportunity report',
      h('div', { className: 'report' },
        ...[['Best keyword', g.opportunity.best_keyword], ['Evidence', g.opportunity.evidence], ['Target buyer', g.opportunity.target_buyer], ['Why you', g.opportunity.differentiator], ['Price range', g.opportunity.price_range]]
          .map(([k, v]) => h('div', {}, h('span', { className: 'meta' }, k), h('div', {}, v)))),
      g.opportunity.competitor_gaps.length ? h('div', {}, h('div', { className: 'meta', style: 'margin-top:8px' }, 'Competitor gaps'), h('ul', {}, g.opportunity.competitor_gaps.map((x) => h('li', {}, x)))) : null,
      g.opportunity.test_first.length ? h('div', {}, h('div', { className: 'meta' }, 'Test first after publishing'), h('ol', {}, g.opportunity.test_first.map((x) => h('li', {}, x)))) : null) : null,
    g.claims_to_verify.length ? h('div', { className: 'warn' }, h('b', {}, 'Check before publishing: can you prove each claim?'), h('ul', {}, g.claims_to_verify.map((x) => h('li', {}, x)))) : null,
    g.action_plan.length ? card('Your action plan', h('ol', {}, g.action_plan.map((x) => h('li', { style: 'margin-bottom:8px' }, h('b', {}, x.when + ': '), x.action, h('div', { className: 'meta' }, 'Why: ' + x.why))))) : null,
    card('Title · pick one', ...g.titles.map((t) => line(t, RL.title))),
    card('Category', h('div', {}, `${g.category} › ${g.subcategory}`)),
    card(['Search tags', counter(g.tags.length, RL.tags), copyBtn(() => g.tags.join(', '))], h('div', { className: 'chips' }, g.tags.map((t) => h('span', { className: 'chip' }, t, h('small', {}, `${t.length}/${RL.tag}`))))),
    card(['Description', counter(g.description.length, RL.desc), copyBtn(() => g.description)], h('div', { className: 'text' }, g.description)),
    card('Packages', h('div', { className: 'pkgs' }, g.packages.map((p) => h('div', { className: 'pkg' },
      h('div', { className: 'meta' }, p.tier.toUpperCase()),
      h('div', { className: 'price' }, '$' + p.price),
      line(p.name, RL.pkgName),
      line(p.description, RL.pkgDesc),
      h('div', { className: 'meta' }, `${p.days} day delivery · ${p.revisions} revisions`),
      h('ul', {}, p.includes.map((x) => h('li', {}, x))))))),
    card('Gig extras', ...g.extras.map((x) => line(`${x.name} — $${x.price}${x.days ? ` (+${x.days} days)` : ''}`))),
    card('FAQ', ...g.faq.map((f) => h('div', { className: 'line' }, h('div', { className: 'grow' }, h('b', {}, f.q), h('div', { className: 'text' }, f.a)), counter(f.a.length, RL.faqA), copyBtn(() => `${f.q}\n${f.a}`)))),
    card('Buyer requirements', ...g.requirements.map((r) => line(r))),
    card('Gig image idea', h('div', { className: 'text' }, g.image_idea)),
    card('Why this wins', h('ul', {}, g.why_it_wins.map((x) => h('li', {}, x)))),
    card('What competitors do', h('ul', {}, g.competitor_insights.map((x) => h('li', {}, x)))),
  );
}

// ---------- PDF ----------
// jsPDF's built-in fonts only cover Windows-1252, so swap or drop anything outside it.
const pdfText = (s) => String(s ?? '').replace(/[✓✔]/g, '').replace(/›/g, '>').replace(/×/g, 'x').replace(/[^\x00-\xff•–—‘’“”…€™]/g, '').replace(/[ \t]+([.,;:!?])/g, '$1').replace(/[ \t]{2,}/g, ' ').trim();

function buildPdf(last) {
  const RL = rulesFor(last.platform), noun = last.platform === 'upwork' ? 'project' : 'gig';
  const { jsPDF } = window.jspdf;
  const g = normalizeGig(last.gig);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 48, CW = W - M * 2;
  const GREEN = [29, 191, 115], INK = [31, 32, 36], MUTED = [107, 110, 118];
  let y = M;

  const ensure = (need) => { if (y + need > H - M) { doc.addPage(); y = M; } };
  const font = (size, style = 'normal', color = INK) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color); };
  const para = (text, { size = 10.5, style = 'normal', color = INK, indent = 0, gap = 6 } = {}) => {
    font(size, style, color);
    const lines = doc.splitTextToSize(pdfText(text), CW - indent);
    lines.forEach((l) => { ensure(size * 1.4); doc.text(l, M + indent, y); y += size * 1.4; });
    y += gap;
  };
  const section = (title) => {
    ensure(60);
    y += 8;
    doc.setFillColor(...GREEN); doc.rect(M, y - 10, 3, 14, 'F');
    font(13, 'bold'); doc.text(pdfText(title), M + 10, y + 1);
    y += 20;
  };
  const bullets = (items, numbered = false) => items.forEach((t, i) => {
    font(10.5);
    const lines = doc.splitTextToSize(pdfText(t), CW - 16);
    ensure(lines.length * 15);
    doc.text(numbered ? `${i + 1}.` : '•', M, y);
    lines.forEach((l) => { doc.text(l, M + 16, y); y += 15; });
    y += 3;
  });

  // cover band
  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 92, 'F');
  font(20, 'bold', [255, 255, 255]); doc.text(`${RL.platform} ${noun === 'gig' ? 'Gig' : 'Project'} Plan`, M, 44);
  font(11, 'normal', [255, 255, 255]); doc.text(pdfText(`Search: "${last.query}"  ·  ${new Date(last.at || Date.now()).toLocaleDateString()}  ·  built from ${last.studied} competitor gigs`), M, 66);
  y = 122;

  const m = last.market;
  if (m) {
    section('Market snapshot');
    const stats = [['Competing gigs', m.total?.toLocaleString() ?? '?'], ['Difficulty', `${m.difficulty}/100`], ['Median reviews (page 1)', m.medianReviews], ['Median start price', '$' + m.medianPrice], ['Gigs < 20 reviews', m.weakGigsOnPage], ['Price range', `$${m.minPrice} – $${m.maxPrice}`]];
    const colW = CW / 3;
    stats.forEach(([k, v], i) => {
      const x = M + (i % 3) * colW, yy = y + Math.floor(i / 3) * 44;
      doc.setDrawColor(230, 231, 234); doc.roundedRect(x, yy - 14, colW - 8, 38, 4, 4, 'S');
      font(13, 'bold'); doc.text(pdfText(String(v)), x + 8, yy + 4);
      font(8.5, 'normal', MUTED); doc.text(pdfText(k), x + 8, yy + 17);
    });
    y += 92;
  }

  const o = g.opportunity;
  if (o.best_keyword) {
    section('Opportunity report');
    [['Best keyword', o.best_keyword], ['Evidence', o.evidence], ['Target buyer', o.target_buyer], ['Why you', o.differentiator], ['Price range', o.price_range]]
      .forEach(([k, v]) => { para(k, { size: 9, color: MUTED, gap: 0 }); para(v, { gap: 6 }); });
    if (o.competitor_gaps.length) { para('Competitor gaps', { size: 9, color: MUTED, gap: 0 }); bullets(o.competitor_gaps); }
    if (o.test_first.length) { para('Test first after publishing', { size: 9, color: MUTED, gap: 0 }); bullets(o.test_first, true); }
  }
  if (g.claims_to_verify.length) { section('Claims to verify before publishing'); bullets(g.claims_to_verify); }

  if (g.action_plan.length) {
    section('Your action plan');
    g.action_plan.forEach((s, i) => {
      font(10.5, 'bold', GREEN);
      ensure(40);
      doc.text(pdfText(`${i + 1}. ${s.when}`), M, y); y += 15;
      para(s.action, { indent: 14, gap: 0 });
      para('Why: ' + s.why, { indent: 14, size: 9.5, color: MUTED, gap: 8 });
    });
  }

  section('Gig title (pick one)');
  g.titles.forEach((t) => para(`${t}   (${t.length}/${RL.title})`, { gap: 2 }));
  section('Category');
  para(`${g.category} > ${g.subcategory}`);
  section('Search tags');
  para(g.tags.join('  ·  '));
  section(`Description (${g.description.length}/${RL.desc} chars)`);
  para(g.description);

  section('Packages');
  g.packages.forEach((p) => {
    ensure(70);
    font(11, 'bold'); doc.text(pdfText(`${p.tier}: ${p.name}`), M, y);
    font(11, 'bold', GREEN); doc.text(`$${p.price}`, W - M, y, { align: 'right' });
    y += 15;
    para(p.description, { size: 10, gap: 0 });
    para(`${p.days} day delivery · ${p.revisions} revisions`, { size: 9.5, color: MUTED, gap: 2 });
    if (p.includes.length) para('Includes: ' + p.includes.join(', '), { size: 9.5, gap: 10 });
  });

  if (g.extras.length) { section('Gig extras'); bullets(g.extras.map((x) => `${x.name} — $${x.price}${x.days ? ` (+${x.days} days)` : ''}`)); }
  if (g.faq.length) {
    section('FAQ');
    g.faq.forEach((f) => { para('Q: ' + f.q, { style: 'bold', gap: 0 }); para(f.a, { gap: 8 }); });
  }
  if (g.requirements.length) { section('Buyer requirements'); bullets(g.requirements, true); }
  if (g.image_idea) { section('Gig image idea'); para(g.image_idea); }
  if (g.why_it_wins.length) { section('Why this gig wins'); bullets(g.why_it_wins); }
  if (g.competitor_insights.length) { section('What competitors do'); bullets(g.competitor_insights); }

  const k = last.keywords;
  if (k) {
    section('Keyword research');
    [['Must-use', k.mustUse], ['Winning (top 10)', k.winning], ['Long-tail', k.longTail], ['Competitor tags', k.tags]].forEach(([label, list]) => list?.length && para(`${label}: ${list.join(', ')}`, { gap: 4 }));
  }

  const rc = ruleSummary(last);
  section('Rule check: ' + rc.headline);
  if (rc.issues.length) bullets(rc.issues.map((x) => `${x.field}: ${x.msg}`));
  if (rc.fixes.length) { para('Changed automatically by code', { size: 9, color: MUTED, gap: 0 }); bullets(rc.fixes); }
  para(rc.note, { size: 9, color: MUTED });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    font(8.5, 'normal', MUTED);
    doc.text(`Gig Spy · ${i}/${pages}`, W - M, H - 24, { align: 'right' });
  }
  return doc;
}

// ---------- CSV + settings ----------
function downloadCsv() {
  if (!current) return status('Analyze a search page first.');
  const cols = ['pos', 'title', 'seller', 'level', 'country', 'rating', 'reviews', 'price', 'days', 'pro', 'choice', 'ad', 'url'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = [cols.join(','), ...current.data.gigs.map((g) => cols.map((c) => esc(c === 'pos' ? g.pos + 1 : g[c])).join(','))].join('\n');
  h('a', { href: URL.createObjectURL(new Blob([body], { type: 'text/csv' })), download: `${current.platform}-${current.data.query.replace(/\W+/g, '-')}.csv` }).click();
}

$('analyze').onclick = () => run();
$('gigBtn').onclick = () => { showTab('gig'); generateGig(); };
$('stopBtn').onclick = () => { stopReading = true; $('stopBtn').disabled = true; toast('Finishing this gig, then writing…'); };
const SETTINGS = ['username', 'about', 'myTitle', 'myRate', 'fiverrProfile', 'upworkProfile', 'apiKey', 'aiModel'];
// Live hint under the key field: which AI the key is for, its default model, and where to get one.
function showKeyHint() {
  const p = providerOf($('apiKey').value.trim());
  $('aiModel').placeholder = p ? `default: ${PROVIDERS[p].model}` : 'default for your key';
  put($('keyHint'), p
    ? `✓ ${PROVIDERS[p].name} key`
    : ['Get a key: ', ...Object.values(PROVIDERS).flatMap((x, i) => [i ? ' · ' : '', h('a', { href: x.keys, target: '_blank', textContent: x.name })])]);
}
$('apiKey').oninput = showKeyHint;
$('save').onclick = async () => {
  const btn = $('save');
  const vals = Object.fromEntries(SETTINGS.map((k) => [k, $(k).value.trim()]));
  await store.set(vals);
  const shown = (part) => [...$('settings').querySelectorAll(`[data-for~="${part}"]`)].some((el) => !el.hidden);
  if (shown('key')) {
    btn.disabled = true;
    $('keyHint').textContent = 'Checking key…';
    const err = vals.apiKey ? await checkKey(vals.apiKey, vals.aiModel) : NO_KEY;
    btn.disabled = false;
    if (err) return ($('keyHint').textContent = '⚠ ' + err); // saved, but this step stays open until the key works
    hasKey = true;
    showKeyHint();
  }
  ['fiverr', 'upwork'].filter(shown).forEach((p) => (setupDone[p] = true));
  await store.set({ setupDone });
  document.body.classList.remove('setup');
  $('settings').hidden = true;
  toast(shown('key') ? `${PROVIDERS[providerOf(vals.apiKey)].name} key works ✓` : 'Saved');
  const next = afterSave;
  afterSave = null;
  next ? next() : run();
};
// side panels don't reliably show confirm() dialogs, so the button asks for a second click instead
$('clearCache').onclick = async () => {
  const b = $('clearCache');
  if (!b.dataset.armed) {
    b.dataset.armed = '1';
    b.textContent = 'Click again to delete all saved data (settings are kept)';
    setTimeout(() => { delete b.dataset.armed; b.textContent = 'Reset saved data…'; }, 5000);
    return;
  }
  delete b.dataset.armed;
  b.textContent = 'Reset saved data…';
  await store.remove(['gigCache', 'gigResults', 'searches', 'history', 'lastGig', 'profileCache', 'profileResults', 'proposals']);
  current = null;
  toast('Saved data cleared');
  run();
};

// Follow the browser: re-read when you switch tabs or a page finishes loading.
let debounce;
const autoRun = () => { clearTimeout(debounce); debounce = setTimeout(() => run(true), 400); };
chrome.tabs.onActivated.addListener(autoRun);
// info.url also fires for in-page navigation (Upwork's job slide-over, Fiverr's search filters)
chrome.tabs.onUpdated.addListener((_id, info, tab) => { if (tab.active && (info.status === 'complete' || info.url)) autoRun(); });
