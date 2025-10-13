-- ========================================================================
-- COMPREHENSIVE AUDIT: Invalid Module Enrollments
-- ========================================================================
-- This script finds ALL cases where users are enrolled in modules
-- without proper domain access
-- ========================================================================

-- AUDIT 1: Find ALL invalid enrollments (users enrolled without domain access)
-- ========================================================================
SELECT 
    'INVALID ENROLLMENTS' as audit_type,
    um.id as enrollment_id,
    um.user_id,
    u.name as user_name,
    u.email as user_email,
    um.module_id,
    m.title as module_title,
    um.status as enrollment_status,
    um.score,
    um.joined_on,
    'User lacks domain access to this module' as issue
FROM user_modules um
INNER JOIN users u ON u.user_id = um.user_id
INNER JOIN modules m ON m.id = um.module_id
WHERE u.deleted_on IS NULL
AND NOT EXISTS (
    -- Check if user has access through ANY shared domain
    SELECT 1
    FROM user_domains ud
    INNER JOIN domain_modules dm ON dm.domain_id = ud.domain_id
    WHERE ud.user_id = um.user_id
    AND dm.module_id = um.module_id
)
ORDER BY um.joined_on DESC;

-- If this returns rows: Those enrollments violate access control rules!
-- ========================================================================


-- AUDIT 2: Find orphaned modules (modules with NO domain links)
-- ========================================================================
SELECT 
    'ORPHANED MODULES' as audit_type,
    m.id as module_id,
    m.title as module_title,
    m.level,
    m.duration,
    m.created_on,
    COUNT(um.id) as total_enrollments,
    'Module has no domain links!' as issue
FROM modules m
LEFT JOIN domain_modules dm ON dm.module_id = m.id
LEFT JOIN user_modules um ON um.module_id = m.id
WHERE dm.module_id IS NULL
GROUP BY m.id, m.title, m.level, m.duration, m.created_on
ORDER BY COUNT(um.id) DESC;

-- Any module appearing here is orphaned and cannot be accessed legitimately!
-- Enrollments in these modules are ALL invalid!
-- ========================================================================


-- AUDIT 3: Users with no domain access (cannot access ANY modules)
-- ========================================================================
SELECT 
    'USERS WITHOUT DOMAINS' as audit_type,
    u.user_id,
    u.name as user_name,
    u.email,
    u.role,
    u.org_id,
    COUNT(ud.domain_id) as domain_count,
    COUNT(um.id) as enrollment_count,
    'User has no domain assignments' as issue
FROM users u
LEFT JOIN user_domains ud ON ud.user_id = u.user_id
LEFT JOIN user_modules um ON um.user_id = u.user_id
WHERE u.deleted_on IS NULL
AND u.role = 'Learner'  -- Focus on learners
GROUP BY u.user_id, u.name, u.email, u.role, u.org_id
HAVING COUNT(ud.domain_id) = 0
ORDER BY COUNT(um.id) DESC;

-- Learners with no domain access but have enrollments = DATA ISSUE!
-- ========================================================================


-- AUDIT 4: Detailed breakdown by module
-- ========================================================================
SELECT 
    'MODULE ENROLLMENT VALIDITY' as audit_type,
    m.id as module_id,
    m.title as module_title,
    COUNT(DISTINCT um.id) as total_enrollments,
    COUNT(DISTINCT CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM user_domains ud
            INNER JOIN domain_modules dm ON dm.domain_id = ud.domain_id
            WHERE ud.user_id = um.user_id AND dm.module_id = um.module_id
        ) THEN um.id 
    END) as valid_enrollments,
    COUNT(DISTINCT CASE 
        WHEN NOT EXISTS (
            SELECT 1 
            FROM user_domains ud
            INNER JOIN domain_modules dm ON dm.domain_id = ud.domain_id
            WHERE ud.user_id = um.user_id AND dm.module_id = um.module_id
        ) THEN um.id 
    END) as invalid_enrollments,
    COUNT(DISTINCT dm.domain_id) as linked_domains,
    STRING_AGG(DISTINCT d.name, ', ' ORDER BY d.name) as domain_names
