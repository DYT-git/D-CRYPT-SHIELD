package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// ─────────────────────────────────────────────────────────────
// Response structs
// ─────────────────────────────────────────────────────────────

type ChainPortfolio struct {
	Chain            string  `json:"chain"`
	TokenSymbol      string  `json:"token_symbol"`
	Balance          float64 `json:"balance"`
	BalanceUSD       float64 `json:"balance_usd"`
	TotalIncoming    float64 `json:"total_incoming"`
	TotalOutgoing    float64 `json:"total_outgoing"`
	TxCount          int     `json:"tx_count"`
	FirstSeen        string  `json:"first_seen"`
	DataAvailable    bool    `json:"data_available"`
	DataNote         string  `json:"data_note,omitempty"`
}

type OmniPortfolioResponse struct {
	Address          string           `json:"address"`
	TotalBalanceUSD  float64          `json:"total_balance_usd"`
	TotalBalanceINR  float64          `json:"total_balance_inr"`
	TotalTxCount     int              `json:"total_tx_count"`
	Chains           []ChainPortfolio `json:"chains"`
}

// ─────────────────────────────────────────────────────────────
// Helper: fetch with fallback key logic
// ─────────────────────────────────────────────────────────────

var httpClient = &http.Client{Timeout: 12 * time.Second}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func fetchJSON(url string) (map[string]interface{}, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "D-CRYPT-Tracer/1.0")
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// ─────────────────────────────────────────────────────────────
// Per-chain fetchers
// ─────────────────────────────────────────────────────────────

// fetchEthereumPortfolio fetches ETH balance and tx history from Etherscan.
// Falls back to keyless endpoint (rate-limited but works for demo).
func fetchEthereumPortfolio(address string) (balance, totalIn, totalOut float64, txCount int, firstSeen string, err error) {
	apiKey := getEnv("ETHERSCAN_API_KEY", "")
	
	// Try BlockCypher first (Free, no key required, provides total_received and total_sent)
	url := fmt.Sprintf("https://api.blockcypher.com/v1/eth/main/addrs/%s/balance", address)
	data, e := fetchJSON(url)
	if e == nil && data["error"] == nil {
		if bal, ok := data["final_balance"].(float64); ok {
			balance = bal / 1e18 // wei → ETH
		}
		if ti, ok := data["total_received"].(float64); ok {
			totalIn = ti / 1e18
		}
		if to, ok := data["total_sent"].(float64); ok {
			totalOut = to / 1e18
		}
		if n, ok := data["final_n_tx"].(float64); ok {
			txCount = int(n)
		} else if n, ok := data["n_tx"].(float64); ok {
			txCount = int(n)
		}
		return
	}

	// Fallback to Etherscan (Note: V1 keyless is deprecated, requires API key)
	baseURL := "https://api.etherscan.io/api"

	// Balance
	balURL := fmt.Sprintf("%s?module=account&action=balance&address=%s&tag=latest", baseURL, address)
	if apiKey != "" {
		balURL += "&apikey=" + apiKey
	}
	if bData, e := fetchJSON(balURL); e == nil {
		if bData["status"] == "1" {
			if strBal, ok := bData["result"].(string); ok {
				if f, e2 := strconv.ParseFloat(strBal, 64); e2 == nil {
					balance = f / 1e18
				}
			}
		}
	}

	// Transactions
	txURL := fmt.Sprintf("%s?module=account&action=txlist&address=%s&startblock=0&endblock=99999999&page=1&offset=200&sort=asc", baseURL, address)
	if apiKey != "" {
		txURL += "&apikey=" + apiKey
	}
	if tData, e := fetchJSON(txURL); e == nil {
		if tData["status"] == "1" {
			if results, ok := tData["result"].([]interface{}); ok && len(results) > 0 {
				txCount = len(results)
				if first, ok := results[0].(map[string]interface{}); ok {
					if ts, ok := first["timeStamp"].(string); ok {
						if tsInt, e2 := strconv.ParseInt(ts, 10, 64); e2 == nil {
							firstSeen = time.Unix(tsInt, 0).Format("2006-01-02")
						}
					}
				}
				for _, r := range results {
					tx, ok := r.(map[string]interface{})
					if !ok {
						continue
					}
					valStr, _ := tx["value"].(string)
					toAddr, _ := tx["to"].(string)
					if valF, e2 := strconv.ParseFloat(valStr, 64); e2 == nil {
						eth := valF / 1e18
						if strings.EqualFold(toAddr, address) {
							totalIn += eth
						} else {
							totalOut += eth
						}
					}
				}
			}
		}
	}
	return
}

