#!/usr/bin/env python3
"""Scan Gmail for job opportunity emails from the last 1.5 years.
Extracts company names, job titles, and links. Posts to Open Careers /api/ingest.

Env:
  CAREERS_INGEST_URL  https://careers.hansakoch.com/api/ingest
  CAREERS_PASSWORD    hak2026
"""
import email
import imaplib
import json
import os
import re
import sys
import urllib.request
from email.header import decode_header
from datetime import datetime, timedelta

ACCOUNTS = [
    {
        "email": "hans@hansakoch.com",
        "password": "yxwp nbhp bedv wqju",
        "imap": "imap.gmail.com",
    },
    {
        "email": "hans@icebergmedia.co.uk",
        "password": "unhl sdyv lqzy wgid",
        "imap": "imap.gmail.com",
    },
]

# Job-related email senders and subjects
JOB_SENDERS = [
    "linkedin", "indeed", "glassdoor", "ziprecruiter", "monster",
    "dice", "careerbuilder", "simplyhired", "snagajob", "flexjobs",
    "remote.co", "weworkremotely", "angel.co", "greenhouse", "lever",
    "ashby", "workday", "smartrecruiters", "icims", "bamboohr",
    "jobvite", "recruiting", "talent", "hr@", "jobs@", "careers@",
    "hiring@", "recruitment", "noreply", "no-reply",
]

JOB_SUBJECT_PATTERNS = [
    r"(?i)job (alert|recommendation|match|opportunity|opening)",
    r"(?i)new (job|position|role|opportunity)",
    r"(?i)we.{0,5}hiring",
    r"(?i)career (opportunity|update|alert)",
    r"(?i)your (application|resume|profile)",
    r"(?i)interview",
    r"(?i)offer",
    r"(?i)seo (director|manager|lead|specialist|strategist)",
    r"(?i)(head|director|manager) (of|for) (seo|search|growth|marketing|digital|organic)",
    r"(?i)(aeo|geo|ppc|paid media|performance marketing)",
    r"(?i)(webmaster|growth marketing|ai enablement)",
    r"(?i)apply|application|position|role",
]

JOB_BODY_PATTERNS = [
    r"(?i)we (are|re) (looking|searching|hiring)",
    r"(?i)job (description|details|summary)",
    r"(?i)qualifications|requirements|responsibilities",
    r"(?i)apply (now|here|today)",
    r"(?i)click.{0,20}apply",
    r"(?i)greenhouse\.io|lever\.co|ashbyhq|workday|myworkday",
    r"(?i)indeed\.com/viewjob|linkedin\.com/jobs",
]

def decode_subject(msg):
    subject = msg.get("Subject", "")
    if subject:
        parts = decode_header(subject)
        decoded = []
        for part, charset in parts:
            if isinstance(part, bytes):
                decoded.append(part.decode(charset or "utf-8", errors="replace"))
            else:
                decoded.append(part)
        return " ".join(decoded)
    return ""

def get_body(msg):
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            if ct == "text/plain":
                try:
                    body += part.get_payload(decode=True).decode("utf-8", errors="replace")[:5000]
                except:
                    pass
            elif ct == "text/html" and not body:
                try:
                    html = part.get_payload(decode=True).decode("utf-8", errors="replace")
                    body += re.sub(r"<[^>]+>", " ", html)[:5000]
                except:
                    pass
    else:
        try:
            body = msg.get_payload(decode=True).decode("utf-8", errors="replace")[:5000]
        except:
            pass
    return body

def extract_job_info(subject, body, sender):
    """Extract potential job title and company from email."""
    info = {"title": "", "company": "", "url": "", "source": "email"}

    # Extract URLs that look like job postings
    url_patterns = [
        r'(https?://boards\.greenhouse\.io/[^\s<>"]+)',
        r'(https?://(?:www\.)?lever\.co/[^\s<>"]+)',
        r'(https?://(?:www\.)?ashbyhq\.com/[^\s<>"]+)',
        r'(https?://(?:\w+\.)?myworkday\.com/[^\s<>"]+)',
        r'(https?://(?:www\.)?indeed\.com/viewjob[^\s<>"]+)',
        r'(https?://(?:www\.)?linkedin\.com/jobs/view/[^\s<>"]+)',
        r'(https?://(?:www\.)?glassdoor\.com/job[^\s<>"]+)',
        r'(https?://(?:www\.)?ziprecruiter\.com/[^\s<>"]+)',
        r'(https?://(?:www\.)?smartrecruiters\.com/[^\s<>"]+)',
        r'(https?://jobs?\.\w+\.\w+/[^\s<>"]+)',
        r'(https?://careers?\.\w+\.\w+/[^\s<>"]+)',
        r'(https?://apply\.\w+\.\w+/[^\s<>"]+)',
    ]

    combined = f"{subject} {body}"
    for pattern in url_patterns:
        match = re.search(pattern, combined)
        if match:
            info["url"] = match.group(1)
            break

    # Extract job title from subject
    title_patterns = [
        r"(?i)(?:re:\s*)?(?:application|apply|position|role|opportunity)[:\s]+(.{5,80}?)(?:\s+at\s+|\s+@\s+|\s+-\s+|\s*$)",
        r"(?i)(seo|aeo|ppc|growth|marketing|digital|webmaster|director|manager|head|lead|specialist|strategist|architect).{0,30}(remote|hybrid|onsite)?",
        r"(?i)(.{5,60}?)\s+(?:at|@)\s+(.{2,40})",
    ]

    for pattern in title_patterns:
        match = re.search(pattern, subject, re.IGNORECASE)
        if match:
            if match.lastindex >= 2:
                info["title"] = match.group(1).strip()
                info["company"] = match.group(2).strip()
            else:
                info["title"] = match.group(1).strip()
            break

    # Extract company from sender domain
    if not info["company"]:
        sender_match = re.search(r"@([\w.-]+)", sender)
        if sender_match:
            domain = sender_match.group(1).lower()
            # Skip generic email providers
            skip = ["gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com", "protonmail.com"]
            if not any(s in domain for s in skip):
                company = domain.split(".")[0]
                if company not in ["noreply", "no-reply", "mail", "email", "info", "support", "hr", "jobs", "careers", "recruiting", "talent"]:
                    info["company"] = company.replace("-", " ").title()

    # Extract company from body
    if not info["company"]:
        company_match = re.search(r"(?i)(?:at|@|company:\s*|employer:\s*)([A-Z][\w\s&.]{2,40}?)(?:\s+is\s|\s+in\s|\s*\||\s*$)", body[:1000])
        if company_match:
            info["company"] = company_match.group(1).strip()

    return info

