export type Gate0 = 'reject' | 'review' | 'pass';
export type Gate1 = 'reject' | 'maybe' | 'hot';
export type Verdict = 'reject' | 'maybe' | 'hot';

export type JobInput = {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
};

export type Decision = {
  gate0: Gate0;
  gate1: Gate1 | null;
  locScore: number;
  locLabel: string;
  score: number;
  verdict: Verdict;
  reasons: string[];
};

const DENY_TITLE: RegExp[] = [
  /\bsales\b/,
  /\bsdr\b/,
  /\bbdr\b/,
  /\baccount executive\b/,
  /\badvertising sales\b/,
  /\bfundrais/,
  /\bleas(e|ing|ing agent)\b/,
  /\b(rn|registered nurse|nurse|nursing)\b/,
  /\bchemist\b/,
  /\bchemistry\b/,
  /\bintern(ship)?\b/,
  /\bbroadcast\b/,
  /\bproducer intern\b/,
  /\bsell[\s-]?side\b/,
  /\bhuman resources\b/,
  /\bfinance intern\b/,
  /\barea sales\b/,
  /\bbusiness development\b/,
  /\baccount development\b/,
  /\bdesigner\b/,
  /\btelemarket/,
  /\bquota\b/,
  /\bcloser\b/,
  /\baccount manager\b/,
  /\bcold call/,
  /\breal estate\b/,
  /\bunit manager\b/,
  /\badvertising sales\b/,
];

const UNIVERSITY = /\b(university|college|admissions|academic|campus)\b/;
const UNI_ROLE = /\b(associate director|assistant director|director|dean|provost)\b/;

/** Pure SWE/PM/content/comms titles — reject unless SEO/search/growth keywords rescue them. */
const SOFT_DENY: RegExp[] = [
  /\bsoftware engineer\b/,
  /\bstaff engineer\b/,
  /\bprincipal engineer\b/,
  /\bsenior engineer\b/,
  /\bbackend engineer\b/,
  /\bfrontend engineer\b/,
  /\bfull[- ]stack engineer\b/,
  /\bplatform engineer\b/,
  /\bproduct manager\b/,
  /\bprogram manager\b/,
  /\bproject manager\b/,
  /\bcontent (marketing|strategist|writer|manager|lead|director|specialist|coordinator)\b/,
  /\bcommunications (manager|director|specialist|lead|coordinator|strategist)\b/,
  /\bguest acquisition\b/,
  /\bdeveloper advocate\b/,
  /\bdata engineer\b/,
  /\bdevops engineer\b/,
  /\bsre\b/,
  /\bsite reliability engineer\b/,
];

const SEO_RESCUE = /\b(seo|aeo|geo|ppc|search|organic|growth marketing|webmaster|ai enablement|paid media|orm|reputation|performance marketing)\b/;

const ALLOW_TITLE: RegExp[] = [
  /\bseo\b/,
  /\baeo\b/,
  /\bgeo\b/,
  /\bppc\b/,
  /\bpaid media\b/,
  /\bperformance marketing\b/,
  /\borm\b/,
  /\breputation\b/,
  /\bgrowth marketing\b/,
  /\bhead of growth\b/,
  /\bai enablement\b/,
  /\bai[- ]native\b/,
  /\bagent optim/,
  /\bwebmaster\b/,
  /\bsearch (engine|marketing|director|lead|head|architect)\b/,
  /\borganic search\b/,
  /\bai search\b/,
  /\bcrypto (marketing|seo|growth)\b/,
  /\bautomation architect\b/,
  /\bai systems architect\b/,
  /\bdirector of agent\b/,
  /\bdigital strateg(y|ist)\b/,
  /\bsearch marketing\b/,
  /\bprogrammatic seo\b/,
  /\bcontent seo\b/,
];

const SALES_JD = [
  /(?<!no )(?<!without )\bquota\b/,
  /\bcommission\b/,
  /\bcold[- ]call/,
  /\bpipeline of deals\b/,
  /\bclosing deals\b/,
  /\bhunter\b/,
  /\bcarried quota\b/,
  /\bnew business sales\b/,
];

const FIT_JD = [
  /\bseo\b/,
  /\baeo\b/,
  /\bgeo\b/,
  /\bppc\b/,
  /\bpaid media\b/,
  /\bgrowth\b/,
  /\bai agent/,
  /\bautomat/,
  /\bwebmaster\b/,
  /\bcloudflare\b/,
  /\borganic\b/,
  /\breputation\b/,
  /\borm\b/,
  /\bsearch engine\b/,
];