FROM modules m
LEFT JOIN user_modules um ON um.module_id = m.id
LEFT JOIN users u ON u.user_id = um.user_id AND u.deleted_on IS NULL
LEFT JOIN domain_modules dm ON dm.module_id = m.id
LEFT JOIN domains d ON d.id = dm.domain_id
GROUP BY m.id, m.title
HAVING COUNT(DISTINCT CASE 
    WHEN NOT EXISTS (
        SELECT 1 
        FROM user_domains ud
        INNER JOIN domain_modules dm2 ON dm2.domain_id = ud.domain_id
        WHERE ud.user_id = um.user_id AND dm2.module_id = um.module_id
    ) THEN um.id 
END) > 0
ORDER BY COUNT(DISTINCT CASE 
    WHEN NOT EXISTS (
        SELECT 1 
        FROM user_domains ud
        INNER JOIN domain_modules dm2 ON dm2.domain_id = ud.domain_id
        WHERE ud.user_id = um.user_id AND dm2.module_id = um.module_id
    ) THEN um.id 
END) DESC;

-- Shows modules with invalid enrollments and their statistics
-- ========================================================================


-- AUDIT 5: Domain coverage analysis
-- ========================================================================
SELECT 
    'DOMAIN COVERAGE' as audit_type,
    d.id as domain_id,
    d.name as domain_name,
    COUNT(DISTINCT dm.module_id) as modules_in_domain,
    COUNT(DISTINCT ud.user_id) as users_with_access,
    COUNT(DISTINCT um.id) as total_enrollments
FROM domains d
LEFT JOIN domain_modules dm ON dm.domain_id = d.id
LEFT JOIN user_domains ud ON ud.domain_id = d.id
LEFT JOIN user_modules um ON um.module_id = dm.module_id AND um.user_id = ud.user_id
GROUP BY d.id, d.name
ORDER BY d.name;

-- Shows which domains are most/least used
-- ========================================================================


-- AUDIT 6: Complete data integrity summary
-- ========================================================================
SELECT 
    'SUMMARY' as audit_type,
    (SELECT COUNT(*) FROM modules) as total_modules,
    (SELECT COUNT(*) FROM modules m WHERE NOT EXISTS (
        SELECT 1 FROM domain_modules dm WHERE dm.module_id = m.id
    )) as orphaned_modules,
    (SELECT COUNT(*) FROM user_modules um INNER JOIN users u ON u.user_id = um.user_id WHERE u.deleted_on IS NULL) as total_enrollments,
    (SELECT COUNT(*) FROM user_modules um 
     INNER JOIN users u ON u.user_id = um.user_id
     WHERE u.deleted_on IS NULL
     AND NOT EXISTS (
        SELECT 1 FROM user_domains ud
        INNER JOIN domain_modules dm ON dm.domain_id = ud.domain_id
        WHERE ud.user_id = um.user_id AND dm.module_id = um.module_id
     )) as invalid_enrollments,
    (SELECT COUNT(*) FROM users WHERE deleted_on IS NULL AND role = 'Learner') as total_learners,
    (SELECT COUNT(DISTINCT u.user_id) FROM users u 
     LEFT JOIN user_domains ud ON ud.user_id = u.user_id
     WHERE u.deleted_on IS NULL 
     AND u.role = 'Learner'
     AND ud.domain_id IS NULL) as learners_without_domains,
    (SELECT COUNT(*) FROM domains) as total_domains,
    (SELECT COUNT(DISTINCT domain_id) FROM domain_modules) as domains_with_modules,
    (SELECT COUNT(DISTINCT domain_id) FROM user_domains) as domains_with_users;

-- High-level overview of data integrity issues
-- ========================================================================


-- ========================================================================
-- RECOMMENDATIONS BASED ON AUDIT RESULTS
-- ========================================================================
-- 
-- 1. If AUDIT 1 returns rows:
--    → Fix invalid enrollments using one of the fix options
--
-- 2. If AUDIT 2 returns rows:
--    → Link orphaned modules to appropriate domains
--    → OR delete orphaned modules if they're not needed
--
-- 3. If AUDIT 3 returns rows:
--    → Assign domains to users without domain access
--    → OR unenroll them from modules if inappropriate
--
-- 4. Use AUDIT 4 to prioritize:
--    → Fix modules with highest invalid enrollment counts first
--
-- 5. Use AUDIT 5 and 6 for:
--    → Strategic planning of domain and module assignments
--    → Understanding usage patterns
-- ========================================================================

