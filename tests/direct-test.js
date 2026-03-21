// Direct test - bypasses MCP, calls the tool function directly
require('dotenv').config();

const ScraperClient = require('../src/scraper-client');
const SalesModel = require('../src/sales-model');

async function directTest() {
    console.log('🧪 DIRECT TEST - Amazon BSR Tool\n');
    console.log('=' .repeat(60));
    
    const scraper = new ScraperClient();
    const model = new SalesModel();
    
    // Test ASINs that worked before
    const testAsins = [
        '059035342X',  // Harry Potter
        '0451526538',  // Tom Sawyer
        'B002QYW8LW',  // Baby Toothbrush
        'B07RHMTWZG',  // Laundry Bag
        'B00I5H5Z1O'   // Echo Dot
    ];
    
    console.log(`Testing ${testAsins.length} ASINs...\n`);
    
    for (const asin of testAsins) {
        console.log(`📦 ASIN: ${asin}`);
        console.log('-'.repeat(40));
        
        try {
            // Fetch BSR
            const productData = await scraper.scrapeProduct(asin);
            console.log(`   ✅ BSR: ${productData.bsr.toLocaleString()}`);
            console.log(`   📝 Title: ${productData.title.substring(0, 60)}...`);
            
            // Estimate sales
            const estimate = model.estimate(productData.bsr, productData.category);
            console.log(`   💰 Estimated Monthly Sales: ${estimate.estimatedMonthlySales.toLocaleString()}`);
            console.log(`   🎯 Confidence: ${estimate.confidence}`);
            console.log(`   📐 Formula: ${estimate.formula}`);
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
        
        console.log('');
        
        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('=' .repeat(60));
    console.log('✅ Test complete');
    
    // Show model stats
    const stats = model.getStats();
    console.log(`\n📊 Model Stats:`);
    console.log(`   Data points: ${stats.dataPoints}`);
    console.log(`   Formula: ${stats.formula}`);
}

// Run the test
directTest().catch(console.error);