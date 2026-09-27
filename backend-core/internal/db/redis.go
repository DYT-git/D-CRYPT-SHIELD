package db

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// ConnectRedis creates and returns a Redis client.
// Used for caching VASP labels and as a task queue.
func ConnectRedis() (*redis.Client, error) {
	var opt *redis.Options
	if rawURL := os.Getenv("REDIS_URL"); rawURL != "" {
		if parsed, err := redis.ParseURL(rawURL); err == nil {
			opt = parsed
		}
	}

	if opt == nil {
		addr := getEnv("REDIS_ADDR", "127.0.0.1:6379")
		password := getEnv("REDIS_PASSWORD", "vaspengine123")
		opt = &redis.Options{
			Addr:     addr,
			Password: password,
			DB:       0,
		}
	}

	// Always ensure IPv4 127.0.0.1 on Windows to avoid IPv6 loopback hangs
	if strings.HasPrefix(opt.Addr, "localhost:") {
		opt.Addr = strings.Replace(opt.Addr, "localhost:", "127.0.0.1:", 1)
	}

	opt.PoolSize = 20
	opt.MinIdleConns = 5
	opt.DialTimeout = 2 * time.Second

	client := redis.NewClient(opt)

	// Verify connection with 2-second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if _, err := client.Ping(ctx).Result(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	return client, nil
}
