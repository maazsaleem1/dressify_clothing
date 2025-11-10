import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from './firestore';

// Helper function to convert Firestore doc to object
const docToObject = (doc) => {
  return { id: doc.id, ...doc.data() };
};

// ==================== BRANDS ====================
export const getBrands = async () => {
  const q = query(collection(db, 'brands'), orderBy('name'));
  const snapshot = await getDocs(q);
  return { data: snapshot.docs.map(docToObject) };
};

export const getBrand = async (id) => {
  const docRef = doc(db, 'brands', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Brand not found');
  return { data: docToObject(docSnap) };
};

export const createBrand = async (data) => {
  const docRef = await addDoc(collection(db, 'brands'), {
    ...data,
    isActive: true,
    createdAt: serverTimestamp()
  });
  const docSnap = await getDoc(docRef);
  return { data: docToObject(docSnap) };
};

export const updateBrand = async (id, data) => {
  const docRef = doc(db, 'brands', id);
  await updateDoc(docRef, data);
  const docSnap = await getDoc(docRef);
  return { data: docToObject(docSnap) };
};

export const deleteBrand = async (id) => {
  await deleteDoc(doc(db, 'brands', id));
  return { data: { message: 'Brand deleted successfully' } };
};

// ==================== CATEGORIES ====================
export const getCategories = async () => {
  const q = query(collection(db, 'categories'), orderBy('name'));
  const snapshot = await getDocs(q);
  return { data: snapshot.docs.map(docToObject) };
};

export const getCategory = async (id) => {
  const docRef = doc(db, 'categories', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Category not found');
  return { data: docToObject(docSnap) };
};

export const createCategory = async (data) => {
  const docRef = await addDoc(collection(db, 'categories'), {
    ...data,
    isActive: true,
    createdAt: serverTimestamp()
  });
  const docSnap = await getDoc(docRef);
  return { data: docToObject(docSnap) };
};

export const updateCategory = async (id, data) => {
  const docRef = doc(db, 'categories', id);
  await updateDoc(docRef, data);
  const docSnap = await getDoc(docRef);
  return { data: docToObject(docSnap) };
};

export const deleteCategory = async (id) => {
  await deleteDoc(doc(db, 'categories', id));
  return { data: { message: 'Category deleted successfully' } };
};

// ==================== INVENTORY ====================
export const getInventory = async (params = {}) => {
  let q = collection(db, 'inventory');
  const constraints = [];
  
  if (params.brand) constraints.push(where('brandId', '==', params.brand));
  if (params.category) constraints.push(where('categoryId', '==', params.category));
  
  constraints.push(orderBy('createdAt', 'desc'));
  q = query(q, ...constraints);
  
  const snapshot = await getDocs(q);
  const items = [];
  
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const brandDoc = data.brandId ? await getDoc(doc(db, 'brands', data.brandId)) : null;
    const categoryDoc = data.categoryId ? await getDoc(doc(db, 'categories', data.categoryId)) : null;
    
    items.push({
      id: docSnap.id,
      ...data,
      brand: brandDoc?.exists() ? docToObject(brandDoc) : null,
      category: categoryDoc?.exists() ? docToObject(categoryDoc) : null
    });
  }
  
  return { data: items };
};

export const getInventoryItem = async (id) => {
  const docRef = doc(db, 'inventory', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Inventory item not found');
  return { data: docToObject(docSnap) };
};

export const createInventoryItem = async (data) => {
  const docRef = await addDoc(collection(db, 'inventory'), {
    brandId: data.brand,
    categoryId: data.category,
    productName: data.productName,
    sizes: data.sizes || [],
    costPerUnit: data.costPerUnit,
    sellingPrice: data.sellingPrice,
    lowStockThreshold: data.lowStockThreshold || 10,
    notes: data.notes || '',
    createdAt: serverTimestamp()
  });
  const docSnap = await getDoc(docRef);
  return { data: docToObject(docSnap) };
};

export const updateInventoryItem = async (id, data) => {
  const docRef = doc(db, 'inventory', id);
  await updateDoc(docRef, {
    brandId: data.brand,
    categoryId: data.category,
    productName: data.productName,
    sizes: data.sizes,
    costPerUnit: data.costPerUnit,
    sellingPrice: data.sellingPrice,
    lowStockThreshold: data.lowStockThreshold,
    notes: data.notes
  });
  const docSnap = await getDoc(docRef);
  return { data: docToObject(docSnap) };
};

export const updateStock = async (id, data) => {
  return updateInventoryItem(id, data);
};

export const deleteInventoryItem = async (id) => {
  await deleteDoc(doc(db, 'inventory', id));
  return { data: { message: 'Inventory item deleted successfully' } };
};

export const getInventoryStats = async () => {
  const snapshot = await getDocs(collection(db, 'inventory'));
  const items = snapshot.docs.map(docToObject);
  
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
  
  return {
    data: {
      totalItems,
      totalQuantity,
      totalValue,
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.map(item => ({
        id: item.id,
        productName: item.productName,
        quantity: (item.sizes || []).reduce((s, size) => s + (size.quantity || 0), 0)
      }))
    }
  };
};

// ==================== CUSTOMERS ====================
export const getCustomers = async (params = {}) => {
  let q = collection(db, 'customers');
  const constraints = [];
  
  if (params.type) constraints.push(where('customerType', '==', params.type));
  constraints.push(orderBy('name'));
  
  q = query(q, ...constraints);
  const snapshot = await getDocs(q);
  return { data: snapshot.docs.map(docToObject) };
};

export const getCustomer = async (id) => {
  const docRef = doc(db, 'customers', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Customer not found');
  
  // Get customer's sales
  const salesQuery = query(
    collection(db, 'sales'),
    where('customerId', '==', id),
    orderBy('saleDate', 'desc')
  );
  const salesSnapshot = await getDocs(salesQuery);
  const sales = salesSnapshot.docs.map(docToObject);
  
  const totalPurchases = sales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
  const totalPaid = sales.reduce((sum, sale) => sum + (sale.paidAmount || 0), 0);
  const totalOutstanding = sales.reduce((sum, sale) => sum + (sale.remainingAmount || 0), 0);
  
  return {
    data: {
      customer: docToObject(docSnap),
      recentSales: sales.slice(0, 10),
      summary: { totalPurchases, totalPaid, totalOutstanding }
    }
  };
};

export const createCustomer = async (data) => {
  const docRef = await addDoc(collection(db, 'customers'), {
    ...data,
    createdAt: serverTimestamp()
  });
  const docSnap = await getDoc(docRef);
  return { data: docToObject(docSnap) };
};

export const updateCustomer = async (id, data) => {
  const docRef = doc(db, 'customers', id);
  await updateDoc(docRef, data);
  const docSnap = await getDoc(docRef);
  return { data: docToObject(docSnap) };
};

export const deleteCustomer = async (id) => {
  await deleteDoc(doc(db, 'customers', id));
  return { data: { message: 'Customer deleted successfully' } };
};

// ==================== SALES ====================
export const getSales = async (params = {}) => {
  let q = collection(db, 'sales');
  const constraints = [];
  
  if (params.customer) constraints.push(where('customerId', '==', params.customer));
  if (params.status) constraints.push(where('paymentStatus', '==', params.status));
  
  constraints.push(orderBy('saleDate', 'desc'));
  q = query(q, ...constraints);
  
  const snapshot = await getDocs(q);
  const sales = [];
  
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const customerDoc = await getDoc(doc(db, 'customers', data.customerId));
    
    sales.push({
      id: docSnap.id,
      ...data,
      customer: customerDoc.exists() ? docToObject(customerDoc) : null
    });
  }
  
  return { data: sales };
};

export const getSale = async (id) => {
  const docRef = doc(db, 'sales', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Sale not found');
  return { data: docToObject(docSnap) };
};

export const createSale = async (saleData) => {
  const { customer, items, paidAmount, saleType, notes } = saleData;
  
  // Generate invoice number
  const salesSnapshot = await getDocs(collection(db, 'sales'));
  const invoiceNumber = `INV-${String(salesSnapshot.size + 1).padStart(6, '0')}`;
  
  let totalAmount = 0;
  const processedItems = [];
  
  // Process items and update inventory
  for (const item of items) {
    const inventoryDoc = await getDoc(doc(db, 'inventory', item.inventory));
    
    if (!inventoryDoc.exists()) {
      throw new Error(`Inventory item not found: ${item.inventory}`);
    }
    
    const inventoryData = inventoryDoc.data();
    const sizeObj = inventoryData.sizes.find(s => s.size === item.size);
    
    if (!sizeObj || sizeObj.quantity < item.quantity) {
      throw new Error(`Insufficient stock for ${inventoryData.productName} - Size ${item.size}`);
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
    
    await updateDoc(doc(db, 'inventory', item.inventory), { sizes: updatedSizes });
  }
  
  const paid = paidAmount || 0;
  const remaining = totalAmount - paid;
  let paymentStatus = 'Unpaid';
  if (paid >= totalAmount) paymentStatus = 'Paid';
  else if (paid > 0) paymentStatus = 'Partial';
  
  const docRef = await addDoc(collection(db, 'sales'), {
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
      paymentDate: serverTimestamp(),
      paymentMethod: 'Cash'
    }] : [],
    saleDate: serverTimestamp(),
    createdAt: serverTimestamp()
  });
  
  const docSnap = await getDoc(docRef);
  return { data: docToObject(docSnap) };
};

export const addPayment = async (id, paymentData) => {
  const { amount, paymentMethod, notes } = paymentData;
  
  const saleRef = doc(db, 'sales', id);
  const saleSnap = await getDoc(saleRef);
  
  if (!saleSnap.exists()) {
    throw new Error('Sale not found');
  }
  
  const saleData = saleSnap.data();
  
  if (amount > saleData.remainingAmount) {
    throw new Error('Payment amount exceeds remaining balance');
  }
  
  const newPayment = {
    amount,
    paymentDate: serverTimestamp(),
    paymentMethod: paymentMethod || 'Cash',
    notes: notes || ''
  };
  
  const updatedPaidAmount = saleData.paidAmount + amount;
  const updatedRemainingAmount = saleData.remainingAmount - amount;
  
  let paymentStatus = 'Unpaid';
  if (updatedRemainingAmount === 0) paymentStatus = 'Paid';
  else if (updatedPaidAmount > 0) paymentStatus = 'Partial';
  
  await updateDoc(saleRef, {
    payments: [...(saleData.payments || []), newPayment],
    paidAmount: updatedPaidAmount,
    remainingAmount: updatedRemainingAmount,
    paymentStatus
  });
  
  const updatedSnap = await getDoc(saleRef);
  return { data: docToObject(updatedSnap) };
};

export const deleteSale = async (id) => {
  const saleRef = doc(db, 'sales', id);
  const saleSnap = await getDoc(saleRef);
  
  if (!saleSnap.exists()) {
    throw new Error('Sale not found');
  }
  
  const saleData = saleSnap.data();
  
  // Restore inventory
  for (const item of saleData.items) {
    const inventoryRef = doc(db, 'inventory', item.inventoryId);
    const inventorySnap = await getDoc(inventoryRef);
    
    if (inventorySnap.exists()) {
      const inventoryData = inventorySnap.data();
      const updatedSizes = inventoryData.sizes.map(s => 
        s.size === item.size ? { ...s, quantity: s.quantity + item.quantity } : s
      );
      await updateDoc(inventoryRef, { sizes: updatedSizes });
    }
  }
  
  await deleteDoc(saleRef);
  return { data: { message: 'Sale deleted and inventory restored' } };
};

export const getSalesStats = async (params = {}) => {
  const snapshot = await getDocs(collection(db, 'sales'));
  const sales = snapshot.docs.map(docToObject);
  
  const totalSales = sales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
  const cashReceived = sales.reduce((sum, sale) => sum + (sale.paidAmount || 0), 0);
  const creditGiven = sales.reduce((sum, sale) => sum + (sale.remainingAmount || 0), 0);
  
  const cashSales = sales.filter(s => s.saleType === 'Cash').length;
  const creditSales = sales.filter(s => s.saleType === 'Credit').length;
  
  return {
    data: {
      totalSales,
      cashReceived,
      creditGiven,
      totalTransactions: sales.length,
      cashSales,
      creditSales,
      averageSale: sales.length > 0 ? totalSales / sales.length : 0
    }
  };
};

// ==================== PRODUCTION ====================
export const getProductions = async (params = {}) => {
  let q = collection(db, 'productions');
  const constraints = [];
  
  if (params.status) constraints.push(where('status', '==', params.status));
  constraints.push(orderBy('orderDate', 'desc'));
  
  q = query(q, ...constraints);
  const snapshot = await getDocs(q);
  const productions = [];
  
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const categoryDoc = data.categoryId ? await getDoc(doc(db, 'categories', data.categoryId)) : null;
    
    productions.push({
      id: docSnap.id,
      ...data,
      category: categoryDoc?.exists() ? docToObject(categoryDoc) : null
    });
  }
  
  return { data: productions };
};

export const getProduction = async (id) => {
  const docRef = doc(db, 'productions', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Production not found');
  return { data: docToObject(docSnap) };
};

export const createProduction = async (data) => {
  const productionsSnapshot = await getDocs(collection(db, 'productions'));
  const batchNumber = `BATCH-${String(productionsSnapshot.size + 1).padStart(5, '0')}`;
  
  const docRef = await addDoc(collection(db, 'productions'), {
    batchName: data.batchName,
    batchNumber,
    categoryId: data.category,
    productName: data.productName,
    totalQuantity: data.totalQuantity,
    sizeBreakdown: data.sizeBreakdown || [],
    costPerUnit: data.costPerUnit,
    sellingPrice: data.sellingPrice,
    status: data.status || 'Ordered',
    orderDate: serverTimestamp(),
    expectedCompletionDate: data.expectedCompletionDate || null,
    notes: data.notes || '',
    addedToInventory: false,
    createdAt: serverTimestamp()
  });
  
  const docSnap = await getDoc(docRef);
  return { data: docToObject(docSnap) };
};

export const updateProduction = async (id, data) => {
  const docRef = doc(db, 'productions', id);
  await updateDoc(docRef, {
    batchName: data.batchName,
    categoryId: data.category,
    productName: data.productName,
    totalQuantity: data.totalQuantity,
    sizeBreakdown: data.sizeBreakdown,
    costPerUnit: data.costPerUnit,
    sellingPrice: data.sellingPrice,
    status: data.status,
    expectedCompletionDate: data.expectedCompletionDate,
    notes: data.notes
  });
  const docSnap = await getDoc(docRef);
  return { data: docToObject(docSnap) };
};

export const moveToInventory = async (id, data) => {
  const { brandId } = data;
  
  const productionRef = doc(db, 'productions', id);
  const productionSnap = await getDoc(productionRef);
  
  if (!productionSnap.exists()) {
    throw new Error('Production batch not found');
  }
  
  const productionData = productionSnap.data();
  
  if (productionData.status !== 'Completed') {
    throw new Error('Only completed batches can be moved to inventory');
  }
  
  if (productionData.addedToInventory) {
    throw new Error('Batch already added to inventory');
  }
  
  const inventoryRef = await addDoc(collection(db, 'inventory'), {
    brandId,
    categoryId: productionData.categoryId,
    productName: productionData.productName,
    sizes: productionData.sizeBreakdown,
    costPerUnit: productionData.costPerUnit,
    sellingPrice: productionData.sellingPrice,
    productionBatchId: id,
    createdAt: serverTimestamp()
  });
  
  await updateDoc(productionRef, {
    status: 'Added to Stock',
    addedToInventory: true,
    inventoryId: inventoryRef.id
  });
  
  const updatedProduction = await getDoc(productionRef);
  const inventoryDoc = await getDoc(inventoryRef);
  
  return {
    data: {
      batch: docToObject(updatedProduction),
      inventoryItem: docToObject(inventoryDoc)
    }
  };
};

export const deleteProduction = async (id) => {
  await deleteDoc(doc(db, 'productions', id));
  return { data: { message: 'Production deleted successfully' } };
};

// ==================== DASHBOARD ====================
export const getDashboardStats = async () => {
  // Inventory Stats
  const inventorySnapshot = await getDocs(collection(db, 'inventory'));
  const inventoryItems = inventorySnapshot.docs.map(docToObject);
  
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
  const salesSnapshot = await getDocs(collection(db, 'sales'));
  const allSales = salesSnapshot.docs.map(docToObject);
  
  const totalSalesAmount = allSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
  const totalPaidAmount = allSales.reduce((sum, sale) => sum + (sale.paidAmount || 0), 0);
  const totalCreditAmount = allSales.reduce((sum, sale) => sum + (sale.remainingAmount || 0), 0);
  
  // Customer Stats
  const customersSnapshot = await getDocs(collection(db, 'customers'));
  const totalCustomers = customersSnapshot.size;
  
  // Production Stats
  const productionsSnapshot = await getDocs(collection(db, 'productions'));
  const productions = productionsSnapshot.docs.map(docToObject);
  const inProcessProduction = productions.filter(p => p.status === 'In Process').length;
  const completedProduction = productions.filter(p => p.status === 'Completed').length;
  
  return {
    data: {
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
        creditCustomers: 0
      },
      production: {
        total: productionsSnapshot.size,
        inProcess: inProcessProduction,
        completed: completedProduction
      },
      topProducts: [],
      salesByDate: []
    }
  };
};

export default { 
  getBrands, getBrand, createBrand, updateBrand, deleteBrand,
  getCategories, getCategory, createCategory, updateCategory, deleteCategory,
  getInventory, getInventoryItem, createInventoryItem, updateInventoryItem, deleteInventoryItem, getInventoryStats,
  getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer,
  getSales, getSale, createSale, addPayment, deleteSale, getSalesStats,
  getProductions, getProduction, createProduction, updateProduction, moveToInventory, deleteProduction,
  getDashboardStats
};
