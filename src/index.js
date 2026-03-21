const ScraperClient = require('./scraper-client');
const SalesModel = require('./sales-model');
require('dotenv').config();

// Initialize components
let scraper;
let model;

try {
    scraper = new ScraperClient();
    model = new SalesModel();
    console.error('✅ Initialized: Scraper and Sales Model');
} catch (error) {
    console.error('❌ Initialization failed:', error.message);
    process.exit(1);
}

/**
 * Handle tool query
 */
async function handleQuery(params) {
    const { asin, category } = params;
    
    // Input validation
    if (!asin) {
        return {
            error: true,
            message: 'ASIN parameter is required',
            example: { asin: '059035342X' }
        };
    }
    
    // Basic ASIN validation
    const asinPattern = /^[A-Z0-9]{10}$/;
    if (!asinPattern.test(asin.toUpperCase())) {
        return {
            error: true,
            message: 'Invalid ASIN format. Must be 10 alphanumeric characters.',
            provided: asin
        };
    }
    
    try {
        console.error(`📊 Processing ASIN: ${asin}`);
        
        // Scrape current BSR
        const productData = await scraper.scrapeProduct(asin);
        
        // Estimate sales
        const estimate = model.estimate(productData.bsr, category || productData.category);
        
        // Combine results
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
        
        console.error(`✅ Success: ${asin} → ${result.estimatedMonthlySales.toLocaleString()} sales/month`);
        
        return result;
        
    } catch (error) {
        console.error(`❌ Error for ${asin}:`, error.message);
        return {
            error: true,
            asin,
            message: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// ============================================
// MCP Server Setup - CORRECTED VERSION
// ============================================

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// Create server instance
const server = new Server(
    {
        name: 'amazon-bsr-tool',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
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
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    switch (name) {
        case 'estimate_amazon_sales': {
            const result = await handleQuery(args);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
            
        case 'model_stats': {
            const stats = model.getStats();
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(stats, null, 2)
                }]
            };
        }
            
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
});

// Start server
async function start() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('🚀 Amazon BSR Tool MCP Server running');
    console.error(`📊 Model: ${model.getStats().formula}`);
    console.error(`📈 Data points: ${model.getStats().dataPoints}`);
}

start().catch(console.error);