// fetchBitcoinPortfolio fetches BTC data from BlockCypher (free, no key needed for basic).
// Falls back to mempool.space if BlockCypher fails.
func fetchBitcoinPortfolio(address string) (balance, totalIn, totalOut float64, txCount int, firstSeen string, err error) {
	apiKey := getEnv("BLOCKCYPHER_API_KEY", "")

	// Try BlockCypher first
	url := fmt.Sprintf("https://api.blockcypher.com/v1/btc/main/addrs/%s/balance", address)
	if apiKey != "" {
		url += "?token=" + apiKey
	}
	data, e := fetchJSON(url)
	if e == nil {
		if bal, ok := data["final_balance"].(float64); ok {
			balance = bal / 1e8 // satoshis → BTC
		}
		if ti, ok := data["total_received"].(float64); ok {
			totalIn = ti / 1e8
		}
		if to, ok := data["total_sent"].(float64); ok {
			totalOut = to / 1e8
		}
		if n, ok := data["n_tx"].(float64); ok {
			txCount = int(n)
		}
		return
	}

	// Fallback: mempool.space (completely free, no auth needed)
	mempoolURL := fmt.Sprintf("https://mempool.space/api/address/%s", address)
	mData, e2 := fetchJSON(mempoolURL)
	if e2 != nil {
		err = fmt.Errorf("bitcoin fetch failed: blockcypher: %v, mempool: %v", e, e2)
		return
	}

	if chainStats, ok := mData["chain_stats"].(map[string]interface{}); ok {
		if funded, ok := chainStats["funded_txo_sum"].(float64); ok {
			totalIn = funded / 1e8
		}
		if spent, ok := chainStats["spent_txo_sum"].(float64); ok {
			totalOut = spent / 1e8
		}
		balance = totalIn - totalOut
		if n, ok := chainStats["tx_count"].(float64); ok {
			txCount = int(n)
		}
	}
	return
}

// fetchTronPortfolio fetches TRX data from Tronscan (free, no API key required).
func fetchTronPortfolio(address string) (balance, totalIn, totalOut float64, txCount int, firstSeen string, err error) {
	// TronGrid API — free, no key for basic
	url := fmt.Sprintf("https://apilist.tronscanapi.com/api/accountv2?address=%s", address)
	data, e := fetchJSON(url)
	if e != nil {
		// Fallback: TronGrid direct
		trongridKey := getEnv("TRONGRID_API_KEY", "")
		url2 := fmt.Sprintf("https://api.trongrid.io/v1/accounts/%s", address)
		req, _ := http.NewRequest("GET", url2, nil)
		if trongridKey != "" {
			req.Header.Set("TRON-PRO-API-KEY", trongridKey)
		}
		req.Header.Set("User-Agent", "D-CRYPT-Tracer/1.0")
		resp2, e2 := httpClient.Do(req)
		if e2 != nil {
			err = fmt.Errorf("tron fetch failed: %v / %v", e, e2)
			return
		}
		defer resp2.Body.Close()
		body, _ := io.ReadAll(resp2.Body)
		var tData map[string]interface{}
		if e3 := json.Unmarshal(body, &tData); e3 != nil {
			err = fmt.Errorf("tron parse failed: %v", e3)
			return
		}
		if dataArr, ok := tData["data"].([]interface{}); ok && len(dataArr) > 0 {
			acc := dataArr[0].(map[string]interface{})
			if bal, ok := acc["balance"].(float64); ok {
				balance = bal / 1e6 // SUN → TRX
			}
		}
		return
	}

	// Tronscan response
	if bal, ok := data["balance"].(float64); ok {
		balance = bal / 1e6
	}
	if totalTx, ok := data["totalTransactionCount"].(float64); ok {
		txCount = int(totalTx)
	}
	if toCount, ok := data["toAddressCount"].(float64); ok {
		totalOut = toCount // approximate
	}
	if fromCount, ok := data["fromAddressCount"].(float64); ok {
		totalIn = fromCount
	}
	// First seen
	if created, ok := data["date_created"].(float64); ok && created > 0 {
		firstSeen = time.Unix(int64(created)/1000, 0).Format("2006-01-02")
	}
	return
}

