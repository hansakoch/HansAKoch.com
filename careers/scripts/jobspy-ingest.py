#!/usr/bin/env python3
"""Vultr reserve: scrape with JobSpy, POST survivors to Open Careers /api/ingest.

Env:
  CAREERS_INGEST_URL  https://careers.hansakoch.com/api/ingest
  CAREERS_PASSWORD    worker secret
  JOBSPY_SITES        comma list, default linkedin,indeed
"""
import json
import os
import sys
import urllib.request

QUERIES = [
    ("SEO director", "remote"),
    ("SEO director", "Michigan"),
    ("AEO", "remote"),
    ("AI enablement", "remote"),
    ("PPC director", "remote"),
    ("webmaster", "remote"),
    ("head of organic search", "remote"),
    ("programmatic SEO", "remote"),
]


def scrape():
    try:
        from jobspy import scrape_jobs
    except ImportError:
        print("pip install python-jobspy", file=sys.stderr)
        return []
    sites = os.environ.get("JOBSPY_SITES", "linkedin,indeed").split(",")
    out = []
    for term, location in QUERIES:
        frames = []
        for site in sites:
            site = site.strip()
            if not site:
                continue
            try:
                df_one = scrape_jobs(site_name=[site], search_term=term, location=location, results_wanted=10, hours_old=168)
                if df_one is not None and len(df_one):
                    frames.append(df_one)
            except Exception as e:
                print(f"scrape fail {site}/{term!r}@{location!r}: {e}", file=sys.stderr)
                continue
        if not frames:
            continue
        import pandas as pd
        df = pd.concat(frames, ignore_index=True) if len(frames) > 1 else frames[0]
        if df is None or len(df) == 0:
            continue
        for _, row in df.iterrows():
            out.append(
                {
                    "title": str(row.get("title") or ""),
                    "company": str(row.get("company") or ""),
                    "location": str(row.get("location") or location),
                    "url": str(row.get("job_url") or row.get("job_url_direct") or ""),
                    "description": str(row.get("description") or "")[:4000],
                    "source": "jobspy",
                }
            )
    return out


def main():
    url = os.environ.get("CAREERS_INGEST_URL")
    password = os.environ.get("CAREERS_PASSWORD", "")
    if not url:
        print("Set CAREERS_INGEST_URL", file=sys.stderr)
        sys.exit(2)
    jobs = scrape()
    print(f"scraped={len(jobs)}", flush=True)
    body = json.dumps({"password": password, "jobs": jobs}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "OpenCareers-JobSpy/1.0",
            "X-Careers-Password": password,
        },
    )
    with urllib.request.urlopen(req) as resp:
        print(resp.read().decode())


if __name__ == "__main__":
    main()
