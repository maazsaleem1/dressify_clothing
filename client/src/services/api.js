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
  serverTimestamp,
  Timestamp
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
export const getCategories = async (params = {}) => {
  let q = collection(db, 'categories');
  const constraints = [];

  // Filter by brand if provided
  if (params.brandId) {
    constraints.push(where('brandId', '==', params.brandId));
  }

  // Filter by parent category (for subcategories)
  if (params.parentCategoryId) {
    constraints.push(where('parentCategoryId', '==', params.parentCategoryId));
  } else if (params.mainCategoriesOnly) {
    // Only get main categories (no parent) - Firestore doesn't support null directly, so we'll filter in code
    // We'll fetch all and filter in the result
  }

  // Filter by category type
  if (params.type) {
    constraints.push(where('categoryType', '==', params.type));
  }

  if (constraints.length > 0) {
    constraints.push(orderBy('name'));
    q = query(q, ...constraints);
  } else {
    q = query(q, orderBy('name'));
  }

  let snapshot;
  let usedOrderBy = true; // Track if we used orderBy
  try {
    snapshot = await getDocs(q);
  } catch (error) {
    // If orderBy fails due to missing index, try without it
    if ((error.code === 'failed-precondition' || error.message?.includes('index')) && constraints.length > 1) {
      console.log('Index missing, fetching without orderBy');
      usedOrderBy = false;
      // Remove orderBy and retry
      const constraintsWithoutOrder = constraints.slice(0, -1); // Remove last (orderBy)
      q = constraintsWithoutOrder.length > 0
        ? query(collection(db, 'categories'), ...constraintsWithoutOrder)
        : collection(db, 'categories');
      snapshot = await getDocs(q);
    } else {
      throw error;
    }
  }

  let result = snapshot.docs.map(docToObject);

  // Sort manually if we couldn't use orderBy
  if (!usedOrderBy) {
    result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  console.log('=== getCategories DEBUG ===');
  console.log('Params:', params);
  console.log('Total categories fetched:', result.length);
  console.log('All categories before filtering:', result.map(c => ({
    name: c.name,
    brandId: c.brandId,
    parentCategoryId: c.parentCategoryId,
    categoryType: c.categoryType
  })));

  // Filter main categories only if requested (since Firestore doesn't support null comparison well)
  if (params.mainCategoriesOnly) {
    const beforeFilter = result.length;
    result = result.filter(cat => {
      // Main category: parentCategoryId should be null, undefined, empty string, or not exist
      // Also exclude if categoryType is explicitly 'subcategory'
      const hasNoParent = !cat.parentCategoryId || cat.parentCategoryId === null || cat.parentCategoryId === '';
      const isNotSubcategory = cat.categoryType !== 'subcategory';

      const isMainCategory = hasNoParent && isNotSubcategory;

      // Debug log for each category
      console.log('Category filter check:', {
        name: cat.name,
        brandId: cat.brandId,
        requestedBrandId: params.brandId,
        parentCategoryId: cat.parentCategoryId,
        categoryType: cat.categoryType,
        hasNoParent,
        isNotSubcategory,
        isMainCategory,
        willInclude: isMainCategory
      });

      return isMainCategory;
    });
    console.log('Main categories filtered:', {
      before: beforeFilter,
      after: result.length,
      categories: result.map(c => ({
        name: c.name,
        parentCategoryId: c.parentCategoryId,
        categoryType: c.categoryType,
        brandId: c.brandId
      }))
    });
  }

  return { data: result };
};

export const getCategory = async (id) => {
  const docRef = doc(db, 'categories', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Category not found');
  return { data: docToObject(docSnap) };
};

export const createCategory = async (data) => {
  const categoryData = {
    name: data.name,
    description: data.description || '',
    brandId: data.brandId || null,
    parentCategoryId: data.parentCategoryId || null,
    categoryType: data.parentCategoryId ? 'subcategory' : 'category',
    isActive: true,
    createdAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'categories'), categoryData);
  const docSnap = await getDoc(docRef);
  return { data: docToObject(docSnap) };
};

export const updateCategory = async (id, data) => {
  const categoryData = {
    name: data.name,
    description: data.description || '',
    brandId: data.brandId || null,
    parentCategoryId: data.parentCategoryId || null,
    categoryType: data.parentCategoryId ? 'subcategory' : 'category'
  };

  const docRef = doc(db, 'categories', id);
  await updateDoc(docRef, categoryData);
  const docSnap = await getDoc(docRef);
  return { data: docToObject(docSnap) };
};

export const deleteCategory = async (id) => {
  await deleteDoc(doc(db, 'categories', id));
  return { data: { message: 'Category deleted successfully' } };
};

// ==================== INVENTORY ====================
export const getInventory = async (params = {}) => {
  console.log('=== API: getInventory START ===');
  console.log('Params:', params);

  let q = collection(db, 'inventory');
  const constraints = [];

  if (params.brand) constraints.push(where('brandId', '==', params.brand));
  if (params.category) constraints.push(where('categoryId', '==', params.category));

  // Add orderBy if no filters (to avoid index issues)
  let useOrderBy = constraints.length === 0;

  if (useOrderBy) {
    constraints.push(orderBy('createdAt', 'desc'));
  }

  q = constraints.length > 0 ? query(q, ...constraints) : q;

  let snapshot;
  try {
    snapshot = await getDocs(q);
  } catch (error) {
    // If orderBy fails due to missing index, try without it
    if ((error.code === 'failed-precondition' || error.message?.includes('index')) && useOrderBy) {
      console.log('Index missing, fetching without orderBy');
      // Remove orderBy and retry
      const constraintsWithoutOrder = constraints.slice(0, -1); // Remove last (orderBy)
      q = constraintsWithoutOrder.length > 0
        ? query(collection(db, 'inventory'), ...constraintsWithoutOrder)
        : collection(db, 'inventory');
      snapshot = await getDocs(q);
    } else {
      throw error;
    }
  }
  console.log('Inventory items found:', snapshot.size);

  const items = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    console.log('Processing item:', docSnap.id, 'BrandId:', data.brandId, 'CategoryId:', data.categoryId);

    let brandData = null;
    let categoryData = null;

    // Fetch brand
    if (data.brandId) {
      try {
        const brandDoc = await getDoc(doc(db, 'brands', data.brandId));
        if (brandDoc.exists()) {
          brandData = docToObject(brandDoc);
          console.log('Brand found:', brandData.name);
        } else {
          console.log('Brand not found for ID:', data.brandId);
        }
      } catch (error) {
        console.error('Error fetching brand:', error);
      }
    }

    // Fetch category
    if (data.categoryId) {
      try {
        const categoryDoc = await getDoc(doc(db, 'categories', data.categoryId));
        if (categoryDoc.exists()) {
          categoryData = docToObject(categoryDoc);
          console.log('Category found:', categoryData.name);
        } else {
          console.log('Category not found for ID:', data.categoryId);
        }
      } catch (error) {
        console.error('Error fetching category:', error);
      }
    }

    items.push({
      id: docSnap.id,
      ...data,
      brand: brandData,
      category: categoryData,
      brandId: data.brandId, // Keep original ID for reference
      categoryId: data.categoryId // Keep original ID for reference
    });
  }

  console.log('Items processed:', items.length);
  console.log('=== API: getInventory SUCCESS ===');

  return { data: items };
};

