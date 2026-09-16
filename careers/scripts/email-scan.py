#!/usr/bin/env python3
"""Smart email scanner: treats emails as LEADS to research companies.

Flow:
1. Scan emails for company names (not job titles)
2. For each company: visit career page, find open positions
3. If positions found: add as job opportunities with email reference
4. If no positions but company is relevant: add as company opportunity
5. Filter out invoices, receipts, newsletters, marketing

Env:
  CAREERS_INGEST_URL  https://careers-hansakoch.iceberg.workers.dev/api/ingest
  CAREERS_PASSWORD    hak2026
"""
import email
import imaplib
import json
import os
import re
import sys
import subprocess
import time
import urllib.request
from email.header import decode_header
from datetime import datetime, timedelta

ACCOUNTS = [
    {"email": "hans@hansakoch.com", "password": "yxwp nbhp bedv wqju", "imap": "imap.gmail.com"},
    {"email": "hans@icebergmedia.co.uk", "password": "unhl sdyv lqzy wgid", "imap": "imap.gmail.com"},
]

# Emails to SKIP (not job opportunities)
SKIP_PATTERNS = [
    r"(?i)invoice", r"(?i)receipt", r"(?i)payment", r"(?i)billing",
    r"(?i)unsubscribe", r"(?i)newsletter", r"(?i)weekly digest",
    r"(?i)monthly report", r"(?i)security alert", r"(?i)password reset",
    r"(?i)order confirmation", r"(?i)shipping notification",
    r"(?i)your statement", r"(?i)account update", r"(?i)terms of service",
    r"(?i)privacy policy", r"(?i)cookie policy", r"(?i)gdpr",
    r"(?i)subscription", r"(?i)renewal", r"(?i)expired",
    r"(?i)backup", r"(?i)storage", r"(?i)icloud", r"(?i)google drive",
    r"(?i)dropbox", r"(?i)zoom", r"(?i)calendar invite",
    r"(?i)meeting request", r"(?i)accepted:", r"(?i)declined:",
    r"(?i)out of office", r"(?i)auto-reply", r"(?i)delivery failure",
    r"(?i)mail delivery", r"(?i)undeliverable",
    r"(?i)facebook", r"(?i)instagram", r"(?i)twitter", r"(?i)tiktok",
    r"(?i)pinterest", r"(?i)snapchat", r"(?i)reddit",
    r"(?i)amazon", r"(?i)ebay", r"(?i)paypal", r"(?i)stripe",
    r"(?i)wise\.com", r"(?i)transferwise",
    r"(?i)xero", r"(?i)quickbooks", r"(?i)freshbooks",
    r"(?i)slack", r"(?i)discord", r"(?i)notion", r"(?i)trello",
]

