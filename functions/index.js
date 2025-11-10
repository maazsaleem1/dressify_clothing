const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// Helper function to wrap endpoints with CORS
const corsHandler = (handler) => {
  return (req, res) => {
    cors(req, res, () => handler(req, res));
  };
};

// ==================== BRANDS ====================
exports.getBrands = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const snapshot = await db.collection('brands').orderBy('name').get();
    const brands = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(brands);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

exports.createBrand = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const data = { ...req.body, createdAt: admin.firestore.FieldValue.serverTimestamp() };
    const docRef = await db.collection('brands').add(data);
    const doc = await docRef.get();
    res.status(201).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

exports.updateBrand = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const id = req.query.id || req.body.id;
    await db.collection('brands').doc(id).update(req.body);
    const doc = await db.collection('brands').doc(id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

exports.deleteBrand = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const id = req.query.id;
    await db.collection('brands').doc(id).delete();
    res.json({ message: 'Brand deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// ==================== CATEGORIES ====================
exports.getCategories = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const snapshot = await db.collection('categories').orderBy('name').get();
    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

exports.createCategory = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const data = { ...req.body, createdAt: admin.firestore.FieldValue.serverTimestamp() };
    const docRef = await db.collection('categories').add(data);
    const doc = await docRef.get();
    res.status(201).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

exports.updateCategory = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const id = req.query.id || req.body.id;
    await db.collection('categories').doc(id).update(req.body);
    const doc = await db.collection('categories').doc(id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

exports.deleteCategory = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const id = req.query.id;
    await db.collection('categories').doc(id).delete();
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// ==================== INVENTORY ====================
exports.getInventory = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    let query = db.collection('inventory');
    
    if (req.query.brand) query = query.where('brandId', '==', req.query.brand);
    if (req.query.category) query = query.where('categoryId', '==', req.query.category);
    
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    const inventory = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Fetch brand and category details
      const brandDoc = data.brandId ? await db.collection('brands').doc(data.brandId).get() : null;
      const categoryDoc = data.categoryId ? await db.collection('categories').doc(data.categoryId).get() : null;
      
      inventory.push({
        id: doc.id,
        ...data,
        brand: brandDoc?.exists ? { id: brandDoc.id, ...brandDoc.data() } : null,
        category: categoryDoc?.exists ? { id: categoryDoc.id, ...categoryDoc.data() } : null
      });
    }
    
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

exports.createInventory = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const data = {
      brandId: req.body.brand,
      categoryId: req.body.category,
      productName: req.body.productName,
      sizes: req.body.sizes || [],
      costPerUnit: req.body.costPerUnit,
      sellingPrice: req.body.sellingPrice,
      lowStockThreshold: req.body.lowStockThreshold || 10,
      notes: req.body.notes || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('inventory').add(data);
    const doc = await docRef.get();
    res.status(201).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

exports.updateInventory = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const id = req.query.id || req.body.id;
    const updateData = {
      brandId: req.body.brand,
      categoryId: req.body.category,
      productName: req.body.productName,
      sizes: req.body.sizes,
      costPerUnit: req.body.costPerUnit,
      sellingPrice: req.body.sellingPrice,
      lowStockThreshold: req.body.lowStockThreshold,
      notes: req.body.notes
    };
    
    await db.collection('inventory').doc(id).update(updateData);
    const doc = await db.collection('inventory').doc(id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

exports.deleteInventory = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const id = req.query.id;
    await db.collection('inventory').doc(id).delete();
    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

exports.getInventoryStats = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const snapshot = await db.collection('inventory').get();
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => {
      return sum + (item.sizes || []).reduce((s, size) => s + (size.quantity || 0), 0);
    }, 0);
    
    const totalValue = items.reduce((sum, item) => {
      const qty = (item.sizes || []).reduce((s, size) => s + (size.quantity || 0), 0);
      return sum + (qty * (item.costPerUnit || 0));
    }, 0);
    
    const lowStockItems = items.filter(item => {
      const qty = (item.sizes || []).reduce((s, size) => s + (size.quantity || 0), 0);
      return qty <= (item.lowStockThreshold || 10);
    });
    
    res.json({
      totalItems,
      totalQuantity,
      totalValue,
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.map(item => ({
        id: item.id,
        productName: item.productName,
        quantity: (item.sizes || []).reduce((s, size) => s + (size.quantity || 0), 0)
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// ==================== CUSTOMERS ====================
exports.getCustomers = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    let query = db.collection('customers');
    
    if (req.query.type) query = query.where('customerType', '==', req.query.type);
    
    const snapshot = await query.orderBy('name').get();
    const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

exports.getCustomer = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const id = req.query.id;
    const customerDoc = await db.collection('customers').doc(id).get();
    
    if (!customerDoc.exists) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const salesSnapshot = await db.collection('sales')
      .where('customerId', '==', id)
      .orderBy('saleDate', 'desc')
      .limit(10)
      .get();
    
    const sales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const allSalesSnapshot = await db.collection('sales').where('customerId', '==', id).get();
    const allSales = allSalesSnapshot.docs.map(doc => doc.data());
    
    const totalPurchases = allSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
    const totalPaid = allSales.reduce((sum, sale) => sum + (sale.paidAmount || 0), 0);
    const totalOutstanding = allSales.reduce((sum, sale) => sum + (sale.remainingAmount || 0), 0);
    
    res.json({
      customer: { id: customerDoc.id, ...customerDoc.data() },
      recentSales: sales,
      summary: { totalPurchases, totalPaid, totalOutstanding }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

exports.createCustomer = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const data = { ...req.body, createdAt: admin.firestore.FieldValue.serverTimestamp() };
    const docRef = await db.collection('customers').add(data);
    const doc = await docRef.get();
    res.status(201).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

exports.updateCustomer = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const id = req.query.id || req.body.id;
    await db.collection('customers').doc(id).update(req.body);
    const doc = await db.collection('customers').doc(id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

exports.deleteCustomer = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const id = req.query.id;
    await db.collection('customers').doc(id).delete();
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// ==================== SALES ====================
exports.getSales = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    let query = db.collection('sales');
    
    if (req.query.customer) query = query.where('customerId', '==', req.query.customer);
    if (req.query.status) query = query.where('paymentStatus', '==', req.query.status);
    
    const snapshot = await query.orderBy('saleDate', 'desc').get();
    const sales = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const customerDoc = await db.collection('customers').doc(data.customerId).get();
      
      sales.push({
        id: doc.id,
        ...data,
        customer: customerDoc.exists ? { id: customerDoc.id, ...customerDoc.data() } : null
      });
    }
    
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

exports.createSale = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const { customer, items, paidAmount, saleType, notes } = req.body;
    
    // Generate invoice number
    const salesCount = await db.collection('sales').count().get();
    const invoiceNumber = `INV-${String(salesCount.data().count + 1).padStart(6, '0')}`;
    
    let totalAmount = 0;
    const processedItems = [];
    
    // Process items and update inventory
    for (const item of items) {
      const inventoryDoc = await db.collection('inventory').doc(item.inventory).get();
      
      if (!inventoryDoc.exists) {
        return res.status(404).json({ error: `Inventory item not found: ${item.inventory}` });
      }
      
      const inventoryData = inventoryDoc.data();
      const sizeObj = inventoryData.sizes.find(s => s.size === item.size);
      
      if (!sizeObj || sizeObj.quantity < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${inventoryData.productName} - Size ${item.size}` 
        });
      }
      
      const itemTotal = item.quantity * item.unitPrice;
      totalAmount += itemTotal;
      
      processedItems.push({
        inventoryId: item.inventory,
        productName: inventoryData.productName,
        size: item.size,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: itemTotal
      });
      
      // Update inventory
      const updatedSizes = inventoryData.sizes.map(s => 
        s.size === item.size ? { ...s, quantity: s.quantity - item.quantity } : s
      );
      
      await db.collection('inventory').doc(item.inventory).update({ sizes: updatedSizes });
    }
    
    const paid = paidAmount || 0;
    const remaining = totalAmount - paid;
    let paymentStatus = 'Unpaid';
    if (paid >= totalAmount) paymentStatus = 'Paid';
    else if (paid > 0) paymentStatus = 'Partial';
    
    const saleData = {
      invoiceNumber,
      customerId: customer,
      items: processedItems,
      totalAmount,
      paidAmount: paid,
      remainingAmount: remaining,
      paymentStatus,
      saleType: saleType || (paid >= totalAmount ? 'Cash' : 'Credit'),
      notes: notes || '',
      payments: paid > 0 ? [{
        amount: paid,
        paymentDate: admin.firestore.FieldValue.serverTimestamp(),
        paymentMethod: 'Cash'
      }] : [],
      saleDate: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('sales').add(saleData);
    const doc = await docRef.get();
    res.status(201).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

exports.addPayment = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const id = req.query.id;
    const { amount, paymentMethod, notes } = req.body;
    
    const saleDoc = await db.collection('sales').doc(id).get();
    if (!saleDoc.exists) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    const saleData = saleDoc.data();
    
    if (amount > saleData.remainingAmount) {
      return res.status(400).json({ error: 'Payment amount exceeds remaining balance' });
    }
    
    const newPayment = {
      amount,
      paymentDate: admin.firestore.FieldValue.serverTimestamp(),
      paymentMethod: paymentMethod || 'Cash',
      notes: notes || ''
    };
    
    const updatedPaidAmount = saleData.paidAmount + amount;
    const updatedRemainingAmount = saleData.remainingAmount - amount;
    
    let paymentStatus = 'Unpaid';
    if (updatedRemainingAmount === 0) paymentStatus = 'Paid';
    else if (updatedPaidAmount > 0) paymentStatus = 'Partial';
    
    await db.collection('sales').doc(id).update({
      payments: admin.firestore.FieldValue.arrayUnion(newPayment),
      paidAmount: updatedPaidAmount,
      remainingAmount: updatedRemainingAmount,
      paymentStatus
    });
    
    const updatedDoc = await db.collection('sales').doc(id).get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

exports.deleteSale = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const id = req.query.id;
    const saleDoc = await db.collection('sales').doc(id).get();
    
    if (!saleDoc.exists) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    
    const saleData = saleDoc.data();
    
    // Restore inventory
    for (const item of saleData.items) {
      const inventoryDoc = await db.collection('inventory').doc(item.inventoryId).get();
      
      if (inventoryDoc.exists) {
        const inventoryData = inventoryDoc.data();
        const updatedSizes = inventoryData.sizes.map(s => 
          s.size === item.size ? { ...s, quantity: s.quantity + item.quantity } : s
        );
        await db.collection('inventory').doc(item.inventoryId).update({ sizes: updatedSizes });
      }
    }
    
    await db.collection('sales').doc(id).delete();
    res.json({ message: 'Sale deleted and inventory restored' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

exports.getSalesStats = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const snapshot = await db.collection('sales').get();
    const sales = snapshot.docs.map(doc => doc.data());
    
    const totalSales = sales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
    const cashReceived = sales.reduce((sum, sale) => sum + (sale.paidAmount || 0), 0);
    const creditGiven = sales.reduce((sum, sale) => sum + (sale.remainingAmount || 0), 0);
    
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
}));

// ==================== PRODUCTION ====================
exports.getProductions = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    let query = db.collection('productions');
    
    if (req.query.status) query = query.where('status', '==', req.query.status);
    
    const snapshot = await query.orderBy('orderDate', 'desc').get();
    const productions = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const categoryDoc = data.categoryId ? await db.collection('categories').doc(data.categoryId).get() : null;
      
      productions.push({
        id: doc.id,
        ...data,
        category: categoryDoc?.exists ? { id: categoryDoc.id, ...categoryDoc.data() } : null
      });
    }
    
    res.json(productions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

exports.createProduction = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const productionsCount = await db.collection('productions').count().get();
    const batchNumber = `BATCH-${String(productionsCount.data().count + 1).padStart(5, '0')}`;
    
    const data = {
      batchName: req.body.batchName,
      batchNumber,
      categoryId: req.body.category,
      productName: req.body.productName,
      totalQuantity: req.body.totalQuantity,
      sizeBreakdown: req.body.sizeBreakdown || [],
      costPerUnit: req.body.costPerUnit,
      sellingPrice: req.body.sellingPrice,
      status: req.body.status || 'Ordered',
      orderDate: admin.firestore.FieldValue.serverTimestamp(),
      expectedCompletionDate: req.body.expectedCompletionDate || null,
      notes: req.body.notes || '',
      addedToInventory: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('productions').add(data);
    const doc = await docRef.get();
    res.status(201).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

exports.updateProduction = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const id = req.query.id || req.body.id;
    const updateData = {
      batchName: req.body.batchName,
      categoryId: req.body.category,
      productName: req.body.productName,
      totalQuantity: req.body.totalQuantity,
      sizeBreakdown: req.body.sizeBreakdown,
      costPerUnit: req.body.costPerUnit,
      sellingPrice: req.body.sellingPrice,
      status: req.body.status,
      expectedCompletionDate: req.body.expectedCompletionDate,
      notes: req.body.notes
    };
    
    await db.collection('productions').doc(id).update(updateData);
    const doc = await db.collection('productions').doc(id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

exports.moveToInventory = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const id = req.query.id;
    const { brandId } = req.body;
    
    const productionDoc = await db.collection('productions').doc(id).get();
    
    if (!productionDoc.exists) {
      return res.status(404).json({ error: 'Production batch not found' });
    }
    
    const productionData = productionDoc.data();
    
    if (productionData.status !== 'Completed') {
      return res.status(400).json({ error: 'Only completed batches can be moved to inventory' });
    }
    
    if (productionData.addedToInventory) {
      return res.status(400).json({ error: 'Batch already added to inventory' });
    }
    
    const inventoryData = {
      brandId,
      categoryId: productionData.categoryId,
      productName: productionData.productName,
      sizes: productionData.sizeBreakdown,
      costPerUnit: productionData.costPerUnit,
      sellingPrice: productionData.sellingPrice,
      productionBatchId: id,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const inventoryRef = await db.collection('inventory').add(inventoryData);
    
    await db.collection('productions').doc(id).update({
      status: 'Added to Stock',
      addedToInventory: true,
      inventoryId: inventoryRef.id
    });
    
    const updatedProduction = await db.collection('productions').doc(id).get();
    const inventoryDoc = await inventoryRef.get();
    
    res.json({
      batch: { id: updatedProduction.id, ...updatedProduction.data() },
      inventoryItem: { id: inventoryDoc.id, ...inventoryDoc.data() }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

exports.deleteProduction = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    const id = req.query.id;
    await db.collection('productions').doc(id).delete();
    res.json({ message: 'Production batch deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// ==================== DASHBOARD ====================
exports.getDashboardStats = functions.https.onRequest(corsHandler(async (req, res) => {
  try {
    // Inventory Stats
    const inventorySnapshot = await db.collection('inventory').get();
    const inventoryItems = inventorySnapshot.docs.map(doc => doc.data());
    
    const totalStock = inventoryItems.reduce((sum, item) => {
      return sum + (item.sizes || []).reduce((s, size) => s + (size.quantity || 0), 0);
    }, 0);
    
    const totalInventoryValue = inventoryItems.reduce((sum, item) => {
      const qty = (item.sizes || []).reduce((s, size) => s + (size.quantity || 0), 0);
      return sum + (qty * (item.costPerUnit || 0));
    }, 0);
    
    const lowStockItems = inventoryItems.filter(item => {
      const qty = (item.sizes || []).reduce((s, size) => s + (size.quantity || 0), 0);
      return qty <= (item.lowStockThreshold || 10);
    }).length;
    
    // Sales Stats
    const salesSnapshot = await db.collection('sales').get();
    const allSales = salesSnapshot.docs.map(doc => doc.data());
    
    const totalSalesAmount = allSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
    const totalPaidAmount = allSales.reduce((sum, sale) => sum + (sale.paidAmount || 0), 0);
    const totalCreditAmount = allSales.reduce((sum, sale) => sum + (sale.remainingAmount || 0), 0);
    
    // Customer Stats
    const customersSnapshot = await db.collection('customers').get();
    const totalCustomers = customersSnapshot.size;
    const creditCustomers = customersSnapshot.docs.filter(doc => 
      doc.data().customerType === 'Credit'
    ).length;
    
    // Production Stats
    const productionsSnapshot = await db.collection('productions').get();
    const totalProduction = productionsSnapshot.size;
    const inProcessProduction = productionsSnapshot.docs.filter(doc => 
      doc.data().status === 'In Process'
    ).length;
    const completedProduction = productionsSnapshot.docs.filter(doc => 
      doc.data().status === 'Completed'
    ).length;
    
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
      topProducts: [],
      salesByDate: []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

