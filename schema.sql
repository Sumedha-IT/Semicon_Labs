
-- Create Organizations table
CREATE TABLE organizations (
    org_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('semicon', 'corporate', 'startup', 'university', 'government', 'other')),
    industry VARCHAR(100) NOT NULL CHECK (industry IN ('IT', 'Telecom', 'Healthcare', 'Finance', 'Education', 'Manufacturing', 'Retail', 'Automotive', 'Energy', 'Agriculture', 'Other')),
    location VARCHAR(150) NOT NULL,
    poc_name VARCHAR(100) NOT NULL,
    poc_phone VARCHAR(20) NOT NULL,
    poc_email VARCHAR(100) NOT NULL,
    subscription_id INTEGER NOT NULL, -- Reference to subscription plan
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_on TIMESTAMP NULL -- Soft delete timestamp
);

-- Create Users table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT,
    role VARCHAR(50) NOT NULL CHECK (role IN ('PlatformAdmin', 'ClientAdmin', 'Manager', 'Learner')),
    dob DATE,
    user_phone VARCHAR(20) NOT NULL, -- Phone number
    location VARCHAR(150) NOT NULL,
    registered_device_no VARCHAR(100) NOT NULL,
    tool_id INTEGER NOT NULL, 
    org_id INTEGER REFERENCES organizations(org_id) ON DELETE SET NULL, -- NULL for individual users
    manager_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL, -- NULL for users without manager
    joined_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Changed from created_at to match entity
    updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Changed from updated_at to match entity
    deleted_on TIMESTAMP NULL -- Soft delete timestamp
);

-- Create indexes
CREATE INDEX users_org_id_idx ON users(org_id);
CREATE INDEX users_manager_id_idx ON users(manager_id);
CREATE INDEX users_role_idx ON users(role);
CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_tool_id_idx ON users(tool_id);
CREATE INDEX users_deleted_on_idx ON users(deleted_on);
CREATE INDEX users_org_role_idx ON users(org_id, role);

CREATE INDEX organizations_type_idx ON organizations(type);
CREATE INDEX organizations_subscription_id_idx ON organizations(subscription_id);
CREATE INDEX organizations_deleted_on_idx ON organizations(deleted_on);

-- Create Domains table
CREATE TABLE domains (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NULL,
    created_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), -- Changed from created_at to match entity
    updated_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() -- Changed from updated_at to match entity
);

-- Create User-Domains join table
CREATE TABLE user_domains (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    created_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), -- Changed from created_at to match entity
    CONSTRAINT uq_user_domain UNIQUE (user_id, domain_id)
);

CREATE INDEX idx_user_domains_user_id ON user_domains (user_id);
CREATE INDEX idx_user_domains_domain_id ON user_domains (domain_id);

-- Insert sample organizations (updated to match code constants)
INSERT INTO organizations (name, description, type, industry, location, poc_name, poc_phone, poc_email, subscription_id) VALUES 
('SemiCon Labs', 'Main platform organization for semiconductor training', 'corporate', 'IT', 'Bengaluru', 'Rajesh Kumar', '9000000000', 'poc@semiconlabs.com', 1),
('Tech Corp', 'Leading semiconductor company', 'corporate', 'IT', 'Mumbai', 'Priya Sharma', '9000000001', 'poc@techcorp.com', 2),
('Innovation Inc', 'Startup focused on semiconductor innovation', 'startup', 'IT', 'Pune', 'Amit Patel', '9000000002', 'poc@innovation.com', 3),
('University College', 'Educational institution offering semiconductor courses', 'university', 'Education', 'Delhi', 'Dr. Sunita Singh', '9000000003', 'poc@university.edu', 4),
('Government Lab', 'Government research laboratory', 'government', 'Other', 'Chennai', 'Dr. Ravi Menon', '9000000004', 'poc@govlab.gov.in', 5);

