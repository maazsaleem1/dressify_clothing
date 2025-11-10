const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    shopName: {
        type: String,
        trim: true,
        default: ''
    },
    market: {
        type: String,
        trim: true,
        default: ''
    },
    contact: {
        type: String,
        trim: true,
        default: ''
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        default: ''
    },
    address: {
        type: String,
        default: ''
    },
    customerType: {
        type: String,
        enum: ['Walk-in', 'Credit', 'Regular'],
        default: 'Walk-in'
    },
    creditLimit: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Customer', customerSchema);

