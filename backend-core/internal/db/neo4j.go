package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// ConnectNeo4j creates and returns a Neo4j driver instance.
// The driver manages a connection pool internally.
func ConnectNeo4j() (neo4j.DriverWithContext, error) {
	uri := getEnv("NEO4J_URI", "bolt://127.0.0.1:7687")
	uri = strings.ReplaceAll(uri, "localhost", "127.0.0.1")
	user := getEnv("NEO4J_USER", "neo4j")
	password := getEnv("NEO4J_PASSWORD", "vaspengine123")

	driver, err := neo4j.NewDriverWithContext(
		uri,
		neo4j.BasicAuth(user, password, ""),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create neo4j driver: %w", err)
	}

	// Verify connectivity with 2s timeout
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := driver.VerifyConnectivity(ctx); err != nil {
		return nil, fmt.Errorf("failed to verify neo4j connectivity: %w", err)
	}

	// Create constraints asynchronously with timeout so server startup is non-blocking
	go func() {
		bgCtx, bgCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer bgCancel()
		if err := setupNeo4jConstraints(bgCtx, driver); err != nil {
			fmt.Fprintf(os.Stderr, "[WARN] Neo4j constraints setup: %v\n", err)
		} else {
			log.Println("[OK] Neo4j constraints verified")
		}
	}()

	return driver, nil
}

// setupNeo4jConstraints creates indexes and constraints on first run.
// Ensures wallet address nodes are unique per chain for fast lookups.
func setupNeo4jConstraints(ctx context.Context, driver neo4j.DriverWithContext) error {
	session := driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	constraints := []string{
		// Unique wallet address per chain
		`CREATE CONSTRAINT wallet_address_unique IF NOT EXISTS
		 FOR (w:Wallet) REQUIRE (w.address, w.chain) IS UNIQUE`,

		// Index on VASP name for fast lookups
		`CREATE INDEX vasp_name_index IF NOT EXISTS
		 FOR (v:Wallet) ON (v.vasp_name)`,

		// Index on wallet type (exchange, mixer, etc.)
		`CREATE INDEX wallet_type_index IF NOT EXISTS
		 FOR (w:Wallet) ON (w.wallet_type)`,
	}

	for _, query := range constraints {
		_, err := session.Run(ctx, query, nil)
		if err != nil {
			return fmt.Errorf("constraint query failed: %w", err)
		}
	}

	return nil
}
