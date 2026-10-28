import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MasterLedgerEngine } from './ledgerEngine.ts';
import { IdempotencyGuard } from './idempotencyGuard.ts';
import { safeCompare, verifyShopifyHmac, verifyWooCommerceHmac } from '../shared/hmac.ts';
import { EcommerceOperationsOrchestrator } from '../workflows/orchestrator.ts';
import {
  MANUAL_ADJUSTMENT_REASONS,
  MAX_STOCK_CHANGE,
  WAREHOUSE_LOCATIONS,
  isIdentifier,
  isPositiveInt,
  isWarehouseLocation
} from '../shared/validation.ts';
import type { CloudEvent, NormalizedOrder, PlatformType, WarehouseLocation } from '../shared/types.ts';

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

/** An error that maps to a specific HTTP status and a message that is safe to return. */
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface ServerOptions {
  port?: number;
  orchestrator?: EcommerceOperationsOrchestrator;
  frontendDir?: string;
  /** Bearer token required on state-changing API routes. Defaults to OMNISYNC_API_TOKEN. */
  apiToken?: string;
  /** Exact origins allowed to call the API cross-origin. Defaults to ALLOWED_ORIGINS (comma-separated). */
  allowedOrigins?: string[];
}

export class EcommerceApiServer {
  public server: http.Server;
  public orchestrator: EcommerceOperationsOrchestrator;
  public port: number;
  public frontendDir: string;
  private sseClients: Set<http.ServerResponse> = new Set();
  private apiToken: string;
  private allowedOrigins: Set<string>;