// fetchBNBPortfolio fetches BNB data from BSCScan (same pattern as Etherscan).
func fetchBNBPortfolio(address string) (balance, totalIn, totalOut float64, txCount int, firstSeen string, err error) {
	apiKey := getEnv("BSCSCAN_API_KEY", "")
	baseURL := "https://api.bscscan.com/api"

	// Balance (Try BscScan first)
	balURL := fmt.Sprintf("%s?module=account&action=balance&address=%s&tag=latest", baseURL, address)
	if apiKey != "" {
		balURL += "&apikey=" + apiKey
	}
	
	balanceFetched := false
	if bData, e := fetchJSON(balURL); e == nil {
		if bData["status"] == "1" {
			if strBal, ok := bData["result"].(string); ok {
				if f, e2 := strconv.ParseFloat(strBal, 64); e2 == nil {
					balance = f / 1e18
					balanceFetched = true
				}
			}
		}
	}

	// Fallback to public BSC RPC if BscScan V1 fails
	if !balanceFetched {
		rpcURL := "https://bsc-dataseed.binance.org/"
		payload := fmt.Sprintf(`{"jsonrpc":"2.0","method":"eth_getBalance","params":["%s", "latest"],"id":1}`, address)
		req, _ := http.NewRequest("POST", rpcURL, strings.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "D-CRYPT-Tracer/1.0")
		if resp, err := httpClient.Do(req); err == nil {
			defer resp.Body.Close()
			var rpcResp map[string]interface{}
			if json.NewDecoder(resp.Body).Decode(&rpcResp) == nil {
				if resultHex, ok := rpcResp["result"].(string); ok && len(resultHex) > 2 {
					// Parse hex string (e.g. "0x...")
					if resultHex[:2] == "0x" {
						resultHex = resultHex[2:]
					}
					if parsed, err := strconv.ParseUint(resultHex, 16, 64); err == nil {
						balance = float64(parsed) / 1e18
					}
				}
			}
		}
	}

	// Transactions
	txURL := fmt.Sprintf("%s?module=account&action=txlist&address=%s&startblock=0&endblock=99999999&page=1&offset=200&sort=asc", baseURL, address)
	if apiKey != "" {
		txURL += "&apikey=" + apiKey
	}
	if tData, e := fetchJSON(txURL); e == nil {
		if tData["status"] == "1" {
			if results, ok := tData["result"].([]interface{}); ok && len(results) > 0 {
				txCount = len(results)
				if first, ok := results[0].(map[string]interface{}); ok {
					if ts, ok := first["timeStamp"].(string); ok {
						if tsInt, e2 := strconv.ParseInt(ts, 10, 64); e2 == nil {
							firstSeen = time.Unix(tsInt, 0).Format("2006-01-02")
						}
					}
				}
				for _, r := range results {
					tx, ok := r.(map[string]interface{})
					if !ok {
						continue
					}
					valStr, _ := tx["value"].(string)
					toAddr, _ := tx["to"].(string)
					if valF, e2 := strconv.ParseFloat(valStr, 64); e2 == nil {
						bnb := valF / 1e18
						if strings.EqualFold(toAddr, address) {
							totalIn += bnb
						} else {
							totalOut += bnb
						}
					}
				}
			}
		}
	}
	return
}

