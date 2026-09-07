import sys

with open("src/app/case/[case_id]/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

if "const [portfolio, setPortfolio]" not in content:
    content = content.replace(
        "const [copied, setCopied] = useState<string | null>(null);",
        "const [copied, setCopied] = useState<string | null>(null);\n  const [portfolio, setPortfolio] = useState<any>(null);"
    )

if "setPortfolio(p)" not in content:
    new_fetch_case = """if (result.status === 'completed' && result.suspect_address) {
              clearInterval(interval);
              fetch(`/api/v1/portfolio/${result.chain}/${result.suspect_address}`).then(r => r.json()).then(p => setPortfolio(p)).catch(e => console.error(e));"""
    content = content.replace("if (result.status === 'completed' && result.suspect_address) {\n              clearInterval(interval);", new_fetch_case)

ui_block = """      </div>

      {portfolio && (
        <div className="glass-panel overflow-hidden mb-6 mt-6">
          <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-header)] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--text-1)] m-0 flex items-center gap-2">
              <RouteIcon className="w-4 h-4 text-[var(--accent)]" /> Wallet Analytics & Profile
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-[var(--bg-body)] p-4 rounded-lg border border-[var(--border-color)]">
              <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1">Current Net Worth</p>
              <p className="text-2xl font-bold text-[var(--text-1)]">?{portfolio.balance_inr.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              <p className="text-xs font-medium text-[var(--text-2)] mt-1">${portfolio.balance_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD</p>
            </div>
            
            <div className="bg-[var(--bg-body)] p-4 rounded-lg border border-[var(--border-color)]">
              <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1">Active Holdings</p>
              <p className="text-2xl font-bold text-[var(--text-1)]">{portfolio.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} <span className="text-sm">{portfolio.token_symbol}</span></p>
              <p className="text-xs font-medium text-[var(--text-2)] mt-1">First Active: {portfolio.first_seen || 'Unknown'}</p>
            </div>
            
            <div className="bg-[var(--bg-body)] p-4 rounded-lg border border-[var(--border-color)]">
              <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1">Total Incoming</p>
              <p className="text-xl font-bold text-[var(--text-1)]">{portfolio.total_incoming.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm">{portfolio.token_symbol}</span></p>
              <p className="text-xs font-medium text-[var(--text-2)] mt-1">Tx Count: {portfolio.tx_count}</p>
            </div>
            
            <div className="bg-[var(--bg-body)] p-4 rounded-lg border border-[var(--border-color)]">
              <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1">Total Outgoing</p>
              <p className="text-xl font-bold text-[var(--text-1)]">{portfolio.total_outgoing.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm">{portfolio.token_symbol}</span></p>
              <p className="text-xs font-medium text-[var(--text-2)] mt-1">?{portfolio.total_outgoing_inr.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">"""

if "Wallet Analytics & Profile" not in content:
    content = content.replace('      </div>\n\n      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">', ui_block)

# Fix Intelligence Fetch
content = content.replace("api/v1/risk/${result.chain}/${result.suspect_address}", "api/v1/intelligence/case/${case_id}")

with open("src/app/case/[case_id]/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
