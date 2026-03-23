const ScraperClient = require('./scraper-client');
const SalesModel = require('./sales-model');
require('dotenv').config();

// Initialize components
let scraper;
let model;

try {
    scraper = new ScraperClient();
    model = new SalesModel();
    console.error('[OK] Initialized: Scraper and Sales Model');
} catch (error) {
    console.error('[ERROR] Initialization failed:', error.message);
    process.exit(1);
}

/**
 * Handle tool query
 */
async function handleQuery(params) {
    const { asin, category } = params;
    
    if (!asin) {
        return {
            error: true,
            message: 'ASIN parameter is required',
            example: { asin: '059035342X' }
        };
    }
    
    const asinPattern = /^[A-Z0-9]{10}$/;
    if (!asinPattern.test(asin.toUpperCase())) {
        return {
            error: true,
            message: 'Invalid ASIN format. Must be 10 alphanumeric characters.',
            provided: asin
        };
    }
    
    try {
        console.error(`[INFO] Processing ASIN: ${asin}`);
        
        const productData = await scraper.scrapeProduct(asin);
        const estimate = model.estimate(productData.bsr, category || productData.category);
        
        const result = {
            asin: productData.asin,
            title: productData.title,
            bsr: productData.bsr,
            estimatedMonthlySales: estimate.estimatedMonthlySales,
            confidence: estimate.confidence,
            category: estimate.category,
            formula: estimate.formula,
            lastUpdated: productData.lastUpdate,
            timestamp: new Date().toISOString()
        };
        
        console.error(`[OK] Success: ${asin} -> ${result.estimatedMonthlySales.toLocaleString()} sales/month`);
        
        return result;
        
    } catch (error) {
        console.error(`[ERROR] Error for ${asin}:`, error.message);
        return {
            error: true,
            asin,
            message: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// ============================================
// MCP Server Setup - Full Protocol Support
// ============================================

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        tool: 'amazon-bsr-tool',
        version: '1.0.0',
        dataPoints: model.getStats().dataPoints
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        tool: 'amazon-bsr-tool',
        version: '1.0.0',
        endpoints: ['/health', '/mcp'],
        instructions: 'POST JSON-RPC requests to /mcp'
    });
});

// MCP endpoint - handles all JSON-RPC methods
app.post('/mcp', async (req, res) => {
    const { method, params, id } = req.body;
    
    console.error(`[MCP] Received method: ${method}`);
    
    // Handle initialize (handshake method)
    if (method === 'initialize') {
        const result = {
            protocolVersion: '0.1.0',
            serverInfo: {
                name: 'amazon-bsr-tool',
                version: '1.0.0'
            },
            capabilities: {
                tools: {}
            }
        };
        return res.json({ jsonrpc: '2.0', id, result });
    }
    
    // Handle initialized notification (no response expected)
    if (method === 'initialized') {
        return res.status(204).end();
    }
    
    // Handle tools/list
    if (method === 'tools/list') {
        const result = {
            tools: [
                {
                    name: 'estimate_amazon_sales',
                    description: 'Estimate monthly sales for an Amazon product using BSR (Best Sellers Rank). Returns estimated sales volume and confidence level.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            asin: {
                                type: 'string',
                                description: 'Amazon Standard Identification Number (10-character product ID, e.g., "059035342X")'
                            },
                            category: {
                                type: 'string',
                                description: 'Optional category name for better accuracy (e.g., "Books", "Electronics")'
                            }
                        },
                        required: ['asin']
                    }
                },
                {
                    name: 'model_stats',
                    description: 'Get calibration statistics about the sales estimation model',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                }
            ]
        };
        return res.json({ jsonrpc: '2.0', id, result });
    }
    
    // Handle tools/call
    if (method === 'tools/call') {
        const { name, arguments: args } = params;
        
        if (name === 'estimate_amazon_sales') {
            try {
                const result = await handleQuery(args);
                return res.json({
                    jsonrpc: '2.0',
                    id,
                    result: {
                        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
                    }
                });
            } catch (error) {
                return res.json({
                    jsonrpc: '2.0',
                    id,
                    error: { code: -32000, message: error.message }
                });
            }
        } else if (name === 'model_stats') {
            const stats = model.getStats();
            return res.json({
                jsonrpc: '2.0',
                id,
                result: {
                    content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }]
                }
            });
        } else {
            return res.json({
                jsonrpc: '2.0',
                id,
                error: { code: -32601, message: `Tool not found: ${name}` }
            });
        }
    }
    
    // Handle any other method
    return res.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
    });
});

app.listen(port, () => {
    console.error(`[RUNNING] Amazon BSR Tool MCP Server running on port ${port}`);
    console.error(`[MODEL] ${model.getStats().formula}`);
    console.error(`[DATA] Data points: ${model.getStats().dataPoints}`);
    console.error(`[HEALTH] Health check: http://localhost:${port}/health`);
});