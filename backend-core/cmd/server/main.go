package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"vasp-engine/internal/db"
	"vasp-engine/internal/handlers"
	"vasp-engine/internal/middleware"
)

func main() {
	// -----------------------------------------------------------
	// Load environment variables from .env file
	// -----------------------------------------------------------
	if err := godotenv.Load("../.env"); err != nil {
		log.Println("[WARN] No .env file found, using system environment variables")
	}

	// -----------------------------------------------------------
	// Connect to all databases
	// -----------------------------------------------------------
	pgPool, err := db.ConnectPostgres()
	if err != nil {
		log.Printf("[WARN] Could not connect to PostgreSQL: %v. Database features will be disabled.", err)
	} else {
		defer pgPool.Close()
		log.Println("[OK] PostgreSQL connected")
	}

	neo4jDriver, err := db.ConnectNeo4j()
	if err != nil {
		log.Printf("[WARN] Could not connect to Neo4j: %v. Graph features will be disabled.", err)
	} else {
		defer neo4jDriver.Close(context.Background())
		log.Println("[OK] Neo4j connected")
	}

	redisClient, err := db.ConnectRedis()
	if err != nil {
		log.Fatalf("[FATAL] Could not connect to Redis: %v", err)
	}
	defer redisClient.Close()
	log.Println("[OK] Redis connected")

	// -----------------------------------------------------------
	// Setup Gin HTTP Server
	// -----------------------------------------------------------
	if os.Getenv("GO_ENV") == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Global Middleware
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(middleware.CORS())
	router.Use(middleware.RequestID())

	// -----------------------------------------------------------
	// Register all API routes
	// -----------------------------------------------------------
	handlers.RegisterRoutes(router, pgPool, neo4jDriver, redisClient)

	// -----------------------------------------------------------
	// Start HTTP Server with Graceful Shutdown
	// -----------------------------------------------------------
	port := os.Getenv("PORT")`n`tif port == "" {`n`t`tport = os.Getenv("GO_SERVER_PORT")`n`t}
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second, // longer for tracing operations
		IdleTimeout:  120 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("[OK] VASP Attribution Engine running on http://localhost:%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] Server failed: %v", err)
		}
	}()

	// Graceful shutdown on CTRL+C or kill signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[INFO] Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("[FATAL] Forced shutdown: %v", err)
	}
	log.Println("[OK] Server stopped cleanly")
}

