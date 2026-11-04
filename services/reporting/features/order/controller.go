package order

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/OlaleyeFisayo/fonu-fullstack-assessment/services/reporting/shared/response"
)

const dateLayout = "2006-01-02"

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

func (c *Controller) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/summary", c.summary)
	return r
}

func (c *Controller) summary(w http.ResponseWriter, r *http.Request) {
	from, to := r.URL.Query().Get("from"), r.URL.Query().Get("to")
	fromDate, err1 := time.Parse(dateLayout, from)
	toDate, err2 := time.Parse(dateLayout, to)
	if err1 != nil || err2 != nil {
		response.Error(w, http.StatusBadRequest, "from and to are required, format YYYY-MM-DD")
		return
	}
	if toDate.Before(fromDate) {
		response.Error(w, http.StatusBadRequest, "from must be on or before to")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	summary, err := c.service.Summary(ctx, from, to)
	if err != nil {
		log.Println("summary query failed:", err)
		response.Error(w, http.StatusInternalServerError, "failed to build summary")
		return
	}
	response.JSON(w, http.StatusOK, summary)
}
