export class PaginationMetaDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;

  constructor(page: number, limit: number, total: number) {
    this.page = page;
    this.limit = limit;
    this.total = total;
    this.totalPages = Math.ceil(total / limit);
    this.hasNext = page < this.totalPages;
    this.hasPrev = page > 1;
  }
}

export class PaginatedResponseDto<T> {
  data: T[];
  pagination: PaginationMetaDto;
  filters?: {
    applied: Record<string, any>;
    available?: Record<string, any>;
  };

  constructor(
    data: T[],
    pagination: PaginationMetaDto,
    filters?: Record<string, any>,
  ) {
    this.data = data;
    this.pagination = pagination;
    if (filters) {
      this.filters = {
        applied: filters,
      };
    }
  }
}
