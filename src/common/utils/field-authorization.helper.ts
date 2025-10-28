import { UserRole } from '../constants/user-roles';
import {
  ALLOWED_USER_FIELDS_BY_ROLE,
  ALLOWED_ORG_FIELDS_BY_ROLE,
} from '../constants/field-authorization';
import { FieldAuthorizationException } from '../exceptions/field-authorization.exception';

/**
 * Retrieves the list of fields a role is allowed to update for User entity
 * @param role - User role (Learner, Manager, ClientAdmin, PlatformAdmin)
 * @param isSelfUpdate - Whether the user is updating their own profile
 * @returns Array of allowed field names
 */
export function getAllowedUserFields(role: UserRole | string, isSelfUpdate: boolean = false): string[] {
  // Normalize role to string for comparison
  const roleString = typeof role === 'string' ? role : String(role);
  
  // For Learner and Manager, only allow updates if they're updating their own profile
  if ((roleString === 'Learner' || roleString === 'Manager') && !isSelfUpdate) {
    return []; // No access to update other users
  }

  return ALLOWED_USER_FIELDS_BY_ROLE[roleString] || [];
}

/**
 * Retrieves the list of fields a role is allowed to update for Organization entity
 * @param role - User role (Learner, Manager, ClientAdmin, PlatformAdmin)
 * @returns Array of allowed field names
 */
export function getAllowedOrgFields(role: UserRole | string): string[] {
  const roleString = typeof role === 'string' ? role : String(role);
  return ALLOWED_ORG_FIELDS_BY_ROLE[roleString] || [];
}

/**
 * Validates that a user role is authorized to update the specified fields in User entity
 * Throws FieldAuthorizationException if unauthorized fields are detected
 * 
 * @param updateDto - Update DTO containing fields to be updated
 * @param role - User role attempting the update
 * @param isSelfUpdate - Whether the user is updating their own profile
 * @throws FieldAuthorizationException if attempting to update unauthorized fields
 */
export function validateUserFieldAuthorization(
  updateDto: Record<string, any>,
  role: UserRole | string,
  isSelfUpdate: boolean = false,
): void {
  // Normalize role to string for comparison
  const roleString = typeof role === 'string' ? role : String(role);
  
  // Get allowed fields for this role
  const allowedFields = getAllowedUserFields(roleString as UserRole, isSelfUpdate);

  // Extract the fields being updated (ignore undefined/null values)
  const fieldsBeingUpdated = Object.keys(updateDto).filter(
    (field) => updateDto[field] !== undefined && updateDto[field] !== null,
  );

  // Filter out password field from validation (it's handled specially in the service)
  const fieldsBeingUpdatedFiltered = fieldsBeingUpdated.filter(field => field !== 'password');

  // For PlatformAdmin, allow all fields
  if (roleString === 'PlatformAdmin' || roleString === UserRole.PLATFORM_ADMIN) {
    return; // No restrictions for PlatformAdmin
  }

  // If no fields to validate, return
  if (fieldsBeingUpdatedFiltered.length === 0) {
    return;
  }

  // Check if any unauthorized fields are being updated
  const unauthorizedFields = fieldsBeingUpdatedFiltered.filter(
    (field) => !allowedFields.includes(field),
  );

  if (unauthorizedFields.length > 0) {
    throw new FieldAuthorizationException(
      roleString,
      unauthorizedFields,
      allowedFields,
      'user',
    );
  }
}

/**
 * Validates that a user role is authorized to update the specified fields in Organization entity
 * Throws FieldAuthorizationException if unauthorized fields are detected
 * 
 * @param updateDto - Update DTO containing fields to be updated
 * @param role - User role attempting the update
 * @throws FieldAuthorizationException if attempting to update unauthorized fields
 */
export function validateOrganizationFieldAuthorization(
  updateDto: Record<string, any>,
  role: UserRole | string,
): void {
  // Normalize role to string for comparison
  const roleString = typeof role === 'string' ? role : String(role);
  
  // Get allowed fields for this role
  const allowedFields = getAllowedOrgFields(roleString);

  // Extract the fields being updated (ignore undefined/null values)
  const fieldsBeingUpdated = Object.keys(updateDto).filter(
    (field) => updateDto[field] !== undefined && updateDto[field] !== null,
  );

  // For PlatformAdmin, allow all fields
  if (roleString === 'PlatformAdmin' || roleString === UserRole.PLATFORM_ADMIN) {
    return; // No restrictions for PlatformAdmin
  }

  // Check if any unauthorized fields are being updated
  const unauthorizedFields = fieldsBeingUpdated.filter(
    (field) => !allowedFields.includes(field),
  );

  if (unauthorizedFields.length > 0) {
    throw new FieldAuthorizationException(
      roleString,
      unauthorizedFields,
      allowedFields,
      'organization',
    );
  }
}

