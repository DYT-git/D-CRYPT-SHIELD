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

					msg := fmt.Sprintf("REAL EVIDENCE SECURED: [%s] %s transfer of %.5f native asset in Block %s on %s. Real TxHash: %s", 
						targetAddr[:8]+"...", direction, amount, blockNum.String(), strings.ToUpper(chain), tx.Hash)

					log.Println(msg)
					publishEvent("confirmed", tx.Hash, msg, targetAddr)

					if target.OfficerEmail != "" {
						go sendEmailAlert(target.OfficerEmail, targetAddr, direction, fmt.Sprintf("%.5f", amount), "Native Asset", strings.ToUpper(chain), tx.Hash)
					}
				}
			}
			return true
		})
	}
}

func sendEmailAlert(toEmail, wallet, direction, amount, token, chain, hash string) {
	from := os.Getenv("SMTP_EMAIL")
	password := os.Getenv("SMTP_PASSWORD")
	smtpHost := "smtp.gmail.com"
	smtpPort := "587"

	if from == "" || password == "" {
		log.Println("[EMAIL ERROR] Missing SMTP credentials in .env")
		return
	}

	timestamp := time.Now().Format("Jan 02, 2006 15:04:05 UTC")
	fromHeader := fmt.Sprintf("From: \"D-CRYPT\" <%s>\r\n", from)
	toHeader := fmt.Sprintf("To: %s\r\n", toEmail)
	subject := "Subject: 🚨 D-CRYPT ALERT: Target Wallet Activity Intercepted\r\n"
	mime := "MIME-version: 1.0;\r\nContent-Type: text/html; charset=\"UTF-8\";\r\n\r\n"

	body := fmt.Sprintf(`
	<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #1e293b; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
		<div style="background-color: #1e293b; padding: 20px; text-align: center;">
			<h2 style="color: #fbbf24; margin: 0; letter-spacing: 2px;">D-CRYPT SHIELD</h2>
			<p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase;">Tactical Telemetry Alert</p>
		</div>
		<div style="padding: 30px; background-color: #ffffff;">
			<p style="font-size: 16px;"><strong>Hello Sir/Madam,</strong></p>
			<p style="font-size: 14px; line-height: 1.6;">This is an official automated notification from the D-CRYPT Telemetry Engine. A new transaction matching your active tracker has been successfully intercepted on the global blockchain.</p>
			<div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #fbbf24; margin: 20px 0; font-family: monospace; font-size: 13px;">
				<p style="margin: 8px 0;"><strong>Timestamp:</strong> %s</p>
				<p style="margin: 8px 0;"><strong>Target Wallet:</strong> %s</p>
				<p style="margin: 8px 0;"><strong>Transfer Type:</strong> %s</p>
				<p style="margin: 8px 0;"><strong>Amount:</strong> %s %s</p>
				<p style="margin: 8px 0;"><strong>Network Layer:</strong> %s</p>
				<p style="margin: 8px 0;"><strong>Transaction Hash:</strong> <span style="word-break: break-all; color: #2563eb;">%s</span></p>
			</div>
			<p style="font-size: 14px; line-height: 1.6;">Thank you for choosing D-CRYPT Shield for your intelligence operations.</p>
			<p style="font-size: 14px; line-height: 1.6;">You can track and investigate this case further from your official dashboard link:<br>
			<a href="https://shield.d-crypt.in" style="color: #2563eb; text-decoration: none; font-weight: bold; font-size: 16px;">shield.d-crypt.in</a></p>
		</div>
		<div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
			This is a highly confidential system-generated message. Do not reply.
		</div>
	</div>
	`, timestamp, wallet, direction, amount, token, chain, hash)

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