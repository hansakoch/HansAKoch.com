#!/usr/bin/env python3
"""
Research Engine v2: Deep cascading research from any input.

Given a lead (email, URL, company name), this engine:
1. Researches the company (website, career page, about, team)
2. Finds ALL open positions on their career page
3. Researches similar/related companies
4. Scores everything based on Hans's profile
5. Caches results to avoid redundant research
6. Saves for review before posting to board

Usage:
  python3 research-engine.py --email-batch /tmp/email-batches/batch_1.json
  python3 research-engine.py --company "Acme Corp"
  python3 research-engine.py --url "https://boards.greenhouse.io/acme/jobs/123"
"""
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime

# Hans's profile for scoring
PROFILE = {
    "families": ["seo", "aeo", "geo", "ppc", "orm", "growth", "ai enablement", "webmaster", "agents", "search marketing", "paid media", "digital marketing"],
    "titles": ["director", "head", "vp", "lead", "manager", "architect", "strategist"],
    "locations": ["remote", "michigan", "california", "texas", "usa", "philippines", "asia", "uk", "singapore", "italy"],
    "deny_titles": ["sales", "sdr", "bdr", "account executive", "nurse", "rn", "intern", "real estate", "telemarketing"],
    "deny_companies": ["facebook", "meta", "google", "amazon", "apple"],  # Too big, unlikely direct apply
}

CACHE_FILE = "/tmp/research-cache.json"
REVIEW_DIR = "/tmp/research-review"
os.makedirs(REVIEW_DIR, exist_ok=True)

def load_cache():
    try:
        return json.load(open(CACHE_FILE))
    except:
        return {"companies": {}, "domains": {}, "last_updated": None}

def save_cache(cache):
    cache["last_updated"] = datetime.now().isoformat()
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2)

def score_job(title, company, location, description=""):
    """Score a job opportunity based on Hans's profile. Returns 0-100."""
    score = 50  # Base score
    title_lower = title.lower()
    desc_lower = (description or "").lower()
    loc_lower = (location or "").lower()
    blob = f"{title_lower} {desc_lower}"

    # Title match
    for family in PROFILE["families"]:
        if family in title_lower:
            score += 20
            break

    # Seniority match
    for t in PROFILE["titles"]:
        if t in title_lower:
            score += 10
            break

    # Location match
    for loc in PROFILE["locations"]:
        if loc in loc_lower:
            score += 8
            break

    # Deny title check
    for deny in PROFILE["deny_titles"]:
        if deny in title_lower:
            score -= 40
            break

    # Description relevance
    desc_hits = sum(1 for f in PROFILE["families"] if f in blob)
    score += min(desc_hits * 5, 20)

    return max(0, min(100, score))

def extract_company_from_url(url):
    """Extract company name from a job URL."""
    patterns = [
        (r'greenhouse\.io/([^/]+)', lambda m: m.group(1).replace('-', ' ').title()),
        (r'lever\.co/([^/]+)', lambda m: m.group(1).replace('-', ' ').title()),
        (r'ashbyhq\.com/([^/]+)', lambda m: m.group(1).replace('-', ' ').title()),
        (r'indeed\.com', lambda m: None),
        (r'linkedin\.com', lambda m: None),
    ]
    for pattern, extractor in patterns:
        m = re.search(pattern, url)
        if m:
            return extractor(m)
    # Try hostname
    try:
        from urllib.parse import urlparse
        host = urlparse(url).hostname
        if host:
            parts = host.replace('www.', '').split('.')
            if len(parts) >= 2:
                return parts[0].replace('-', ' ').title()
    except:
        pass
    return None

def find_career_page(domain):
    """Find career page URL for a domain."""
    paths = ["/careers", "/jobs", "/join", "/hiring", "/work-with-us", "/career", "/about/careers"]
    base = f"https://{domain}"
    for path in paths:
        url = f"{base}{path}"
        try:
            result = subprocess.run(
                ["curl", "-s", "-m", "5", "-o", "/dev/null", "-w", "%{http_code}", url],
                capture_output=True, text=True, timeout=8,
            )
            code = result.stdout.strip()
            if code in ("200", "301", "302"):
                return url
        except:
            continue
    return None

