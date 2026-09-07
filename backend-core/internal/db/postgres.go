package db

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/lib/pq"
)

// ConnectPostgres creates and returns a PostgreSQL connection pool.
// Uses environment variables for connection config.
func ConnectPostgres() (*sql.DB, error) {
	dsn := os.Getenv("POSTGRES_URL")
	if dsn == "" {
		// Build DSN from individual env vars if POSTGRES_URL not set
		dsn = fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			getEnv("POSTGRES_HOST", "localhost"),
			getEnv("POSTGRES_PORT", "5432"),
			getEnv("POSTGRES_USER", "vasp_user"),
			getEnv("POSTGRES_PASSWORD", "vaspengine123"),
			getEnv("POSTGRES_DB", "vasp_db"),
		)
	}

	pool, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open postgres connection: %w", err)
	}

	// Configure connection pool for high-throughput tracing
	pool.SetMaxOpenConns(25)
	pool.SetMaxIdleConns(10)

	// Verify the connection is alive
	if err := pool.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping postgres: %w", err)
	}

	return pool, nil
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