  constructor(options: ServerOptions = {}) {
    this.orchestrator = options.orchestrator || new EcommerceOperationsOrchestrator();
    this.port = options.port ?? 3000;
    this.frontendDir = options.frontendDir || path.resolve(process.cwd(), 'src/frontend');
    this.apiToken = options.apiToken ?? process.env.OMNISYNC_API_TOKEN ?? '';
    this.allowedOrigins = new Set(
      (options.allowedOrigins ?? (process.env.ALLOWED_ORIGINS || '').split(','))
        .map((origin: string) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean)
    );

    this.orchestrator.on('cloudEvent', (event: CloudEvent) => {
      const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data || event)}\n\n`;
      for (const client of this.sseClients) {
        client.write(payload);
      }
    });

    this.server = http.createServer((req, res) => this.handleRequest(req, res));
  }

  public start(portOverride?: number): Promise<{ url: string; port: number }> {
    return new Promise((resolve, reject) => {
      const targetPort = portOverride !== undefined ? portOverride : this.port;
      this.server.listen(targetPort, () => {
        const address = this.server.address();
        const actualPort = typeof address === 'object' && address ? address.port : targetPort;
        this.port = actualPort;
        const url = `http://localhost:${actualPort}`;
        resolve({ url, port: actualPort });
      });
      this.server.on('error', reject);
    });
  }

  /**
   * Security settings that are missing. The server still starts, but the affected
   * routes reject every request until the setting is provided (fail closed).
   */
  public getConfigWarnings(): string[] {
    const warnings: string[] = [];
    if (!this.apiToken) {
      warnings.push('OMNISYNC_API_TOKEN is not set: POST /api/v1/inventory/adjust, /api/v1/inventory/transfer and /api/v1/reconciliation/trigger will be rejected with 503.');
    }
    for (const store of this.orchestrator.stores.values()) {
      if (!store.webhookSecret) {
        const envName = store.platform === 'SHOPIFY' ? 'SHOPIFY_WEBHOOK_SECRET' : 'WOO_WEBHOOK_SECRET';
        warnings.push(`${envName} is not set: webhooks for ${store.id} will be rejected with 503.`);
      }
    }
    return warnings;
  }

  /**
   * Looks up the signing secret for a webhook route. Fails closed: an unknown store,
   * a store on another platform, or a store without a secret is rejected before any
   * signature check. Returns null when a response has already been sent.
   */
  private resolveWebhookSecret(storeId: string, platform: PlatformType, res: http.ServerResponse): string | null {
    const store = this.orchestrator.stores.get(storeId);
    if (!store || store.platform !== platform) {
      sendJson(res, 404, { success: false, error: 'Unknown store' });
      return null;
    }
    if (!store.webhookSecret) {
      sendJson(res, 503, { success: false, error: 'Webhook signing secret is not configured for this store' });
      return null;
    }
    return store.webhookSecret;
  }

  /**
   * Bearer-token check for state-changing API routes. Fails closed: with no token
   * configured these routes are disabled (503). Returns false when a response has
   * already been sent.
   */
  private requireApiToken(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    if (!this.apiToken) {
      sendJson(res, 503, { success: false, error: 'This route is disabled: OMNISYNC_API_TOKEN is not configured' });
      return false;
    }
    const match = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.authorization || '');
    if (!match || !safeCompare(match[1], this.apiToken)) {
      sendJson(res, 401, { success: false, error: 'Unauthorized: missing or invalid bearer token' }, { 'WWW-Authenticate': 'Bearer' });
      return false;
    }
    return true;
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      for (const client of this.sseClients) {
        client.end();
      }
      this.sseClients.clear();
      this.server.close(err => (err ? reject(err) : resolve()));
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method || 'GET';

    // CORS: only origins listed in ALLOWED_ORIGINS get cross-origin access. The dashboard
    // is served by this server (same origin) and needs no entry.
    res.setHeader('Vary', 'Origin');
    const origin = req.headers.origin;
    if (origin && this.allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Shopify-Hmac-Sha256, X-WC-Webhook-Signature, X-Shopify-Webhook-Id, X-WC-Webhook-ID, X-Event-Id');
    }

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // 1. Health Check
      if (pathname === '/health' || pathname === '/api/v1/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          version: '1.0.0-PROD',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          storesCount: this.orchestrator.stores.size || 2,
          adaptersCount: this.orchestrator.adapters.size || 2,
          stores: Array.from(this.orchestrator.stores.keys())
        }));
        return;
      }

      // 2. Real-Time SSE Stream
      if (pathname === '/api/v1/events/stream') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        res.write('event: connected\ndata: {"status":"connected"}\n\n');
        this.sseClients.add(res);

        req.on('close', () => {
          this.sseClients.delete(res);
        });
        return;
      }

      // 3. Inventory Query
      if (pathname === '/api/v1/inventory' && method === 'GET') {
        const skuFilter = parsedUrl.searchParams.get('sku');
        const allProducts = this.orchestrator.ledger.getAllProducts();
        const filtered = skuFilter
          ? allProducts.filter(p => p.masterSku.toLowerCase().includes(skuFilter.toLowerCase()) || p.title.toLowerCase().includes(skuFilter.toLowerCase()))
          : allProducts;

        const enriched = filtered.map(p => ({
          ...p,
          mappings: this.orchestrator.getChannelMappings(p.masterSku)
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ total: enriched.length, items: enriched }));
        return;
      }

      // 4. Unified Orders Stream
      if (pathname === '/api/v1/orders' && method === 'GET') {
        const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
        const orders = this.orchestrator.getOrders(limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ total: orders.length, orders }));
        return;
      }

      // 5. Immutable Audit Trail Log
      if (pathname === '/api/v1/audit' && method === 'GET') {
        const sku = parsedUrl.searchParams.get('sku') || undefined;
        const trail = this.orchestrator.ledger.getAuditTrail(sku);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ total: trail.length, auditTrail: trail }));
        return;
      }

      // 6. Manual Inventory Adjustment
      if (pathname === '/api/v1/inventory/adjust' && method === 'POST') {
        if (!this.requireApiToken(req, res)) return;
        const body = await parseJsonBody(req);
        const { masterSku, quantityDelta, reason, referenceId, preferredLocation } = body;

        if (!isIdentifier(masterSku) || !Number.isInteger(quantityDelta) || quantityDelta === 0 || Math.abs(quantityDelta) > MAX_STOCK_CHANGE) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: `masterSku and a non-zero integer quantityDelta (at most ${MAX_STOCK_CHANGE} either way) are required` }));
          return;
        }
        if (
          !MANUAL_ADJUSTMENT_REASONS.includes(reason || 'MANUAL_ADJUSTMENT') ||
          (preferredLocation && !isWarehouseLocation(preferredLocation)) ||
          (referenceId && !isIdentifier(referenceId))
        ) {
          sendJson(res, 400, {
            success: false,
            error: `reason must be one of ${MANUAL_ADJUSTMENT_REASONS.join(', ')}; preferredLocation one of ${WAREHOUSE_LOCATIONS.join(', ')}; referenceId at most 128 characters`
          });
          return;
        }

        const result = await this.orchestrator.ledger.applyDelta(
          masterSku,
          quantityDelta,
          reason || 'MANUAL_ADJUSTMENT',
          undefined,
          referenceId,
          preferredLocation || 'MAIN_US_3PL'
        );

        if (!result.success) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: result.error }));
          return;
        }

        await this.orchestrator.broadcastInventoryUpdate(masterSku, result.newStock);
        this.orchestrator.emitCloudEvent('com.ecom.inventory.adjusted', {
          masterSku,
          quantityDelta,
          resultingStock: result.newStock,
          reason: reason || 'MANUAL_ADJUSTMENT'
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, masterSku, newStock: result.newStock, entry: result.entry }));
        return;
      }

      // 7. Warehouse Location Stock Transfer
      if (pathname === '/api/v1/inventory/transfer' && method === 'POST') {
        if (!this.requireApiToken(req, res)) return;
        const body = await parseJsonBody(req);
        const { masterSku, fromLocation, toLocation, quantity } = body;

        if (
          !isIdentifier(masterSku) ||
          !isWarehouseLocation(fromLocation) ||
          !isWarehouseLocation(toLocation) ||
          fromLocation === toLocation ||
          !isPositiveInt(quantity, MAX_STOCK_CHANGE)
        ) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: `masterSku, two different locations (${WAREHOUSE_LOCATIONS.join(', ')}) and an integer quantity from 1 to ${MAX_STOCK_CHANGE} are required`
          }));
          return;
        }

        const xferResult = await this.orchestrator.ledger.transferWarehouseStock(
          masterSku,
          fromLocation as WarehouseLocation,
          toLocation as WarehouseLocation,
          quantity
        );

        if (!xferResult.success) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: xferResult.error }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Transferred ${quantity} units from ${fromLocation} to ${toLocation}` }));
        return;
      }

      // 8. Drift Reconciliation Trigger
      if (pathname === '/api/v1/reconciliation/trigger' && method === 'POST') {
        if (!this.requireApiToken(req, res)) return;
        const auditResult = await this.orchestrator.runDriftAudit();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...auditResult }));
        return;
      }

      // 9. Circuit Breakers Status
      if (pathname === '/api/v1/circuit-breakers' && method === 'GET') {
        const breakerStatuses: Record<string, string> = {};
        for (const [storeId, breaker] of this.orchestrator.circuitBreakers.entries()) {
          breakerStatuses[storeId] = breaker.getState();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ circuitBreakers: breakerStatuses }));
        return;
      }

      // 10. Shopify Webhook Ingest
      if (pathname.startsWith('/api/v1/webhooks/shopify') && method === 'POST') {
        const storeId = pathname.split('/').pop() || '';
        const secret = this.resolveWebhookSecret(storeId, 'SHOPIFY', res);
        if (secret === null) return;

        const rawBody = await readRawBody(req);
        const sig = (req.headers['x-shopify-hmac-sha256'] as string) || '';

        if (!verifyShopifyHmac(rawBody, sig, secret)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid Shopify HMAC signature' }));
          return;
        }

        const payload = parseJsonObject(rawBody);
        const eventId = (req.headers['x-shopify-webhook-id'] as string) || `sh_evt_${payload.id || Date.now()}`;

        const outcome = await this.orchestrator.handleInboundOrder(payload, storeId, eventId);
        res.writeHead(outcome.success === false ? 400 : 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: outcome.success ? 'acknowledged' : 'rejected',
          orderId: String(payload.id || outcome.orderId),
          ...outcome
        }));
        return;
      }

      // 11. WooCommerce Webhook Ingest
      if (pathname.startsWith('/api/v1/webhooks/woocommerce') && method === 'POST') {
        const storeId = pathname.split('/').pop() || '';
        const secret = this.resolveWebhookSecret(storeId, 'WOOCOMMERCE', res);
        if (secret === null) return;

        const rawBody = await readRawBody(req);
        const sig = (req.headers['x-wc-webhook-signature'] as string) || '';

        if (!verifyWooCommerceHmac(rawBody, sig, secret)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid WooCommerce HMAC signature' }));
          return;
        }

        const payload = parseJsonObject(rawBody);
        const eventId = (req.headers['x-wc-webhook-id'] as string) || `wc_evt_${payload.id || Date.now()}`;

        const outcome = await this.orchestrator.handleInboundOrder(payload, storeId, eventId);
        res.writeHead(outcome.success === false ? 400 : 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: outcome.success ? 'acknowledged' : 'rejected',
          orderId: String(payload.id || payload.number || outcome.orderId),
          ...outcome
        }));
        return;
      }

      // 12. Static File Serving
      if (method === 'GET' || method === 'HEAD') {
        let filePath = path.join(this.frontendDir, pathname === '/' ? 'index.html' : pathname);
        filePath = path.normalize(filePath);

        if (!filePath.startsWith(this.frontendDir)) {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('Forbidden');
          return;
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.svg': 'image/svg+xml'
          };
          res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
          if (method === 'HEAD') {
            res.end();
          } else {
            fs.createReadStream(filePath).pipe(res);
          }
          return;
        }
      }

      // 404 Fallback
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found', path: pathname }));
    } catch (err: any) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (err instanceof HttpError) {
        sendJson(res, err.status, { success: false, error: err.message });
        return;
      }
      // Log details server-side only; never echo internal error messages to clients.
      console.error('Unhandled request error:', err);
      sendJson(res, 500, { error: 'Internal Server Error' });
    }
  }
}

export function createEcommerceServer(options: ServerOptions = {}): EcommerceApiServer {
  return new EcommerceApiServer(options);
}

function sendJson(res: http.ServerResponse, status: number, body: unknown, headers: http.OutgoingHttpHeaders = {}): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

function readRawBody(req: http.IncomingMessage, limit: number = MAX_BODY_BYTES): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tooLarge = () => {
      req.removeAllListeners('data');
      req.resume(); // drain and discard the rest
      reject(new HttpError(413, `Request body exceeds ${limit} bytes`));
    };
    if (Number(req.headers['content-length']) > limit) {
      tooLarge();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', chunk => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buf.length;
      if (size > limit) {
        tooLarge();
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseJsonObject(raw: Buffer): any {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }
  return parsed;
}

async function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  const raw = await readRawBody(req);
  if (!raw.length) return {};
  return parseJsonObject(raw);
}