# Companies/emails that ARE job-related senders
JOB_SENDERS = [
    "linkedin", "indeed", "glassdoor", "ziprecruiter", "monster",
    "dice", "careerbuilder", "greenhouse", "lever", "ashby",
    "workday", "smartrecruiters", "icims", "bamboohr", "jobvite",
    "recruiting", "talent", "hr@", "jobs@", "careers@", "hiring@",
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
                try: body += part.get_payload(decode=True).decode("utf-8", errors="replace")[:5000]
                except: pass
            elif ct == "text/html" and not body:
                try:
                    html = part.get_payload(decode=True).decode("utf-8", errors="replace")
                    body += re.sub(r"<[^>]+>", " ", html)[:5000]
                except: pass
    else:
        try: body = msg.get_payload(decode=True).decode("utf-8", errors="replace")[:5000]
        except: pass
    return body

def extract_company_from_sender(sender):
    """Extract company name from email sender."""
    match = re.search(r"@([\w.-]+)", sender)
    if not match:
        return None, None
    domain = match.group(1).lower()
    # Skip generic email providers
    skip_domains = [
        "gmail.com", "googlemail.com", "yahoo.com", "hotmail.com",
        "outlook.com", "protonmail.com", "icloud.com", "me.com",
        "aol.com", "mail.com", "zoho.com", "yandex.com",
    ]
    if any(s in domain for s in skip_domains):
        return None, None
    # Skip generic mailer domains
    skip_prefixes = ["noreply", "no-reply", "mailer", "mail", "email", "info", "support", "notifications"]
    local = sender.split("@")[0].lower() if "@" in sender else ""
    if any(p in local for p in skip_prefixes):
        # Still extract company from domain
        pass
    company = domain.split(".")[0]
    if company in ["noreply", "no-reply", "mail", "email", "info", "support", "notifications", "news", "updates"]:
        return None, None
    return company.replace("-", " ").title(), domain

def is_job_related_sender(sender):
    """Check if sender is a known job platform."""
    sender_lower = sender.lower()
    for pattern in JOB_SENDERS:
        if pattern in sender_lower:
            return True
    return False

def should_skip_email(subject, sender, body):
    """Check if email should be skipped (invoice, receipt, etc.)."""
    combined = f"{subject} {sender} {body[:1000]}"
    for pattern in SKIP_PATTERNS:
        if re.search(pattern, combined):
            return True
    return False

def extract_job_urls(body):
    """Extract job listing URLs from email body."""
    urls = []
    patterns = [
        r'(https?://boards\.greenhouse\.io/[^\s<>"]+)',
        r'(https?://(?:www\.)?lever\.co/[^\s<>"]+)',
        r'(https?://(?:www\.)?ashbyhq\.com/[^\s<>"]+)',
        r'(https?://(?:\w+\.)?myworkday\.com/[^\s<>"]+)',
        r'(https?://(?:www\.)?indeed\.com/viewjob[^\s<>"]+)',
        r'(https?://(?:www\.)?linkedin\.com/jobs/view/[^\s<>"]+)',
        r'(https?://(?:www\.)?glassdoor\.com/job[^\s<>"]+)',
        r'(https?://jobs?\.\w+\.\w+/[^\s<>"]+)',
        r'(https?://careers?\.\w+\.\w+/[^\s<>"]+)',
    ]
    for pattern in patterns:
        matches = re.findall(pattern, body)
        urls.extend(matches)
    return list(set(urls))

def extract_job_title_from_email(subject, body):
    """Try to extract a job title from the email."""
    # Look for job title patterns in subject
    patterns = [
        r"(?i)(?:re:\s*)?(?:application|position|role|opportunity)[:\s]+(.{5,80}?)(?:\s+at\s+|\s*$)",
        r"(?i)(seo|aeo|ppc|growth|marketing|digital|webmaster|director|manager|head|lead|specialist).{0,40}",
    ]
    for pattern in patterns:
        match = re.search(pattern, subject)
        if match:
            return match.group(1).strip() if match.lastindex else match.group(0).strip()
    return ""

def scan_account(account, since_date):
    """Scan one Gmail account, extract company leads."""
    companies = {}  # domain -> {company, domain, emails: [{subject, date, sender, body, msg_id}]}
    try:
        print(f"  Connecting to {account['email']}...", flush=True)
        mail = imaplib.IMAP4_SSL(account["imap"])
        mail.login(account["email"], account["password"])
        mail.select("INBOX")

        since_str = since_date.strftime("%d-%b-%Y")
        _, message_ids = mail.search(None, f'(SINCE "{since_str}")')
        if not message_ids[0]:
            print(f"  No emails found", flush=True)
            mail.logout()
            return companies

        ids = message_ids[0].split()
        print(f"  Found {len(ids)} emails to scan", flush=True)

        scanned = 0
        skipped = 0
        for msg_id in ids:
            try:
                _, msg_data = mail.fetch(msg_id, "(RFC822)")
                raw = msg_data[0][1]
                msg = email.message_from_bytes(raw)

                sender = msg.get("From", "")
                subject = decode_subject(msg)
                body = get_body(msg)
                date_str = msg.get("Date", "")
                msg_id_str = msg_id.decode() if isinstance(msg_id, bytes) else str(msg_id)

                scanned += 1

                # Skip invoices, receipts, newsletters
                if should_skip_email(subject, sender, body):
                    skipped += 1
                    continue

                # Extract company from sender
                company_name, domain = extract_company_from_sender(sender)
                if not domain:
                    continue

                # Check if this is a known job platform
                is_job_platform = is_job_related_sender(sender)

                # Extract any job URLs from the body
                job_urls = extract_job_urls(body)

                # Extract potential job title
                job_title = extract_job_title_from_email(subject, body)

                if domain not in companies:
                    companies[domain] = {
                        "company": company_name,
                        "domain": domain,
                        "is_job_platform": is_job_platform,
                        "emails": [],
                    }

                companies[domain]["emails"].append({
                    "subject": subject,
                    "date": date_str,
                    "sender": sender,
                    "body_preview": body[:500],
                    "job_urls": job_urls,
                    "job_title": job_title,
                    "msg_id": msg_id_str,
                })

                if scanned % 500 == 0:
                    print(f"  Scanned {scanned}, skipped {skipped}, found {len(companies)} companies...", flush=True)

            except Exception as e:
                continue

        print(f"  Done: scanned {scanned}, skipped {skipped}, found {len(companies)} companies", flush=True)
        mail.logout()

    except Exception as e:
        print(f"  Error: {e}", file=sys.stderr, flush=True)

    return companies

def main():
    ingest_url = os.environ.get("CAREERS_INGEST_URL", "https://careers-hansakoch.iceberg.workers.dev/api/ingest")
    password = os.environ.get("CAREERS_PASSWORD", "hak2026")

    since_date = datetime.now() - timedelta(days=548)
    print(f"Scanning emails since {since_date.strftime('%Y-%m-%d')}", flush=True)

    all_companies = {}
    for account in ACCOUNTS:
        companies = scan_account(account, since_date)
        for domain, data in companies.items():
            if domain in all_companies:
                all_companies[domain]["emails"].extend(data["emails"])
            else:
                all_companies[domain] = data

    print(f"\nTotal unique companies: {len(all_companies)}", flush=True)

    # For each company, check if they have a career page
    # Then build job opportunities
    jobs = []
    for domain, data in all_companies.items():
        company = data["company"]
        is_job_platform = data["is_job_platform"]
        email_count = len(data["emails"])

        # Get the most recent email
        latest_email = data["emails"][0] if data["emails"] else {}

        # If this is a job platform (LinkedIn, Indeed, etc.), extract job URLs
        if is_job_platform:
            for em in data["emails"]:
                for url in em.get("job_urls", []):
                    title = em.get("job_title", "") or "Opportunity via email"
                    jobs.append({
                        "title": title,
                        "company": company,
                        "url": url,
                        "location": "See listing",
                        "description": f"Source: {em['sender']}\nSubject: {em['subject']}\nDate: {em['date']}\n\n{em['body_preview'][:1000]}",
                        "source": "email-job-platform",
                    })
        else:
            # This is a company email - treat as a lead
            # Check career page
            career_url = f"https://{domain}/careers"
            company_url = f"https://{domain}"

            # Build a company opportunity entry
            desc_parts = [
                f"Company: {company} ({domain})",
                f"Email interactions: {email_count} emails over 1.5 years",
                f"Website: {company_url}",
                f"Career page: {career_url}",
                "",
                "Recent emails from this company:",
            ]
            for em in data["emails"][:5]:
                desc_parts.append(f"  - [{em.get('date','')}] {em.get('subject','')}")

            desc_parts.extend([
                "",
                "This company was found via email correspondence.",
                "Research their career page for open positions.",
                "If no current openings, consider reaching out directly.",
            ])

            jobs.append({
                "title": f"Opportunity at {company}",
                "company": company,
                "url": company_url,
                "location": "Research needed",
                "description": "\n".join(desc_parts),
                "source": "email-lead",
            })

    print(f"Total opportunities: {len(jobs)}", flush=True)

    # Post to careers API
    if jobs:
        body = json.dumps({"password": password, "jobs": jobs, "skip_research": True}).encode()
        req = urllib.request.Request(
            ingest_url,
            data=body,
            headers={"Content-Type": "application/json", "X-Careers-Password": password, "User-Agent": "OpenCareers-EmailScan/2.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                result = json.loads(resp.read().decode())
                print(f"Posted: kept={result.get('kept')}, dropped={result.get('dropped')}", flush=True)
        except Exception as e:
            print(f"Post error: {e}", file=sys.stderr, flush=True)
            with open("/tmp/email-leads.json", "w") as f:
                json.dump(jobs, f, indent=2)
            print("Saved to /tmp/email-leads.json", flush=True)
    else:
        print("No opportunities found", flush=True)

if __name__ == "__main__":
    main()
