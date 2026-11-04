package order

import "github.com/go-chi/chi/v5"

func Routes(c *Controller) chi.Router {
	r := chi.NewRouter()
	r.Get("/summary", c.summary)
	return r
}
