import { NextResponse } from 'next/server';

// In-memory persistent storage across requests on server
interface CivilianReport {
  id: string;
  submitted_at: string;
  auth: {
    verified: boolean;
    provider: string;
    name: string;
    email: string;
  };
  device: {
    ip: string;
    isp: string;
    vpn_detected: boolean;
    user_agent: string;
    resolution: string;
    timezone: string;
  };
  fraud: {
    network: string;
    amount: string;
    scammer: string;
    description: string;
    txn_hash?: string;
  };
  status: string;
}

const INITIAL_MOCK_REPORTS: CivilianReport[] = [
  {
    id: "CIV-8891",
    submitted_at: "Today, 14:22 IST",
    auth: {
      verified: true,
      provider: "Google OAuth",
      name: "Ramesh Kumar",
      email: "ramesh.kumar88@gmail.com",
    },
    device: {
      ip: "103.18.23.99",
      isp: "Jio Infocomm Ltd",
      vpn_detected: false,
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/116.0",
      resolution: "1920x1080",
      timezone: "Asia/Kolkata",
    },
    fraud: {
      network: "Ethereum (ETH)",
      amount: "2.4 ETH",
      scammer: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      description: "I received a Telegram message offering a part-time job reviewing hotels. After the first payment, they asked me to deposit crypto to unlock VIP tasks. They froze my funds and demanded more."
    },
    status: "PROCESSING_BFS"
  },
  {
    id: "CIV-8892",
    submitted_at: "Today, 15:05 IST",
    auth: {
      verified: false,
      provider: "Guest Mode (Direct URL)",
      name: "Anonymous Citizen",
      email: "N/A",
    },
    device: {
      ip: "193.122.44.11",
      isp: "Mullvad VPN / Datacamp Ltd",
      vpn_detected: true,
      user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
      resolution: "1440x900",
      timezone: "Europe/London (Mismatch Detected)",
    },
    fraud: {
      network: "Tron (TRX)",
      amount: "4,500 USDT",
      scammer: "TG49rL7YtP6A9v3X8w5Z1q2KxJmN8cU9sL",
      description: "Invested in a yield farming platform called DeFi-Max. When I tried to withdraw my USDT, the contract threw an error and my balance was drained."
    },
    status: "PENDING_REVIEW"
  },
  {
    id: "CIV-8893",
    submitted_at: "Today, 16:10 IST",
    auth: {
      verified: true,
      provider: "Google OAuth",
      name: "Anjali Desai",
      email: "anjali.d99@yahoo.in",
    },
    device: {
      ip: "49.36.14.21",
      isp: "Airtel Broadband",
      vpn_detected: false,
      user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15",
      resolution: "390x844",
      timezone: "Asia/Kolkata",
    },
    fraud: {
      network: "Polygon (MATIC)",
      amount: "15,000 MATIC",
      scammer: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
      description: "Clicked on a phishing link disguised as a MetaMask airdrop. Signed a malicious contract that transferred all my MATIC to the scammer."
    },
    status: "QUEUED"
  }
];

// Persistent global variable across serverless invocations in dev/prod
declare global {
  var __civilianReportsGlobal: CivilianReport[] | undefined;
}

if (!globalThis.__civilianReportsGlobal) {
  globalThis.__civilianReportsGlobal = [...INITIAL_MOCK_REPORTS];
}

export async function GET() {
  return NextResponse.json({
    success: true,
    count: globalThis.__civilianReportsGlobal?.length || 0,
    reports: globalThis.__civilianReportsGlobal || []
  });
}

export async function POST(req: Request) {
  try {
    const reportData = await req.json();
    if (!reportData || !reportData.fraud || !reportData.fraud.scammer) {
      return NextResponse.json({ success: false, error: "Invalid report data" }, { status: 400 });
    }

    if (!globalThis.__civilianReportsGlobal) {
      globalThis.__civilianReportsGlobal = [...INITIAL_MOCK_REPORTS];
    }

    // Prepend to top of reports queue
    globalThis.__civilianReportsGlobal.unshift(reportData);

    return NextResponse.json({
      success: true,
      report: reportData,
      total_count: globalThis.__civilianReportsGlobal.length
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to save report" }, { status: 500 });
  }
}
