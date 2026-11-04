package env

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBURL          string
	ReportingToken string
	Port           string
}

func Load() Config {
	_ = godotenv.Load("../../.env")

	port := os.Getenv("REPORTING_PORT")
	if port == "" {
		port = "3001"
	}
	return Config{
		DBURL:          required("DB_URL"),
		ReportingToken: required("REPORTING_TOKEN"),
		Port:           port,
	}
}

func required(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatal(key + " is required")
	}
	return v
}