-- Insert sample users (passwords will be hashed by the application)
-- All users have password: test123
-- Note: org_id can be NULL for individual users
-- Note: manager_id can be NULL for users without manager
-- Note: Client type comes from organizations.type field
INSERT INTO users (name, email, password_hash, role, dob, user_phone, location, registered_device_no, tool_id, org_id, manager_id) VALUES
('Platform Admin', 'platform@admin.com', 'test123', 'PlatformAdmin', '1985-01-15', '9000000001', 'Bengaluru', 'DEV-ADMIN-001', 1, 1, NULL),
('Client Admin', 'client@admin.com', 'test123', 'ClientAdmin', '1980-05-20', '9000000002', 'Mumbai', 'DEV-CLIENT-001', 2, 2, NULL),
('Team Manager', 'manager@team.com', 'test123', 'Manager', '1988-03-10', '9000000003', 'Mumbai', 'DEV-MGR-001', 1, 2, 2),
('John Learner', 'learner@user.com', 'test123', 'Learner', '1995-07-25', '9000000004', 'Mumbai', 'DEV-LRN-001', 1, 2, 3),
('Sarah Engineer', 'sarah@techcorp.com', 'test123', 'Learner', '1992-11-12', '9000000005', 'Mumbai', 'DEV-LRN-002', 2, 2, 3),
('Mike Developer', 'mike@innovation.com', 'test123', 'Learner', '1990-09-08', '9000000006', 'Pune', 'DEV-LRN-003', 1, 3, NULL),
('Dr. Lisa Professor', 'lisa@university.edu', 'test123', 'ClientAdmin', '1975-12-03', '9000000007', 'Delhi', 'DEV-UNIV-001', 1, 4, NULL),
('Gov Lab Admin', 'govadmin@govlab.gov.in', 'test123', 'ClientAdmin', '1970-08-15', '9000000011', 'Chennai', 'DEV-GOV-ADMIN-001', 1, 5, NULL),
('Research Lead', 'research@govlab.gov.in', 'test123', 'Manager', '1982-04-18', '9000000008', 'Chennai', 'DEV-GOV-001', 2, 5, 8),
('Individual Learner', 'individual@learner.com', 'test123', 'Learner', '1998-06-30', '9000000009', 'Hyderabad', 'DEV-IND-001', 1, NULL, NULL),
('Freelance Engineer', 'freelance@engineer.com', 'test123', 'Learner', '1987-08-14', '9000000010', 'Bangalore', 'DEV-FREELANCE-001', 2, NULL, NULL);
-- Sample domains
INSERT INTO domains (name, description) VALUES
('Physical Design', 'Physical design for semiconductor devices'),
('Design Verification', 'Verification of semiconductor designs'),
('Analog Layout', 'Analog layout for semiconductor devices');

-- Create Modules table
CREATE TABLE modules (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    skills TEXT[] NULL,
    "desc" TEXT NULL,
    duration INTEGER NULL, -- Duration in minutes
    level VARCHAR(50) NULL CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
    created_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    CONSTRAINT uq_module_title_domain UNIQUE (title, domain_id) -- Allow same title in different domains
);


-- Sample modules
INSERT INTO modules (title, skills, "desc", duration, level, domain_id) VALUES
('Introduction to Physical Design', ARRAY['Layout Design', 'Floor Planning', 'Placement'], 'Fundamentals of physical design in semiconductor devices', 120, 'Beginner', 1),
('Design Verification Basics', ARRAY['Simulation', 'Testing', 'Debugging'], 'Basic concepts of design verification', 90, 'Beginner', 2),
('Analog Layout Fundamentals', ARRAY['Layout Design', 'Matching', 'Symmetry'], 'Essential concepts for analog layout design', 150, 'Beginner', 3);

-- Create User-Modules join table for progress tracking
CREATE TABLE user_modules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    questions_answered INTEGER DEFAULT 0,
    score NUMERIC(5,2) DEFAULT 0,
    threshold_score NUMERIC(5,2) DEFAULT 70,
    status VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'passed', 'failed')),
    joined_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_on TIMESTAMP WITH TIME ZONE NULL,
    CONSTRAINT uq_user_module UNIQUE (user_id, module_id)
);

CREATE INDEX idx_user_modules_user_id ON user_modules (user_id);
CREATE INDEX idx_user_modules_module_id ON user_modules (module_id);
CREATE INDEX idx_user_modules_status ON user_modules (status);
