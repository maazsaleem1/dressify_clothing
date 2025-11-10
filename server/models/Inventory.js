const mongoose = require('mongoose');

const sizeSchema = new mongoose.Schema({
    size: {
        type: String,
        required: true,
        enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
    },
    quantity: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    }
}, { _id: false });

const inventorySchema = new mongoose.Schema({
    brand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Brand',
        required: true
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
    sizes: [sizeSchema],
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
    lowStockThreshold: {
        type: Number,
        default: 10
    },
    notes: {
        type: String,
        default: ''
    },
    productionBatch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Production',
        default: null
    }
}, {
    timestamps: true
});

// Virtual for total quantity
inventorySchema.virtual('totalQuantity').get(function () {
    return this.sizes.reduce((sum, size) => sum + size.quantity, 0);
});

// Virtual for total cost
inventorySchema.virtual('totalCost').get(function () {
    return this.totalQuantity * this.costPerUnit;
});

inventorySchema.set('toJSON', { virtuals: true });
inventorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Inventory', inventorySchema);

