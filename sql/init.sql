-- HCM System Database Initialization Script
-- PostgreSQL Database: hcm_db

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS hr;
CREATE SCHEMA IF NOT EXISTS matching;
CREATE SCHEMA IF NOT EXISTS verification;
CREATE SCHEMA IF NOT EXISTS audit;

-- Set search path
SET search_path TO public, hr, matching, verification, audit;

-- Create base tables
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- HR schema tables
CREATE TABLE IF NOT EXISTS hr.employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    department VARCHAR(255),
    position VARCHAR(255),
    hire_date DATE,
    salary DECIMAL(12, 2),
    manager_id UUID REFERENCES hr.employees(id),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hr.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    manager_id UUID REFERENCES hr.employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Matching schema tables
CREATE TABLE IF NOT EXISTS matching.job_postings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    requirements TEXT,
    department_id UUID REFERENCES hr.departments(id),
    posted_by UUID REFERENCES hr.employees(id),
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matching.applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_posting_id UUID REFERENCES matching.job_postings(id),
    applicant_id UUID REFERENCES public.users(id),
    status VARCHAR(50) DEFAULT 'pending',
    match_score DECIMAL(5, 2),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Verification schema tables
CREATE TABLE IF NOT EXISTS verification.identity_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    verification_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES hr.employees(id),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit schema tables
CREATE TABLE IF NOT EXISTS audit.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    action VARCHAR(255) NOT NULL,
    table_name VARCHAR(255),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON hr.employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON hr.employees(department);
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON matching.job_postings(status);
CREATE INDEX IF NOT EXISTS idx_applications_job_posting_id ON matching.applications(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON matching.applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_verifications_user_id ON verification.identity_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit.audit_logs(created_at);

-- Create functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON hr.employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON hr.departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_job_postings_updated_at BEFORE UPDATE ON matching.job_postings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON matching.applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_verifications_updated_at BEFORE UPDATE ON verification.identity_verifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO public.users (username, email, password_hash, first_name, last_name) VALUES
    ('admin', 'admin@example.com', crypt('admin123', gen_salt('bf')), 'System', 'Administrator'),
    ('hr_manager', 'hr.manager@example.com', crypt('hrpass123', gen_salt('bf')), 'HR', 'Manager'),
    ('john.doe', 'john.doe@example.com', crypt('johnpass123', gen_salt('bf')), 'John', 'Doe'),
    ('jane.smith', 'jane.smith@example.com', crypt('janepass123', gen_salt('bf')), 'Jane', 'Smith')
ON CONFLICT (username) DO NOTHING;

-- Insert sample departments
INSERT INTO hr.departments (name, description) VALUES
    ('Information Technology', 'IT Department responsible for technology infrastructure'),
    ('Human Resources', 'HR Department responsible for employee management'),
    ('Finance', 'Finance Department responsible for financial operations'),
    ('Marketing', 'Marketing Department responsible for business promotion')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA hr TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA matching TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA verification TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA audit TO postgres;

GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA hr TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA matching TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA verification TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA audit TO postgres;

-- Create application user (for production)
-- CREATE USER hcm_app WITH PASSWORD 'secure_password_change_me';
-- GRANT CONNECT ON DATABASE hcm_db TO hcm_app;
-- GRANT USAGE ON SCHEMA public, hr, matching, verification, audit TO hcm_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public, hr, matching, verification TO hcm_app;
-- GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA audit TO hcm_app;

COMMIT;
