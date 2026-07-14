"""
Workspace Platform — Main entry point.

FastAPI application serving the Workspace UI.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import time
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader

from core import __version__
from workspace.core.app_registry import get_app, get_apps, get_apps_by_category

logger = logging.getLogger(__name__)

_TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")
_STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

_jinja = Environment(
    loader=FileSystemLoader(_TEMPLATES_DIR),
    autoescape=True,
)


def _render(name: str, **ctx: Any) -> str:
    tmpl = _jinja.get_template(name)
    return tmpl.render(**ctx)


# WebSocket connection manager
class WSManager:
    def __init__(self) -> None:
        self._clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self._clients:
            self._clients.remove(ws)

    async def broadcast(self, data: dict[str, Any]) -> None:
        msg = json.dumps(data)
        dead: list[WebSocket] = []
        for ws in self._clients:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    @property
    def count(self) -> int:
        return len(self._clients)


ws_manager = WSManager()


def create_app() -> FastAPI:
    """Create and configure the Workspace FastAPI application."""
    app = FastAPI(
        title="Trading Workspace",
        version=__version__,
        description="Workspace Platform — Phase 14",
    )

    # Static files
    app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")

    # ── Workspace Shell ────────────────────────────────────────────

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def workspace_shell(request: Request):
        """Workspace shell — redirect to first app."""
        apps = get_apps()
        default = apps[0].route if apps else "/scanner"
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="scanner",
            app_name="Scanner",
            content=f'<script>window.location.href="{default}";</script>',
        )

    @app.get("/apps", response_class=JSONResponse)
    async def list_apps():
        return JSONResponse([a.to_dict() for a in get_apps()])

    # ── App Pages ──────────────────────────────────────────────────

    def _app_page(app_id: str, title: str, extra_head: str = "") -> str:
        app = get_app(app_id)
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app=app_id,
            app_name=title,
            content=f'<div class="app-container" id="app-{app_id}">'
                    f'<div class="app-header"><h1>{app.icon} {title}</h1>'
                    f'<p>{app.description}</p></div>'
                    f'<div id="{app_id}-content"></div></div>',
            extra_head=extra_head,
        )

    @app.get("/scanner", response_class=HTMLResponse, include_in_schema=False)
    async def scanner_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="scanner",
            app_name="Scanner",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>🔍 Scanner</h1>
                <p>Live signal stream from all strategies</p>
              </div>
              <div class="card">
                <div class="card-header">
                  <span class="card-title">Signal Flow</span>
                  <span style="color:var(--text-muted);font-size:12px">
                    <span class="status-dot online"></span> Listening
                  </span>
                </div>
                <div id="signal-stream" class="signal-stream">
                  <div style="color:var(--text-muted);text-align:center;padding:40px">
                    Waiting for signals...
                  </div>
                </div>
              </div>
            </div>
            <script>
              const stream = document.getElementById('signal-stream');
              new WsClient('/ws/scanner', (data) => {
                if (data.type === 'signal') {
                  const line = document.createElement('div');
                  line.className = 'signal-line';
                  line.innerHTML = `
                    <span class="symbol">${data.symbol}</span>
                    <span class="strategy">${data.strategy}</span>
                    <span class="score" style="color:${data.score >= 70 ? 'var(--accent-green)' : 'var(--accent-orange)'}">${data.score}</span>
                    <span class="direction">${fmt.direction(data.direction)}</span>
                    <span class="stars">${fmt.stars(data.rating)}</span>
                    <span style="color:var(--text-muted);font-size:11px">${fmt.time(data.timestamp)}</span>
                  `;
                  stream.insertBefore(line, stream.firstChild);
                  while (stream.children.length > 200) stream.removeChild(stream.lastChild);
                }
              });
            </script>
            """,
        )

    @app.get("/opportunities", response_class=HTMLResponse, include_in_schema=False)
    async def opportunities_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="opportunities",
            app_name="Opportunities",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>🎯 Opportunity Center</h1>
                <p>Active, pending and closed trading opportunities</p>
              </div>
              <div class="metric-group">
                <div class="metric-card">
                  <div class="metric-label">Active</div>
                  <div class="metric-value green" id="opp-active">0</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Pending</div>
                  <div class="metric-value blue" id="opp-pending">0</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Today P&L</div>
                  <div class="metric-value" id="opp-pnl">+0.00%</div>
                </div>
              </div>
              <div id="opp-list"></div>
            </div>
            <script>
              const oppList = document.getElementById('opp-list');
              oppList.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:40px">Loading opportunities...</div>';
              new WsClient('/ws/opportunities', (data) => {
                if (data.type === 'opportunity') {
                  const pnl = data.pnl != null ? (data.pnl >= 0 ? '+' : '') + data.pnl.toFixed(2) + '%' : '—';
                  const statusClass = data.status === 'active' ? 'active' : data.status === 'waiting' ? 'waiting' : 'stopped';
                  const card = document.createElement('div');
                  card.className = 'opp-card';
                  card.innerHTML = `
                    <span class="opp-symbol">${data.symbol}</span>
                    <span class="opp-direction">${fmt.direction(data.direction)}</span>
                    <span class="opp-status ${statusClass}">${data.status}</span>
                    <span class="opp-pnl" style="color:${data.pnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">${pnl}</span>
                    <span class="opp-meta">RR ${data.rr || '—'} · ${fmt.elapsed(data.timestamp)}</span>
                  `;
                  oppList.insertBefore(card, oppList.firstChild);
                }
                if (data.type === 'metrics') {
                  document.getElementById('opp-active').textContent = data.active || 0;
                  document.getElementById('opp-pending').textContent = data.pending || 0;
                  document.getElementById('opp-pnl').textContent = (data.pnl >= 0 ? '+' : '') + (data.pnl || 0).toFixed(2) + '%';
                }
              });
            </script>
            """,
        )

    @app.get("/strategies", response_class=HTMLResponse, include_in_schema=False)
    async def strategies_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="strategies",
            app_name="Strategies",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>🧠 Strategy Center</h1>
                <p>Strategy management: health, metrics, lifecycle controls</p>
              </div>
              <div id="strategy-list"></div>
            </div>
            <script>
              const sl = document.getElementById('strategy-list');
              sl.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:40px">Loading strategies...</div>';
              new WsClient('/ws/strategies', (data) => {
                if (data.type === 'strategy_status') {
                  const healthDot = fmt.statusDot(data.health);
                  const card = document.createElement('div');
                  card.className = 'card';
                  card.innerHTML = `
                    <div class="card-header">
                      <span class="card-title">${healthDot} ${data.name}</span>
                      <div style="display:flex;gap:4px">
                        <button class="btn btn-sm" onclick="alert('Config')">⚙️</button>
                        <button class="btn btn-sm btn-danger" onclick="alert('Pause')">⏸</button>
                        <button class="btn btn-sm" onclick="alert('Restart')">🔄</button>
                      </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">
                      <div><div style="color:var(--text-muted)">Winrate</div><div style="font-family:var(--font-mono)">${data.winrate || '—'}%</div></div>
                      <div><div style="color:var(--text-muted)">PF</div><div style="font-family:var(--font-mono)">${data.profit_factor || '—'}</div></div>
                      <div><div style="color:var(--text-muted)">Last Signal</div><div style="font-family:var(--font-mono)">${data.last_signal ? fmt.elapsed(data.last_signal) : '—'}</div></div>
                      <div><div style="color:var(--text-muted)">CPU</div><div style="font-family:var(--font-mono)">${data.cpu || '0'}%</div></div>
                      <div><div style="color:var(--text-muted)">Memory</div><div style="font-family:var(--font-mono)">${data.memory || '0'} MB</div></div>
                    </div>
                  `;
                  sl.innerHTML = '';
                  sl.appendChild(card);
                }
              });
            </script>
            """,
        )

    @app.get("/replay", response_class=HTMLResponse, include_in_schema=False)
    async def replay_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="replay",
            app_name="Replay Studio",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>▶️ Replay Studio</h1>
                <p>Deterministic backtest IDE with breakpoints</p>
              </div>
              <div style="display:grid;grid-template-columns:1fr 300px;gap:16px">
                <div class="card">
                  <div class="card-header">
                    <span class="card-title">Timeline</span>
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-sm">⏮</button>
                      <button class="btn btn-sm btn-primary">▶</button>
                      <button class="btn btn-sm">⏭</button>
                      <span style="color:var(--text-muted);font-size:12px;margin-left:8px">1x</span>
                    </div>
                  </div>
                  <div style="height:300px;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">
                    Timeline control — coming soon
                  </div>
                </div>
                <div class="card">
                  <div class="card-header">
                    <span class="card-title">Inspector</span>
                  </div>
                  <div style="color:var(--text-muted);font-size:12px">
                    <div>EMA: —</div>
                    <div>RSI: —</div>
                    <div>ATR: —</div>
                    <div>Decision: —</div>
                  </div>
                </div>
              </div>
            </div>
            """,
        )

    @app.get("/inspector", response_class=HTMLResponse, include_in_schema=False)
    async def inspector_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="inspector",
            app_name="Inspector",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>🔬 Feature Inspector</h1>
                <p>Understand why decisions were made — per-symbol feature analysis</p>
              </div>
              <div style="display:flex;gap:8px;margin-bottom:16px">
                <input id="inspector-symbol" value="BTCUSDT"
                       style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:8px 12px;border-radius:4px;font-family:var(--font-mono)">
                <button class="btn btn-primary" onclick="inspectSymbol()">Inspect</button>
              </div>
              <div class="card">
                <div class="card-header">
                  <span class="card-title">Features</span>
                  <span style="color:var(--text-muted);font-size:12px">Last update: —</span>
                </div>
                <div id="feature-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">
                  <div style="color:var(--text-muted);text-align:center;padding:20px">Select symbol to inspect</div>
                </div>
              </div>
              <div class="card">
                <div class="card-header">
                  <span class="card-title">Decision Chain</span>
                </div>
                <div id="decision-chain" style="color:var(--text-muted);font-family:var(--font-mono);font-size:12px"></div>
              </div>
            </div>
            <script>
              function inspectSymbol() {
                const sym = document.getElementById('inspector-symbol').value || 'BTCUSDT';
                fetch('/api/v1/inspector/' + sym)
                  .then(r => r.json())
                  .then(data => {
                    const grid = document.getElementById('feature-grid');
                    grid.innerHTML = '';
                    for (const [key, val] of Object.entries(data.features || {})) {
                      const v = typeof val === 'number' ? val.toFixed(4) : val;
                      grid.innerHTML += `<div class="metric-card"><div class="metric-label">${key}</div><div class="metric-value" style="font-size:16px">${v}</div></div>`;
                    }
                    const dc = document.getElementById('decision-chain');
                    dc.innerHTML = (data.decision_chain || []).map(d => '<div>→ ' + d + '</div>').join('');
                  })
                  .catch(err => {
                    document.getElementById('feature-grid').innerHTML =
                      '<div style="color:var(--accent-red);text-align:center;padding:20px">Error: ' + err + '</div>';
                  });
              }
              inspectSymbol();
            </script>
            """,
        )

    @app.get("/learning", response_class=HTMLResponse, include_in_schema=False)
    async def learning_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="learning",
            app_name="Learning",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>🤖 Learning Center</h1>
                <p>ML model hub: accuracy, retrain, predictions</p>
              </div>
              <div class="metric-group">
                <div class="metric-card">
                  <div class="metric-label">Regime Classifier</div>
                  <div class="metric-value green">91%</div>
                  <div class="metric-change up">Accuracy ↑ 2.1%</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Performance Predictor</div>
                  <div class="metric-value blue">R² 0.73</div>
                  <div class="metric-change up">Precision ↑ 0.04</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Anomaly Detector</div>
                  <div class="metric-value orange">87%</div>
                  <div class="metric-change up">Precision ↑ 1.2%</div>
                </div>
              </div>
              <div class="card">
                <div class="card-header">
                  <span class="card-title">Models</span>
                  <button class="btn btn-primary btn-sm" onclick="alert('Retraining...')">🔄 Retrain All</button>
                </div>
                <table class="data-table">
                  <tr><th>Model</th><th>Status</th><th>Score</th><th>Samples</th><th>Version</th><th></th></tr>
                  <tr><td>Regime Classifier</td><td><span class="status-dot online"></span> Ready</td><td>0.91</td><td>12,430</td><td>1.2.0</td><td><button class="btn btn-sm" onclick="alert('Retrain regime classifier')">Retrain</button></td></tr>
                  <tr><td>Performance Predictor</td><td><span class="status-dot online"></span> Ready</td><td>0.73</td><td>8,210</td><td>1.1.0</td><td><button class="btn btn-sm" onclick="alert('Retrain performance predictor')">Retrain</button></td></tr>
                  <tr><td>Anomaly Detector</td><td><span class="status-dot online"></span> Ready</td><td>0.87</td><td>45,600</td><td>2.0.0</td><td><button class="btn btn-sm" onclick="alert('Retrain anomaly detector')">Retrain</button></td></tr>
                </table>
              </div>
            </div>
            """,
        )

    @app.get("/plugins", response_class=HTMLResponse, include_in_schema=False)
    async def plugins_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="plugins",
            app_name="Plugin Store",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>🧩 Plugin Store</h1>
                <p>Browse, install and manage plugins</p>
              </div>
              <div style="display:flex;gap:8px;margin-bottom:16px">
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                  <button class="btn btn-sm btn-primary">Trending</button>
                  <button class="btn btn-sm">Signals</button>
                  <button class="btn btn-sm">Indicators</button>
                  <button class="btn btn-sm">Exchanges</button>
                  <button class="btn btn-sm">Analysis</button>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
                <div class="card">
                  <div class="card-header"><span class="card-title">Momentum Pro</span></div>
                  <div style="color:var(--text-secondary);font-size:12px;margin-bottom:8px">Advanced momentum detection with volume confirmation</div>
                  <div style="display:flex;gap:4px;margin-bottom:8px">
                    <span class="tag long">Signal</span>
                    <span class="tag bull">Momentum</span>
                  </div>
                  <button class="btn btn-primary btn-sm">Install</button>
                </div>
                <div class="card">
                  <div class="card-header"><span class="card-title">ICT Concepts</span></div>
                  <div style="color:var(--text-secondary);font-size:12px;margin-bottom:8px">Smart Money, Order Blocks, FVG, Liquidity</div>
                  <div style="display:flex;gap:4px;margin-bottom:8px">
                    <span class="tag bull">Analysis</span>
                    <span class="tag neutral">ICT</span>
                  </div>
                  <button class="btn btn-sm">Install</button>
                </div>
                <div class="card">
                  <div class="card-header"><span class="card-title">Whale Tracker</span></div>
                  <div style="color:var(--text-secondary);font-size:12px;margin-bottom:8px">Large order flow and whale wallet monitoring</div>
                  <div style="display:flex;gap:4px;margin-bottom:8px">
                    <span class="tag neutral">Data</span>
                    <span class="tag long">Whales</span>
                  </div>
                  <button class="btn btn-sm">Install</button>
                </div>
                <div class="card">
                  <div class="card-header"><span class="card-title">News Sentiment</span></div>
                  <div style="color:var(--text-secondary);font-size:12px;margin-bottom:8px">Real-time news + sentiment analysis for any symbol</div>
                  <div style="display:flex;gap:4px;margin-bottom:8px">
                    <span class="tag neutral">News</span>
                    <span class="tag bull">AI</span>
                  </div>
                  <button class="btn btn-sm">Install</button>
                </div>
              </div>
            </div>
            """,
        )

    @app.get("/monitor", response_class=HTMLResponse, include_in_schema=False)
    async def monitor_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="monitor",
            app_name="System",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>📊 System Monitor</h1>
                <p>Runtime: services, CPU, RAM, latency</p>
              </div>
              <div class="metric-group">
                <div class="metric-card">
                  <div class="metric-label">CPU</div>
                  <div class="metric-value" id="sys-cpu">—</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Memory</div>
                  <div class="metric-value" id="sys-mem">—</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">Active Plugins</div>
                  <div class="metric-value blue" id="sys-plugins">32</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">WS Clients</div>
                  <div class="metric-value" id="sys-ws">0</div>
                </div>
              </div>
              <div class="card">
                <div class="card-header"><span class="card-title">Services</span></div>
                <table class="data-table" id="service-table">
                  <tr><th>Service</th><th>Status</th><th>Uptime</th><th>Latency</th></tr>
                </table>
              </div>
            </div>
            <script>
              fetch('/api/v1/system/status').then(r=>r.json()).then(data => {
                document.getElementById('sys-cpu').textContent = data.cpu_percent + '%';
                document.getElementById('sys-mem').textContent = data.memory_mb + ' MB';
                document.getElementById('sys-plugins').textContent = data.active_plugins;
                document.getElementById('sys-ws').textContent = data.ws_clients;
                const st = document.getElementById('service-table');
                for (const [name, status] of Object.entries(data.services || {})) {
                  st.innerHTML += `<tr><td>${name}</td><td>${fmt.statusDot(status)} ${status}</td><td>—</td><td>—</td></tr>`;
                }
              });
            </script>
            """,
        )

    @app.get("/api", response_class=HTMLResponse, include_in_schema=False)
    async def api_explorer_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="api",
            app_name="API Explorer",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>📡 API Explorer</h1>
                <p>Live API reference — test endpoints, inspect responses</p>
              </div>
              <div style="display:flex;gap:8px;margin-bottom:16px">
                <select id="api-method" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:8px;border-radius:4px">
                  <option>GET</option>
                  <option>POST</option>
                </select>
                <input id="api-path" value="/api/v1/system/status"
                       style="flex:1;background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:8px 12px;border-radius:4px;font-family:var(--font-mono)">
                <button class="btn btn-primary" onclick="callAPI()">Send</button>
              </div>
              <div class="card">
                <div class="card-header"><span class="card-title">Response</span></div>
                <pre id="api-response" style="color:var(--accent-green);font-family:var(--font-mono);font-size:12px;white-space:pre-wrap">Click "Send" to call an endpoint</pre>
              </div>
              <div class="card">
                <div class="card-header"><span class="card-title">Available Endpoints</span></div>
                <table class="data-table">
                  <tr><th>Method</th><th>Path</th><th>Description</th></tr>
                  <tr><td><span class="tag neutral">GET</span></td><td>/api/v1/system/status</td><td>Runtime status</td></tr>
                  <tr><td><span class="tag neutral">GET</span></td><td>/api/v1/inspector/{symbol}</td><td>Feature inspector</td></tr>
                  <tr><td><span class="tag neutral">GET</span></td><td>/apps</td><td>List workspace apps</td></tr>
                </table>
              </div>
            </div>
            <script>
              async function callAPI() {
                const method = document.getElementById('api-method').value;
                const path = document.getElementById('api-path').value;
                const resp = document.getElementById('api-response');
                resp.textContent = 'Loading...';
                try {
                  const r = await fetch(path, { method });
                  const text = await r.text();
                  try { resp.textContent = JSON.stringify(JSON.parse(text), null, 2); }
                  catch { resp.textContent = text; }
                } catch(err) {
                  resp.textContent = 'Error: ' + err;
                }
              }
            </script>
            """,
        )

    @app.get("/settings", response_class=HTMLResponse, include_in_schema=False)
    async def settings_page():
        return _render(
            "base.html",
            categories=get_apps_by_category(),
            active_app="settings",
            app_name="Settings",
            content="""
            <div class="app-container">
              <div class="app-header">
                <h1>⚙️ Settings</h1>
                <p>Platform configuration</p>
              </div>
              <div class="card">
                <div class="card-header"><span class="card-title">General</span></div>
                <div style="display:grid;gap:12px">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span>Workspace Theme</span>
                    <select style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;border-radius:4px">
                      <option>Dark</option>
                      <option>Light</option>
                    </select>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span>Default Symbol</span>
                    <input value="BTCUSDT" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;border-radius:4px;width:120px">
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span>Auto-refresh (sec)</span>
                    <input type="number" value="5" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:4px 8px;border-radius:4px;width:80px">
                  </div>
                </div>
              </div>
            </div>
            """,
        )

    # ── API Endpoints ──────────────────────────────────────────────

    # Scanner mock data
    _symbols = [
        "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT",
        "ADA/USDT", "AVAX/USDT", "DOT/USDT", "LINK/USDT", "MATIC/USDT",
        "ATOM/USDT", "UNI/USDT", "LTC/USDT", "BCH/USDT", "NEAR/USDT",
    ]

    def _gen_price(base: float) -> float:
        return round(base * random.uniform(0.98, 1.02), 2)

    def _gen_scanner_item(symbol: str) -> dict[str, Any]:
        base_prices = {
            "BTC/USDT": 65400, "ETH/USDT": 3450, "SOL/USDT": 142,
            "BNB/USDT": 578, "XRP/USDT": 0.62, "ADA/USDT": 0.45,
            "AVAX/USDT": 32.15, "DOT/USDT": 7.80, "LINK/USDT": 14.87,
            "MATIC/USDT": 0.72, "ATOM/USDT": 9.45, "UNI/USDT": 7.12,
            "LTC/USDT": 82.50, "BCH/USDT": 345.0, "NEAR/USDT": 5.23,
        }
        base = base_prices.get(symbol, 100)
        price = _gen_price(base)
        change = round(random.uniform(-5.0, 5.0), 2)
        score = random.randint(20, 95)
        signals = []
        if score > 50:
            signals.append("Momentum")
        if random.random() > 0.5:
            signals.append("Volume")
        if score > 70 and random.random() > 0.4:
            signals.append("Breakout")
        return {
            "symbol": symbol,
            "price": price,
            "change": change,
            "changePercent": round(change, 2),
            "volume": random.randint(1000, 50000),
            "score": score,
            "signals": signals,
            "direction": "long" if change >= 0 else "short",
            "timestamp": time.time(),
        }

    def _gen_scanner_items() -> list[dict[str, Any]]:
        return [_gen_scanner_item(s) for s in _symbols]

    @app.get("/api/v1/scanner")
    async def scanner_list():
        return _gen_scanner_items()

    @app.get("/api/v1/system/status")
    async def system_status():
        return {
            "services": {
                "Feature Engine": "OK",
                "Decision Engine": "OK",
                "Replay": "OK",
                "Learning": "OK",
                "Telegram": "OK",
            },
            "cpu_percent": 12.4,
            "memory_mb": 186,
            "active_plugins": 32,
            "active_strategies": 8,
            "uptime_hours": 47.3,
            "ws_clients": ws_manager.count,
        }

    @app.get("/api/v1/inspector/{symbol:str}")
    async def feature_inspector(symbol: str):
        return {
            "symbol": symbol,
            "features": {
                "EMA-20": 65321.45,
                "RSI-14": 62.3,
                "ATR-14": 712.8,
                "Trend": "Bull",
                "Volatility": "Expansion",
                "Whales": "Active",
                "Confidence": "78%",
                "Volume Ratio": 1.42,
                "Spread": 0.0003,
                "Liquidity": "High",
            },
            "decision_chain": [
                f"Trend analysis: BULL (EMA>200, +3.2%)",
                "RSI: 62.3 (bullish, no divergence)",
                "Volume: 1.42x avg (confirms trend)",
                "Volatility: Expansion (ATR ratio 1.62)",
                "Decision: LONG with 78% confidence",
            ],
        }

    @app.get("/api/v1/trace/{symbol}")
    async def trace_graph(symbol: str):
        return {
            "symbol": symbol,
            "nodes": [
                {
                    "id": "market_data",
                    "type": "input",
                    "position": {"x": 0, "y": 200},
                    "data": {"label": "Market Data", "status": "ok", "detail": f"1h candles for {symbol}"},
                },
                {
                    "id": "features",
                    "type": "default",
                    "position": {"x": 250, "y": 200},
                    "data": {"label": "Feature Engine", "status": "ok", "detail": "EMA, RSI, ATR computed"},
                },
                {
                    "id": "context",
                    "type": "default",
                    "position": {"x": 500, "y": 200},
                    "data": {"label": "Context Engine", "status": "ok", "detail": "Market regime: BULL, Volatility: Expansion"},
                },
                {
                    "id": "consensus",
                    "type": "default",
                    "position": {"x": 750, "y": 100},
                    "data": {"label": "Consensus", "status": "ok", "detail": "3/5 strategies agree: LONG"},
                },
                {
                    "id": "strategy_a",
                    "type": "default",
                    "position": {"x": 750, "y": 250},
                    "data": {"label": "Momentum v2", "status": "ok", "detail": "Score: 78, LONG"},
                },
                {
                    "id": "strategy_b",
                    "type": "default",
                    "position": {"x": 750, "y": 400},
                    "data": {"label": "MeanReversion", "status": "warn", "detail": "Score: 42, NEUTRAL"},
                },
                {
                    "id": "risk",
                    "type": "output",
                    "position": {"x": 1000, "y": 200},
                    "data": {"label": "Risk Engine", "status": "ok", "detail": "Risk: 2.1%, POSITION_SIZE: 0.1 BTC"},
                },
            ],
            "edges": [
                {"id": "e1", "source": "market_data", "target": "features"},
                {"id": "e2", "source": "features", "target": "context"},
                {"id": "e3", "source": "context", "target": "consensus"},
                {"id": "e4", "source": "context", "target": "strategy_a"},
                {"id": "e5", "source": "context", "target": "strategy_b"},
                {"id": "e6", "source": "strategy_a", "target": "consensus"},
                {"id": "e7", "source": "strategy_b", "target": "consensus"},
                {"id": "e8", "source": "consensus", "target": "risk"},
            ],
        }

    # ── Replay ────────────────────────────────────────────────────

    # Mock replay sessions
    _replay_sessions = [
        {
            "id": "btc-2024-q1",
            "name": "BTC/USDT Backtest Q1 2024",
            "symbol": "BTC/USDT",
            "events": 42,
            "duration": "3 months",
            "strategies": ["Momentum v2", "MeanReversion"],
            "status": "ready",
        },
        {
            "id": "eth-2024-q1",
            "name": "ETH/USDT Backtest Q1 2024",
            "symbol": "ETH/USDT",
            "events": 38,
            "duration": "3 months",
            "strategies": ["Momentum v2"],
            "status": "ready",
        },
        {
            "id": "sol-2024-mar",
            "name": "SOL/USDT Live Replay March 2024",
            "symbol": "SOL/USDT",
            "events": 55,
            "duration": "1 month",
            "strategies": ["MeanReversion", "Scalper v3"],
            "status": "ready",
        },
    ]

    def _gen_replay_events(session_id: str) -> list[dict[str, Any]]:
        base_time = time.time() - 86400 * 7  # 7 days ago
        prices = {
            "btc-2024-q1": 43700.0,
            "eth-2024-q1": 2850.0,
            "sol-2024-mar": 98.50,
        }
        base_price = prices.get(session_id, 100.0)
        events: list[dict[str, Any]] = []
        step = 0

        # Helper to add events
        def add(typ: str, ts_offset: float, symbol: str, data: dict[str, Any]) -> None:
            nonlocal step
            step += 1
            nonlocal base_time
            events.append({
                "step": step,
                "id": f"evt-{session_id}-{step}",
                "timestamp": base_time + ts_offset,
                "type": typ,
                "symbol": symbol,
                "data": data,
            })

        # Simulated timeline
        add("session_start", 0, "BTC/USDT", {"strategy": "Momentum v2", "mode": "backtest"})
        add("market_data", 10, "BTC/USDT", {"open": 43680, "high": 43800, "low": 43650, "close": 43700, "volume": 12450})
        add("feature_update", 15, "BTC/USDT", {"feature": "EMA-20", "value": 43520, "prev": 43480, "delta": "+40"})
        add("feature_update", 16, "BTC/USDT", {"feature": "RSI-14", "value": 58.3, "prev": 55.1, "delta": "+3.2"})
        add("feature_update", 17, "BTC/USDT", {"feature": "ATR-14", "value": 680, "prev": 690, "delta": "-10"})
        add("context_update", 20, "BTC/USDT", {"regime": "BULL", "volatility": "Normal", "trend_strength": "Strong"})
        add("signal", 25, "BTC/USDT", {
            "strategy": "Momentum v2", "score": 78, "direction": "LONG",
            "confidence": 0.82, "indicators": {"ema_trend": "bull", "rsi": 58.3, "volume_ratio": 1.35},
        })
        add("signal", 26, "BTC/USDT", {
            "strategy": "MeanReversion", "score": 34, "direction": "NEUTRAL",
            "confidence": 0.31, "indicators": {"deviation": "-0.8σ", "rsi": 58.3},
        })
        add("decision", 28, "BTC/USDT", {
            "result": "LONG", "confidence": 0.78, "reason": "3/5 strategies bullish",
            "trigger": "EMA-20 cross above EMA-50",
        })
        add("opportunity", 30, "BTC/USDT", {
            "direction": "LONG", "entry": 43700, "stop": 43400, "target": 44200,
            "risk_reward": 2.1, "confidence": 78,
        })
        add("trade_open", 32, "BTC/USDT", {
            "entry": 43720, "size": 0.5, "stop": 43400, "target": 44200,
            "direction": "LONG", "pnl_potential": "+1.14%",
        })
        add("market_data", 35, "BTC/USDT", {"open": 43720, "high": 43950, "low": 43700, "close": 43900, "volume": 18200})
        add("feature_update", 38, "BTC/USDT", {"feature": "RSI-14", "value": 62.5, "prev": 58.3, "delta": "+4.2"})
        add("feature_update", 39, "BTC/USDT", {"feature": "Volume Ratio", "value": 1.62, "prev": 1.35, "delta": "+0.27"})
        add("context_update", 40, "BTC/USDT", {"regime": "BULL", "volatility": "Expansion", "trend_strength": "Very Strong"})
        add("trade_update", 45, "BTC/USDT", {
            "pnl": "+0.55%", "price": 43900, "unrealized_pnl": 90.0,
            "stop_trailed": 43500,
        })
        add("signal", 50, "BTC/USDT", {
            "strategy": "Momentum v2", "score": 85, "direction": "LONG",
            "confidence": 0.91, "indicators": {"ema_trend": "bull", "rsi": 62.5, "volume_ratio": 1.62},
        })
        add("signal", 52, "BTC/USDT", {
            "strategy": "MeanReversion", "score": 28, "direction": "SHORT",
            "confidence": 0.22, "indicators": {"deviation": "+1.2σ", "rsi": 62.5},
        })
        add("decision", 55, "BTC/USDT", {
            "result": "HOLD", "confidence": 0.91, "reason": "Position already open, trailing stop active",
        })
        add("market_data", 60, "BTC/USDT", {"open": 43900, "high": 44150, "low": 43880, "close": 44100, "volume": 21400})
        add("trade_update", 65, "BTC/USDT", {
            "pnl": "+1.02%", "price": 44100, "unrealized_pnl": 190.0,
            "stop_trailed": 43700,
        })
        add("feature_update", 68, "BTC/USDT", {"feature": "ATR-14", "value": 720, "prev": 680, "delta": "+40"})
        add("context_update", 70, "BTC/USDT", {"regime": "BULL", "volatility": "High", "trend_strength": "Very Strong"})
        add("market_data", 75, "BTC/USDT", {"open": 44100, "high": 44300, "low": 44050, "close": 44250, "volume": 19800})
        add("trade_close", 80, "BTC/USDT", {
            "exit": 44200, "pnl": "+1.14%", "profit": 250.0,
            "reason": "Target reached", "bars_held": 48,
            "return_percent": 1.14,
        })
        add("opportunity", 85, "BTC/USDT", {
            "direction": "LONG", "entry": 44250, "stop": 43950, "target": 44800,
            "risk_reward": 1.8, "confidence": 72,
        })
        add("signal", 88, "BTC/USDT", {
            "strategy": "Momentum v2", "score": 72, "direction": "LONG",
            "confidence": 0.76, "indicators": {"ema_trend": "bull", "rsi": 60.1, "volume_ratio": 1.15},
        })
        add("decision", 90, "BTC/USDT", {
            "result": "LONG", "confidence": 0.76, "reason": "Trend intact, retracement entry",
        })
        add("trade_open", 92, "BTC/USDT", {
            "entry": 44250, "size": 0.75, "stop": 43950, "target": 44800,
            "direction": "LONG", "pnl_potential": "+1.24%",
        })
        add("market_data", 95, "BTC/USDT", {"open": 44250, "high": 44400, "low": 44100, "close": 44150, "volume": 16500})
        add("trade_update", 100, "BTC/USDT", {
            "pnl": "-0.23%", "price": 44150, "unrealized_pnl": -75.0,
            "stop_trailed": 43950,
        })
        add("market_data", 105, "BTC/USDT", {"open": 44150, "high": 44200, "low": 43900, "close": 43950, "volume": 22000})
        add("trade_close", 110, "BTC/USDT", {
            "exit": 43950, "pnl": "-0.68%", "profit": -225.0,
            "reason": "Stop loss", "bars_held": 18,
            "return_percent": -0.68,
        })
        add("session_end", 120, "BTC/USDT", {
            "total_trades": 2, "win_rate": "50%", "net_pnl": "+0.46%",
            "sharpe": 1.42, "max_drawdown": "-0.68%",
        })

        return events

    _replay_state: PlaybackState = {
        "session_id": None,
        "status": "stopped",
        "current_step": 0,
        "speed": 1.0,
        "events": [],
    }

    @app.get("/api/v1/replay/sessions")
    async def list_replay_sessions():
        return _replay_sessions

    @app.post("/api/v1/replay/load")
    async def load_replay_session(body: dict[str, Any]):
        session_id = body.get("session_id", "btc-2024-q1")
        _replay_state["session_id"] = session_id
        _replay_state["status"] = "paused"
        _replay_state["current_step"] = 0
        _replay_state["events"] = _gen_replay_events(session_id)
        return {
            "session_id": session_id,
            "status": "paused",
            "total_events": len(_replay_state["events"]),
        }

    @app.get("/api/v1/replay/events/{session_id}")
    async def get_replay_events(session_id: str):
        return _gen_replay_events(session_id)

    @app.get("/api/v1/replay/state")
    async def get_replay_state():
        return _replay_state

    @app.post("/api/v1/replay/control")
    async def control_replay(body: dict[str, Any]):
        action = body.get("action", "pause")
        if action == "play":
            _replay_state["status"] = "playing"
        elif action == "pause":
            _replay_state["status"] = "paused"
        elif action == "stop":
            _replay_state["status"] = "stopped"
            _replay_state["current_step"] = 0
        elif action == "seek":
            _replay_state["current_step"] = body.get("step", 0)
            _replay_state["status"] = "paused"
        elif action == "speed":
            _replay_state["speed"] = body.get("speed", 1.0)
        return _replay_state

    @app.get("/api/v1/replay/event/{step}")
    async def get_replay_event(step: int, session: str = "btc-2024-q1"):
        events = _replay_state.get("events") or _gen_replay_events(session)
        for evt in events:
            if evt["step"] == step:
                return evt
        return {"error": "event not found"}

    # ── Strategies ─────────────────────────────────────────────────

    # Mock strategy data
    _strategies = [
        {
            "id": "momentum-v2",
            "name": "Momentum v2",
            "symbol": "BTC/USDT",
            "status": "running",
            "type": "Momentum",
            "timeframe": "1h",
            "version": "2.3.1",
            "metrics": {
                "pnl": 12450.75,
                "pnl_percent": 24.8,
                "win_rate": 62.5,
                "profit_factor": 2.14,
                "sharpe": 1.87,
                "max_drawdown": -8.3,
                "total_trades": 248,
                "avg_trade": 50.20,
                "avg_win": 185.40,
                "avg_loss": -98.60,
                "expectancy": 0.42,
            },
            "open_positions": [
                {"symbol": "BTC/USDT", "direction": "LONG", "entry": 65420, "current": 66100, "pnl": 680, "pnl_percent": 1.04, "size": 0.1, "stop": 64800, "target": 67200, "duration": "2h 15m"},
                {"symbol": "ETH/USDT", "direction": "SHORT", "entry": 3450, "current": 3380, "pnl": 70, "pnl_percent": 2.03, "size": 1.0, "stop": 3520, "target": 3300, "duration": "1h 30m"},
            ],
            "recent_trades": [
                {"id": "t-001", "symbol": "SOL/USDT", "direction": "LONG", "entry": 145.20, "exit": 152.80, "pnl": 380, "pnl_percent": 5.24, "closed_at": "2026-07-14T12:30:00Z", "reason": "take_profit"},
                {"id": "t-002", "symbol": "BTC/USDT", "direction": "SHORT", "entry": 65800, "exit": 65100, "pnl": 700, "pnl_percent": 1.06, "closed_at": "2026-07-14T11:45:00Z", "reason": "take_profit"},
                {"id": "t-003", "symbol": "ETH/USDT", "direction": "LONG", "entry": 3420, "exit": 3360, "pnl": -60, "pnl_percent": -1.75, "closed_at": "2026-07-14T10:20:00Z", "reason": "stop_loss"},
                {"id": "t-004", "symbol": "AVAX/USDT", "direction": "LONG", "entry": 28.50, "exit": 30.20, "pnl": 170, "pnl_percent": 5.96, "closed_at": "2026-07-14T09:15:00Z", "reason": "take_profit"},
                {"id": "t-005", "symbol": "BTC/USDT", "direction": "LONG", "entry": 64500, "exit": 64200, "pnl": -300, "pnl_percent": -0.47, "closed_at": "2026-07-14T08:00:00Z", "reason": "stop_loss"},
            ],
            "equity_curve": [{"date": "2026-07-07", "value": 10000}, {"date": "2026-07-08", "value": 10230}, {"date": "2026-07-09", "value": 10150}, {"date": "2026-07-10", "value": 10480}, {"date": "2026-07-11", "value": 10620}, {"date": "2026-07-12", "value": 10890}, {"date": "2026-07-13", "value": 11240}, {"date": "2026-07-14", "value": 12450}],
        },
        {
            "id": "mean-reversion",
            "name": "MeanReversion",
            "symbol": "ETH/USDT",
            "status": "paused",
            "type": "Mean Reversion",
            "timeframe": "15m",
            "version": "1.8.2",
            "metrics": {
                "pnl": 4560.30,
                "pnl_percent": 9.1,
                "win_rate": 55.2,
                "profit_factor": 1.48,
                "sharpe": 1.12,
                "max_drawdown": -5.7,
                "total_trades": 412,
                "avg_trade": 11.07,
                "avg_win": 85.20,
                "avg_loss": -45.80,
                "expectancy": 0.31,
            },
            "open_positions": [],
            "recent_trades": [
                {"id": "t-101", "symbol": "ETH/USDT", "direction": "LONG", "entry": 3350, "exit": 3420, "pnl": 70, "pnl_percent": 2.09, "closed_at": "2026-07-14T10:00:00Z", "reason": "take_profit"},
                {"id": "t-102", "symbol": "LINK/USDT", "direction": "LONG", "entry": 14.20, "exit": 14.80, "pnl": 60, "pnl_percent": 4.23, "closed_at": "2026-07-14T08:30:00Z", "reason": "take_profit"},
            ],
            "equity_curve": [{"date": "2026-07-07", "value": 10000}, {"date": "2026-07-08", "value": 9850}, {"date": "2026-07-09", "value": 10120}, {"date": "2026-07-10", "value": 10300}, {"date": "2026-07-11", "value": 10240}, {"date": "2026-07-12", "value": 10560}, {"date": "2026-07-13", "value": 10780}, {"date": "2026-07-14", "value": 10910}],
        },
        {
            "id": "trend-following",
            "name": "TrendFollowing",
            "symbol": "SOL/USDT",
            "status": "running",
            "type": "Trend Following",
            "timeframe": "4h",
            "version": "1.0.0",
            "metrics": {
                "pnl": 8720.50,
                "pnl_percent": 17.4,
                "win_rate": 48.3,
                "profit_factor": 2.87,
                "sharpe": 1.54,
                "max_drawdown": -12.1,
                "total_trades": 89,
                "avg_trade": 97.98,
                "avg_win": 385.00,
                "avg_loss": -155.00,
                "expectancy": 0.68,
            },
            "open_positions": [
                {"symbol": "SOL/USDT", "direction": "LONG", "entry": 152.00, "current": 158.50, "pnl": 650, "pnl_percent": 4.28, "size": 10, "stop": 146.00, "target": 170.00, "duration": "6h 40m"},
            ],
            "recent_trades": [
                {"id": "t-201", "symbol": "SOL/USDT", "direction": "LONG", "entry": 140.00, "exit": 155.00, "pnl": 1500, "pnl_percent": 10.71, "closed_at": "2026-07-13T16:00:00Z", "reason": "take_profit"},
                {"id": "t-202", "symbol": "ADA/USDT", "direction": "LONG", "entry": 0.45, "exit": 0.43, "pnl": -200, "pnl_percent": -4.44, "closed_at": "2026-07-13T08:00:00Z", "reason": "stop_loss"},
            ],
            "equity_curve": [{"date": "2026-07-07", "value": 10000}, {"date": "2026-07-08", "value": 10450}, {"date": "2026-07-09", "value": 10200}, {"date": "2026-07-10", "value": 10800}, {"date": "2026-07-11", "value": 11200}, {"date": "2026-07-12", "value": 11500}, {"date": "2026-07-13", "value": 12100}, {"date": "2026-07-14", "value": 12850}],
        },
    ]

    @app.get("/api/v1/strategies")
    async def list_strategies():
        """Return summary list of all strategies."""
        return [
            {
                "id": s["id"],
                "name": s["name"],
                "symbol": s["symbol"],
                "status": s["status"],
                "type": s["type"],
                "timeframe": s["timeframe"],
                "metrics": {
                    "pnl": s["metrics"]["pnl"],
                    "pnl_percent": s["metrics"]["pnl_percent"],
                    "win_rate": s["metrics"]["win_rate"],
                    "profit_factor": s["metrics"]["profit_factor"],
                    "sharpe": s["metrics"]["sharpe"],
                    "max_drawdown": s["metrics"]["max_drawdown"],
                    "total_trades": s["metrics"]["total_trades"],
                },
            }
            for s in _strategies
        ]

    @app.get("/api/v1/strategies/{strategy_id}")
    async def get_strategy(strategy_id: str):
        """Return full strategy detail with open positions and recent trades."""
        for s in _strategies:
            if s["id"] == strategy_id:
                return s
        return {"error": "strategy not found"}

    @app.get("/api/v1/strategies/{strategy_id}/metrics")
    async def get_strategy_metrics(strategy_id: str):
        """Return equity curve for charting."""
        for s in _strategies:
            if s["id"] == strategy_id:
                return {"equity_curve": s["equity_curve"], "metrics": s["metrics"]}
        return {"error": "strategy not found"}

    @app.post("/api/v1/strategies/{strategy_id}/control")
    async def control_strategy(strategy_id: str, body: dict[str, Any] = {}):
        """Start / stop / pause a strategy."""
        action = body.get("action", "toggle")
        for s in _strategies:
            if s["id"] == strategy_id:
                if action == "start":
                    s["status"] = "running"
                elif action == "stop":
                    s["status"] = "stopped"
                elif action == "pause":
                    s["status"] = "paused"
                else:
                    s["status"] = "running" if s["status"] != "running" else "paused"
                return {"id": strategy_id, "status": s["status"]}
        return {"error": "strategy not found"}

    # ── WebSocket ──────────────────────────────────────────────────

    @app.websocket("/ws/scanner")
    async def ws_scanner(websocket: WebSocket):
        await ws_manager.connect(websocket)

        async def periodic_push():
            try:
                while True:
                    await asyncio.sleep(5)
                    await websocket.send_json({
                        "type": "scanner_update",
                        "data": _gen_scanner_items(),
                    })
            except Exception:
                pass

        task = asyncio.create_task(periodic_push())

        try:
            # Push initial data
            await websocket.send_json({
                "type": "scanner_update",
                "data": _gen_scanner_items(),
            })
            # Wait for messages
            while True:
                msg = await websocket.receive_text()
                if msg == "ping":
                    await websocket.send_json({"type": "pong"})
        except WebSocketDisconnect:
            pass
        except Exception:
            pass
        finally:
            task.cancel()
            ws_manager.disconnect(websocket)

    @app.websocket("/ws/opportunities")
    async def ws_opportunities(websocket: WebSocket):
        await ws_manager.connect(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            ws_manager.disconnect(websocket)

    @app.websocket("/ws/strategies")
    async def ws_strategies(websocket: WebSocket):
        await ws_manager.connect(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            ws_manager.disconnect(websocket)

    # ── Plugin Store ───────────────────────────────────────────────

    # Lazy-init marketplace API
    marketplace_api = None

    def _get_marketplace():
        nonlocal marketplace_api
        if marketplace_api is None:
            from marketplace.store import create_marketplace_api
            marketplace_api = create_marketplace_api()
        return marketplace_api

    @app.get("/api/v1/plugins")
    async def list_plugins(category: str = "", search: str = "", trust: str = ""):
        api = _get_marketplace()
        if category:
            pkgs = api['get_by_category'](category)
        else:
            pkgs = api['get_trending'](100)

        # Filter by search
        if search:
            q = search.lower()
            pkgs = [p for p in pkgs if q in p['name'].lower() or q in p['display_name'].lower() or q in p['description'].lower()]

        # Filter by trust level
        if trust:
            pkgs = [p for p in pkgs if p.get('trust_level') == trust]

        return pkgs

    @app.get("/api/v1/plugins/categories")
    async def get_plugin_categories():
        api = _get_marketplace()
        return api['get_all_categories']()

    @app.get("/api/v1/plugins/updates")
    async def get_plugin_updates():
        """Check for available updates on installed packages."""
        api = _get_marketplace()
        installed = api['list_installed']()
        updates = []
        for item in installed:
            name = item['name']
            detail = api['get_package_detail'](name)
            if isinstance(detail, dict) and detail.get('error'):
                continue
            installed_ver = item.get('version', '')
            latest = detail.get('latest_version', '')
            if installed_ver and latest and installed_ver != latest:
                updates.append({
                    'name': name,
                    'display_name': detail.get('display_name', name),
                    'installed_version': installed_ver,
                    'latest_version': latest,
                    'icon': detail.get('icon', '🧩'),
                    'trust_level': detail.get('trust_level', 'community'),
                })
        return updates

    @app.get("/api/v1/plugins/{plugin_id}")
    async def get_plugin(plugin_id: str):
        api = _get_marketplace()
        return api['get_package_detail'](plugin_id)

    @app.post("/api/v1/plugins/install")
    async def install_plugin(body: dict[str, Any] = {}):
        api = _get_marketplace()
        name = body.get('name', '')
        version = body.get('version')
        if not name:
            return {"error": "name required"}
        return api['install_package'](name, version)

    @app.post("/api/v1/plugins/remove")
    async def remove_plugin(body: dict[str, Any] = {}):
        api = _get_marketplace()
        name = body.get('name', '')
        if not name:
            return {"error": "name required"}
        return api['remove_package'](name)

    @app.post("/api/v1/plugins/update")
    async def update_plugin(body: dict[str, Any] = {}):
        """Update a plugin to latest version."""
        api = _get_marketplace()
        name = body.get('name', '')
        if not name:
            return {"error": "name required"}
        detail = api['get_package_detail'](name)
        if isinstance(detail, dict) and detail.get('error'):
            return detail
        return api['install_package'](name, detail.get('latest_version'))

    @app.post("/api/v1/plugins/enable")
    async def enable_plugin(body: dict[str, Any] = {}):
        return {"status": "enabled", "name": body.get('name', '')}

    @app.post("/api/v1/plugins/disable")
    async def disable_plugin(body: dict[str, Any] = {}):
        return {"status": "disabled", "name": body.get('name', '')}

    # ── ML Workbench ──────────────────────────────────────────────

    ml_api = None

    def _get_ml():
        nonlocal ml_api
        if ml_api is None:
            from ml.service import create_ml_api
            ml_api = create_ml_api()
        return ml_api

    @app.get("/api/v1/ml/models")
    async def list_ml_models():
        return _get_ml()['list_models']()

    @app.get("/api/v1/ml/models/{model_id}")
    async def get_ml_model(model_id: str):
        return _get_ml()['get_model'](model_id)

    @app.post("/api/v1/ml/train")
    async def start_training(body: dict[str, Any] = {}):
        return _get_ml()['start_training'](body)

    @app.get("/api/v1/ml/train/{model_id}")
    async def get_training_run(model_id: str):
        return _get_ml()['get_training_run'](model_id)

    @app.post("/api/v1/ml/evaluate")
    async def evaluate_model(body: dict[str, Any] = {}):
        return _get_ml()['evaluate_model'](body)

    @app.post("/api/v1/ml/promote")
    async def promote_model(body: dict[str, Any] = {}):
        return _get_ml()['promote_model'](body)

    @app.get("/api/v1/ml/experiments")
    async def list_experiments():
        return _get_ml()['list_experiments']()

    @app.get("/api/v1/ml/experiments/{experiment_id}")
    async def get_experiment(experiment_id: str):
        return _get_ml()['get_experiment'](experiment_id)

    @app.get("/api/v1/ml/metrics/{model_id}")
    async def get_ml_metrics(model_id: str):
        return _get_ml()['get_metrics'](model_id)

    # ── System Monitor ─────────────────────────────────────────────

    @app.get("/api/v1/system/overview")
    async def system_overview():
        from workspace.system.service import create_system_api
        return create_system_api()

    @app.get("/api/v1/system/services")
    async def system_services():
        from workspace.system.service import get_system_services
        return get_system_services()

    @app.get("/api/v1/system/resources")
    async def system_resources():
        from workspace.system.service import get_system_resources
        return get_system_resources()

    @app.get("/api/v1/system/events")
    async def system_events():
        from workspace.system.service import get_system_events
        return get_system_events()

    @app.get("/api/v1/system/websockets")
    async def system_websockets():
        from workspace.system.service import get_system_websockets
        return get_system_websockets()

    @app.get("/api/v1/system/plugins")
    async def system_plugins():
        from workspace.system.service import get_system_plugins
        return get_system_plugins()

    @app.get("/api/v1/system/timeline")
    async def system_timeline():
        from workspace.system.service import get_system_timeline
        return get_system_timeline()

    @app.get("/api/v1/system/alerts")
    async def system_alerts():
        from workspace.system.service import get_system_alerts
        return get_system_alerts()

    @app.get("/api/v1/system/health")
    async def system_health():
        from workspace.system.service import get_system_health
        return get_system_health()

    return app


app = create_app()
