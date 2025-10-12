export enum UserRole {
  PLATFORM_ADMIN = 'PlatformAdmin',
  CLIENT_ADMIN = 'ClientAdmin',
  MANAGER = 'Manager',
  LEARNER = 'Learner'
}

export const ROLE_HIERARCHY = {
  [UserRole.PLATFORM_ADMIN]: 4,
  [UserRole.CLIENT_ADMIN]: 3,
  [UserRole.MANAGER]: 2,
  [UserRole.LEARNER]: 1
};

export const ROLE_DESCRIPTIONS = {
  [UserRole.PLATFORM_ADMIN]: 'Full system access - can manage everything',
  [UserRole.CLIENT_ADMIN]: 'Organization-level access - manages org users, creates managers, and views content',
  [UserRole.MANAGER]: 'Team-level access within organization - manages assigned team learners under Client Admin',
  [UserRole.LEARNER]: 'Learner access - consumes content, tracks progress, and manages personal profile'
};