export const getInventoryItem = async (id) => {
  const docRef = doc(db, 'inventory', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Inventory item not found');
  return { data: docToObject(docSnap) };
};

export const createInventoryItem = async (data) => {
  // Calculate initial total quantity
  const initialQuantity = data.sizes && data.sizes.length > 0
    ? data.sizes.reduce((sum, size) => sum + (size.quantity || 0), 0)
    : (data.quantity || 0);

  // Store initial sizes for tracking
  const initialSizes = data.sizes && data.sizes.length > 0
    ? data.sizes.map(s => ({ ...s, initialQuantity: s.quantity || 0 }))
    : [{ size: 'One Size', quantity: initialQuantity, initialQuantity: initialQuantity }];

  const docRef = await addDoc(collection(db, 'inventory'), {
    brandId: data.brand,
    categoryId: data.category,
    productName: data.productName,
    sizes: initialSizes,
    initialQuantity: initialQuantity, // Track initial stock
    costPerUnit: data.costPerUnit,
    sellingPrice: data.sellingPrice,
    lowStockThreshold: data.lowStockThreshold || 10,
    notes: data.notes || '',
    stockHistory: [], // Track stock changes
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
  console.log('=== API: deleteInventoryItem START ===');
  console.log('1. Item ID to delete:', id);

  if (!id) {
    console.error('ERROR: No ID provided');
    throw new Error('Item ID is required');
  }

  try {
    const docRef = doc(db, 'inventory', id);
    console.log('2. Document reference created');

    // Check if document exists before deleting
    const docSnap = await getDoc(docRef);
    console.log('3. Document exists:', docSnap.exists());

    if (!docSnap.exists()) {
      console.error('ERROR: Document does not exist');
      throw new Error('Inventory item not found');
    }

    console.log('4. Deleting document...');
    await deleteDoc(docRef);
    console.log('5. Document deleted successfully');
    console.log('=== API: deleteInventoryItem SUCCESS ===');

    return { data: { message: 'Inventory item deleted successfully' } };
  } catch (error) {
    console.error('=== API: deleteInventoryItem ERROR ===');
    console.error('Error:', error);
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.code);
    throw error;
  }
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
  console.log('=== API: createSale START ===');
  console.log('1. Received Sale Data:', saleData);
  console.log('2. Customer ID:', saleData.customer);
  console.log('3. Items:', saleData.items);
  console.log('4. Paid Amount:', saleData.paidAmount);
  console.log('5. Sale Type:', saleData.saleType);

  const { customer, items, paidAmount, saleType, notes } = saleData;

  if (!customer) {
    console.error('ERROR: No customer ID provided');
    throw new Error('Customer is required');
  }

  if (!items || items.length === 0) {
    console.error('ERROR: No items provided');
    throw new Error('At least one item is required');
  }

  // Generate invoice number
  console.log('6. Generating invoice number...');
  const salesSnapshot = await getDocs(collection(db, 'sales'));
  const invoiceNumber = `INV-${String(salesSnapshot.size + 1).padStart(6, '0')}`;
  console.log('7. Invoice Number:', invoiceNumber);

  let totalAmount = 0;
  const processedItems = [];

  // Process items and update inventory
  console.log('8. Processing items...');
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`   Processing Item ${i + 1}:`, item);
    console.log(`   Item Inventory ID:`, item.inventory);

    if (!item.inventory) {
      console.error(`ERROR: Item ${i + 1} missing inventory ID`);
      throw new Error(`Item ${i + 1} is missing inventory ID`);
    }

    const inventoryDoc = await getDoc(doc(db, 'inventory', item.inventory));
    console.log(`   Inventory Doc Exists:`, inventoryDoc.exists());

    if (!inventoryDoc.exists()) {
      console.error(`ERROR: Inventory item not found: ${item.inventory}`);
      throw new Error(`Inventory item not found: ${item.inventory}`);
    }

    const inventoryData = inventoryDoc.data();
    console.log(`   Inventory Data:`, inventoryData);
    console.log(`   Inventory Sizes:`, inventoryData.sizes);
    console.log(`   Looking for size:`, item.size);

    const sizeObj = inventoryData.sizes.find(s => s.size === item.size);
    console.log(`   Found Size Object:`, sizeObj);

    if (!sizeObj) {
      console.error(`ERROR: Size ${item.size} not found in inventory`);
      throw new Error(`Size ${item.size} not found for ${inventoryData.productName}`);
    }

    if (sizeObj.quantity < item.quantity) {
      console.error(`ERROR: Insufficient stock. Available: ${sizeObj.quantity}, Requested: ${item.quantity}`);
      throw new Error(`Insufficient stock for ${inventoryData.productName} - Size ${item.size}. Available: ${sizeObj.quantity}, Requested: ${item.quantity}`);
    }

    const itemTotal = item.quantity * item.unitPrice;
    totalAmount += itemTotal;
    console.log(`   Item Total:`, itemTotal);
    console.log(`   Running Total:`, totalAmount);

    processedItems.push({
      inventoryId: item.inventory,
      productName: inventoryData.productName,
      size: item.size,
      quantity: item.quantity,
      unitPrice: item.unitPrice, // Price customer paid
      totalPrice: itemTotal,
      inventorySellingPrice: inventoryData.sellingPrice || 0, // Actual price from inventory
      inventoryCostPrice: inventoryData.costPerUnit || 0, // Cost price from inventory
      profitPerUnit: item.unitPrice - (inventoryData.sellingPrice || 0), // Profit per unit
      totalProfit: (item.unitPrice - (inventoryData.sellingPrice || 0)) * item.quantity // Total profit
    });

    // Update inventory
    console.log(`   Updating inventory...`);
    const oldQuantity = sizeObj.quantity;
    const newQuantity = oldQuantity - item.quantity;

    const updatedSizes = inventoryData.sizes.map(s =>
      s.size === item.size ? { ...s, quantity: newQuantity } : s
    );
    console.log(`   Updated Sizes:`, updatedSizes);

    // Add stock history entry
    const stockHistoryEntry = {
      type: 'sale',
      date: Timestamp.now(),
      size: item.size,
      oldQuantity: oldQuantity,
      newQuantity: newQuantity,
      change: -item.quantity,
      saleId: null, // Will be set after sale is created
      description: `Sold ${item.quantity} units`
    };

    // Get existing history or create new array
    const existingHistory = inventoryData.stockHistory || [];

    await updateDoc(doc(db, 'inventory', item.inventory), {
      sizes: updatedSizes,
      stockHistory: [...existingHistory, stockHistoryEntry]
    });
    console.log(`   Inventory updated successfully`);
  }

  console.log('9. All items processed. Total Amount:', totalAmount);

  const paid = paidAmount || 0;
  const remaining = totalAmount - paid;
  let paymentStatus = 'Unpaid';
  if (paid >= totalAmount) paymentStatus = 'Paid';
  else if (paid > 0) paymentStatus = 'Partial';

  console.log('10. Payment Details:', { paid, remaining, paymentStatus });

  const saleDoc = {
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
      paymentDate: Timestamp.now(),
      paymentMethod: 'Cash'
    }] : [],
    saleDate: serverTimestamp(),
    createdAt: serverTimestamp()
  };

  console.log('11. Creating sale document:', saleDoc);

  const docRef = await addDoc(collection(db, 'sales'), saleDoc);
  console.log('12. Sale document created with ID:', docRef.id);

  // Update stock history with sale ID
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const inventoryDoc = await getDoc(doc(db, 'inventory', item.inventory));
    if (inventoryDoc.exists()) {
      const inventoryData = inventoryDoc.data();
      const history = inventoryData.stockHistory || [];
      if (history.length > 0) {
        // Update the last entry (which we just added) with sale ID
        const lastEntry = history[history.length - 1];
        if (lastEntry.type === 'sale' && !lastEntry.saleId) {
          lastEntry.saleId = docRef.id;
          lastEntry.invoiceNumber = invoiceNumber;
          await updateDoc(doc(db, 'inventory', item.inventory), {
            stockHistory: history
          });
        }
      }
    }
  }

  const docSnap = await getDoc(docRef);
  const result = docToObject(docSnap);
  console.log('13. Sale created successfully:', result);
  console.log('=== API: createSale SUCCESS ===');

  return { data: result };
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
    paymentDate: Timestamp.now(),
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
