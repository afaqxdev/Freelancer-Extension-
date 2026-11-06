// Upwork page reader. Injected with chrome.scripting into the page's MAIN world because profile pages keep their
// data in window.__NUXT__ (a JS object a content script can't see). The last expression is the result.
// Shapes verified on live pages (Oct 2026): job search, job page, catalog search, catalog project, talent search, profile.
(() => {
  // Nuxt 3 "devalue" payload: a flat array where objects point at other indexes.
  function unflatten(arr) {
    const memo = new Map();
    const wrappers = new Set(['ShallowReactive', 'Reactive', 'Ref', 'ShallowRef', 'EmptyRef', 'EmptyShallowRef', 'NuxtError']);
    const get = (i) => {
      if (typeof i !== 'number') return i;
      if (i < 0) return undefined;
      if (memo.has(i)) return memo.get(i);
      const v = arr[i];
      if (v === null || typeof v !== 'object') { memo.set(i, v); return v; }
      if (Array.isArray(v)) {
        if (typeof v[0] === 'string' && (wrappers.has(v[0]) || ['Date', 'Set', 'Map', 'null', 'BigInt', 'RegExp'].includes(v[0]))) {
          const [tag, ...rest] = v;
          let out = null;
          if (wrappers.has(tag)) out = get(rest[0]);
          else if (tag === 'Date') out = rest[0];
          else if (tag === 'Set') out = rest.map(get);
          else if (tag === 'Map') { out = {}; for (let k = 0; k < rest.length; k += 2) out[get(rest[k])] = get(rest[k + 1]); }
          memo.set(i, out);
          return out;
        }
        const out = [];
        memo.set(i, out);
        v.forEach((x) => out.push(get(x)));
        return out;
      }
      const out = {};
      memo.set(i, out);
      for (const [k, x] of Object.entries(v)) out[k] = get(x);
      return out;
    };
    return get(0);
  }

  const U = 'https://www.upwork.com';
  const text = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
  const params = new URLSearchParams(location.search);
  const page = Number(params.get('page') || 1);

  if (/just a moment|attention required|access denied/i.test(document.title) || document.querySelector('#challenge-form, .cf-turnstile')) {
    return { platform: 'upwork', kind: 'captcha', captcha: true };
  }

  let nuxt3 = null;
  try { const el = document.getElementById('__NUXT_DATA__'); if (el) nuxt3 = unflatten(JSON.parse(el.textContent)); } catch { /* not a Nuxt 3 page */ }
  const vuex = nuxt3?.vuex || {};

  // ---- job opened in the search slide-over: same document, so the page data is still the search ----
  const slider = location.pathname.match(/\/search\/jobs\/details\/(~[0-9a-z]+)/i);
  if (slider) return { platform: 'upwork', kind: 'up-job-link', url: `${U}/jobs/${slider[1]}` };

  // ---- job search (talent search pages also carry an empty jobsSearch, so match the URL too) ----
  if (vuex.jobsSearch?.jobs && /\/search\/jobs/.test(location.pathname)) {
    const js = vuex.jobsSearch;
    return {
      platform: 'upwork', kind: 'up-jobs', query: params.get('q') || '', page, total: js.paging?.total ?? null,
      jobs: js.jobs.map((j, i) => ({
        pos: i,
        title: text(j.title),
        url: `${U}/jobs/${j.ciphertext}`,
        type: j.type === 2 ? 'hourly' : 'fixed',
        hourlyMin: j.hourlyBudget?.min || null,
        hourlyMax: j.hourlyBudget?.max || null,
        fixed: j.amount?.amount || null,
        level: String(j.tierText || '').replace(/^jsn_|_\d+$/g, '') || null,
        duration: j.durationLabel || null,
        posted: j.publishedOn || j.createdOn,
        skills: (j.attrs || []).map((a) => a.prettyName).filter(Boolean),
        proposals: j.proposalsTier || null,
        client: {
          verified: !!j.client?.isPaymentVerified,
          spent: j.client?.totalSpent?.amount ?? j.client?.totalSpent ?? null,
          rating: j.client?.totalFeedback ?? null,
          reviews: j.client?.totalReviews ?? null,
          country: j.client?.location?.country ?? null,
        },
        description: text(j.description).slice(0, 600),
      })),
    };
  }

  // ---- single job ----
  if (vuex.jobDetails?.job) {
    const jd = vuex.jobDetails, j = jd.job, b = jd.buyer || {}, ca = j.clientActivity || {};
    const skills = [...(jd.sands?.additionalSkills || []).map((s) => s.name), ...(jd.sands?.ontologySkills || []).map((s) => s.name || s.prefLabel)].filter(Boolean);
    return {
      platform: 'upwork', kind: 'up-job', url: `${U}/jobs/${j.ciphertext}`,
      title: text(j.title),
      description: text(j.description).slice(0, 5000),
      type: j.type === 2 ? 'hourly' : 'fixed',
      hourlyMin: j.extendedBudgetInfo?.hourlyBudgetMin || null,
      hourlyMax: j.extendedBudgetInfo?.hourlyBudgetMax || null,
      fixed: j.budget?.amount || null,
      level: { 1: 'Entry', 2: 'Intermediate', 3: 'Expert' }[j.contractorTier] || null,
      duration: j.engagementDuration?.label || null,
      workload: j.workload || null,
      category: j.category?.name || null,
      skills,
      posted: j.publishTime || j.postedOn,
      questions: (j.questions || jd.questions || []).map((q) => text(q.question || q)).filter(Boolean),
      activity: { applicants: ca.totalApplicants ?? null, hired: ca.totalHired ?? null, interviewing: ca.totalInvitedToInterview ?? null, invites: ca.invitationsSent ?? null, lastSeen: ca.lastBuyerActivity || null },
      client: {
        verified: !!b.isPaymentMethodVerified,
        spent: b.stats?.totalCharges?.amount ?? null,
        hires: b.stats?.totalJobsWithHires ?? null,
        posted: b.jobs?.postedCount ?? null,
        rating: b.stats?.score ?? null,
        reviews: b.stats?.feedbackCount ?? null,
        hours: b.stats?.hoursCount ?? null,
        avgRate: b.avgHourlyJobsRate?.amount ?? null,
        country: b.location?.country ?? null,
        since: b.company?.contractDate ?? null,
      },
    };
  }

  // ---- catalog search (same shape as a Fiverr search so the gig tools reuse it) ----
  if (vuex.search?.projects) {
    const s = vuex.search;
    return {
      platform: 'upwork', kind: 'search', query: params.get('q') || '', page, total: s.paging?.total ?? null,
      gigs: s.projects.map((p, i) => ({
        pos: i,
        title: String(p.title || '').replace(/^you will get\s+/i, ''),
        seller: p.person?.shortName,
        level: p.person?.topRatedPlus ? 'top_rated_plus' : p.person?.topRated ? 'top_rated' : p.person?.risingTalent ? 'rising_talent' : 'new',
        rating: p.person?.rating ? Math.round(p.person.rating * 100) / 100 : null,
        reviews: p.person?.totalFeedback ?? 0,
        price: p.priceStart ?? null,
        days: p.deliveryTime ?? p.minDaysToFulfill ?? null,
        pro: false, choice: false, ad: false, attrs: [],
        url: `${U}/services/product/${p.slug}`,
        profileUrl: p.person?.ciphertext ? `${U}/freelancers/${p.person.ciphertext}` : null,
      })),
    };
  }

  // ---- catalog project page (same shape as a Fiverr gig page) ----
  if (vuex.projects?.projectSelected?.project) {
    const ps = vuex.projects.projectSelected, pr = ps.project;
    let faq = [];
    try { faq = JSON.parse(pr.description?.faqJson || '[]'); } catch { /* malformed */ }
    const packages = (pr.packages || []).map((k) => {
      const specs = (k.specs || []).map((s) => {
        const chosen = (s.choices || []).filter((c) => c.selected).map((c) => c.choiceLabel);
        return chosen.length ? `${s.label}: ${chosen.join(', ')}` : s.value != null ? `${s.label}: ${s.value}` : null;
      }).filter(Boolean);
      return `${k.title}: $${k.price}, ${k.daysToFulfill} days. ${text(k.description || '')}${specs.length ? ' | ' + specs.join(', ') : ''}`;
    }).join('\n');
    return {
      platform: 'upwork', kind: 'gig', captcha: false, url: location.href.split('?')[0],
      title: pr.project?.title || document.title,
      tags: (pr.tags || []).map(String),
      description: text(pr.description?.description).slice(0, 1500),
      packages: packages.slice(0, 2500),
      faq: faq.slice(0, 8).map((f) => ({ q: text(f.question || f.q).slice(0, 200), a: text(f.answer || f.a).slice(0, 400) })),
      pageText: '',
    };
  }

  // ---- talent search ----
  if (vuex.profilesSearch?.profiles) {
    const ps = vuex.profilesSearch;
    return {
      platform: 'upwork', kind: 'up-talent', query: params.get('q') || '', page, total: ps.paging?.originTotal ?? ps.paging?.total ?? null,
      profiles: ps.profiles.map((p) => ({
        url: `${U}/freelancers/${p.identity?.ciphertext}`,
        name: p.profile?.shortName,
        title: p.profile?.title,
        rate: Number(p.profile?.chargeRate?.rawValue) || null,
      })).filter((p) => p.url.includes('~')),
    };
  }

  // ---- freelancer profile: Nuxt 2 window.__NUXT__, or (seen live Nov 2026) Nuxt 3 __NUXT_DATA__ vuex.profileViewer ----
  const pv = (window.__NUXT__?.state?.profileViewer || vuex.profileViewer)?.profile;
  if (pv?.profile) {
    const pp = pv.profile, st = pv.stats || {};
    return {
      platform: 'upwork', kind: 'profile', url: `${U}/freelancers/${pv.profileUrl?.split('/').pop() || ''}`.replace(/\/$/, '') || location.href,
      name: pp.shortName || pp.name,
      title: pp.title || '',
      overview: String(pp.description || '').slice(0, 5000),
      skills: (pp.skills || []).map((s) => s.prettyName || s.name).filter(Boolean),
      rate: st.hourlyRate?.amount ?? null,
      rating: st.rating ? Math.round(st.rating * 100) / 100 : null,
      reviews: st.totalFeedback ?? 0,
      jobs: st.totalJobsWorked ?? 0,
      hours: Math.round(st.totalHours || 0),
      badge: st.topRatedStatus || 'none',
      jss: typeof st.nSS100BwScore === 'number' && st.nSS100BwScore <= 1 ? Math.round(st.nSS100BwScore * 100) : null,
      hireAgain: st.hireAgainPercentage != null ? Math.round(st.hireAgainPercentage) : null,
      portfolio: st.totalPortfolioItems ?? (pv.portfolios || []).length,
      certs: (pv.certificates || []).length,
      education: (pv.education || []).length,
      employment: (pv.employmentHistory || []).length,
      languages: (pv.languages || []).map((l) => `${l.language?.name || l.name || ''} ${l.proficiencyTitle || l.level || ''}`.trim()).filter(Boolean),
      video: !!pv.video,
      response: st.responsiveState || null,
      memberSince: st.memberSince || null,
    };
  }

  // Page format details (no profile content) so an unrecognized page can be reported and the reader updated.
  const keys = (o) => (o && typeof o === 'object' ? Object.keys(o).slice(0, 40) : null);
  return {
    platform: 'upwork', kind: 'other',
    debug: { url: location.href.split('?')[0], title: document.title.slice(0, 80), nuxt2: keys(window.__NUXT__?.state), nuxt3: keys(nuxt3), vuex: keys(nuxt3?.vuex), pinia: keys(nuxt3?.pinia), data: keys(nuxt3?.data),
      // one level deeper on profile pages, in case the profile store's inner shape changed too
      profileViewer: keys(vuex.profileViewer), pvProfile: keys(vuex.profileViewer?.profile), pvProfileProfile: keys(vuex.profileViewer?.profile?.profile) },
  };
})();
