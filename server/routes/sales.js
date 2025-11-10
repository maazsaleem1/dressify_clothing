const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const Customer = require('../models/Customer');

// Get all sales with filters
router.get('/', async (req, res) => {
  try {
    const { customer, status, startDate, endDate, type } = req.query;
    let query = {};
    
    if (customer) query.customer = customer;
    if (status) query.paymentStatus = status;
    if (type) query.saleType = type;
    
    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) query.saleDate.$gte = new Date(startDate);
      if (endDate) query.saleDate.$lte = new Date(endDate);
    }
    
    const sales = await Sale.find(query)
      .populate('customer')
      .populate('items.inventory')
      .sort({ saleDate: -1 });
    
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single sale
router.get('/:id', async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('customer')
      .populate('items.inventory');
    
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create sale
router.post('/', async (req, res) => {
  try {
    const { customer, items, paidAmount, saleType, notes } = req.body;
    
    // Validate customer
    const customerDoc = await Customer.findById(customer);
    if (!customerDoc) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Process items and update inventory
    let totalAmount = 0;
    const processedItems = [];
    
    for (const item of items) {
      const inventoryItem = await Inventory.findById(item.inventory);
      if (!inventoryItem) {
        return res.status(404).json({ error: `Inventory item not found: ${item.inventory}` });
      }
      
      // Check stock availability
      const sizeObj = inventoryItem.sizes.find(s => s.size === item.size);
      if (!sizeObj || sizeObj.quantity < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${inventoryItem.productName} - Size ${item.size}` 
        });
      }
      
      // Calculate item total
      const itemTotal = item.quantity * item.unitPrice;
      totalAmount += itemTotal;
      
      processedItems.push({
        inventory: item.inventory,
        productName: inventoryItem.productName,
        size: item.size,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: itemTotal
      });
      
      // Update inventory
      const sizeIndex = inventoryItem.sizes.findIndex(s => s.size === item.size);
      inventoryItem.sizes[sizeIndex].quantity -= item.quantity;
      await inventoryItem.save();
    }
    
    // Calculate payment status
    const paid = paidAmount || 0;
    const remaining = totalAmount - paid;
    let paymentStatus = 'Unpaid';
    if (paid >= totalAmount) paymentStatus = 'Paid';
    else if (paid > 0) paymentStatus = 'Partial';
    
    // Create sale
    const sale = new Sale({
      customer,
      items: processedItems,
      totalAmount,
      paidAmount: paid,
      remainingAmount: remaining,
      paymentStatus,
      saleType: saleType || (paid >= totalAmount ? 'Cash' : 'Credit'),
      notes,
      payments: paid > 0 ? [{
        amount: paid,
        paymentDate: new Date(),
        paymentMethod: 'Cash'
      }] : []
    });
    
    await sale.save();
    await sale.populate('customer items.inventory');
    
    res.status(201).json(sale);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add payment to sale
router.post('/:id/payment', async (req, res) => {
  try {
    const { amount, paymentMethod, notes } = req.body;
    const sale = await Sale.findById(req.params.id);
    
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    if (amount > sale.remainingAmount) {
      return res.status(400).json({ error: 'Payment amount exceeds remaining balance' });
    }
    
    // Add payment
    sale.payments.push({
      amount,
      paymentDate: new Date(),
      paymentMethod: paymentMethod || 'Cash',
      notes: notes || ''
    });
    
    // Update amounts
    sale.paidAmount += amount;
    sale.remainingAmount -= amount;
    
    // Update payment status
    if (sale.remainingAmount === 0) {
      sale.paymentStatus = 'Paid';
    } else if (sale.paidAmount > 0) {
      sale.paymentStatus = 'Partial';
    }
    
    await sale.save();
    await sale.populate('customer items.inventory');
    
    res.json(sale);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get sales statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = {};
    
    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) query.saleDate.$gte = new Date(startDate);
      if (endDate) query.saleDate.$lte = new Date(endDate);
    }
    
    const sales = await Sale.find(query);
    
    const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const cashReceived = sales.reduce((sum, sale) => sum + sale.paidAmount, 0);
    const creditGiven = sales.reduce((sum, sale) => sum + sale.remainingAmount, 0);
    
    const cashSales = sales.filter(s => s.saleType === 'Cash').length;
    const creditSales = sales.filter(s => s.saleType === 'Credit').length;
    
    res.json({
      totalSales,
      cashReceived,
      creditGiven,
      totalTransactions: sales.length,
      cashSales,
      creditSales,
      averageSale: sales.length > 0 ? totalSales / sales.length : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete sale (admin only - also restore inventory)
router.delete('/:id', async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    // Restore inventory
    for (const item of sale.items) {
      const inventoryItem = await Inventory.findById(item.inventory);
      if (inventoryItem) {
        const sizeIndex = inventoryItem.sizes.findIndex(s => s.size === item.size);
        if (sizeIndex !== -1) {
          inventoryItem.sizes[sizeIndex].quantity += item.quantity;
          await inventoryItem.save();
        }
      }
    }
    
    await sale.deleteOne();
    res.json({ message: 'Sale deleted and inventory restored' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

