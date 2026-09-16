#!/usr/bin/env python3
"""Batch email scanner: categorize ALL emails, save for review.

Categories:
- job_platform: LinkedIn, Indeed, etc. with job URLs
- job_alert: Job recommendation emails
- company_lead: Company emails that could have career opportunities
- newsletter: Industry newsletters (may contain job ops)
- invoice_receipt: Financial emails (may have company to research)
- contact: Personal/professional contacts
- social_media: Social platform notifications
- system: Password resets, security alerts, etc.
- other: Everything else

Env:
  BATCH_SIZE: emails per batch (default 500)
  BATCH_NUM: which batch to process (1-based)
"""
import email
import imaplib
import json
import os
import re
import sys
import time
from email.header import decode_header
from datetime import datetime, timedelta

ACCOUNTS = [
    {"email": "hans@hansakoch.com", "password": "yxwp nbhp bedv wqju", "imap": "imap.gmail.com"},
    {"email": "hans@icebergmedia.co.uk", "password": "unhl sdyv lqzy wgid", "imap": "imap.gmail.com"},
]

# Category patterns
CATEGORY_PATTERNS = {
    "job_platform": [
        r"(?i)linkedin.*job", r"(?i)indeed.*job", r"(?i)glassdoor",
        r"(?i)ziprecruiter", r"(?i)monster\.com", r"(?i)careerbuilder",
        r"(?i)greenhouse", r"(?i)lever\.co", r"(?i)ashby", r"(?i)workday",
        r"(?i)smartrecruiters", r"(?i)jobvite",
    ],
    "job_alert": [
        r"(?i)job (alert|recommendation|match|opportunity|opening)",
        r"(?i)new (job|position|role|opportunity)",
        r"(?i)we.{0,5}hiring",
        r"(?i)career (opportunity|update|alert)",
        r"(?i)(seo|aeo|ppc|growth|marketing|digital|webmaster|director|manager).{0,30}(remote|hybrid|onsite)",
        r"(?i)apply|application|position|role",
    ],
    "invoice_receipt": [
        r"(?i)invoice", r"(?i)receipt", r"(?i)payment", r"(?i)billing",
        r"(?i)subscription", r"(?i)renewal", r"(?i)order confirmation",
        r"(?i)your statement", r"(?i)transaction",
    ],
    "newsletter": [
        r"(?i)newsletter", r"(?i)weekly digest", r"(?i)monthly report",
        r"(?i)unsubscribe", r"(?i)email preferences",
    ],
    "social_media": [
        r"(?i)facebook", r"(?i)instagram", r"(?i)twitter", r"(?i)tiktok",
        r"(?i)pinterest", r"(?i)snapchat", r"(?i)reddit", r"(?i)linkedin.*(notification|update|message)",
    ],
    "system": [
        r"(?i)password reset", r"(?i)security alert", r"(?i)account update",
        r"(?i)delivery failure", r"(?i)undeliverable", r"(?i)mail delivery",
        r"(?i)out of office", r"(?i)auto-reply",
        r"(?i)calendar invite", r"(?i)meeting request",
        r"(?i)zoom", r"(?i)slack", r"(?i)discord",
    ],
    "contact": [
        r"(?i)re:\s", r"(?i)fwd:\s", r"(?i)hi\s", r"(?i)hello\s",
        r"(?i)dear\s", r"(?i)hey\s",
    ],
}

