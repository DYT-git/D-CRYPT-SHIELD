package db

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
)

// ConnectRedis creates and returns a Redis client.
// Used for caching VASP labels and as a task queue.
func ConnectRedis() (*redis.Client, error) {
	addr := getEnv("REDIS_ADDR", "localhost:6379")
	password := getEnv("REDIS_PASSWORD", "vaspengine123")

	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       0, // default DB

		// Connection pool settings for high throughput
		PoolSize:     20,
		MinIdleConns: 5,
	})

	// Verify connection
	ctx := context.Background()
	if _, err := client.Ping(ctx).Result(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	return client, nil
}
