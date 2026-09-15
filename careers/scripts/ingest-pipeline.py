#!/usr/bin/env python3
"""Ingest existing pipeline data into Open Careers board."""
import json
import os

CAREERS_URL = "https://careers-hansakoch.iceberg.workers.dev/api/ingest"
PASSWORD = "hak2026"
PIPELINE_DIR = "/home/fansfollow/projects/_unsorted/personal/HansAKoch.com/_kingdom/pipeline"

def load_jobs():
    jobs = []
    seen = set()
    for filename in ["scored-jobs.json", "final-filtered.json", "master.json"]:
        path = os.path.join(PIPELINE_DIR, filename)
        if not os.path.exists(path):
            continue
        try:
            with open(path) as f:
                data = json.load(f)
        except:
            continue
        items = data if isinstance(data, list) else list(data.values()) if isinstance(data, dict) else []
        for item in items:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title", "") or item.get("job_title", "")).strip()
            company = str(item.get("company", "") or item.get("company_name", "")).strip()
            url = str(item.get("url", "") or item.get("job_url", "") or item.get("link", "")).strip()
            location = str(item.get("location", "") or item.get("job_location", "")).strip()
            desc = str(item.get("description", "") or item.get("job_description", "") or "").strip()[:4000]
            if not title:
                continue
            key = f"{title.lower()}|{company.lower()}"
            if key in seen:
                continue
            seen.add(key)
            jobs.append({"title": title, "company": company, "url": url, "location": location, "description": desc, "source": "pipeline"})
    return jobs

def main():
    print("Loading pipeline data...", flush=True)
    jobs = load_jobs()
    print(f"Found {len(jobs)} unique jobs", flush=True)
    if not jobs:
        return

    # Write batches to temp files and use curl
    total_kept = 0
    total_dropped = 0
    batch_size = 50
    total_batches = (len(jobs) + batch_size - 1) // batch_size

    for i in range(0, len(jobs), batch_size):
        batch = jobs[i:i+batch_size]
        batch_file = f"/tmp/batch_{i}.json"
        with open(batch_file, "w") as f:
            json.dump({"password": PASSWORD, "jobs": batch}, f)

        exit_code = os.system(f'curl -s -m 30 -X POST "{CAREERS_URL}" -H "Content-Type: application/json" -H "X-Careers-Password: {PASSWORD}" -d @{batch_file} > /tmp/batch_result_{i}.json 2>&1')

        try:
            with open(f"/tmp/batch_result_{i}.json") as f:
                result = json.load(f)
            kept = result.get("kept", 0)
            dropped = result.get("dropped", 0)
            total_kept += kept
            total_dropped += dropped
        except:
            kept = 0
            dropped = 0

        print(f"  Batch {i//batch_size+1}/{total_batches}: kept={kept} dropped={dropped} total_kept={total_kept}", flush=True)

        # Clean up
        os.unlink(batch_file)

    print(f"Done: kept={total_kept}, dropped={total_dropped}", flush=True)

if __name__ == "__main__":
    main()
