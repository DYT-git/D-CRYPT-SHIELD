package models

// NormalizedDisclosureRequest is a SAHYOG-independent structure 
// representing a request to disclose user identity from a VASP.
type NormalizedDisclosureRequest struct {
	CaseReference         string   `json:"case_reference"`
	SuspectWallet         string   `json:"suspect_wallet"`
	Chain                 string   `json:"chain"`
	IdentifiedVASP        string   `json:"identified_vasp"`
	AttributionConfidence float64  `json:"attribution_confidence"`
	RelevantTxHashes      []string `json:"relevant_tx_hashes"`
	ReportHash            string   `json:"report_hash"`
	PrimaryEvidence       string   `json:"primary_evidence,omitempty"`
}

// NormalizedFreezeRequest is a SAHYOG-independent structure
// representing a request to freeze assets at a VASP.
type NormalizedFreezeRequest struct {
	CaseReference    string   `json:"case_reference"`
	TargetVASP       string   `json:"target_vasp"`
	SuspectWallet    string   `json:"suspect_wallet"`
	AssetSymbol      string   `json:"asset_symbol"`
	EstimatedValue   float64  `json:"estimated_value"`
	RelevantTxHashes []string `json:"relevant_tx_hashes"`
	ReportHash       string   `json:"report_hash"`
}

// TransportResult represents the outcome of pushing a payload through an IntegrationTransport.
type TransportResult struct {
	Success       bool   `json:"success"`
	Message       string `json:"message"`
	PayloadHash   string `json:"payload_hash"`
	Timestamp     string `json:"timestamp"`
	TransportName string `json:"transport_name"`
}

// IntegrationOutboxRecord represents a prepared payload preserved locally.
type IntegrationOutboxRecord struct {
	ID              int64  `json:"id"`
	CaseID          string `json:"case_id"`
	RequestType     string `json:"request_type"`
	TransportMethod string `json:"transport_method"`
	PayloadJSON     string `json:"payload_json"`
	PayloadHash     string `json:"payload_hash"`
	Status          string `json:"status"`
	CreatedAt       string `json:"created_at"`
}
