import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MasterLedgerEngine } from './ledgerEngine.ts';
import { IdempotencyGuard } from './idempotencyGuard.ts';
import { verifyShopifyHmac, verifyWooCommerceHmac } from '../shared/hmac.ts';
import { EcommerceOperationsOrchestrator } from '../workflows/orchestrator.ts';
import type { CloudEvent, NormalizedOrder, PlatformType, WarehouseLocation } from '../shared/types.ts';

export interface ServerOptions {
  port?: number;
  orchestrator?: EcommerceOperationsOrchestrator;
  frontendDir?: string;
}

export class EcommerceApiServer {
  public server: http.Server;
  public orchestrator: EcommerceOperationsOrchestrator;
  public port: number;
  public frontendDir: string;
  private sseClients: Set<http.ServerResponse> = new Set();

  constructor(options: ServerOptions = {}) {
    this.orchestrator = options.orchestrator || new EcommerceOperationsOrchestrator();
    this.port = options.port ?? 3000;
    this.frontendDir = options.frontendDir || path.resolve(process.cwd(), 'src/frontend');

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

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Shopify-Hmac-Sha256, X-WC-Webhook-Signature, X-Shopify-Webhook-Id, X-WC-Webhook-ID, X-Event-Id');

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
        const body = await parseJsonBody(req);
        const { masterSku, quantityDelta, reason, referenceId, preferredLocation } = body;

        if (!masterSku || typeof quantityDelta !== 'number') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'masterSku and numeric quantityDelta are required' }));
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
        const body = await parseJsonBody(req);
        const { masterSku, fromLocation, toLocation, quantity } = body;

        if (!masterSku || !fromLocation || !toLocation || !quantity) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'masterSku, fromLocation, toLocation, and quantity are required' }));
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

        const payload = JSON.parse(rawBody.toString('utf8'));
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

        const payload = JSON.parse(rawBody.toString('utf8'));
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
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
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

function readRawBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  const raw = await readRawBody(req);
  if (!raw.length) return {};
  return JSON.parse(raw.toString('utf8'));
}
