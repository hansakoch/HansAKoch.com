CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  url TEXT,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  source TEXT,
  description TEXT,
  gate0 TEXT,
  gate1 TEXT,
  loc_label TEXT,
  score INTEGER,
  verdict TEXT,
  method TEXT DEFAULT 'unknown',
  status TEXT NOT NULL DEFAULT 'discovered',
  resume_md TEXT,
  cover_md TEXT,
  packet_notes TEXT,
  approved INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_verdict ON jobs(verdict);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_score ON jobs(score);

CREATE TABLE IF NOT EXISTS probes (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  domain TEXT,
  persona TEXT NOT NULL DEFAULT 'probe',
  method TEXT,
  result TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS atlas (
  domain TEXT PRIMARY KEY,
  last_good_method TEXT,
  last_result TEXT,
  notes TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS denylist (
  pattern TEXT PRIMARY KEY,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT,
  kind TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS onboarding (
  key TEXT PRIMARY KEY,
  done INTEGER DEFAULT 0,
  notes TEXT,
  updated_at TEXT NOT NULL
);
