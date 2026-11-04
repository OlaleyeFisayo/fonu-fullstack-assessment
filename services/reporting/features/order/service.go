package order

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func (s *Service) Summary(ctx context.Context, from, to string) (SummaryResponse, error) {
	res := SummaryResponse{From: from, To: to}

	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*)::int,
		       COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'), 0)::text
		FROM "order"
		WHERE "createdAt" >= $1::date AND "createdAt" < $2::date + 1`,
		from, to).Scan(&res.TotalOrders, &res.Revenue)
	if err != nil {
		return res, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT status::text, COUNT(*)::int, COALESCE(SUM(total), 0)::text
		FROM "order"
		WHERE "createdAt" >= $1::date AND "createdAt" < $2::date + 1
		GROUP BY status
		ORDER BY status`,
		from, to)
	if err != nil {
		return res, err
	}
	res.ByStatus, err = pgx.CollectRows(rows, pgx.RowToStructByPos[StatusCount])
	if err != nil {
		return res, err
	}

	rows, err = s.pool.Query(ctx, `
		SELECT oi."productName", SUM(oi.quantity)::int AS qty
		FROM order_item oi
		JOIN "order" o ON o.id = oi."orderId"
		WHERE o.status <> 'cancelled'
		  AND o."createdAt" >= $1::date AND o."createdAt" < $2::date + 1
		GROUP BY oi."productName"
		ORDER BY qty DESC
		LIMIT 5`,
		from, to)
	if err != nil {
		return res, err
	}
	res.TopProducts, err = pgx.CollectRows(rows, pgx.RowToStructByPos[TopProduct])
	return res, err
}
