import { UserRole } from './user-roles';

/**
 * Defines which fields each role can update in User entity
 * Key: role identifier (UserRole enum)
 * Value: array of field names that the role is allowed to update
 */
export const ALLOWED_USER_FIELDS_BY_ROLE: Record<string, string[]> = {
  // Learner can only update their own profile fields
  [UserRole.LEARNER]: ['name', 'password', 'registered_device_no', 'location', 'user_phone'],
  
  // Manager has same permissions as Learner for their own profile
  [UserRole.MANAGER]: ['name', 'password', 'registered_device_no', 'location', 'user_phone'],
  
  // ClientAdmin can only update manager_id and org_id for users in their organization
  [UserRole.CLIENT_ADMIN]: ['manager_id', 'org_id'],
  
  // PlatformAdmin can update all fields
  [UserRole.PLATFORM_ADMIN]: [
    'name',
    'password',
    'email',
    'role',
    'dob',
    'user_phone',
    'location',
    'registered_device_no',
    'tool_id',
    'org_id',
    'manager_id',
  ],
};

/**
 * Defines which fields each role can update in Organization entity
 * Key: role identifier (UserRole enum)
 * Value: array of field names that the role is allowed to update
 */
export const ALLOWED_ORG_FIELDS_BY_ROLE: Record<string, string[]> = {
  // Learner and Manager have no access to update organizations
  [UserRole.LEARNER]: [],
  [UserRole.MANAGER]: [],
  
  // ClientAdmin can only update POC and basic org info
  [UserRole.CLIENT_ADMIN]: ['type', 'location', 'poc_email', 'poc_phone', 'poc_name'],
  
  // PlatformAdmin can update all fields
  [UserRole.PLATFORM_ADMIN]: [
    'name',
    'description',
    'type',
    'industry',
    'location',
    'poc_name',
    'poc_phone',
    'poc_email',
    'subscription_id',
  ],
};

/**
 * Fields in User entity that are considered immutable by Learner/Manager roles
 * These are system-managed fields that should never be updated by basic users
 */
export const IMMUTABLE_USER_FIELDS = [
  'email',
  'role',
  'tool_id',
  'org_id',
  'manager_id',
  'dob',
  'joined_on',
  'updated_on',
  'deleted_on',
  'failed_otp_attempts',
  'account_locked_until',
];

/**
 * Fields in Organization entity that are considered immutable by ClientAdmin
 * These are system-managed fields that should never be updated by ClientAdmin
 */
export const IMMUTABLE_ORG_FIELDS_FOR_CLIENT_ADMIN = [
  'name',
  'description',
  'industry',
  'subscription_id',
  'created_on',
  'updated_on',
  'deleted_on',
];

