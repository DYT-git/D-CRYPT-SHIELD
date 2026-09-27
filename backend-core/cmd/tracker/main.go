package main

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
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

type Target struct {
	Address      string `json:"address"`
	Chain        string `json:"chain"`
	Asset        string `json:"asset"`
	OfficerEmail string `json:"officer_email"`
	Action       string `json:"action"`
}

type Event struct {
	Type    string `json:"type"`
	Hash    string `json:"hash"`
	Message string `json:"message"`
	Target  string `json:"target"`
}

var (
	redisClient *redis.Client
	watchlist   sync.Map
)

var endpoints = map[string]struct {
	WSS  string
	HTTP string
}{
	"ethereum": {"wss://ethereum-rpc.publicnode.com", "https://ethereum-rpc.publicnode.com"},
	"bnb":      {"wss://bsc-rpc.publicnode.com", "https://bsc-rpc.publicnode.com"},
	"polygon":  {"wss://polygon-rpc.publicnode.com", "https://polygon-rpc.publicnode.com"},
}

type RPCRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
	ID      int           `json:"id"`
}

func main() {
	log.Println("[ENGINE 2] Starting 100% REAL Tracking Worker...")
	godotenv.Load("../.env")

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}

	opt, _ := redis.ParseURL(redisURL)
	redisClient = redis.NewClient(opt)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go listenForTargets(ctx)

	for chain, urls := range endpoints {
		go startChainWorker(ctx, chain, urls.WSS, urls.HTTP)
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan
	log.Println("[ENGINE 2] Shutting down...")
}

func listenForTargets(ctx context.Context) {
	pubsub := redisClient.Subscribe(ctx, "tracking_targets")
	defer pubsub.Close()

	for {
		msg, err := pubsub.ReceiveMessage(ctx)
		if err != nil {
			continue
		}

		var target Target
		json.Unmarshal([]byte(msg.Payload), &target)

		addr := strings.ToLower(target.Address)
		if target.Action == "remove" {
			watchlist.Delete(addr)
			log.Printf("[ENGINE 2] Removed live listener for: %s\n", addr)
			publishEvent("system", "", fmt.Sprintf("D-CRYPT Tracker deactivated for %s.", addr[:8]+"..."), addr)
		} else {
			watchlist.Store(addr, target)
			log.Printf("[ENGINE 2] Deployed EXACT MATCH listener for: %s on %s\n", addr, target.Chain)
			publishEvent("system", "", fmt.Sprintf("D-CRYPT Real-Time Worker activated. Scanning global blocks for %s...", addr[:8]+"..."), addr)
		}
	}
}

func startChainWorker(ctx context.Context, chain, wssURL, httpURL string) {
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
					go fetchAndScanBlock(chain, httpURL, blockHex)
				}
			}
		}
		conn.Close()
	}
}

func fetchAndScanBlock(chain, httpURL, blockHex string) {
	reqBody := RPCRequest{
		JSONRPC: "2.0",
		Method:  "eth_getBlockByNumber",
		Params:  []interface{}{blockHex, true},
		ID:      2,
	}
	jsonData, _ := json.Marshal(reqBody)

	resp, err := http.Post(httpURL, "application/json", bytes.NewBuffer(jsonData))
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

		watchlist.Range(func(key, value interface{}) bool {
			targetAddr := key.(string)
			target := value.(Target)

			if target.Chain == chain || target.Chain == "" {
				if txFrom == targetAddr || txTo == targetAddr {
					direction := "OUTBOUND"
					if txTo == targetAddr {
						direction = "INBOUND"
					}

					valInt := new(big.Int)
					valInt.SetString(strings.Replace(tx.Value, "0x", "", 1), 16)
					amount := new(big.Float).Quo(new(big.Float).SetInt(valInt), big.NewFloat(1e18))

					msg := fmt.Sprintf("🚨 REAL EVIDENCE SECURED 🚨\n"+
						"Direction: %s\n"+
						"Amount:    %.5f Native Asset\n"+
						"From:      %s\n"+
						"To:        %s\n"+
						"Network:   %s (Block %s)\n"+
						"TxHash:    %s",
						direction, amount, txFrom, txTo, strings.ToUpper(chain), blockNum.String(), tx.Hash)

					log.Println(msg)
					publishEvent("confirmed", tx.Hash, msg, targetAddr)

					if target.OfficerEmail != "" {
						go sendEmailAlert(target.OfficerEmail, targetAddr, direction, txFrom, txTo, fmt.Sprintf("%.5f", amount), "Native Asset", strings.ToUpper(chain), blockNum.String(), tx.Hash)
					}
				}
			}
			return true
		})
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

	dirColor := "#ef4444"
	if direction == "INBOUND" {
		dirColor = "#10b981"
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

func publishEvent(eventType, hash, message, target string) {
	event := Event{
		Type:    eventType,
		Hash:    hash,
		Message: message,
		Target:  target,
	}
	payload, _ := json.Marshal(event)
	redisClient.Publish(context.Background(), "live_tracking_events", payload)
}