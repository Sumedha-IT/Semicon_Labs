
-- Create Organizations table
CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('semicon', 'corporate', 'startup', 'university', 'government', 'other')),
    industry VARCHAR(100) NOT NULL CHECK (industry IN ('IT', 'Telecom', 'Healthcare', 'Finance', 'Education', 'Manufacturing', 'Retail', 'Automotive', 'Energy', 'Agriculture', 'Other')),
    location VARCHAR(150) NOT NULL,
    poc_name VARCHAR(100) NOT NULL,
    poc_phone VARCHAR(20) NOT NULL,
    poc_email VARCHAR(100) NOT NULL,
    subscription_id INTEGER NOT NULL, -- Reference to subscription plan
    created_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_on TIMESTAMP WITH TIME ZONE NULL -- Soft delete timestamp
);

-- Create Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT,
    role VARCHAR(50) NOT NULL CHECK (role IN ('PlatformAdmin', 'ClientAdmin', 'Manager', 'Learner')),
    dob DATE,
    user_phone VARCHAR(20) NULL, -- Phone number (optional)
    location VARCHAR(150) NULL, -- Location (optional)
    registered_device_no VARCHAR(100) NOT NULL,
    profession VARCHAR(100) NULL,
    highest_qualification VARCHAR(100) NULL,
    highest_qualification_specialization VARCHAR(150) NULL,
    tool_id INTEGER NULL, -- Tool ID (optional) 
    org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL, -- NULL for individual users
    manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL for users without manager
    joined_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), -- Users join rather than created
    updated_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_on TIMESTAMP WITH TIME ZONE NULL -- Soft delete timestamp
);


-- Create Domains table
CREATE TABLE domains (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NULL,
    created_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), -- Changed from created_at to match entity
    updated_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() -- Changed from updated_at to match entity
);

-- Create Modules table
CREATE TABLE modules (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    "desc" TEXT NULL,
    duration INTEGER NULL, -- Duration in minutes
    level VARCHAR(50) NULL CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
    created_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create Domain-Modules join table (Many-to-Many relationship)
CREATE TABLE domain_modules (
    id SERIAL PRIMARY KEY,
    domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    created_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_domain_module UNIQUE (domain_id, module_id) -- Prevent duplicate domain-module pairs
);

-- Create User-Domains join table
CREATE TABLE user_domains (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
    created_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_domain UNIQUE (user_id, domain_id)
);

-- Create User-Modules join table for progress tracking
-- Uses user_domain_id to enforce domain access and provide clear context
CREATE TABLE user_modules (
    id SERIAL PRIMARY KEY,
    user_domain_id INTEGER NOT NULL REFERENCES user_domains(id) ON DELETE CASCADE,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    questions_answered INTEGER DEFAULT 0,
    score NUMERIC(5,2) DEFAULT 0,
    threshold_score NUMERIC(5,2) DEFAULT 70,
    status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
    joined_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), -- Tracks when progress is updated
    completed_on TIMESTAMP WITH TIME ZONE NULL,
    CONSTRAINT uq_user_domain_module UNIQUE (user_domain_id, module_id)
);

-- Create Topics table
CREATE TABLE topics (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL UNIQUE,
    "desc" TEXT NULL,
    level VARCHAR(50) NULL CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
    created_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create Module-Topics join table
CREATE TABLE module_topics (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    topic_order_in_module INTEGER NOT NULL DEFAULT 1,
    created_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_module_topic UNIQUE (module_id, topic_id)
);

-- Create User-Topics join table for progress tracking
-- Uses user_module_id to enforce module access and provide clear context
CREATE TABLE user_topics (
    id SERIAL PRIMARY KEY,
    user_module_id INTEGER NOT NULL REFERENCES user_modules(id) ON DELETE CASCADE,
    topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
    created_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_module_topic UNIQUE (user_module_id, topic_id)
);

-- Create DocContents table for interactive lesson bundles
CREATE TABLE doc_contents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NULL,
    file_type VARCHAR(100) NOT NULL DEFAULT 'application/zip',
    storage_url TEXT NOT NULL,
    storage_key_prefix VARCHAR(500) NOT NULL,
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_topic_doc_content UNIQUE (topic_id) -- One-to-one relationship with topics
);

