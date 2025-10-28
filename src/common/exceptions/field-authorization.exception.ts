import { ForbiddenException } from '@nestjs/common';

/**
 * Custom exception thrown when a user attempts to update fields
 * they are not authorized to modify based on their role
 */
export class FieldAuthorizationException extends ForbiddenException {
  constructor(
    role: string,
    unauthorizedFields: string[],
    allowedFields: string[],
    entityType: 'user' | 'organization' = 'user',
  ) {
    const message = `${role} role cannot update: ${unauthorizedFields.join(', ')}`;
    
    super(message);
    this.message = message;
  }
}

