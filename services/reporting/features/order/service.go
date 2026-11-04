package order

import (
	"context"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var psql = sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

type totals struct {
	Count   int
	Revenue string
}

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func createdBetween(col string, from, to time.Time) sq.And {
	return sq.And{sq.GtOrEq{col: from}, sq.Lt{col: to.AddDate(0, 0, 1)}}
}

func (s *Service) run(ctx context.Context, b sq.SelectBuilder) (pgx.Rows, error) {
	query, args, err := b.ToSql()
	if err != nil {
		return nil, err
	}
	return s.pool.Query(ctx, query, args...)
}

func (s *Service) Summary(ctx context.Context, from, to time.Time) (SummaryResponse, error) {
	res := SummaryResponse{From: from.Format(dateLayout), To: to.Format(dateLayout)}

	rows, err := s.run(ctx, psql.
		Select("COUNT(*)::int", "COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'), 0)::text").
		From(`"order"`).
		Where(createdBetween(`"createdAt"`, from, to)))
	if err != nil {
		return res, err
	}
	t, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[totals])
	if err != nil {
		return res, err
	}
	res.TotalOrders, res.Revenue = t.Count, t.Revenue

	rows, err = s.run(ctx, psql.
		Select("status::text", "COUNT(*)::int", "COALESCE(SUM(total), 0)::text").
		From(`"order"`).
		Where(createdBetween(`"createdAt"`, from, to)).
		GroupBy("status").
		OrderBy("status"))
	if err != nil {
		return res, err
	}
	res.ByStatus, err = pgx.CollectRows(rows, pgx.RowToStructByPos[StatusCount])
	if err != nil {
		return res, err
	}

	rows, err = s.run(ctx, psql.
		Select(`oi."productName"`, "SUM(oi.quantity)::int AS qty").
		From("order_item oi").
		Join(`"order" o ON o.id = oi."orderId"`).
		Where(sq.NotEq{"o.status": "cancelled"}).
		Where(createdBetween(`o."createdAt"`, from, to)).
		GroupBy(`oi."productName"`).
		OrderBy("qty DESC").
		Limit(5))
	if err != nil {
		return res, err
	}
	res.TopProducts, err = pgx.CollectRows(rows, pgx.RowToStructByPos[TopProduct])
	return res, err
}