-- Create Change Log table for tracking changes to domains, modules, topics, and doc contents
CREATE TABLE change_log (
    id SERIAL PRIMARY KEY,
    change_type_id INTEGER NOT NULL,
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('domain', 'module', 'topic', 'doc_content')),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NULL,
    updated_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users table indexes
CREATE INDEX users_org_id_idx ON users(org_id);
CREATE INDEX users_manager_id_idx ON users(manager_id);
CREATE INDEX users_role_idx ON users(role);
CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_tool_id_idx ON users(tool_id);
CREATE INDEX users_org_role_idx ON users(org_id, role);

-- Organizations table indexes
CREATE INDEX organizations_type_idx ON organizations(type);
CREATE INDEX organizations_subscription_id_idx ON organizations(subscription_id);

-- User-Domains table indexes
CREATE INDEX idx_user_domains_user_id ON user_domains (user_id);
CREATE INDEX idx_user_domains_domain_id ON user_domains (domain_id);

-- Domain-Modules table indexes
CREATE INDEX idx_domain_modules_domain_id ON domain_modules (domain_id);
CREATE INDEX idx_domain_modules_module_id ON domain_modules (module_id);

-- User-Modules table indexes
CREATE INDEX idx_user_modules_user_domain_id ON user_modules (user_domain_id);
CREATE INDEX idx_user_modules_module_id ON user_modules (module_id);
CREATE INDEX idx_user_modules_status ON user_modules (status);

-- Topics table indexes
CREATE INDEX idx_topics_level ON topics (level); 

-- Module-Topics table indexes
CREATE INDEX idx_module_topics_module_id ON module_topics (module_id);
CREATE INDEX idx_module_topics_topic_id ON module_topics (topic_id);
CREATE INDEX idx_module_topics_order ON module_topics (module_id, topic_order_in_module);

-- User-Topics table indexes
CREATE INDEX idx_user_topics_user_id ON user_topics (user_id);
CREATE INDEX idx_user_topics_topic_id ON user_topics (topic_id);
CREATE INDEX idx_user_topics_user_module_id ON user_topics (user_module_id);
CREATE INDEX idx_user_topics_status ON user_topics (status);

-- DocContents table indexes
CREATE INDEX idx_doc_contents_topic_id ON doc_contents (topic_id);
CREATE INDEX idx_doc_contents_uploaded_by ON doc_contents (uploaded_by);

-- Change Log table indexes
CREATE INDEX idx_change_log_change_type ON change_log (change_type);
CREATE INDEX idx_change_log_change_type_id ON change_log (change_type_id);
CREATE INDEX idx_change_log_user_id ON change_log (user_id);
CREATE INDEX idx_change_log_type_type_id ON change_log (change_type, change_type_id);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert sample organizations
INSERT INTO organizations (name, description, type, industry, location, poc_name, poc_phone, poc_email, subscription_id) VALUES 
('SemiCon Labs', 'Main platform organization for semiconductor training', 'corporate', 'IT', 'Bengaluru', 'Rajesh Kumar', '9000000000', 'poc@semiconlabs.com', 1),
('Tech Corp', 'Leading semiconductor company', 'corporate', 'IT', 'Mumbai', 'Priya Sharma', '9000000001', 'poc@techcorp.com', 2),
('Innovation Inc', 'Startup focused on semiconductor innovation', 'startup', 'IT', 'Pune', 'Amit Patel', '9000000002', 'poc@innovation.com', 3),
('University College', 'Educational institution offering semiconductor courses', 'university', 'Education', 'Delhi', 'Dr. Sunita Singh', '9000000003', 'poc@university.edu', 4),
('Government Lab', 'Government research laboratory', 'government', 'Other', 'Chennai', 'Dr. Ravi Menon', '9000000004', 'poc@govlab.gov.in', 5);




-- Insert sample domains
INSERT INTO domains (name, description) VALUES
('Physical Design', 'Physical design for semiconductor devices'),
('Design Verification', 'Verification of semiconductor designs'),
('Analog Layout', 'Analog layout for semiconductor devices');



-- Insert domain-module associations
INSERT INTO domain_modules (domain_id, module_id) VALUES
(1, 1), -- Physical Design domain -> Introduction to Physical Design module
(2, 2), -- Design Verification domain -> Design Verification Basics module
(3, 3); -- Analog Layout domain -> Analog Layout Fundamentals module