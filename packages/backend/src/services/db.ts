import Database from "better-sqlite3";

const dbPath = process.env.DB_PATH ?? "shieldpass.db";
export const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    ens_node TEXT PRIMARY KEY,
    ens_name TEXT NOT NULL,
    admin TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    registered_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS root_history (
    ens_node TEXT NOT NULL,
    root TEXT NOT NULL,
    set_at INTEGER NOT NULL,
    PRIMARY KEY (ens_node, root)
  );

  CREATE TABLE IF NOT EXISTS reports (
    report_hash TEXT PRIMARY KEY,
    ens_node TEXT NOT NULL,
    nullifier TEXT NOT NULL UNIQUE,
    root_used TEXT NOT NULL,
    cid TEXT NOT NULL,
    category INTEGER NOT NULL,
    submitted_at INTEGER NOT NULL,
    pseudonym_node TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    context_pack_cid TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_reports_company ON reports(ens_node, submitted_at DESC);
  CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category, submitted_at DESC);

  CREATE TABLE IF NOT EXISTS proof_jobs (
    request_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    ens_node TEXT NOT NULL,
    report_hash TEXT NOT NULL,
    period_id INTEGER NOT NULL,
    receipt_json TEXT,
    error TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pseudonym_stats (
    pseudonym_node TEXT PRIMARY KEY,
    reports_count INTEGER NOT NULL DEFAULT 0,
    verified_count INTEGER NOT NULL DEFAULT 0,
    debunked_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS email_otps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email, used, expires_at);

  CREATE TABLE IF NOT EXISTS investigation_results (
    report_hash TEXT PRIMARY KEY,
    dossier_json TEXT NOT NULL,
    credibility_score INTEGER NOT NULL,
    completed_at INTEGER NOT NULL
  );
`);

// Non-destructive migration: add payload_json column if it doesn't exist yet
try { db.exec("ALTER TABLE reports ADD COLUMN payload_json TEXT"); } catch { /* already exists */ }

// Helper functions
export const dbHelpers = {
  insertCompany: (ensNode: string, ensName: string, admin: string, registeredAt: number) => {
    const stmt = db.prepare(
      "INSERT INTO companies (ens_node, ens_name, admin, registered_at) VALUES (?, ?, ?, ?)"
    );
    return stmt.run(ensNode, ensName, admin, registeredAt);
  },

  insertCompanyIfMissing: (ensNode: string, ensName: string, admin: string, registeredAt: number) => {
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO companies (ens_node, ens_name, admin, registered_at) VALUES (?, ?, ?, ?)"
    );
    return stmt.run(ensNode, ensName, admin, registeredAt);
  },

  getCompany: (ensNode: string) => {
    const stmt = db.prepare("SELECT * FROM companies WHERE ens_node = ?");
    return stmt.get(ensNode) as CompanyRow | undefined;
  },

  listCompanies: (limit = 50, cursor?: string) => {
    let query = "SELECT * FROM companies WHERE active = 1";
    const params: any[] = [];
    if (cursor) {
      query += " AND ens_name > ?";
      params.push(cursor);
    }
    query += " ORDER BY ens_name LIMIT ?";
    params.push(limit + 1);
    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as CompanyRow[];
    const items = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? items[items.length - 1].ens_name : null;
    return { items, nextCursor };
  },

  insertRootHistory: (ensNode: string, root: string, setAt: number) => {
    const stmt = db.prepare(
      "INSERT OR REPLACE INTO root_history (ens_node, root, set_at) VALUES (?, ?, ?)"
    );
    return stmt.run(ensNode, root, setAt);
  },

  getRootHistory: (ensNode: string) => {
    const stmt = db.prepare(
      "SELECT root FROM root_history WHERE ens_node = ? ORDER BY set_at DESC"
    );
    return stmt.all(ensNode) as { root: string }[];
  },

  insertReport: (report: Omit<ReportRow, "context_pack_cid">) => {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO reports (
        report_hash, ens_node, nullifier, root_used, cid, category,
        submitted_at, pseudonym_node, tx_hash, block_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      report.report_hash,
      report.ens_node,
      report.nullifier,
      report.root_used,
      report.cid,
      report.category,
      report.submitted_at,
      report.pseudonym_node,
      report.tx_hash,
      report.block_number
    );
  },

  getReport: (reportHash: string) => {
    const stmt = db.prepare("SELECT * FROM reports WHERE report_hash = ?");
    return stmt.get(reportHash) as ReportRow | undefined;
  },

  updateReportPayload: (reportHash: string, payloadJson: string) => {
    const stmt = db.prepare("UPDATE reports SET payload_json = ? WHERE report_hash = ?");
    return stmt.run(payloadJson, reportHash);
  },

  listReports: (filters: {
    company?: string;
    category?: number;
    since?: number;
    limit?: number;
    cursor?: string;
  }) => {
    const { company, category, since, limit = 25, cursor } = filters;
    const conditions: string[] = [];
    const params: any[] = [];

    if (company) {
      const companyRow = db.prepare("SELECT ens_node FROM companies WHERE ens_name = ?").get(company) as { ens_node: string } | undefined;
      conditions.push("ens_node = ?");
      params.push(companyRow?.ens_node ?? company);
    }
    if (category !== undefined) {
      conditions.push("category = ?");
      params.push(category);
    }
    if (since) {
      conditions.push("submitted_at > ?");
      params.push(since);
    }
    if (cursor) {
      conditions.push("submitted_at < ?");
      params.push(cursor);
    }

    const whereClause = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    const query = `SELECT * FROM reports ${whereClause} ORDER BY submitted_at DESC LIMIT ?`;
    params.push(limit + 1);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as ReportRow[];
    const items = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? items[items.length - 1].submitted_at : null;
    return { items, nextCursor };
  },

  insertProofJob: (job: ProofJobRow) => {
    const stmt = db.prepare(`
      INSERT INTO proof_jobs (
        request_id, status, ens_node, report_hash, period_id,
        created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      job.request_id,
      job.status,
      job.ens_node,
      job.report_hash,
      job.period_id,
      job.created_at,
      job.expires_at
    );
  },

  getProofJob: (requestId: string) => {
    const stmt = db.prepare("SELECT * FROM proof_jobs WHERE request_id = ?");
    return stmt.get(requestId) as ProofJobRow | undefined;
  },

  updateProofJob: (requestId: string, updates: Partial<ProofJobRow>) => {
    const fields = Object.keys(updates).filter((k) => k !== "request_id");
    if (fields.length === 0) return;
    const setClause = fields.map((f) => `${f} = ?`).join(", ");
    const values = fields.map((f) => (updates as any)[f]);
    const stmt = db.prepare(`UPDATE proof_jobs SET ${setClause} WHERE request_id = ?`);
    return stmt.run(...values, requestId);
  },

  insertInvestigationResult: (reportHash: string, dossierJson: string, credibilityScore: number, completedAt: number) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO investigation_results (report_hash, dossier_json, credibility_score, completed_at)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(reportHash, dossierJson, credibilityScore, completedAt);
  },

  getInvestigationResult: (reportHash: string) => {
    const stmt = db.prepare("SELECT * FROM investigation_results WHERE report_hash = ?");
    return stmt.get(reportHash) as InvestigationResultRow | undefined;
  },

  setMeta: (key: string, value: string) => {
    const stmt = db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)");
    return stmt.run(key, value);
  },

  getMeta: (key: string) => {
    const stmt = db.prepare("SELECT value FROM meta WHERE key = ?");
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value;
  },
};

export type CompanyRow = {
  ens_node: string;
  ens_name: string;
  admin: string;
  active: number;
  registered_at: number;
};

export type ReportRow = {
  report_hash: string;
  ens_node: string;
  nullifier: string;
  root_used: string;
  cid: string;
  category: number;
  submitted_at: number;
  pseudonym_node: string;
  tx_hash: string;
  block_number: number;
  context_pack_cid?: string | null;
  payload_json?: string | null;
};

export type ProofJobRow = {
  request_id: string;
  status: "queued" | "fulfilled" | "failed" | "expired";
  ens_node: string;
  report_hash: string;
  period_id: number;
  receipt_json?: string | null;
  error?: string | null;
  created_at: number;
  expires_at: number;
};

export type InvestigationResultRow = {
  report_hash: string;
  dossier_json: string;
  credibility_score: number;
  completed_at: number;
};
