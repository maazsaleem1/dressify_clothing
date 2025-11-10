const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');

// Get all customers
router.get('/', async (req, res) => {
  try {
    const { type, search } = req.query;
    let query = {};
    
    if (type) query.customerType = type;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { shopName: { $regex: search, $options: 'i' } },
        { market: { $regex: search, $options: 'i' } }
      ];
    }
    
    const customers = await Customer.find(query).sort({ name: 1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single customer with ledger
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Get customer's sales
    const sales = await Sale.find({ customer: req.params.id })
      .sort({ saleDate: -1 })
      .limit(10);
    
    // Calculate totals
    const allSales = await Sale.find({ customer: req.params.id });
    const totalPurchases = allSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalPaid = allSales.reduce((sum, sale) => sum + sale.paidAmount, 0);
    const totalOutstanding = allSales.reduce((sum, sale) => sum + sale.remainingAmount, 0);
    
    res.json({
      customer,
      recentSales: sales,
      summary: {
        totalPurchases,
        totalPaid,
        totalOutstanding
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create customer
router.post('/', async (req, res) => {
  try {
    const customer = new Customer(req.body);
    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update customer
router.put('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete customer
router.delete('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

