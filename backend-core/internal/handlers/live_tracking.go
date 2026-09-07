package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// TrackTargetRequest defines a new live tracking target
type TrackTargetRequest struct {
	Address      string `json:"address" binding:"required"`
	Chain        string `json:"chain"`
	Asset        string `json:"asset"`
	OfficerEmail string `json:"officer_email"`
	Action       string `json:"action"` // "add" or "remove"
}

// StartTracking publishes a new target to Redis so the Headless Engine can pick it up
func (h *Handler) StartTracking(c *gin.Context) {
	var req TrackTargetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request", "details": err.Error()})
		return
	}

	payload, _ := json.Marshal(req)
	
	if h.redis != nil {
		err := h.redis.Publish(context.Background(), "tracking_targets", payload).Err()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to deploy tracker engine"})
			return
		}
	}

	statusMsg := "Tracking engine deployed successfully"
	if req.Action == "remove" {
		statusMsg = "Target removed from tracking engine"
	}

	c.JSON(http.StatusOK, gin.H{
		"message": statusMsg,
		"status":  "success",
		"target":  req.Address,
	})
}

// LiveFeed SSE (Server-Sent Events) endpoint to stream Redis events to the Next.js frontend
func (h *Handler) LiveFeed(c *gin.Context) {
	if h.redis == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Redis not configured"})
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Access-Control-Allow-Origin", "*")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pubsub := h.redis.Subscribe(ctx, "live_tracking_events")
	defer pubsub.Close()

	clientGone := c.Writer.CloseNotify()

	for {
		select {
		case <-clientGone:
			return
		case msg := <-pubsub.Channel():
			event := fmt.Sprintf("data: %s\n\n", msg.Payload)
			c.Writer.Write([]byte(event))
			c.Writer.Flush()
		}
	}
}