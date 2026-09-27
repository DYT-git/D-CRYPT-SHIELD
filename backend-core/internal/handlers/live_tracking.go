package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"net/smtp"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// TrackTargetRequest defines a new live tracking target
type TrackTargetRequest struct {
	Address      string `json:"address" binding:"required"`
	Chain        string `json:"chain"`
	Asset        string `json:"asset"`
	OfficerEmail string `json:"officer_email"`
	Action       string `json:"action"` // "add" or "remove"
	DeployTime   int64  `json:"deploy_time,omitempty"`
}

// LiveEvent represents a telemetry message sent through SSE
type LiveEvent struct {
	Type      string `json:"type"` // "system", "confirmed"
	Hash      string `json:"hash,omitempty"`
	Message   string `json:"message"`
	Target    string `json:"target,omitempty"`
	Timestamp string `json:"timestamp"`
}

type RPCRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
	ID      int           `json:"id"`
}

var (
	trackerMu        sync.RWMutex
	activeTargets    = make(map[string]TrackTargetRequest)
	liveSubscribers  = make(map[chan LiveEvent]struct{})
	seenTransactions sync.Map
	trackerStarted   sync.Once

	trackerHttpClient = &http.Client{
		Timeout: 6 * time.Second,
	}

	wsEndpoints = map[string]struct {
		WSS  string
		HTTP string
	}{
		"ethereum": {"wss://ethereum-rpc.publicnode.com", "https://ethereum-rpc.publicnode.com"},
		"bnb":      {"wss://bsc-rpc.publicnode.com", "https://bsc-rpc.publicnode.com"},
		"polygon":  {"wss://polygon-rpc.publicnode.com", "https://polygon-rpc.publicnode.com"},
		"sepolia":  {"wss://ethereum-sepolia-rpc.publicnode.com", "https://ethereum-sepolia-rpc.publicnode.com"},
	}
)

func broadcastLiveEvent(evt LiveEvent) {
	trackerMu.RLock()
	defer trackerMu.RUnlock()
	for ch := range liveSubscribers {
		select {
		case ch <- evt:
		default:
		}
	}
}

func getChainIDsForChain(chain string) []string {
	switch strings.ToLower(chain) {
	case "ethereum":
		return []string{"1", "11155111"} // Ethereum Mainnet + Sepolia Testnet
	case "sepolia":
		return []string{"11155111"}
	case "bnb", "bsc":
		return []string{"56"}
	case "polygon", "matic":
		return []string{"137"}
	default:
		return []string{"1", "11155111"}
	}
}

func getNetworkNameForChainID(cid string) string {
	switch cid {
	case "1":
		return "ETHEREUM"
	case "11155111":
		return "SEPOLIA"
	case "56":
		return "BNB"
	case "137":
		return "POLYGON"
	default:
		return "EVM"
	}
}

