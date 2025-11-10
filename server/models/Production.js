const mongoose = require('mongoose');

const sizeBreakdownSchema = new mongoose.Schema({
    size: {
        type: String,
        required: true,
        enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: false });

const productionSchema = new mongoose.Schema({
    batchName: {
        type: String,
        required: true,
        trim: true
    },
    batchNumber: {
        type: String,
        required: true,
        unique: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    productName: {
        type: String,
        required: true,
        trim: true
    },
    totalQuantity: {
        type: Number,
        required: true,
        min: 1
    },
    sizeBreakdown: [sizeBreakdownSchema],
    costPerUnit: {
        type: Number,
        required: true,
        min: 0
    },
    sellingPrice: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['Ordered', 'In Process', 'Completed', 'Added to Stock'],
        default: 'Ordered'
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    expectedCompletionDate: {
        type: Date
    },
    completionDate: {
        type: Date
    },
    notes: {
        type: String,
        default: ''
    },
    addedToInventory: {
        type: Boolean,
        default: false
    },
    inventoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inventory'
    }
}, {
    timestamps: true
});

// Generate batch number
productionSchema.pre('save', async function (next) {
    if (!this.batchNumber) {
        const count = await mongoose.model('Production').countDocuments();
        this.batchNumber = `BATCH-${String(count + 1).padStart(5, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Production', productionSchema);

