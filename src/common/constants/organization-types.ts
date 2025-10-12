export enum OrganizationType {
  SEMICON = 'semicon',
  CORPORATE = 'corporate',
  STARTUP = 'startup',
  UNIVERSITY = 'university',
  GOVERNMENT = 'government',
  OTHER = 'other'
}

export enum Industry {
  IT = 'IT',
  TELECOM = 'Telecom',
  HEALTHCARE = 'Healthcare',
  FINANCE = 'Finance',
  EDUCATION = 'Education',
  MANUFACTURING = 'Manufacturing',
  RETAIL = 'Retail',
  AUTOMOTIVE = 'Automotive',
  ENERGY = 'Energy',
  AGRICULTURE = 'Agriculture',
  OTHER = 'Other'
}

export const ORGANIZATION_TYPE_DESCRIPTIONS = {
  [OrganizationType.SEMICON]: 'Semiconductor and electronics companies',
  [OrganizationType.CORPORATE]: 'Large corporate enterprises',
  [OrganizationType.STARTUP]: 'Early-stage startup companies',
  [OrganizationType.UNIVERSITY]: 'Educational institutions and universities',
  [OrganizationType.GOVERNMENT]: 'Government agencies and departments',
  [OrganizationType.OTHER]: 'Other types of organizations'
};

export const INDUSTRY_DESCRIPTIONS = {
  [Industry.IT]: 'Information Technology and Software',
  [Industry.TELECOM]: 'Telecommunications and Networking',
  [Industry.HEALTHCARE]: 'Healthcare and Medical Services',
  [Industry.FINANCE]: 'Financial Services and Banking',
  [Industry.EDUCATION]: 'Education and Training',
  [Industry.MANUFACTURING]: 'Manufacturing and Production',
  [Industry.RETAIL]: 'Retail and E-commerce',
  [Industry.AUTOMOTIVE]: 'Automotive Industry',
  [Industry.ENERGY]: 'Energy and Utilities',
  [Industry.AGRICULTURE]: 'Agriculture and Farming',
  [Industry.OTHER]: 'Other Industries'
};