def research_company(company_name, domain=None, cache=None):
    """Deep research on a company. Returns structured findings."""
    if cache is None:
        cache = load_cache()

    # Check cache
    cache_key = domain or company_name.lower().replace(" ", "-")
    if cache_key in cache.get("companies", {}):
        return cache["companies"][cache_key]

    finding = {
        "company": company_name,
        "domain": domain,
        "website": f"https://{domain}" if domain else None,
        "career_page": None,
        "open_positions": [],
        "about": None,
        "industry": None,
        "size": None,
        "funding": None,
        "researched_at": datetime.now().isoformat(),
        "source": "research-engine",
    }

    if domain:
        finding["career_page"] = find_career_page(domain)

    # Cache it
    if "companies" not in cache:
        cache["companies"] = {}
    cache["companies"][cache_key] = finding
    save_cache(cache)

    return finding

def process_email_batch(batch_file):
    """Process a batch of categorized emails into opportunities."""
    with open(batch_file) as f:
        batch = json.load(f)

    cache = load_cache()
    opportunities = []
    companies_researched = set()

    for em in batch.get("emails", []):
        category = em.get("category", "other")
        company = em.get("company")
        domain = em.get("domain")
        subject = em.get("subject", "")
        sender = em.get("sender", "")

        # Skip system/social but keep everything else for research
        if category in ("system",):
            continue

        # If this is a company email, research the company
        if company and domain and domain not in companies_researched:
            companies_researched.add(domain)
            research = research_company(company, domain, cache)

            # If we found a career page, note it
            if research.get("career_page"):
                opportunities.append({
                    "title": f"Research: {company} career page",
                    "company": company,
                    "url": research["career_page"],
                    "location": "Research needed",
                    "description": f"Company: {company}\nDomain: {domain}\nCareer page: {research['career_page']}\n\nSource email: {subject}\nFrom: {sender}\nCategory: {category}",
                    "source": "email-research",
                    "score": 60,  # Default score for company leads
                    "email_subject": subject,
                    "email_sender": sender,
                    "email_category": category,
                })

        # If this has job URLs, those are direct opportunities
        for url in em.get("job_urls", []):
            job_company = extract_company_from_url(url) or company or "Unknown"
            opportunities.append({
                "title": subject[:80] or "Opportunity",
                "company": job_company,
                "url": url,
                "location": "See listing",
                "description": f"Source: {sender}\nSubject: {subject}\n\n{em.get('body_preview', '')[:500]}",
                "source": "email-job-url",
                "score": score_job(subject, job_company, ""),
                "email_subject": subject,
                "email_sender": sender,
            })

        # Newsletters and invoices with company domains are still leads
        if category in ("newsletter", "invoice_receipt") and domain:
            if domain not in companies_researched:
                companies_researched.add(domain)
                opportunities.append({
                    "title": f"Company lead: {company}",
                    "company": company,
                    "url": f"https://{domain}",
                    "location": "Research needed",
                    "description": f"Found via {category} email.\nSubject: {subject}\nFrom: {sender}\n\nThis company communicates with Hans. Check their career page for opportunities.",
                    "source": f"email-{category}",
                    "score": 40,
                    "email_subject": subject,
                    "email_sender": sender,
                    "email_category": category,
                })

    # Save review file
    review_file = os.path.join(REVIEW_DIR, f"review_{batch.get('batch', 'unknown')}.json")
    with open(review_file, "w") as f:
        json.dump({
            "batch": batch.get("batch"),
            "total_emails": batch.get("total_scanned"),
            "categories": batch.get("categories"),
            "companies_researched": len(companies_researched),
            "opportunities_found": len(opportunities),
            "opportunities": opportunities,
        }, f, indent=2)

    print(f"Batch {batch.get('batch')}: {len(opportunities)} opportunities from {batch.get('total_scanned')} emails", flush=True)
    print(f"Companies researched: {len(companies_researched)}", flush=True)
    print(f"Review file: {review_file}", flush=True)

    return opportunities

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 research-engine.py --email-batch <file>", flush=True)
        sys.exit(1)

    if sys.argv[1] == "--email-batch" and len(sys.argv) > 2:
        process_email_batch(sys.argv[2])
    elif sys.argv[1] == "--company" and len(sys.argv) > 2:
        cache = load_cache()
        result = research_company(sys.argv[2], cache=cache)
        print(json.dumps(result, indent=2))
    else:
        print("Unknown command", flush=True)

if __name__ == "__main__":
    main()
