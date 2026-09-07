package multiplexer

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync/atomic"
	"time"
)

// Node represents a single RPC API endpoint (e.g., Alchemy, Infura, Cloudflare)
type Node struct {
	URL          string
	PenaltyUntil int64 // Unix timestamp of when the rate-limit penalty expires
}

// IsHealthy checks if the node is currently allowed to receive traffic
func (n *Node) IsHealthy() bool {
	return time.Now().Unix() > atomic.LoadInt64(&n.PenaltyUntil)
}

// Penalize flags the node as rate-limited/failed for a specific duration
func (n *Node) Penalize(seconds int64) {
	penaltyTime := time.Now().Unix() + seconds
	atomic.StoreInt64(&n.PenaltyUntil, penaltyTime)
}

// Pool is the core Smart API Router. It abstracts multiple APIs into a single interface.
type Pool struct {
	nodes   []*Node
	counter uint64
	client  *http.Client
}

// NewPool initializes a new Smart Router with a list of comma-separated URLs
func NewPool(urls []string) (*Pool, error) {
	if len(urls) == 0 {
		return nil, errors.New("cannot start multiplexer: zero RPC URLs provided")
	}

	var nodes []*Node
	for _, u := range urls {
		nodes = append(nodes, &Node{URL: u, PenaltyUntil: 0})
	}

	return &Pool{
		nodes:   nodes,
		counter: 0,
		client: &http.Client{
			Timeout: 5 * time.Second, // Fast timeouts for high TPS
		},
	}, nil
}

// getNextNode uses an atomic lock-free counter to round-robin through nodes.
// If a node is heavily rate-limited, it skips it to find a healthy one.
func (p *Pool) getNextNode() (*Node, error) {
	totalNodes := uint64(len(p.nodes))
	
	for i := uint64(0); i < totalNodes; i++ {
		// Atomic addition ensures 1,000 TPS concurrency without crashing
		idx := atomic.AddUint64(&p.counter, 1) % totalNodes
		node := p.nodes[idx]
		
		if node.IsHealthy() {
			return node, nil
		}
	}
	return nil, errors.New("ALL API NODES ARE CURRENTLY RATE-LIMITED OR DOWN")
}

// Execute performs an HTTP POST request to the blockchain network.
// To the rest of the application, this looks like a single database connection.
// Internally, it routes, balances, and handles failures automatically.
func (p *Pool) Execute(ctx context.Context, payload []byte) ([]byte, error) {
	maxRetries := len(p.nodes) // Try as many times as we have fallback nodes

	for attempt := 0; attempt < maxRetries; attempt++ {
		node, err := p.getNextNode()
		if err != nil {
			// Extreme edge case: sleep briefly if all APIs in the world are blocked
			time.Sleep(500 * time.Millisecond)
			continue 
		}

		req, err := http.NewRequestWithContext(ctx, "POST", node.URL, bytes.NewBuffer(payload))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := p.client.Do(req)
		if err != nil {
			node.Penalize(5) // Network error, penalize for 5 seconds
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()

		// 429 = Too Many Requests (Rate Limit Hit)
		if resp.StatusCode == 429 {
			node.Penalize(10) // Severe penalty, lock this node for 10 seconds
			continue          // Instantly retry on the next node
		}

		if resp.StatusCode != 200 {
			node.Penalize(2) // Mild penalty for 500 errors
			continue
		}

		// Success! Return the data to the engine.
		return body, nil
	}

	return nil, fmt.Errorf("multiplexer failed: exhausted all %d fallback nodes", maxRetries)
}