export function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9+/#. ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


/** Latin letters vs Cyrillic / other letters in raw title+description. */
export function scriptStats(raw: string): { latin: number; cyrillic: number; otherLetter: number; totalLetter: number } {
  let latin = 0;
  let cyrillic = 0;
  let otherLetter = 0;
  for (const ch of raw) {
    const cp = ch.codePointAt(0) || 0;
    if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a) || (cp >= 0xc0 && cp <= 0x024f) || (cp >= 0x1e00 && cp <= 0x1eff)) {
      latin += 1;
    } else if (cp >= 0x0400 && cp <= 0x04ff) {
      cyrillic += 1;
    } else if (
      (cp >= 0x3040 && cp <= 0x30ff) || // hiragana/katakana
      (cp >= 0x3400 && cp <= 0x9fff) || // CJK
      (cp >= 0xac00 && cp <= 0xd7af) || // Hangul
      (cp >= 0x0600 && cp <= 0x06ff) || // Arabic
      (cp >= 0x0590 && cp <= 0x05ff) // Hebrew
    ) {
      otherLetter += 1;
    }
  }
  return { latin, cyrillic, otherLetter, totalLetter: latin + cyrillic + otherLetter };
}

/** Strong English SEO/AEO allow keywords — title first; stray tokens in foreign prose do not count. */
export function hasEnglishSeoAllow(title: string, description: string): boolean {
  const titleLatin = norm((title || '').replace(/[^\x00-\x7F]+/g, ' '));
  for (const re of ALLOW_TITLE) {
    if (titleLatin && re.test(titleLatin)) return true;
  }
  if (titleLatin && SEO_RESCUE.test(titleLatin)) return true;
  // Description rescue only when there is real English prose (not a lone "SEO" in a Russian JD).
  const descLatin = (description || '').replace(/[^\x00-\x7F]+/g, ' ');
  const latinLetters = (descLatin.match(/[A-Za-z]/g) || []).length;
  if (latinLetters < 40) return false;
  const blob = norm(`${titleLatin} ${descLatin}`);
  for (const re of ALLOW_TITLE) {
    if (re.test(blob)) return true;
  }
  return SEO_RESCUE.test(blob);
}

/**
 * Clearly non-English JD (Cyrillic-heavy or heavy non-Latin) without English SEO/AEO allow keywords.
 * Multilingual listings stay OK when the English SEO role is clear.
 */
export function isForeignOnlyJd(job: JobInput): boolean {
  const raw = `${job.title || ''} ${job.description || ''}`.slice(0, 2500);
  const s = scriptStats(raw);
  if (s.totalLetter < 10) return false;
  const nonLatin = s.cyrillic + s.otherLetter;
  const nonLatinRatio = nonLatin / s.totalLetter;
  const clearlyForeign = s.cyrillic >= 8 || nonLatinRatio >= 0.45;
  if (!clearlyForeign) return false;
  if (hasEnglishSeoAllow(job.title || '', job.description || '')) return false;
  return true;
}

export type DecideOpts = { extraDeny?: string[] };

export function gate0(job: JobInput, extraDeny: string[] = []): { result: Gate0; reasons: string[] } {
  const title = norm(job.title || '');
  const company = norm(job.company || '');
  const blob = `${title} ${company} ${norm(job.description || '').slice(0, 400)}`;
  const reasons: string[] = [];

  if (isForeignOnlyJd(job)) {
    reasons.push('foreign-lang-only');
    return { result: 'reject', reasons };
  }

  for (const raw of extraDeny) {
    const p = norm(raw);
    if (p && (title.includes(p) || blob.includes(p))) {
      reasons.push(`deny-extra:${p}`);
      return { result: 'reject', reasons };
    }
  }

  if (UNIVERSITY.test(blob) && UNI_ROLE.test(title)) {
    reasons.push('university-admin');
    return { result: 'reject', reasons };
  }

  for (const re of DENY_TITLE) {
    if (re.test(title)) {
      reasons.push(`deny:${re}`);
      return { result: 'reject', reasons };
    }
  }

  if (/(^|\s)hr(\s|$)/.test(title)) {
    reasons.push('deny:hr');
    return { result: 'reject', reasons };
  }

  for (const re of ALLOW_TITLE) {
    if (re.test(title)) {
      reasons.push(`allow:${re}`);
      return { result: 'pass', reasons };
    }
  }

  for (const re of SOFT_DENY) {
    if (re.test(title)) {
      if (SEO_RESCUE.test(title)) {
        reasons.push(`soft-rescue:${re}`);
        return { result: 'review', reasons };
      }
      reasons.push(`soft-deny:${re}`);
      return { result: 'reject', reasons };
    }
  }

  reasons.push('ambiguous-title');
  return { result: 'review', reasons };
}