// fetchSolanaPortfolio fetches SOL data using the public Solana JSON-RPC.
func fetchSolanaPortfolio(address string) (balance, totalIn, totalOut float64, txCount int, firstSeen string, err error) {
	rpcURL := getEnv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")

	// Get balance
	balPayload := fmt.Sprintf(`{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["%s"]}`, address)
	req, _ := http.NewRequest("POST", rpcURL, strings.NewReader(balPayload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "D-CRYPT-Tracer/1.0")
	resp, e := httpClient.Do(req)
	if e != nil {
		err = e
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var rpcResp map[string]interface{}
	if e2 := json.Unmarshal(body, &rpcResp); e2 == nil {
		if result, ok := rpcResp["result"].(map[string]interface{}); ok {
			if val, ok := result["value"].(float64); ok {
				balance = val / 1e9 // lamports → SOL
			}
		}
	}

	// Get recent signatures for tx count
	sigPayload := fmt.Sprintf(`{"jsonrpc":"2.0","id":1,"method":"getSignaturesForAddress","params":["%s",{"limit":100}]}`, address)
	req2, _ := http.NewRequest("POST", rpcURL, strings.NewReader(sigPayload))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("User-Agent", "D-CRYPT-Tracer/1.0")
	resp2, e3 := httpClient.Do(req2)
	if e3 == nil {
		defer resp2.Body.Close()
		body2, _ := io.ReadAll(resp2.Body)
		var sigResp map[string]interface{}
		if json.Unmarshal(body2, &sigResp) == nil {
			if results, ok := sigResp["result"].([]interface{}); ok {
				txCount = len(results)
				if txCount > 0 {
					if last, ok := results[txCount-1].(map[string]interface{}); ok {
						if bt, ok := last["blockTime"].(float64); ok {
							firstSeen = time.Unix(int64(bt), 0).Format("2006-01-02")
						}
					}
				}
			}
		}
	}
	// totalIn/totalOut not available without indexer — set note
	return
}

// fetchPolygonPortfolio fetches MATIC/POL data from Polygonscan.
func fetchPolygonPortfolio(address string) (balance, totalIn, totalOut float64, txCount int, firstSeen string, err error) {
	apiKey := getEnv("POLYGONSCAN_API_KEY", "")
	baseURL := "https://api.polygonscan.com/api"

	// Balance (Try PolygonScan first)
	balURL := fmt.Sprintf("%s?module=account&action=balance&address=%s&tag=latest", baseURL, address)
	if apiKey != "" {
		balURL += "&apikey=" + apiKey
	}
	
	balanceFetched := false
	if bData, e := fetchJSON(balURL); e == nil {
		if bData["status"] == "1" {
			if strBal, ok := bData["result"].(string); ok {
				if f, e2 := strconv.ParseFloat(strBal, 64); e2 == nil {
					balance = f / 1e18
					balanceFetched = true
				}
			}
		}
	}

	// Fallback to public Polygon RPC if PolygonScan V1 fails
	if !balanceFetched {
		rpcURL := "https://polygon-rpc.com/"
		payload := fmt.Sprintf(`{"jsonrpc":"2.0","method":"eth_getBalance","params":["%s", "latest"],"id":1}`, address)
		req, _ := http.NewRequest("POST", rpcURL, strings.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "D-CRYPT-Tracer/1.0")
		if resp, err := httpClient.Do(req); err == nil {
			defer resp.Body.Close()
			var rpcResp map[string]interface{}
			if json.NewDecoder(resp.Body).Decode(&rpcResp) == nil {
				if resultHex, ok := rpcResp["result"].(string); ok && len(resultHex) > 2 {
					// Parse hex string (e.g. "0x...")
					if resultHex[:2] == "0x" {
						resultHex = resultHex[2:]
					}
					if parsed, err := strconv.ParseUint(resultHex, 16, 64); err == nil {
						balance = float64(parsed) / 1e18
					}
				}
			}
		}
	}

	// Transactions
	txURL := fmt.Sprintf("%s?module=account&action=txlist&address=%s&startblock=0&endblock=99999999&page=1&offset=200&sort=asc", baseURL, address)
	if apiKey != "" {
		txURL += "&apikey=" + apiKey
	}
	if tData, e := fetchJSON(txURL); e == nil {
		if tData["status"] == "1" {
			if results, ok := tData["result"].([]interface{}); ok && len(results) > 0 {
				txCount = len(results)
				if first, ok := results[0].(map[string]interface{}); ok {
					if ts, ok := first["timeStamp"].(string); ok {
						if tsInt, e2 := strconv.ParseInt(ts, 10, 64); e2 == nil {
							firstSeen = time.Unix(tsInt, 0).Format("2006-01-02")
						}

					}
				}
				for _, r := range results {
					tx, ok := r.(map[string]interface{})
					if !ok {
						continue
					}
					valStr, _ := tx["value"].(string)
					toAddr, _ := tx["to"].(string)
					if valF, e2 := strconv.ParseFloat(valStr, 64); e2 == nil {
						pol := valF / 1e18
						if strings.EqualFold(toAddr, address) {
							totalIn += pol
						} else {
							totalOut += pol
						}
					}
				}
			}
		}
	}
	return
}

// ─────────────────────────────────────────────────────────────
// Price Oracle
// ─────────────────────────────────────────────────────────────

type chainMeta struct {
	symbol     string
	geckoID    string
	coingeckoID string
}

var chainMetaMap = map[string]chainMeta{
	"ethereum": {symbol: "ETH",  geckoID: "ethereum"},
	"bitcoin":  {symbol: "BTC",  geckoID: "bitcoin"},
	"tron":     {symbol: "TRX",  geckoID: "tron"},
	"bnb":      {symbol: "BNB",  geckoID: "binancecoin"},
	"solana":   {symbol: "SOL",  geckoID: "solana"},
	"polygon":  {symbol: "POL",  geckoID: "matic-network"},
	"arbitrum": {symbol: "ETH",  geckoID: "ethereum"},
	"avalanche":{symbol: "AVAX", geckoID: "avalanche-2"},
}

// Fallback prices (USD) if CoinGecko fails
var fallbackPricesUSD = map[string]float64{
	"ETH":  3100,
	"BTC":  65000,
	"TRX":  0.13,
	"BNB":  600,
	"SOL":  170,
	"POL":  0.55,
	"AVAX": 35,
}

func fetchPrice(geckoID string) (priceINR, priceUSD float64) {
	url := fmt.Sprintf("https://api.coingecko.com/api/v3/simple/price?ids=%s&vs_currencies=inr,usd", geckoID)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "D-CRYPT-Tracer/1.0")
	resp, err := httpClient.Do(req)
	if err != nil {
		return 0, 0
	}
	defer resp.Body.Close()
	var priceData map[string]map[string]float64
	if json.NewDecoder(resp.Body).Decode(&priceData) == nil {
		if p, ok := priceData[geckoID]; ok {
			priceINR = p["inr"]
			priceUSD = p["usd"]
		}
	}
	return
}

// ─────────────────────────────────────────────────────────────
// Covalent Unified Portfolio Fetcher (Primary for EVM chains)
// ─────────────────────────────────────────────────────────────

func fetchCovalentPortfolio(address, chainSlug, apiKey string) (balance, totalIn, totalOut float64, txCount int, firstSeen string, err error) {
	url := fmt.Sprintf("https://api.covalenthq.com/v1/%s/address/%s/balances_v2/", chainSlug, address)
	req, e := http.NewRequest("GET", url, nil)
	if e != nil {
		err = e
		return
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("User-Agent", "D-CRYPT-Tracer/1.0")

	resp, e := httpClient.Do(req)
	if e != nil {
		err = e
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		err = fmt.Errorf("covalent portfolio: HTTP %d", resp.StatusCode)
		return
	}

	var result struct {
		Data struct {
			Items []struct {
				Balance         string  `json:"balance"`
				Quote           float64 `json:"quote"`
				QuoteRate       float64 `json:"quote_rate"`
				IsNativeToken   bool    `json:"is_native_token"`
				IsSpam          bool    `json:"is_spam"`
				LastTransferred string  `json:"last_transferred_at"`
			} `json:"items"`
		} `json:"data"`
		Error        bool   `json:"error"`
		ErrorMessage string `json:"error_message"`
	}

	body, _ := io.ReadAll(resp.Body)
	if e := json.Unmarshal(body, &result); e != nil {
		err = e
		return
	}
	if result.Error {
		err = fmt.Errorf("covalent: %s", result.ErrorMessage)
		return
	}

	inrRate := 84.0
	totalUSD := 0.0

	for _, item := range result.Data.Items {
		if item.IsSpam {
			continue
		}
		if item.IsNativeToken && item.Balance != "" {
			b, e2 := strconv.ParseFloat(item.Balance, 64)
			if e2 == nil {
				balance = b / 1e18
			}
		}
		if item.Quote > 0 {
			totalUSD += item.Quote
		}
		if firstSeen == "" && item.LastTransferred != "" {
			if t, e2 := time.Parse(time.RFC3339, item.LastTransferred); e2 == nil {
				firstSeen = t.Format("2006-01-02")
			}
		}
	}

	// For total in/out and tx count, hit the transactions endpoint
	txURL := fmt.Sprintf("https://api.covalenthq.com/v1/%s/address/%s/transactions_v3/?page-size=200", chainSlug, address)
	txReq, _ := http.NewRequest("GET", txURL, nil)
	txReq.Header.Set("Authorization", "Bearer "+apiKey)
	txReq.Header.Set("User-Agent", "D-CRYPT-Tracer/1.0")
	if txResp, e2 := httpClient.Do(txReq); e2 == nil {
		defer txResp.Body.Close()
		var txResult struct {
			Data struct {
				Items []struct {
					FromAddress string  `json:"from_address"`
					ToAddress   string  `json:"to_address"`
					ValueQuote  float64 `json:"value_quote"`
					Successful  bool    `json:"successful"`
				} `json:"items"`
			} `json:"data"`
		}
		if body2, e3 := io.ReadAll(txResp.Body); e3 == nil {
			if json.Unmarshal(body2, &txResult) == nil {
				addrLower := strings.ToLower(address)
				for _, tx := range txResult.Data.Items {
					if !tx.Successful {
						continue
					}
					txCount++
					if strings.EqualFold(tx.ToAddress, addrLower) {
						totalIn += tx.ValueQuote
					} else {
						totalOut += tx.ValueQuote
					}
				}
			}
		}
	}

	_ = totalUSD
	_ = inrRate
	return
}

// ─────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────

func (h *Handler) GetWalletPortfolio(c *gin.Context) {
	address := c.Param("address")

	supportedChains := []string{"ethereum", "bitcoin", "tron", "bnb", "polygon", "solana"}
	
	omni := OmniPortfolioResponse{
		Address: address,
		Chains:  make([]ChainPortfolio, len(supportedChains)),
	}

	var wg sync.WaitGroup
	var mu sync.Mutex

	for i, ch := range supportedChains {
		wg.Add(1)
		go func(index int, chain string) {
			defer wg.Done()
			
			meta := chainMetaMap[chain]
			priceINR, priceUSD := fetchPrice(meta.geckoID)
			if priceUSD == 0 {
				if fb, ok := fallbackPricesUSD[meta.symbol]; ok {
					priceUSD = fb
					priceINR = fb * 84
				}
			}

			var balance, totalIn, totalOut float64
			var txCount int
			var firstSeen string
			var fetchErr error
			var dataNote string

			covalentKey := getEnv("COVALENT_API_KEY", "")
			covalentChainSlug := map[string]string{
				"ethereum": "eth-mainnet",
				"bnb":      "bsc-mainnet",
				"polygon":  "matic-mainnet",
			}
			covalentFetched := false

			if covalentKey != "" {
				if slug, ok := covalentChainSlug[chain]; ok {
					b, ti, to, tc, fs, cerr := fetchCovalentPortfolio(address, slug, covalentKey)
					if cerr == nil {
						balance, totalIn, totalOut, txCount, firstSeen = b, ti, to, tc, fs
						covalentFetched = true
					}
				}
			}

			if !covalentFetched {
				switch chain {
				case "ethereum":
					balance, totalIn, totalOut, txCount, firstSeen, fetchErr = fetchEthereumPortfolio(address)
				case "bitcoin":
					balance, totalIn, totalOut, txCount, firstSeen, fetchErr = fetchBitcoinPortfolio(address)
				case "tron":
					balance, totalIn, totalOut, txCount, firstSeen, fetchErr = fetchTronPortfolio(address)
					if fetchErr == nil && totalIn == 0 && totalOut == 0 {
						dataNote = "Flow totals approx for Tron."
					}
				case "bnb":
					balance, totalIn, totalOut, txCount, firstSeen, fetchErr = fetchBNBPortfolio(address)
				case "polygon":
					balance, totalIn, totalOut, txCount, firstSeen, fetchErr = fetchPolygonPortfolio(address)
				case "solana":
					balance, totalIn, totalOut, txCount, firstSeen, fetchErr = fetchSolanaPortfolio(address)
				}
			}

			cp := ChainPortfolio{
				Chain:       chain,
				TokenSymbol: meta.symbol,
			}

			if fetchErr != nil {
				cp.DataAvailable = false
				cp.DataNote = fmt.Sprintf("Error: %v", fetchErr)
			} else {
				cp.DataAvailable = true
				cp.DataNote = dataNote
				cp.Balance = balance
				cp.BalanceUSD = balance * priceUSD
				cp.TotalIncoming = totalIn
				cp.TotalOutgoing = totalOut
				cp.TxCount = txCount
				cp.FirstSeen = firstSeen
				
				mu.Lock()
				omni.TotalBalanceUSD += cp.BalanceUSD
				omni.TotalBalanceINR += balance * priceINR
				omni.TotalTxCount += txCount
				mu.Unlock()
			}

			mu.Lock()
			omni.Chains[index] = cp
			mu.Unlock()

		}(i, ch)
	}

	wg.Wait()

	c.JSON(http.StatusOK, omni)
}
