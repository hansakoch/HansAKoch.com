#!/usr/bin/env python3
"""Tiny JobSpy webhook for Open Careers Worker SEARCH_WEBHOOK_URL.

POST JSON { "queries": [{"term","location"}], "destination": "/api/ingest" }
→ 202 immediately, scrape in background, POST survivors to CAREERS_INGEST_URL.
"""
from __future__ import annotations

import json
import os
import sys
import threading
import traceback
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = os.environ.get("JOBSPY_WEBHOOK_HOST", "127.0.0.1")
PORT = int(os.environ.get("JOBSPY_WEBHOOK_PORT", "9135"))
INGEST_URL = os.environ.get("CAREERS_INGEST_URL", "https://careers.hansakoch.com/api/ingest")
PASSWORD = os.environ.get("CAREERS_PASSWORD", "")
SITES = os.environ.get("JOBSPY_SITES", "linkedin,indeed").split(",")
RESULTS = int(os.environ.get("JOBSPY_RESULTS", "10"))
HOURS_OLD = int(os.environ.get("JOBSPY_HOURS_OLD", "168"))


def scrape(queries):
    try:
        from jobspy import scrape_jobs
    except ImportError:
        print("pip install python-jobspy", file=sys.stderr)
        return []
    out = []
    seen = set()
    for q in queries:
        term = (q.get("term") or q.get("search_term") or "").strip()
        location = (q.get("location") or "remote").strip()
        if not term:
            continue
        frames = []
        for site in SITES:
            site = (site or "").strip()
            if not site:
                continue
            try:
                df_one = scrape_jobs(
                    site_name=[site],
                    search_term=term,
                    location=location,
                    results_wanted=RESULTS,
                    hours_old=HOURS_OLD,
                )
                if df_one is not None and len(df_one):
                    frames.append(df_one)
            except Exception as e:
                print(f"scrape fail {site}/{term!r}@{location!r}: {e}", file=sys.stderr)
        if not frames:
            continue
        try:
            import pandas as pd
            df = pd.concat(frames, ignore_index=True) if len(frames) > 1 else frames[0]
        except Exception:
            df = frames[0]
        for _, row in df.iterrows():
            url = str(row.get("job_url") or row.get("job_url_direct") or "")
            key = url or f"{row.get('title')}|{row.get('company')}"
            if key in seen:
                continue
            seen.add(key)
            out.append(
                {
                    "title": str(row.get("title") or ""),
                    "company": str(row.get("company") or ""),
                    "location": str(row.get("location") or location),
                    "url": url,
                    "description": str(row.get("description") or "")[:4000],
                    "source": "jobspy-webhook",
                }
            )
    return out


def post_ingest(jobs):
    body = json.dumps({"password": PASSWORD, "jobs": jobs}).encode()
    req = urllib.request.Request(
        INGEST_URL,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "OpenCareers-JobSpy/1.0", "X-Careers-Password": PASSWORD},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.status, resp.read().decode()


def run_job(payload):
    try:
        queries = payload.get("queries") or []
        print(f"jobspy-webhook: scraping {len(queries)} queries → {INGEST_URL}", flush=True)
        jobs = scrape(queries)
        print(f"jobspy-webhook: scraped {len(jobs)} raw jobs", flush=True)
        if not jobs:
            print("jobspy-webhook: nothing to ingest", flush=True)
            return
        status, body = post_ingest(jobs)
        print(f"jobspy-webhook: ingest {status} {body[:500]}", flush=True)
    except Exception:
        traceback.print_exc()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _path(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/jobspy"):
            path = path[len("/jobspy") :] or "/"
        return path

    def _json(self, code, obj):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self._path() in ("/", "/health"):
            self._json(200, {"ok": True, "service": "jobspy-webhook", "ingest": INGEST_URL})
            return
        self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if self._path() not in ("/", "/run", "/jobspy"):
            self._json(404, {"ok": False, "error": "not found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode() or "{}")
        except json.JSONDecodeError:
            self._json(400, {"ok": False, "error": "bad json"})
            return
        if not isinstance(payload.get("queries"), list) or not payload["queries"]:
            self._json(400, {"ok": False, "error": "queries required"})
            return
        threading.Thread(target=run_job, args=(payload,), daemon=True).start()
        self._json(202, {"ok": True, "accepted": True, "queries": len(payload["queries"])})


def main():
    if not PASSWORD:
        print("WARN: CAREERS_PASSWORD empty", file=sys.stderr)
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"jobspy-webhook listening on http://{HOST}:{PORT}", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
