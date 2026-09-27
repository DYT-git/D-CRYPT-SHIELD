package db

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"time"

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
			getEnv("POSTGRES_HOST", "127.0.0.1"),
			getEnv("POSTGRES_PORT", "5432"),
			getEnv("POSTGRES_USER", "vasp_user"),
			getEnv("POSTGRES_PASSWORD", "vaspengine123"),
			getEnv("POSTGRES_DB", "vasp_db"),
		)
	}
	// Always ensure IPv4 127.0.0.1 on Windows to avoid IPv6 loopback hangs
	dsn = strings.ReplaceAll(dsn, "@localhost:", "@127.0.0.1:")
	dsn = strings.ReplaceAll(dsn, "host=localhost", "host=127.0.0.1")

	pool, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open postgres connection: %w", err)
	}

	// Configure connection pool for high-throughput tracing
	pool.SetMaxOpenConns(25)
	pool.SetMaxIdleConns(10)

	// Verify the connection is alive with 3-second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := pool.PingContext(ctx); err != nil {
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
