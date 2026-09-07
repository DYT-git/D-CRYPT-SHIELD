package sahyog

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"time"
	"vasp-engine/internal/db"
	"vasp-engine/internal/models"
)

// IntegrationTransport defines the interface for passing normalized payloads to external systems.
type IntegrationTransport interface {
	SendDisclosure(ctx context.Context, caseID string, payload *models.NormalizedDisclosureRequest) (*models.TransportResult, error)
	SendFreeze(ctx context.Context, caseID string, payload *models.NormalizedFreezeRequest) (*models.TransportResult, error)
}

// LocalTransport implements IntegrationTransport by strictly validating and 
// logging the payload to the local outbox, demonstrating the complete data flow
// while remaining strictly SAHYOG-independent.
type LocalTransport struct {
	Repo *db.Repository
}

// NewLocalTransport creates a new instance of LocalTransport.
func NewLocalTransport(repo *db.Repository) *LocalTransport {
	return &LocalTransport{Repo: repo}
}

// SendDisclosure processes the disclosure payload locally.
func (t *LocalTransport) SendDisclosure(ctx context.Context, caseID string, payload *models.NormalizedDisclosureRequest) (*models.TransportResult, error) {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	hash := sha256.Sum256(payloadBytes)
	hashStr := hex.EncodeToString(hash[:])

	// Record to local integration outbox
	err = t.Repo.SaveIntegrationOutboxRecord(
		ctx,
		caseID,
		"disclosure",
		"LocalTransport",
		string(payloadBytes),
		hashStr,
		"prepared",
	)
	if err != nil {
		return nil, err
	}

	return &models.TransportResult{
		Success:       true,
		Message:       "Payload successfully prepared and recorded locally.",
		PayloadHash:   hashStr,
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		TransportName: "LocalTransport",
	}, nil
}

// SendFreeze processes the freeze payload locally.
func (t *LocalTransport) SendFreeze(ctx context.Context, caseID string, payload *models.NormalizedFreezeRequest) (*models.TransportResult, error) {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	hash := sha256.Sum256(payloadBytes)
	hashStr := hex.EncodeToString(hash[:])

	// Record to local integration outbox
	err = t.Repo.SaveIntegrationOutboxRecord(
		ctx,
		caseID,
		"freeze",
		"LocalTransport",
		string(payloadBytes),
		hashStr,
		"prepared",
	)
	if err != nil {
		return nil, err
	}

	return &models.TransportResult{
		Success:       true,
		Message:       "Payload successfully prepared and recorded locally.",
		PayloadHash:   hashStr,
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		TransportName: "LocalTransport",
	}, nil
}
