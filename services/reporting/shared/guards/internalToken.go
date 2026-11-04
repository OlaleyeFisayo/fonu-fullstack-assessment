package guards

import (
	"crypto/subtle"
	"net/http"

	"github.com/OlaleyeFisayo/fonu-fullstack-assessment/services/reporting/shared/response"
)

func InternalToken(token string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			got := r.Header.Get("X-Internal-Token")
			if subtle.ConstantTimeCompare([]byte(got), []byte(token)) != 1 {
				response.Error(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