def is_job_email(subject, sender, body):
    """Check if email looks like a job opportunity."""
    sender_lower = sender.lower()
    subject_lower = subject.lower()
    combined = f"{subject} {body[:2000]}".lower()

    # Check sender
    for pattern in JOB_SENDERS:
        if pattern in sender_lower:
            return True

    # Check subject
    for pattern in JOB_SUBJECT_PATTERNS:
        if re.search(pattern, subject):
            return True

    # Check body for job-related content
    hits = 0
    for pattern in JOB_BODY_PATTERNS:
        if re.search(pattern, body[:3000]):
            hits += 1

    return hits >= 2

def scan_account(account, since_date):
    """Scan one Gmail account for job emails."""
    jobs = []
    try:
        print(f"  Connecting to {account['email']}...", flush=True)
        mail = imaplib.IMAP4_SSL(account["imap"])
        mail.login(account["email"], account["password"])
        mail.select("INBOX")

        # Search for emails since date
        since_str = since_date.strftime("%d-%b-%Y")
        _, message_ids = mail.search(None, f'(SINCE "{since_str}")')

        if not message_ids[0]:
            print(f"  No emails found since {since_str}", flush=True)
            mail.logout()
            return jobs

        ids = message_ids[0].split()
        print(f"  Found {len(ids)} emails to scan", flush=True)

        scanned = 0
        found = 0
        for msg_id in ids:
            try:
                _, msg_data = mail.fetch(msg_id, "(RFC822)")
                raw = msg_data[0][1]
                msg = email.message_from_bytes(raw)

                sender = msg.get("From", "")
                subject = decode_subject(msg)
                body = get_body(msg)
                date_str = msg.get("Date", "")

                scanned += 1

                if is_job_email(subject, sender, body):
                    info = extract_job_info(subject, body, sender)
                    if info["title"] or info["company"]:
                        info["description"] = f"From: {sender}\nDate: {date_str}\nSubject: {subject}\n\n{body[:2000]}"
                        jobs.append(info)
                        found += 1

                if scanned % 500 == 0:
                    print(f"  Scanned {scanned} emails, found {found} opportunities...", flush=True)

            except Exception as e:
                continue

        print(f"  Done: scanned {scanned}, found {found} job opportunities", flush=True)
        mail.logout()

    except Exception as e:
        print(f"  Error: {e}", file=sys.stderr, flush=True)

    return jobs

def main():
    ingest_url = os.environ.get("CAREERS_INGEST_URL", "https://careers.hansakoch.com/api/ingest")
    password = os.environ.get("CAREERS_PASSWORD", "hak2026")

    # Last 1.5 years
    since_date = datetime.now() - timedelta(days=548)
    print(f"Scanning emails since {since_date.strftime('%Y-%m-%d')}", flush=True)

    all_jobs = []
    for account in ACCOUNTS:
        jobs = scan_account(account, since_date)
        all_jobs.extend(jobs)

    # Deduplicate by title+company
    seen = set()
    unique_jobs = []
    for job in all_jobs:
        key = f"{job.get('title','').lower()}|{job.get('company','').lower()}"
        if key not in seen and (job.get("title") or job.get("company")):
            seen.add(key)
            unique_jobs.append(job)

    print(f"\nTotal unique job opportunities: {len(unique_jobs)}", flush=True)

    # Post to careers API
    if unique_jobs:
        body = json.dumps({"password": password, "jobs": unique_jobs}).encode()
        req = urllib.request.Request(
            ingest_url,
            data=body,
            headers={
                "Content-Type": "application/json",
                "X-Careers-Password": password,
            },
        )
        try:
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read().decode())
                print(f"Posted to careers: kept={result.get('kept')}, dropped={result.get('dropped')}", flush=True)
        except Exception as e:
            print(f"Post error: {e}", file=sys.stderr, flush=True)
            # Save to file as fallback
            with open("/tmp/email-jobs.json", "w") as f:
                json.dump(unique_jobs, f, indent=2)
            print("Saved to /tmp/email-jobs.json as fallback", flush=True)
    else:
        print("No job opportunities found in emails", flush=True)

if __name__ == "__main__":
    main()
