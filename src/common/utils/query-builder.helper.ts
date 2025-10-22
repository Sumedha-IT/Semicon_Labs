import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/**
 * QueryBuilderHelper - Reusable utility for building TypeORM queries
 * 
 * Provides common filtering, sorting, and pagination methods to reduce
 * code duplication across service classes.
 */
export class QueryBuilderHelper {
  /**
   * Applies date range filtering to a query builder
   * 
   * @param qb - The TypeORM SelectQueryBuilder
   * @param alias - The table alias (e.g., 'user', 'org')
   * @param field - The database column name (e.g., 'created_on', 'updated_on', 'joined_on')
   * @param after - Start date (inclusive) - accepts Date or string
   * @param before - End date (inclusive) - accepts Date or string
   * 
   * @example
   * QueryBuilderHelper.applyDateRangeFilter(qb, 'org', 'created_on', afterDate, beforeDate);
   */
  static applyDateRangeFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    field: string,
    after?: Date | string,
    before?: Date | string,
  ): void {
    if (!after && !before) return;

    const columnPath = `${alias}.${field}`;

    if (after && before) {
      qb.andWhere(`${columnPath} BETWEEN :${field}_after AND :${field}_before`, {
        [`${field}_after`]: after,
        [`${field}_before`]: before,
      });
    } else if (after) {
      qb.andWhere(`${columnPath} >= :${field}_after`, {
        [`${field}_after`]: after,
      });
    } else if (before) {
      qb.andWhere(`${columnPath} <= :${field}_before`, {
        [`${field}_before`]: before,
      });
    }
  }

  /**
   * Applies multi-column search filtering using ILIKE (case-insensitive)
   * 
   * @param qb - The TypeORM SelectQueryBuilder
   * @param alias - The table alias
   * @param searchFields - Array of column names to search in
   * @param search - The search term
   * 
   * @example
   * QueryBuilderHelper.applySearch(qb, 'user', ['name', 'email'], 'john');
   * // Generates: WHERE (user.name ILIKE '%john%' OR user.email ILIKE '%john%')
   */
  static applySearch<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    searchFields: string[],
    search?: string,
  ): void {
    if (!search || searchFields.length === 0) return;

    const conditions = searchFields
      .map((field) => `${alias}.${field} ILIKE :search`)
      .join(' OR ');

    qb.andWhere(`(${conditions})`, { search: `%${search}%` });
  }

  /**
   * Applies sorting to a query builder
   * 
   * @param qb - The TypeORM SelectQueryBuilder
   * @param alias - The table alias
   * @param columnMap - Mapping of camelCase field names to database column names
   * @param sortBy - The field to sort by (camelCase)
   * @param sortOrder - Sort direction ('asc' or 'desc')
   * @param defaultSort - Default column to sort by if sortBy is invalid
   * 
   * @example
   * const columnMap = { name: 'name', createdOn: 'created_on', updatedOn: 'updated_on' };
   * QueryBuilderHelper.applySorting(qb, 'org', columnMap, 'createdOn', 'desc', 'name');
   */
  static applySorting<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    columnMap: Record<string, string>,
    sortBy?: string,
    sortOrder?: string,
    defaultSort: string = 'created_on',
  ): void {
    // Get the database column name from the map, or use default
    const dbColumn = sortBy && columnMap[sortBy] ? columnMap[sortBy] : defaultSort;
    
    // Convert lowercase to uppercase for TypeORM
    const order = (sortOrder?.toUpperCase() || 'ASC') as 'ASC' | 'DESC';
    
    qb.orderBy(`${alias}.${dbColumn}`, order);
  }

  /**
   * Applies pagination and returns paginated results with metadata
   * 
   * @param qb - The TypeORM SelectQueryBuilder
   * @param page - Page number (1-indexed)
   * @param limit - Number of items per page
   * 
   * @returns Promise with data array and pagination metadata
   * 
   * @example
   * const result = await QueryBuilderHelper.paginate(qb, 1, 20);
   * // Returns: { data: [...], total: 100, page: 1, limit: 20, totalPages: 5 }
   */
  static async paginate<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // Get total count before pagination
    const total = await qb.getCount();

    // Apply pagination
    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    // Get paginated data
    const data = await qb.getMany();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Applies a simple equality filter if the value is provided
   * 
   * @param qb - The TypeORM SelectQueryBuilder
   * @param alias - The table alias
   * @param field - The database column name
   * @param value - The value to filter by (undefined/null values are ignored)
   * 
   * @example
   * QueryBuilderHelper.applyEqualityFilter(qb, 'user', 'role', 'admin');
   * // Generates: WHERE user.role = 'admin'
   */
  static applyEqualityFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    field: string,
    value?: any,
  ): void {
    if (value === undefined || value === null) return;

    qb.andWhere(`${alias}.${field} = :${field}`, { [field]: value });
  }

  /**
   * Applies a LIKE filter if the value is provided
   * 
   * @param qb - The TypeORM SelectQueryBuilder
   * @param alias - The table alias
   * @param field - The database column name
   * @param value - The value to filter by (undefined/null values are ignored)
   * 
   * @example
   * QueryBuilderHelper.applyLikeFilter(qb, 'user', 'location', 'New York');
   * // Generates: WHERE user.location LIKE '%New York%'
   */
  static applyLikeFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    field: string,
    value?: string,
  ): void {
    if (!value) return;

    qb.andWhere(`${alias}.${field} LIKE :${field}`, { [field]: `%${value}%` });
  }

  /**
   * Creates a filter object containing only the provided filter values
   * Useful for tracking which filters were applied in API responses
   * 
   * @param filters - Object with potential filter values
   * @returns Object containing only defined filter values
   * 
   * @example
   * const applied = QueryBuilderHelper.buildAppliedFilters({ role: 'admin', search: undefined, orgId: 5 });
   * // Returns: { role: 'admin', orgId: 5 }
   */
  static buildAppliedFilters(filters: Record<string, any>): Record<string, any> {
    const applied: Record<string, any> = {};

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        applied[key] = value;
      }
    }

    return applied;
  }
}

