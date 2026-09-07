package handlers

import (
	"net/http"
	"vasp-engine/internal/sahyog"

	"github.com/gin-gonic/gin"
)

// PrepareDisclosure generates a normalized SAHYOG-ready disclosure request,
// processes it through the transport abstraction, and returns the result.
func (h *Handler) PrepareDisclosure(c *gin.Context) {
	caseID := c.Param("case_id")

	caseData, err := h.repo.GetCase(c.Request.Context(), caseID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Case not found"})
		return
	}

	req, err := sahyog.TransformToDisclosure(caseData)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		return
	}

	// Instantiate the Transport Abstraction (Local implementation for Phase 8D)
	transport := sahyog.NewLocalTransport(h.repo)

	// Pass payload through the transport
	res, err := transport.SendDisclosure(c.Request.Context(), caseID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Transport failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"transport_result": res,
		"payload":          req,
	})
}

// PrepareFreeze generates a normalized SAHYOG-ready freeze request,
// processes it through the transport abstraction, and returns the result.
func (h *Handler) PrepareFreeze(c *gin.Context) {
	caseID := c.Param("case_id")

	caseData, err := h.repo.GetCase(c.Request.Context(), caseID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Case not found"})
		return
	}

	req, err := sahyog.TransformToFreeze(caseData)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
		return
	}

	// Instantiate the Transport Abstraction (Local implementation for Phase 8D)
	transport := sahyog.NewLocalTransport(h.repo)

	// Pass payload through the transport
	res, err := transport.SendFreeze(c.Request.Context(), caseID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Transport failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"transport_result": res,
		"payload":          req,
	})
}
