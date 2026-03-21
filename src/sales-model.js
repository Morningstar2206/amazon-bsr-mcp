const fs = require('fs');
const path = require('path');

class SalesModel {
    constructor() {
        // Calibrated from your 12 data points
        this.baseA = 1000000;  // 1,000,000
        this.baseB = 0.7;      // Power law exponent
        
        // Category multipliers (derived from your calibration)
        this.categoryMultipliers = {
            'Books': 0.8,
            'Electronics': 0.6,
            'Home & Kitchen': 1.0,
            'Baby Products': 1.2,
            'Sports & Outdoors': 0.8,
            'Health & Household': 0.9,
            'Beauty & Personal Care': 0.7,
            'Toys & Games': 1.1,
            'Tools & Home Improvement': 0.5,
            'Clothing': 0.4
        };
        
        // Data file path for expanding calibration
        this.dataFilePath = path.join(__dirname, '../data/calibration-data.csv');
        this.ensureDataFile();
    }

    ensureDataFile() {
        if (!fs.existsSync(this.dataFilePath)) {
            const header = 'ASIN,BSR,Category,ActualSales,VerificationMethod,SellerSource,DateAdded\n';
            fs.writeFileSync(this.dataFilePath, header);
        }
    }

    /**
     * Estimate monthly sales from BSR
     * @param {number} bsr - Best Sellers Rank
     * @param {string} category - Product category (optional)
     * @returns {Object} Sales estimate
     */
    estimate(bsr, category = null) {
        // Validate inputs
        if (!bsr || bsr <= 0) {
            throw new Error('Invalid BSR value');
        }
        
        // Get multiplier
        const multiplier = category && this.categoryMultipliers[category] 
            ? this.categoryMultipliers[category] 
            : 1.0;
        
        // Base sales = A / (BSR ^ B)
        const baseSales = this.baseA / Math.pow(bsr, this.baseB);
        const estimated = Math.round(baseSales * multiplier);
        
        // Determine confidence based on BSR
        let confidence = 'low';
        if (bsr <= 10000) {
            confidence = 'high';
        } else if (bsr <= 100000) {
            confidence = 'medium';
        }
        
        // Business logic: reasonable bounds
        const finalEstimate = Math.max(1, Math.min(estimated, 500000));
        
        return {
            bsr,
            category: category || 'Unknown',
            estimatedMonthlySales: finalEstimate,
            confidence,
            formula: `${this.baseA.toLocaleString()} / (${bsr}^${this.baseB}) × ${multiplier} = ${finalEstimate}`,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Add new calibration point (for expanding dataset)
     */
    addCalibrationPoint(asin, bsr, category, actualSales, verificationMethod, sellerSource) {
        const point = {
            asin,
            bsr,
            category,
            actualSales,
            verificationMethod,
            sellerSource,
            dateAdded: new Date().toISOString(),
            predicted: this.estimate(bsr, category).estimatedMonthlySales,
            errorPercent: Math.abs(this.estimate(bsr, category).estimatedMonthlySales - actualSales) / actualSales * 100
        };
        
        const csvLine = `${asin},${bsr},${category},${actualSales},"${verificationMethod}","${sellerSource}",${point.dateAdded}\n`;
        fs.appendFileSync(this.dataFilePath, csvLine);
        
        return point;
    }

    /**
     * Get current calibration statistics
     */
    getStats() {
        if (!fs.existsSync(this.dataFilePath)) {
            return { dataPoints: 0 };
        }
        
        const content = fs.readFileSync(this.dataFilePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        const dataPoints = lines.length - 1; // Subtract header
        
        return {
            dataPoints,
            formula: `Sales = ${this.baseA.toLocaleString()} / (BSR ^ ${this.baseB})`,
            categoryMultipliers: this.categoryMultipliers
        };
    }
}

module.exports = SalesModel;