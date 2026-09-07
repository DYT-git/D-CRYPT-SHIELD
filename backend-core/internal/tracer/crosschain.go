package tracer

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"vasp-engine/internal/models"
)

// CrossChainResolver defines the contract for resolving bridge jumps.
type CrossChainResolver interface {
	// ResolveJump attempts to track a transaction through a bridge.
	// Returns destChain, destAddress, evidence, or error if unresolvable.
	ResolveJump(ctx context.Context, sourceChain, sourceTxHash, bridgeAddress, bridgeName string) (string, string, *models.CrossChainEvidence, error)
}

// RegistryResolver multiplexes across multiple protocol-specific resolvers.
type RegistryResolver struct {
	client  *http.Client
	baseURL string
}

func NewRegistryResolver() *RegistryResolver {
	return &RegistryResolver{
		client:  &http.Client{Timeout: 10 * time.Second},
		baseURL: "https://api.wormholescan.io",
	}
}

func (r *RegistryResolver) ResolveJump(ctx context.Context, sourceChain, sourceTxHash, bridgeAddress, bridgeProtocol string) (string, string, *models.CrossChainEvidence, error) {
	// Only support Wormhole for Phase 5 verifiable resolution PoC.
	if bridgeProtocol == "Wormhole" {
		return r.resolveWormhole(ctx, sourceChain, sourceTxHash, bridgeAddress)
	}
	return "", "", nil, fmt.Errorf("cross-chain resolution not implemented for protocol: %s", bridgeProtocol)
}

func (r *RegistryResolver) resolveWormhole(ctx context.Context, sourceChain, sourceTxHash, bridgeAddress string) (string, string, *models.CrossChainEvidence, error) {
	// Wormholescan API requires the tx hash without the "0x" prefix for some endpoints, 
	// but the transactions/ API usually accepts 0x.
	
	url := fmt.Sprintf("%s/api/v1/transactions/%s", r.baseURL, sourceTxHash)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", "", nil, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := r.client.Do(req)
	if err != nil {
		return "", "", nil, fmt.Errorf("wormholescan request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", nil, fmt.Errorf("wormholescan API returned %d", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)

	var wResp struct {
		Transactions []struct {
			ID string `json:"id"`
			GlobalTx struct {
				OriginTx struct {
					TxHash string `json:"txHash"`
					From   string `json:"from"`
				} `json:"originTx"`
				DestinationTx struct {
					ChainId int    `json:"chainId"`
					Status  string `json:"status"`
					Method  string `json:"method"`
					TxHash  string `json:"txHash"`
					To      string `json:"to"`
				} `json:"destinationTx"`
			} `json:"globalTx"`
		} `json:"transactions"`
	}

	if err := json.Unmarshal(body, &wResp); err != nil {
		return "", "", nil, fmt.Errorf("failed to parse wormholescan response: %w", err)
	}

	if len(wResp.Transactions) == 0 {
		return "", "", nil, fmt.Errorf("transaction not found in wormhole network")
	}

	tx := wResp.Transactions[0]
	dest := tx.GlobalTx.DestinationTx

	if dest.Status != "completed" && dest.TxHash == "" {
		return "", "", nil, fmt.Errorf("wormhole message not yet redeemed on destination")
	}

	// Map Wormhole chain ID to our internal chain names
	destChain := mapWormholeChainID(dest.ChainId)
	
	evidence := &models.CrossChainEvidence{
		SourceChain:      sourceChain,
		SourceTxHash:     sourceTxHash,
		DestChain:        destChain,
		DestTxHash:       dest.TxHash,
		BridgeProtocol:   "Wormhole",
		CorrelationLevel: "Verified",
		MessageID:        tx.ID, // e.g. "2/0000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585/12345"
		TimeDeltaSeconds: 0, // Difficult to know exactly without the block timestamps from both ends, left as 0
	}

	destAddr := dest.To
	if destAddr == "" {
		return "", "", nil, fmt.Errorf("destination address empty in wormhole response")
	}

	// Ensure prefix for EVM chains
	if !strings.HasPrefix(destAddr, "0x") && destChain != "solana" && destChain != "bitcoin" && destChain != "tron" {
		destAddr = "0x" + destAddr
	}

	log.Printf("[CROSS-CHAIN] 🌉 VERIFIED WORMHOLE JUMP: %s -> %s (%s)", sourceChain, destChain, destAddr)
	return destChain, destAddr, evidence, nil
}

func mapWormholeChainID(id int) string {
	// Subset of Wormhole chain IDs
	switch id {
	case 1:
		return "solana"
	case 2:
		return "ethereum"
	case 4:
		return "bsc"
	case 5:
		return "polygon"
	case 6:
		return "avalanche"
	case 14:
		return "celo"
	case 23:
		return "arbitrum"
	case 24:
		return "optimism"
	case 30:
		return "base"
	default:
		return fmt.Sprintf("wormhole_chain_%d", id)
	}
}
