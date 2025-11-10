const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');

// Get all inventory items with filters
router.get('/', async (req, res) => {
  try {
    const { brand, category, lowStock } = req.query;
    let query = {};
    
    if (brand) query.brand = brand;
    if (category) query.category = category;
    
    let items = await Inventory.find(query)
      .populate('brand')
      .populate('category')
      .populate('productionBatch')
      .sort({ createdAt: -1 });
    
    // Filter low stock items
    if (lowStock === 'true') {
      items = items.filter(item => {
        const totalQty = item.sizes.reduce((sum, s) => sum + s.quantity, 0);
        return totalQty <= item.lowStockThreshold;
      });
    }
    
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single inventory item
router.get('/:id', async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id)
      .populate('brand')
      .populate('category')
      .populate('productionBatch');
    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create inventory item
router.post('/', async (req, res) => {
  try {
    const item = new Inventory(req.body);
    await item.save();
    await item.populate('brand category');
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update inventory item
router.put('/:id', async (req, res) => {
  try {
    const item = await Inventory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('brand category');
    
    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update stock quantity (for sales)
router.patch('/:id/stock', async (req, res) => {
  try {
    const { size, quantity, operation } = req.body; // operation: 'add' or 'subtract'
    const item = await Inventory.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    
    const sizeIndex = item.sizes.findIndex(s => s.size === size);
    if (sizeIndex === -1) {
      return res.status(400).json({ error: 'Size not found' });
    }
    
    if (operation === 'subtract') {
      if (item.sizes[sizeIndex].quantity < quantity) {
        return res.status(400).json({ error: 'Insufficient stock' });
      }
      item.sizes[sizeIndex].quantity -= quantity;
    } else {
      item.sizes[sizeIndex].quantity += quantity;
    }
    
    await item.save();
    await item.populate('brand category');
    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete inventory item
router.delete('/:id', async (req, res) => {
  try {
    const item = await Inventory.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get inventory statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const items = await Inventory.find().populate('brand category');
    
    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => {
      return sum + item.sizes.reduce((s, size) => s + size.quantity, 0);
    }, 0);
    
    const totalValue = items.reduce((sum, item) => {
      const qty = item.sizes.reduce((s, size) => s + size.quantity, 0);
      return sum + (qty * item.costPerUnit);
    }, 0);
    
    const lowStockItems = items.filter(item => {
      const qty = item.sizes.reduce((s, size) => s + size.quantity, 0);
      return qty <= item.lowStockThreshold;
    });
    
    res.json({
      totalItems,
      totalQuantity,
      totalValue,
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.map(item => ({
        id: item._id,
        productName: item.productName,
        brand: item.brand?.name,
        category: item.category?.name,
        quantity: item.sizes.reduce((s, size) => s + size.quantity, 0)
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

