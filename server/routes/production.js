const express = require('express');
const router = express.Router();
const Production = require('../models/Production');
const Inventory = require('../models/Inventory');
const Brand = require('../models/Brand');

// Get all production batches
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};
        if (status) query.status = status;

        const batches = await Production.find(query)
            .populate('category')
            .sort({ orderDate: -1 });
        res.json(batches);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single production batch
router.get('/:id', async (req, res) => {
    try {
        const batch = await Production.findById(req.params.id).populate('category');
        if (!batch) {
            return res.status(404).json({ error: 'Production batch not found' });
        }
        res.json(batch);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create production batch
router.post('/', async (req, res) => {
    try {
        const batch = new Production(req.body);
        await batch.save();
        await batch.populate('category');
        res.status(201).json(batch);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update production batch
router.put('/:id', async (req, res) => {
    try {
        const batch = await Production.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('category');

        if (!batch) {
            return res.status(404).json({ error: 'Production batch not found' });
        }
        res.json(batch);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Move production to inventory
router.post('/:id/move-to-inventory', async (req, res) => {
    try {
        const { brandId } = req.body;
        const batch = await Production.findById(req.params.id);

        if (!batch) {
            return res.status(404).json({ error: 'Production batch not found' });
        }

        if (batch.status !== 'Completed') {
            return res.status(400).json({ error: 'Only completed batches can be moved to inventory' });
        }

        if (batch.addedToInventory) {
            return res.status(400).json({ error: 'Batch already added to inventory' });
        }

        // Create inventory item
        const inventoryItem = new Inventory({
            brand: brandId,
            category: batch.category,
            productName: batch.productName,
            sizes: batch.sizeBreakdown,
            costPerUnit: batch.costPerUnit,
            sellingPrice: batch.sellingPrice,
            productionBatch: batch._id
        });

        await inventoryItem.save();

        // Update production batch
        batch.status = 'Added to Stock';
        batch.addedToInventory = true;
        batch.inventoryId = inventoryItem._id;
        await batch.save();

        res.json({ batch, inventoryItem });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete production batch
router.delete('/:id', async (req, res) => {
    try {
        const batch = await Production.findByIdAndDelete(req.params.id);
        if (!batch) {
            return res.status(404).json({ error: 'Production batch not found' });
        }
        res.json({ message: 'Production batch deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

