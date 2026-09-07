package tracer

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestWormholeResolver_Verified verifies a successful Level 1 bridge jump resolution.
func TestWormholeResolver_Verified(t *testing.T) {
	// Mock Wormholescan API
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		// Mimic wormhole transaction response
		w.Write([]byte(`{
			"transactions": [
				{
					"id": "2/0000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585/12345",
					"globalTx": {
						"originTx": {
							"txHash": "0xabc123",
							"from": "0xsender"
						},
						"destinationTx": {
							"chainId": 5,
							"status": "completed",
							"method": "completeTransfer",
							"txHash": "0xdef456",
							"to": "0xrecipient"
						}
					}
				}
			]
		}`))
	}))
	defer mockServer.Close()

	// Intercept the RegistryResolver's client to use our mock
	resolver := NewRegistryResolver()
	resolver.baseURL = mockServer.URL

	destChain, destAddr, evidence, err := resolver.ResolveJump(context.Background(), "ethereum", "0xabc123", "0x3ee18B2214AFF97000D974cf647E7C347E8fa585", "Wormhole")

	if err != nil {
		t.Fatalf("Expected success, got error: %v", err)
	}
	if destChain != "polygon" {
		t.Errorf("Expected destChain 'polygon', got '%s'", destChain)
	}
	if destAddr != "0xrecipient" {
		t.Errorf("Expected destAddr '0xrecipient', got '%s'", destAddr)
	}
	if evidence == nil {
		t.Fatalf("Expected evidence, got nil")
	}
	if evidence.CorrelationLevel != "Verified" {
		t.Errorf("Expected correlation level 'Verified', got '%s'", evidence.CorrelationLevel)
	}
	if evidence.MessageID != "2/0000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585/12345" {
		t.Errorf("Unexpected MessageID: %s", evidence.MessageID)
	}
}