export function gate1(job: JobInput, g0: Gate0): { result: Gate1; reasons: string[] } {
  const title = norm(job.title || '');
  const desc = norm(job.description || '');
  const blob = `${title} ${desc}`;
  const reasons: string[] = [];

  if (g0 === 'reject') return { result: 'reject', reasons: ['gate0'] };

  for (const re of SALES_JD) {
    if (re.test(blob)) {
      reasons.push(`sales-jd:${re}`);
      return { result: 'reject', reasons };
    }
  }

  let hits = 0;
  for (const re of FIT_JD) {
    if (re.test(blob)) {
      hits += 1;
      reasons.push(`fit:${re}`);
    }
  }

  if (g0 === 'pass' && hits >= 1) return { result: 'hot', reasons };
  if (g0 === 'pass') return { result: 'hot', reasons: [...reasons, 'allow-title'] };
  if (hits >= 3) return { result: 'hot', reasons };
  if (hits >= 1) return { result: 'maybe', reasons };

  reasons.push('no-profile-fit');
  return { result: 'reject', reasons };
}

export function gate2(location: string): { locScore: number; locLabel: string } {
  const loc = norm(location);
  if (!loc) return { locScore: 8, locLabel: 'unspecified' };
  if (/\bremote\b/.test(loc) || /\banywhere\b/.test(loc)) return { locScore: 24, locLabel: 'remote' };
  if (/\bph timezone\b|\bphilippines\b|\bcebu\b|\bmanila\b|\basia[- ]pacific\b/.test(loc)) {
    return { locScore: 20, locLabel: 'ph-tz' };
  }
  if (/\bmichigan\b|\b\bmi\b|\bdetroit\b|\bwayne\b|\bann arbor\b/.test(loc)) {
    return { locScore: 18, locLabel: 'michigan' };
  }
  if (/\bcalifornia\b|\b\bca\b|\bsan francisco\b|\blos angeles\b|\bsilicon valley\b/.test(loc)) {
    return { locScore: 16, locLabel: 'california' };
  }
  if (/\btexas\b|\b\btx\b|\baustin\b|\bdallas\b/.test(loc)) return { locScore: 14, locLabel: 'texas' };
  if (/\bunited states\b|\b\busa\b|\b\bus\b/.test(loc)) return { locScore: 12, locLabel: 'usa' };
  if (/\bsingapore\b|\bjapan\b|\bkorea\b|\bindia\b|\bthailand\b|\bvietnam\b|\bindonesia\b|\basia\b/.test(loc)) {
    return { locScore: 10, locLabel: 'asia' };
  }
  if (/\bitaly\b|\bmilano\b|\bmilan\b|\brome\b/.test(loc)) return { locScore: 9, locLabel: 'italy' };
  return { locScore: 4, locLabel: 'elsewhere' };
}

export function decide(job: JobInput, opts: DecideOpts = {}): Decision {
  const g0 = gate0(job, opts.extraDeny);
  const g1 = gate1(job, g0.result);
  const loc = gate2(job.location || '');
  const reasons = [...g0.reasons, ...g1.reasons];
  // mutated below for foreign-script demote note

  let verdict: Verdict = g1.result;
  if (g0.result === 'reject') verdict = 'reject';

  const base = verdict === 'hot' ? 70 : verdict === 'maybe' ? 48 : 10;
  let score = Math.min(100, base + loc.locScore);
  // Foreign-script-heavy but English SEO-clear: keep on board, but do not rank near pure-English SEO tops.
  if (verdict !== 'reject') {
    const raw = `${job.title || ''} ${job.description || ''}`.slice(0, 2500);
    const st = scriptStats(raw);
    if (st.totalLetter >= 10) {
      const nonLatinRatio = (st.cyrillic + st.otherLetter) / st.totalLetter;
      if (st.cyrillic >= 8 || nonLatinRatio >= 0.45) {
        score = Math.max(0, score - 18);
        reasons.push('foreign-script-demote');
      }
    }
  }

  return {
    gate0: g0.result,
    gate1: g1.result,
    locScore: loc.locScore,
    locLabel: loc.locLabel,
    score,
    verdict,
    reasons,
  };
}

export function visibleOnBoard(d: Decision): boolean {
  return d.verdict === 'hot' || d.verdict === 'maybe';
}
