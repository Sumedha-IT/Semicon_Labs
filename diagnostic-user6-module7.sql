-- ========================================================================
-- Diagnostic Script: User 6 - Module 7 Access Issue
-- ========================================================================
-- This script helps investigate why User 6 is enrolled in Module 7
-- despite potential domain access issues.
-- ========================================================================

-- STEP 1: Check what domains Module 7 is linked to
-- ========================================================================
SELECT 
    'STEP 1: Module 7 Domain Links' as step,
    m.id as module_id,
    m.title as module_title,
    dm.domain_id,
    d.name as domain_name
FROM modules m
LEFT JOIN domain_modules dm ON dm.module_id = m.id
LEFT JOIN domains d ON d.id = dm.domain_id
WHERE m.id = 7;

-- Expected Result: Should show at least one domain_id
-- If no rows returned: Module has NO domain links (DATA INTEGRITY ISSUE!)
-- ========================================================================


-- STEP 2: Check what domains User 6 has access to
-- ========================================================================
SELECT 
    'STEP 2: User 6 Domain Access' as step,
    u.user_id,
    u.name as user_name,
    u.email,
    u.role,
    ud.domain_id,
    d.name as domain_name
FROM users u
LEFT JOIN user_domains ud ON ud.user_id = u.user_id
LEFT JOIN domains d ON d.id = ud.domain_id
WHERE u.user_id = 6;

-- Expected Result: Shows User 6 is linked to Domain 1
-- ========================================================================


-- STEP 3: Check if User 6 should have access to Module 7
-- ========================================================================
-- This query checks if there's ANY overlap between:
-- - Domains that User 6 has access to
-- - Domains that Module 7 belongs to
SELECT 
    'STEP 3: Access Validation' as step,
    CASE 
        WHEN COUNT(*) > 0 THEN 'User HAS access (valid enrollment)'
        ELSE 'User DOES NOT have access (INVALID enrollment!)'
    END as access_status,
    COUNT(*) as matching_domains
FROM user_domains ud
INNER JOIN domain_modules dm ON dm.domain_id = ud.domain_id
WHERE ud.user_id = 6 AND dm.module_id = 7;

-- If count = 0: User should NOT be able to enroll (ACCESS VIOLATION!)
-- If count > 0: User has valid access through shared domain(s)
-- ========================================================================


-- STEP 4: Check the current enrollment status
-- ========================================================================
SELECT 
    'STEP 4: Enrollment Details' as step,
    um.id as enrollment_id,
    um.user_id,
    um.module_id,
    um.status,
    um.score,
    um.threshold_score,
    um.questions_answered,
    um.joined_on,
    um.completed_on
FROM user_modules um
WHERE um.user_id = 6 AND um.module_id = 7;

-- Shows current enrollment state
-- ========================================================================


-- STEP 5: Get ALL domain relationships for Module 7
-- ========================================================================
SELECT 
    'STEP 5: All Module 7 Domains' as step,
    dm.module_id,
    dm.domain_id,
    d.name as domain_name
FROM domain_modules dm
INNER JOIN domains d ON d.id = dm.domain_id
WHERE dm.module_id = 7
ORDER BY d.name;

-- This shows ALL domains that Module 7 belongs to
-- ========================================================================


-- STEP 6: Get ALL domains User 6 has access to
-- ========================================================================
SELECT 
    'STEP 6: All User 6 Domains' as step,
    ud.user_id,
    ud.domain_id,
    d.name as domain_name
FROM user_domains ud
INNER JOIN domains d ON d.id = ud.domain_id
WHERE ud.user_id = 6
ORDER BY d.name;

-- This shows ALL domains that User 6 can access
-- ========================================================================


-- STEP 7: Check for orphaned modules (modules with no domain links)
-- ========================================================================
SELECT 
    'STEP 7: Orphaned Modules Check' as step,
    m.id as module_id,
    m.title as module_title,
    'NO DOMAINS LINKED!' as issue
FROM modules m
LEFT JOIN domain_modules dm ON dm.module_id = m.id
WHERE dm.module_id IS NULL;

-- If Module 7 appears here: It has no domain links (CRITICAL BUG!)
-- ========================================================================


-- ========================================================================
-- RECOMMENDED FIXES (based on diagnostic results)
-- ========================================================================

-- FIX OPTION 1: Link Module 7 to Domain 1
-- Use this if Module 7 should belong to Domain 1
-- ========================================================================
-- INSERT INTO domain_modules (module_id, domain_id)
-- VALUES (7, 1)
-- ON CONFLICT DO NOTHING;


-- FIX OPTION 2: Assign User 6 to Module 7's correct domain(s)
-- First run STEP 5 to see what domains Module 7 belongs to
-- Then assign user to those domains:
-- ========================================================================
-- INSERT INTO user_domains (user_id, domain_id)
-- VALUES (6, <domain_id_from_step_5>)
-- ON CONFLICT DO NOTHING;


-- FIX OPTION 3: Remove invalid enrollment
-- Use this if the enrollment should not exist
-- ========================================================================
-- DELETE FROM user_modules
-- WHERE user_id = 6 AND module_id = 7;


-- ========================================================================
-- VALIDATION QUERY: Run this AFTER applying fixes
-- ========================================================================
SELECT 
    'VALIDATION: Final Check' as step,
    u.user_id,
    u.name,
    m.id as module_id,
    m.title,
    STRING_AGG(DISTINCT d.name, ', ' ORDER BY d.name) as shared_domains,
    COUNT(DISTINCT ud.domain_id) as user_domains,
    COUNT(DISTINCT dm.domain_id) as module_domains,
    CASE 
        WHEN COUNT(DISTINCT ud.domain_id) > 0 AND COUNT(DISTINCT dm.domain_id) > 0 THEN 'VALID'
        ELSE 'INVALID'
    END as enrollment_validity
FROM users u
CROSS JOIN modules m
LEFT JOIN user_domains ud ON ud.user_id = u.user_id
LEFT JOIN domain_modules dm ON dm.module_id = m.id AND dm.domain_id = ud.domain_id
WHERE u.user_id = 6 AND m.id = 7
GROUP BY u.user_id, u.name, m.id, m.title;

-- Should show 'VALID' after fixes are applied
-- ========================================================================