JOB_URL_PATTERNS = [
    r'(https?://boards\.greenhouse\.io/[^\s<>"]+)',
    r'(https?://(?:www\.)?lever\.co/[^\s<>"]+)',
    r'(https?://(?:www\.)?ashbyhq\.com/[^\s<>"]+)',
    r'(https?://(?:\w+\.)?myworkday\.com/[^\s<>"]+)',
    r'(https?://(?:www\.)?indeed\.com/viewjob[^\s<>"]+)',
    r'(https?://(?:www\.)?linkedin\.com/jobs/view/[^\s<>"]+)',
    r'(https?://(?:www\.)?glassdoor\.com/job[^\s<>"]+)',
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
                try: body += part.get_payload(decode=True).decode("utf-8", errors="replace")[:3000]
                except: pass
            elif ct == "text/html" and not body:
                try:
                    html = part.get_payload(decode=True).decode("utf-8", errors="replace")
                    body += re.sub(r"<[^>]+>", " ", html)[:3000]
                except: pass
    else:
        try: body = msg.get_payload(decode=True).decode("utf-8", errors="replace")[:3000]
        except: pass
    return body

def extract_company(sender):
    match = re.search(r"@([\w.-]+)", sender)
    if not match:
        return None, None
    domain = match.group(1).lower()
    skip = ["gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com", "protonmail.com", "icloud.com"]
    if any(s in domain for s in skip):
        return None, domain
    company = domain.split(".")[0]
    return company.replace("-", " ").title(), domain

def categorize(subject, sender, body):
    """Categorize an email. Returns (primary_category, all_categories)."""
    combined = f"{subject} {sender} {body[:1500]}".lower()
    cats = []
    for cat, patterns in CATEGORY_PATTERNS.items():
        for p in patterns:
            if re.search(p, combined):
                cats.append(cat)
                break
    if not cats:
        cats = ["other"]
    return cats[0], cats

def extract_job_urls(body):
    urls = []
    for p in JOB_URL_PATTERNS:
        urls.extend(re.findall(p, body))
    return list(set(urls))

def scan_batch(account, since_date, batch_num, batch_size):
    """Scan one batch of emails from one account."""
    results = []
    try:
        mail = imaplib.IMAP4_SSL(account["imap"])
        mail.login(account["email"], account["password"])
        mail.select("INBOX")

        since_str = since_date.strftime("%d-%b-%Y")
        _, message_ids = mail.search(None, f'(SINCE "{since_str}")')
        if not message_ids[0]:
            mail.logout()
            return results

        ids = message_ids[0].split()
        total = len(ids)
        start = (batch_num - 1) * batch_size
        end = min(start + batch_size, total)

        if start >= total:
            mail.logout()
            return results

        batch_ids = ids[start:end]
        print(f"  Batch {batch_num}: emails {start+1}-{end} of {total}", flush=True)

        for i, msg_id in enumerate(batch_ids):
            try:
                _, msg_data = mail.fetch(msg_id, "(RFC822)")
                raw = msg_data[0][1]
                msg = email.message_from_bytes(raw)

                sender = msg.get("From", "")
                subject = decode_subject(msg)
                body = get_body(msg)
                date_str = msg.get("Date", "")

                company, domain = extract_company(sender)
                primary_cat, all_cats = categorize(subject, sender, body)
                job_urls = extract_job_urls(body)

                results.append({
                    "idx": start + i + 1,
                    "sender": sender,
                    "subject": subject[:200],
                    "date": date_str[:30],
                    "company": company,
                    "domain": domain,
                    "category": primary_cat,
                    "all_categories": all_cats,
                    "job_urls": job_urls,
                    "body_preview": body[:300],
                })

            except Exception as e:
                continue

        mail.logout()

    except Exception as e:
        print(f"  Error: {e}", file=sys.stderr, flush=True)

    return results

def main():
    batch_size = int(os.environ.get("BATCH_SIZE", "500"))
    batch_num = int(os.environ.get("BATCH_NUM", "1"))
    output_dir = "/tmp/email-batches"
    os.makedirs(output_dir, exist_ok=True)

    since_date = datetime.now() - timedelta(days=548)
    print(f"Batch {batch_num} scan since {since_date.strftime('%Y-%m-%d')}", flush=True)

    all_results = []
    for account in ACCOUNTS:
        print(f"  Scanning {account['email']}...", flush=True)
        results = scan_batch(account, since_date, batch_num, batch_size)
        all_results.extend(results)
        print(f"  Got {len(results)} emails from {account['email']}", flush=True)

    # Categorize
    categories = {}
    for r in all_results:
        cat = r["category"]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(r)

    # Save
    output_file = os.path.join(output_dir, f"batch_{batch_num}.json")
    with open(output_file, "w") as f:
        json.dump({
            "batch": batch_num,
            "batch_size": batch_size,
            "total_scanned": len(all_results),
            "categories": {cat: len(items) for cat, items in categories.items()},
            "emails": all_results,
        }, f, indent=2)

    # Print summary
    print(f"\n=== Batch {batch_num} Summary ===", flush=True)
    print(f"Total scanned: {len(all_results)}", flush=True)
    for cat, items in sorted(categories.items(), key=lambda x: -len(x[1])):
        print(f"  {cat}: {len(items)}", flush=True)

    # Show top companies
    companies = {}
    for r in all_results:
        if r["company"]:
            key = r["domain"] or r["company"]
            if key not in companies:
                companies[key] = {"company": r["company"], "domain": r["domain"], "count": 0, "categories": set()}
            companies[key]["count"] += 1
            companies[key]["categories"].add(r["category"])

    print(f"\nTop companies (by email count):", flush=True)
    for key, c in sorted(companies.items(), key=lambda x: -x[1]["count"])[:20]:
        cats = ", ".join(c["categories"])
        print(f"  {c['company']} ({c['domain']}): {c['count']} emails [{cats}]", flush=True)

    print(f"\nSaved to {output_file}", flush=True)
    print(f"Review this batch, then run with BATCH_NUM={batch_num + 1} for next batch", flush=True)

if __name__ == "__main__":
    main()
