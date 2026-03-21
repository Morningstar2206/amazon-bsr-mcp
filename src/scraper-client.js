const axios = require('axios');
require('dotenv').config();

class ScraperClient {
    constructor() {
        // Load API key from environment variable (secure)
        this.apiKey = process.env.SCRAPERAPI_KEY;
        
        if (!this.apiKey) {
            throw new Error('SCRAPERAPI_KEY not found in environment variables');
        }
        
        this.baseUrl = 'http://api.scraperapi.com';
    }

    /**
     * Scrape Amazon product page and extract BSR
     * @param {string} asin - Amazon Standard Identification Number
     * @returns {Promise<Object>} Product data with BSR
     */
    async scrapeProduct(asin) {
        // Validate input
        if (!asin || asin.length < 10) {
            throw new Error('Invalid ASIN format');
        }
        
        const url = `https://www.amazon.com/dp/${asin}`;
        const apiUrl = `${this.baseUrl}?api_key=${this.apiKey}&url=${url}&render=true&timeout=20000`;
        
        try {
            const response = await axios.get(apiUrl, { 
                timeout: 25000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; AmazonBSRTool/1.0)'
                }
            });
            
            const html = response.data;
            
            // Extract BSR using regex (proven method)
            const bsrMatch = html.match(/Best Sellers Rank[^\d]*#?([\d,]+)/);
            const bsr = bsrMatch ? parseInt(bsrMatch[1].replace(/,/g, '')) : null;
            
            // Extract title
            const titleMatch = html.match(/<span id="productTitle"[^>]*>([^<]+)</);
            const title = titleMatch ? titleMatch[1].trim() : null;
            
            // Extract category
            const categoryMatch = html.match(/<a class="a-link-normal a-color-tertiary"[^>]*>([^<]+)</);
            const category = categoryMatch ? categoryMatch[1].trim() : null;
            
            if (!bsr) {
                throw new Error(`No BSR found for ASIN: ${asin}`);
            }
            
            return {
                asin: asin.toUpperCase(),
                bsr,
                title: title || 'Title not found',
                category: category || 'Unknown',
                lastUpdate: new Date().toISOString(),
                success: true
            };
            
        } catch (error) {
            console.error(`Scraper error for ${asin}:`, error.message);
            throw new Error(`Failed to fetch ASIN ${asin}: ${error.message}`);
        }
    }

    /**
     * Scrape multiple ASINs with rate limiting
     * @param {string[]} asins - Array of ASINs
     * @returns {Promise<Array>} Results for each ASIN
     */
    async scrapeMultiple(asins) {
        const results = [];
        for (const asin of asins) {
            try {
                const data = await this.scrapeProduct(asin);
                results.push(data);
                // Delay to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                results.push({ asin, error: error.message, success: false });
            }
        }
        return results;
    }
}

module.exports = ScraperClient;