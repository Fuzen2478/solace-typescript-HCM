import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createUserDB(): Database.Database {
  const dbPath = path.join(process.cwd(), 'data', 'users.db');
  const db = new Database(dbPath);
  
  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');
  
  // Create users table with comprehensive schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      department TEXT,
      title TEXT,
      location TEXT,
      phone TEXT,
      skills TEXT, -- JSON array
      manager_id TEXT,
      ldap_dn TEXT,
      current_load INTEGER DEFAULT 0,
      max_capacity INTEGER DEFAULT 40,
      availability_hours INTEGER DEFAULT 8,
      status TEXT DEFAULT 'active',
      last_sync DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      CHECK (current_load >= 0),
      CHECK (max_capacity > 0),
      CHECK (availability_hours >= 0 AND availability_hours <= 24)
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_users_skills ON users(skills);
    CREATE INDEX IF NOT EXISTS idx_users_manager ON users(manager_id);
    CREATE INDEX IF NOT EXISTS idx_users_location ON users(location);

    -- Create trigger to update updated_at timestamp
    CREATE TRIGGER IF NOT EXISTS users_updated_at 
    AFTER UPDATE ON users
    BEGIN
      UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);
  
  console.log(`📄 User database initialized: ${dbPath}`);
  return db;
}

export function createProjectDB(): Database.Database {
  const dbPath = path.join(process.cwd(), 'data', 'projects.db');
  const db = new Database(dbPath);
  
  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_requests (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      requester_id TEXT NOT NULL,
      priority INTEGER DEFAULT 3,
      required_skills TEXT, -- JSON array
      estimated_hours INTEGER,
      actual_hours INTEGER DEFAULT 0,
      deadline DATE,
      status TEXT DEFAULT 'pending',
      assigned_to TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      
      CHECK (priority BETWEEN 1 AND 5),
      CHECK (estimated_hours > 0),
      CHECK (actual_hours >= 0),
      CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled'))
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      assignee_id TEXT NOT NULL,
      assignment_type TEXT DEFAULT 'internal', -- 'internal' or 'external'
      status TEXT DEFAULT 'assigned',
      progress INTEGER DEFAULT 0,
      notes TEXT,
      estimated_completion DATE,
      actual_completion DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      CHECK (progress BETWEEN 0 AND 100),
      CHECK (assignment_type IN ('internal', 'external')),
      CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled')),
      FOREIGN KEY (request_id) REFERENCES work_requests(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assignment_history (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL,
      status_from TEXT,
      status_to TEXT NOT NULL,
      progress_from INTEGER,
      progress_to INTEGER,
      notes TEXT,
      changed_by TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_requests_status ON work_requests(status);
    CREATE INDEX IF NOT EXISTS idx_requests_priority ON work_requests(priority);
    CREATE INDEX IF NOT EXISTS idx_requests_requester ON work_requests(requester_id);
    CREATE INDEX IF NOT EXISTS idx_requests_assigned ON work_requests(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_requests_deadline ON work_requests(deadline);
    
    CREATE INDEX IF NOT EXISTS idx_assignments_request ON assignments(request_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_assignee ON assignments(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
    CREATE INDEX IF NOT EXISTS idx_assignments_type ON assignments(assignment_type);

    -- Create triggers for updated_at timestamps
    CREATE TRIGGER IF NOT EXISTS work_requests_updated_at 
    AFTER UPDATE ON work_requests
    BEGIN
      UPDATE work_requests SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS assignments_updated_at 
    AFTER UPDATE ON assignments
    BEGIN
      UPDATE assignments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

    -- Create trigger for assignment history
    CREATE TRIGGER IF NOT EXISTS assignment_status_history
    AFTER UPDATE OF status, progress ON assignments
    WHEN OLD.status != NEW.status OR OLD.progress != NEW.progress
    BEGIN
      INSERT INTO assignment_history (
        id, assignment_id, status_from, status_to, 
        progress_from, progress_to, changed_by
      ) VALUES (
        'hist_' || NEW.id || '_' || strftime('%s', 'now'),
        NEW.id, OLD.status, NEW.status, 
        OLD.progress, NEW.progress, 'system'
      );
    END;
  `);
  
  console.log(`📄 Project database initialized: ${dbPath}`);
  return db;
}

export function createMatchingDB(): Database.Database {
  const dbPath = path.join(process.cwd(), 'data', 'matching.db');
  const db = new Database(dbPath);
  
  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS matching_logs (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      algorithm_used TEXT NOT NULL,
      candidate_scores TEXT, -- JSON object
      selected_assignee_id TEXT,
      selection_reason TEXT,
      confidence_score REAL,
      processing_time_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      CHECK (confidence_score BETWEEN 0.0 AND 1.0),
      CHECK (processing_time_ms >= 0)
    );

    CREATE TABLE IF NOT EXISTS skill_weights (
      skill_name TEXT PRIMARY KEY,
      weight REAL DEFAULT 1.0,
      demand_factor REAL DEFAULT 1.0,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      CHECK (weight > 0),
      CHECK (demand_factor > 0)
    );

    CREATE TABLE IF NOT EXISTS matching_feedback (
      id TEXT PRIMARY KEY,
      matching_log_id TEXT NOT NULL,
      feedback_type TEXT NOT NULL, -- 'positive', 'negative', 'neutral'
      feedback_score INTEGER, -- 1-5 rating
      feedback_text TEXT,
      provided_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      CHECK (feedback_type IN ('positive', 'negative', 'neutral')),
      CHECK (feedback_score BETWEEN 1 AND 5),
      FOREIGN KEY (matching_log_id) REFERENCES matching_logs(id) ON DELETE CASCADE
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_matching_logs_request ON matching_logs(request_id);
    CREATE INDEX IF NOT EXISTS idx_matching_logs_assignee ON matching_logs(selected_assignee_id);
    CREATE INDEX IF NOT EXISTS idx_matching_logs_algorithm ON matching_logs(algorithm_used);
    CREATE INDEX IF NOT EXISTS idx_matching_logs_confidence ON matching_logs(confidence_score);
    
    CREATE INDEX IF NOT EXISTS idx_feedback_matching_log ON matching_feedback(matching_log_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_type ON matching_feedback(feedback_type);
  `);
  
  console.log(`📄 Matching database initialized: ${dbPath}`);
  return db;
}

// Utility functions for database operations
export class DatabaseManager {
  private static userDB: Database.Database | null = null;
  private static projectDB: Database.Database | null = null;
  private static matchingDB: Database.Database | null = null;

  static getUserDB(): Database.Database {
    if (!this.userDB) {
      this.userDB = createUserDB();
    }
    return this.userDB;
  }

  static getProjectDB(): Database.Database {
    if (!this.projectDB) {
      this.projectDB = createProjectDB();
    }
    return this.projectDB;
  }

  static getMatchingDB(): Database.Database {
    if (!this.matchingDB) {
      this.matchingDB = createMatchingDB();
    }
    return this.matchingDB;
  }

  static closeAll(): void {
    if (this.userDB) {
      this.userDB.close();
      this.userDB = null;
    }
    if (this.projectDB) {
      this.projectDB.close();
      this.projectDB = null;
    }
    if (this.matchingDB) {
      this.matchingDB.close();
      this.matchingDB = null;
    }
    console.log('📄 All databases closed');
  }
}

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`📁 Created data directory: ${dataDir}`);
}