// StartTracking registers target and initiates block scanning
func (h *Handler) StartTracking(c *gin.Context) {
	var req TrackTargetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request", "details": err.Error()})
		return
	}

	addr := strings.ToLower(req.Address)
	chainName := req.Chain
	if chainName == "" {
		chainName = "ethereum"
	}

	req.DeployTime = time.Now().Unix()

	// Ensure background on-chain tracking workers are active
	startLiveTrackingEngines()

	addrDisplay := req.Address
	if len(addrDisplay) > 8 {
		addrDisplay = addrDisplay[:8] + "..."
	}

	trackerMu.Lock()
	if req.Action == "remove" {
		delete(activeTargets, addr)
		trackerMu.Unlock()

		broadcastLiveEvent(LiveEvent{
			Type:      "system",
			Target:    req.Address,
			Message:   fmt.Sprintf("D-CRYPT Tracker deactivated for %s.", addrDisplay),
			Timestamp: time.Now().Format(time.RFC3339),
		})
	} else {
		req.Chain = chainName
		activeTargets[addr] = req
		trackerMu.Unlock()

		// Pre-seed all existing on-chain transactions as seen so historical txs are NEVER alerted
		go cacheOlderHistory(addr, chainName)

		broadcastLiveEvent(LiveEvent{
			Type:      "system",
			Target:    req.Address,
			Message:   fmt.Sprintf("D-CRYPT Real-Time Worker activated. Scanning global blocks for %s on %s...", addrDisplay, strings.ToUpper(chainName)),
			Timestamp: time.Now().Format(time.RFC3339),
		})
	}

	if h.redis != nil {
		payload, _ := json.Marshal(req)
		_ = h.redis.Publish(context.Background(), "tracking_targets", payload).Err()
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

// cacheOlderHistory seeds all existing historical transactions on-chain as seen
func cacheOlderHistory(address, chain string) {
	apiKey := os.Getenv("ETHERSCAN_API_KEY")
	if apiKey == "" {
		apiKey = "1H9VWAVFQ971UYXAG2WKWKTX57TX4THC22"
	}
	chainIDs := getChainIDsForChain(chain)

	for _, cid := range chainIDs {
		url := fmt.Sprintf("https://api.etherscan.io/v2/api?chainid=%s&module=account&action=txlist&address=%s&page=1&offset=50&sort=desc&apikey=%s", cid, address, apiKey)
		resp, err := trackerHttpClient.Get(url)
		if err != nil {
			continue
		}
		var r struct {
			Status string `json:"status"`
			Result []struct {
				Hash string `json:"hash"`
			} `json:"result"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&r); err == nil && r.Status == "1" {
			for _, tx := range r.Result {
				if tx.Hash != "" {
					seenTransactions.Store(strings.ToLower(tx.Hash), true)
				}
			}
		}
		resp.Body.Close()
	}
}

// startLiveTrackingEngines boots the dual on-chain listener: WebSocket heads + high-speed poller
func startLiveTrackingEngines() {
	trackerStarted.Do(func() {
		log.Println("[LIVE TRACKER] Initializing in-process on-chain listeners...")

		// Engine A: High-speed Explorer Poller (every 2.5s for watched targets)
		go startExplorerPoller()

		// Engine B: WebSocket block scanners for EVM chains
		for chain, urls := range wsEndpoints {
			go startChainWSWorker(chain, urls.WSS, urls.HTTP)
		}
	})
}

func startExplorerPoller() {
	ticker := time.NewTicker(2500 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		trackerMu.RLock()
		targets := make([]TrackTargetRequest, 0, len(activeTargets))
		for _, t := range activeTargets {
			targets = append(targets, t)
		}
		trackerMu.RUnlock()

		if len(targets) == 0 {
			continue
		}

		apiKey := os.Getenv("ETHERSCAN_API_KEY")
		if apiKey == "" {
			apiKey = "1H9VWAVFQ971UYXAG2WKWKTX57TX4THC22"
		}

		for _, target := range targets {
			chainIDs := getChainIDsForChain(target.Chain)
			for _, cid := range chainIDs {
				url := fmt.Sprintf("https://api.etherscan.io/v2/api?chainid=%s&module=account&action=txlist&address=%s&page=1&offset=5&sort=desc&apikey=%s", cid, target.Address, apiKey)
				resp, err := trackerHttpClient.Get(url)
				if err != nil {
					continue
				}

				var r struct {
					Status string `json:"status"`
					Result []struct {
						Hash        string `json:"hash"`
						From        string `json:"from"`
						To          string `json:"to"`
						Value       string `json:"value"`
						BlockNumber string `json:"blockNumber"`
						TimeStamp   string `json:"timeStamp"`
					} `json:"result"`
				}

				if err := json.NewDecoder(resp.Body).Decode(&r); err == nil && r.Status == "1" {
					for _, tx := range r.Result {
						txHashLower := strings.ToLower(tx.Hash)
						if txHashLower == "" {
							continue
						}

						// Discard historical transactions that occurred before tracking began
						txTime, _ := strconv.ParseInt(tx.TimeStamp, 10, 64)
						if target.DeployTime > 0 && txTime < target.DeployTime {
							seenTransactions.Store(txHashLower, true)
							continue
						}

						if _, exists := seenTransactions.LoadOrStore(txHashLower, true); !exists {
							// New intercepted transaction!
							direction := "OUTBOUND"
							if strings.EqualFold(tx.To, target.Address) {
								direction = "INBOUND"
							}

							valInt := new(big.Int)
							valInt.SetString(tx.Value, 10)
							amount := new(big.Float).Quo(new(big.Float).SetInt(valInt), big.NewFloat(1e18))

							networkName := getNetworkNameForChainID(cid)

							targetDisplay := target.Address
							if len(targetDisplay) > 8 {
								targetDisplay = targetDisplay[:8] + "..."
							}

							fromAddr := tx.From
							if fromAddr == "" {
								fromAddr = "Unknown"
							}
							toAddr := tx.To
							if toAddr == "" {
								toAddr = "[Contract Creation]"
							}

							msg := fmt.Sprintf("REAL EVIDENCE SECURED: [%s] %s transfer of %.5f native asset in Block %s on %s\n  ▸ Sender:   %s\n  ▸ Receiver: %s\n  ▸ TxHash:   %s",
								targetDisplay, direction, amount, tx.BlockNumber, strings.ToUpper(networkName), fromAddr, toAddr, tx.Hash)

							log.Println("[EVIDENCE SECURED]", msg)

							broadcastLiveEvent(LiveEvent{
								Type:      "confirmed",
								Hash:      tx.Hash,
								Message:   msg,
								Target:    target.Address,
								Timestamp: time.Now().Format(time.RFC3339),
							})

							if target.OfficerEmail != "" {
								go sendEmailAlert(target.OfficerEmail, target.Address, direction, fromAddr, toAddr, fmt.Sprintf("%.5f", amount), "Native Asset", strings.ToUpper(networkName), tx.BlockNumber, tx.Hash)
							}
						}
					}
				}
				resp.Body.Close()
			}
		}
	}
}

func startChainWSWorker(chain, wssURL, httpURL string) {
	for {
		conn, _, err := websocket.DefaultDialer.Dial(wssURL, nil)
		if err != nil {
			time.Sleep(5 * time.Second)
			continue
		}

		req := RPCRequest{
			JSONRPC: "2.0",
			Method:  "eth_subscribe",
			Params:  []interface{}{"newHeads"},
			ID:      1,
		}
		if err := conn.WriteJSON(req); err != nil {
			conn.Close()
			time.Sleep(5 * time.Second)
			continue
		}

		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				break
			}

			var res map[string]interface{}
			json.Unmarshal(message, &res)

			if method, ok := res["method"].(string); ok && method == "eth_subscription" {
				params, _ := res["params"].(map[string]interface{})
				result, _ := params["result"].(map[string]interface{})

				if blockHex, ok := result["number"].(string); ok {
					go scanRPCBlock(chain, httpURL, blockHex)
				}
			}
		}
		conn.Close()
		time.Sleep(3 * time.Second)
	}
}

func scanRPCBlock(chain, httpURL, blockHex string) {
	trackerMu.RLock()
	hasTargets := len(activeTargets) > 0
	trackerMu.RUnlock()
	if !hasTargets {
		return
	}

	reqBody := RPCRequest{
		JSONRPC: "2.0",
		Method:  "eth_getBlockByNumber",
		Params:  []interface{}{blockHex, true},
		ID:      2,
	}
	jsonData, _ := json.Marshal(reqBody)

	resp, err := trackerHttpClient.Post(httpURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil || resp.StatusCode != 200 {
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var rpcResp struct {
		Result struct {
			Transactions []struct {
				Hash  string `json:"hash"`
				From  string `json:"from"`
				To    string `json:"to"`
				Value string `json:"value"`
			} `json:"transactions"`
		} `json:"result"`
	}

	if err := json.Unmarshal(body, &rpcResp); err != nil {
		return
	}

	blockNum := new(big.Int)
	blockNum.SetString(strings.Replace(blockHex, "0x", "", 1), 16)

	for _, tx := range rpcResp.Result.Transactions {
		txFrom := strings.ToLower(tx.From)
		txTo := strings.ToLower(tx.To)
		txHashLower := strings.ToLower(tx.Hash)

		trackerMu.RLock()
		for addr, target := range activeTargets {
			if target.Chain == chain || target.Chain == "" || target.Chain == "ethereum" {
				if txFrom == addr || txTo == addr {
					if _, exists := seenTransactions.LoadOrStore(txHashLower, true); !exists {
						direction := "OUTBOUND"
						if txTo == addr {
							direction = "INBOUND"
						}

						valInt := new(big.Int)
						valInt.SetString(strings.Replace(tx.Value, "0x", "", 1), 16)
						amount := new(big.Float).Quo(new(big.Float).SetInt(valInt), big.NewFloat(1e18))

						targetDisplay := addr
						if len(targetDisplay) > 8 {
							targetDisplay = targetDisplay[:8] + "..."
						}

						fromAddr := tx.From
						if fromAddr == "" {
							fromAddr = "Unknown"
						}
						toAddr := tx.To
						if toAddr == "" {
							toAddr = "[Contract Creation]"
						}

						msg := fmt.Sprintf("REAL EVIDENCE SECURED: [%s] %s transfer of %.5f native asset in Block %s on %s\n  ▸ Sender:   %s\n  ▸ Receiver: %s\n  ▸ TxHash:   %s",
							targetDisplay, direction, amount, blockNum.String(), strings.ToUpper(chain), fromAddr, toAddr, tx.Hash)

						log.Println("[EVIDENCE SECURED]", msg)
						broadcastLiveEvent(LiveEvent{
							Type:      "confirmed",
							Hash:      tx.Hash,
							Message:   msg,
							Target:    addr,
							Timestamp: time.Now().Format(time.RFC3339),
						})

						if target.OfficerEmail != "" {
							go sendEmailAlert(target.OfficerEmail, addr, direction, fromAddr, toAddr, fmt.Sprintf("%.5f", amount), "Native Asset", strings.ToUpper(chain), blockNum.String(), tx.Hash)
						}
					}
				}
			}
		}
		trackerMu.RUnlock()
	}
}

func sendEmailAlert(toEmail, targetAddr, direction, fromAddr, toAddr, amount, token, chain, block, hash string) {
	from := os.Getenv("SMTP_EMAIL")
	password := os.Getenv("SMTP_PASSWORD")
	smtpHost := "smtp.gmail.com"
	smtpPort := "587"

	if from == "" || password == "" || toEmail == "" {
		return
	}

	log.Printf("[SENDING EMAIL] Alert to: %s for target: %s\n", toEmail, targetAddr)

	timestamp := time.Now().Format("Jan 02, 2006 15:04:05 UTC")
	fromHeader := fmt.Sprintf("From: \"D-CRYPT SHIELD\" <%s>\r\n", from)
	toHeader := fmt.Sprintf("To: %s\r\n", toEmail)
	subject := fmt.Sprintf("Subject: 🚨 D-CRYPT ALERT: Target %s Activity Intercepted (%s)\r\n", direction, chain)
	mime := "MIME-version: 1.0;\r\nContent-Type: text/html; charset=\"UTF-8\";\r\n\r\n"

	dirColor := "#ef4444" // red for outbound
	if direction == "INBOUND" {
		dirColor = "#10b981" // green for inbound
	}

	blockInfo := ""
	if block != "" && block != "0" {
		blockInfo = fmt.Sprintf(" (Block #%s)", block)
	}

	explorerURL := fmt.Sprintf("https://etherscan.io/tx/%s", hash)
	chainLower := strings.ToLower(chain)
	if strings.Contains(chainLower, "sepolia") {
		explorerURL = fmt.Sprintf("https://sepolia.etherscan.io/tx/%s", hash)
	} else if strings.Contains(chainLower, "tron") {
		explorerURL = fmt.Sprintf("https://tronscan.org/#/transaction/%s", hash)
	} else if strings.Contains(chainLower, "bnb") || strings.Contains(chainLower, "binance") {
		explorerURL = fmt.Sprintf("https://bscscan.com/tx/%s", hash)
	}

	body := fmt.Sprintf(`
	<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 620px; margin: auto; border: 1px solid #0f172a; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.15);">
		<div style="background-color: #0f172a; padding: 22px; text-align: center;">
			<h2 style="color: #38bdf8; margin: 0; letter-spacing: 2px; font-size: 22px;">D-CRYPT SHIELD</h2>
			<p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Live Tactical Telemetry Alert</p>
		</div>
		<div style="padding: 28px; background-color: #ffffff;">
			<p style="font-size: 15px; margin-top: 0; color: #0f172a;"><strong>Official Intelligence Dispatch:</strong></p>
			<p style="font-size: 14px; line-height: 1.6; color: #334155;">An on-chain transaction matching your monitored suspect target has been <strong>successfully intercepted</strong> by the live forensic telemetry engine.</p>
			
			<div style="background-color: #f8fafc; border-left: 4px solid %s; border-radius: 6px; padding: 18px; margin: 20px 0; font-size: 13px; line-height: 1.8;">
				<div style="margin-bottom: 8px;"><strong>Status:</strong> <span style="background-color: #d1fae5; color: #065f46; font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 11px;">EVIDENCE INTERCEPTED</span></div>
				<div style="margin-bottom: 8px;"><strong>Timestamp:</strong> %s</div>
				<div style="margin-bottom: 8px;"><strong>Monitored Target:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-weight: bold;">%s</code></div>
				<div style="margin-bottom: 8px;"><strong>Flow Direction:</strong> <span style="color: %s; font-weight: bold;">%s</span></div>
				<div style="margin-bottom: 8px;"><strong>Transfer Amount:</strong> <strong style="font-size: 15px; color: #0f172a;">%s %s</strong></div>
				<div style="margin-bottom: 8px;"><strong>Network Layer:</strong> <strong>%s</strong>%s</div>
				<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 12px 0;">
				<div style="margin-bottom: 8px;"><strong>Sender (From):</strong><br><span style="word-break: break-all; font-family: monospace; color: #475569; font-size: 12px;">%s</span></div>
				<div style="margin-bottom: 8px;"><strong>Receiver (To):</strong><br><span style="word-break: break-all; font-family: monospace; color: #475569; font-size: 12px;">%s</span></div>
				<div style="margin-bottom: 8px;"><strong>Transaction Hash (TxID):</strong><br><a href="%s" target="_blank" style="word-break: break-all; font-family: monospace; color: #2563eb; font-weight: bold; font-size: 12px; text-decoration: underline;">%s</a></div>
			</div>

			<p style="font-size: 13px; line-height: 1.6; color: #64748b;">
				This evidence payload has been cataloged into the active case repository. You can verify and trace the hop attribution directly in the console.
			</p>
			<p style="font-size: 14px; line-height: 1.6; margin-top: 22px; text-align: center;">
				<a href="%s" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 6px; font-weight: bold; font-size: 14px; margin-right: 10px;">View on Blockchain Explorer</a>
				<a href="https://shield.d-crypt.in" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 6px; font-weight: bold; font-size: 14px;">Open Shield Console</a>
			</p>
		</div>
		<div style="background-color: #f1f5f9; padding: 14px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
			D-CRYPT Automated Cyber Forensics System • Highly Confidential LEA Intelligence
		</div>
	</div>
	`, dirColor, timestamp, targetAddr, dirColor, direction, amount, token, chain, blockInfo, fromAddr, toAddr, explorerURL, hash, explorerURL)

	msg := []byte(fromHeader + toHeader + subject + mime + body)
	auth := smtp.PlainAuth("", from, password, smtpHost)

	err := smtp.SendMail(smtpHost+":"+smtpPort, auth, from, []string{toEmail}, msg)
	if err != nil {
		log.Println("[EMAIL ERROR] Failed to send alert to", toEmail, ":", err)
	} else {
		log.Println("[EMAIL SUCCESS] Alert sent to", toEmail)
	}
}

// LiveFeed SSE endpoint streaming live events to dashboard
func (h *Handler) LiveFeed(c *gin.Context) {
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Access-Control-Allow-Origin", "*")

	clientChan := make(chan LiveEvent, 100)

	trackerMu.Lock()
	liveSubscribers[clientChan] = struct{}{}
	trackerMu.Unlock()

	defer func() {
		trackerMu.Lock()
		delete(liveSubscribers, clientChan)
		trackerMu.Unlock()
		close(clientChan)
	}()

	// If redis is available, subscribe in a separate goroutine
	if h.redis != nil {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		pubsub := h.redis.Subscribe(ctx, "live_tracking_events")
		defer pubsub.Close()

		go func() {
			for {
				msg, ok := <-pubsub.Channel()
				if !ok {
					return
				}
				var rEvt LiveEvent
				if err := json.Unmarshal([]byte(msg.Payload), &rEvt); err == nil {
					select {
					case clientChan <- rEvt:
					default:
					}
				}
			}
		}()
	}

	// Keepalive ticker (every 10 seconds) - sends silent SSE comment to keep TCP connection open
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-c.Request.Context().Done():
			return

		case evt := <-clientChan:
			payload, _ := json.Marshal(evt)
			if _, err := c.Writer.Write([]byte(fmt.Sprintf("data: %s\n\n", payload))); err != nil {
				return
			}
			c.Writer.Flush()

		case <-ticker.C:
			// Silent SSE comment line - keeps HTTP connection alive without triggering onmessage or creating terminal entries
			if _, err := c.Writer.Write([]byte(": keepalive\n\n")); err != nil {
				return
			}
			c.Writer.Flush()
		}
	}
}