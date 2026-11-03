import { PaginationQueryDto } from "../dtos/paginationQuery.dto";

export const pageOptions = ({ page, limit }: PaginationQueryDto) => ({
  skip: (page - 1) * limit,
  take: limit,
});

export const paginate = <T>(
  items: T[],
  totalItems: number,
  { page, limit }: PaginationQueryDto,
) => ({
  items,
  meta: {
    page,
    limit,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
  },
});
