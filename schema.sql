-- Database Schema for Cold Call Co-Pilot

CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT,
    current_stage TEXT DEFAULT 'Opener',
    outcome TEXT DEFAULT 'In Progress',
    follow_up_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id INTEGER NOT NULL,
    stage_name TEXT NOT NULL,
    caller_notes TEXT,
    prospect_reaction TEXT,
    ai_guidance TEXT,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (call_id) REFERENCES calls (id)
);