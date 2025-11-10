const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const Production = require('../models/Production');

// Get dashboard statistics
router.get('/stats', async (req, res) => {
    try {
        // Inventory Stats
        const inventoryItems = await Inventory.find().populate('brand category');
        const totalStock = inventoryItems.reduce((sum, item) => {
            return sum + item.sizes.reduce((s, size) => s + size.quantity, 0);
        }, 0);

        const totalInventoryValue = inventoryItems.reduce((sum, item) => {
            const qty = item.sizes.reduce((s, size) => s + size.quantity, 0);
            return sum + (qty * item.costPerUnit);
        }, 0);

        const lowStockItems = inventoryItems.filter(item => {
            const qty = item.sizes.reduce((s, size) => s + size.quantity, 0);
            return qty <= item.lowStockThreshold;
        }).length;

        // Sales Stats
        const allSales = await Sale.find();
        const totalSalesAmount = allSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        const totalPaidAmount = allSales.reduce((sum, sale) => sum + sale.paidAmount, 0);
        const totalCreditAmount = allSales.reduce((sum, sale) => sum + sale.remainingAmount, 0);

        // Recent sales (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentSales = await Sale.find({ saleDate: { $gte: sevenDaysAgo } });
        const recentSalesAmount = recentSales.reduce((sum, sale) => sum + sale.totalAmount, 0);

        // Customer Stats
        const totalCustomers = await Customer.countDocuments();
        const creditCustomers = await Customer.countDocuments({ customerType: 'Credit' });

        // Production Stats
        const totalProduction = await Production.countDocuments();
        const inProcessProduction = await Production.countDocuments({ status: 'In Process' });
        const completedProduction = await Production.countDocuments({ status: 'Completed' });

        // Top selling products (from sales)
        const topProducts = await Sale.aggregate([
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.productName',
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: '$items.totalPrice' }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 }
        ]);

        // Sales by date (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const salesByDate = await Sale.aggregate([
            { $match: { saleDate: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
                    totalSales: { $sum: '$totalAmount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            inventory: {
                totalStock,
                totalValue: totalInventoryValue,
                lowStockItems,
                totalProducts: inventoryItems.length
            },
            sales: {
                totalSales: totalSalesAmount,
                totalPaid: totalPaidAmount,
                totalCredit: totalCreditAmount,
                recentSales: recentSalesAmount,
                totalTransactions: allSales.length
            },
            customers: {
                total: totalCustomers,
                creditCustomers
            },
            production: {
                total: totalProduction,
                inProcess: inProcessProduction,
                completed: completedProduction
            },
            topProducts,
            salesByDate
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

