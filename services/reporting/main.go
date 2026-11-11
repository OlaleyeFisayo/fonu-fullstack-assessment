package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/OlaleyeFisayo/fonu-fullstack-assessment/services/reporting/features/order"
	"github.com/OlaleyeFisayo/fonu-fullstack-assessment/services/reporting/shared/env"
	"github.com/OlaleyeFisayo/fonu-fullstack-assessment/services/reporting/shared/guards"
)

func main() {
	cfg := env.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, cfg.DBURL)
	if err != nil {
		log.Fatal("invalid DB_URL: ", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Fatal("cannot reach database: ", err)
	}

	orderController := order.NewController(order.NewService(pool))

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(guards.InternalToken(cfg.ReportingToken))
	r.Mount("/orders", order.Routes(orderController))

	log.Println("reporting service listening on :" + cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, r))
}
