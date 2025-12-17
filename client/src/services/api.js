// Firestore API Service
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  increment,
  arrayUnion,
  arrayRemove,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase-config';

// Helper function to convert Firestore document to plain object
const docToObject = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    _id: doc.id, // Support both id and _id for compatibility
    ...data,
    // Convert Firestore Timestamps to Date objects
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
    saleDate: data.saleDate?.toDate ? data.saleDate.toDate() : data.saleDate,
    expectedCompletionDate: data.expectedCompletionDate?.toDate ? data.expectedCompletionDate.toDate() : data.expectedCompletionDate,
  };
};

// Helper function to prepare data for Firestore
const prepareData = (data) => {
  const prepared = { ...data };
  // Remove id/_id fields as they're document IDs, not data
  delete prepared.id;
  delete prepared._id;
  // Convert Date objects to Firestore Timestamps
  if (prepared.createdAt && prepared.createdAt instanceof Date) {
    prepared.createdAt = Timestamp.fromDate(prepared.createdAt);
  }
  if (prepared.updatedAt && prepared.updatedAt instanceof Date) {
    prepared.updatedAt = Timestamp.fromDate(prepared.updatedAt);
  }
  if (prepared.saleDate && prepared.saleDate instanceof Date) {
    prepared.saleDate = Timestamp.fromDate(prepared.saleDate);
  }
  if (prepared.expectedCompletionDate && prepared.expectedCompletionDate instanceof Date) {
    prepared.expectedCompletionDate = Timestamp.fromDate(prepared.expectedCompletionDate);
  }
  return prepared;
};

// ==================== BRANDS ====================
export const getBrands = async () => {
  try {
    const q = query(collection(db, 'brands'), orderBy('name'));
    const snapshot = await getDocs(q);
    const brands = snapshot.docs.map(docToObject);
    return { data: brands };
  } catch (error) {
    console.error('Error fetching brands:', error);
    throw error;
  }
};

export const createBrand = async (brandData) => {
  try {
    const data = {
      ...prepareData(brandData),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isActive: brandData.isActive !== undefined ? brandData.isActive : true
    };
    const docRef = await addDoc(collection(db, 'brands'), data);
    return { data: { id: docRef.id, ...data } };
  } catch (error) {
    console.error('Error creating brand:', error);
    throw error;
  }
};

export const updateBrand = async (id, brandData) => {
  try {
    const data = {
      ...prepareData(brandData),
      updatedAt: Timestamp.now()
    };
    await updateDoc(doc(db, 'brands', id), data);
    return { data: { id, ...data } };
  } catch (error) {
    console.error('Error updating brand:', error);
    throw error;
  }
};

export const deleteBrand = async (id) => {
  try {
    await deleteDoc(doc(db, 'brands', id));
    return { success: true };
  } catch (error) {
    console.error('Error deleting brand:', error);
    throw error;
  }
};

// ==================== CATEGORIES ====================
export const getCategories = async (filters = {}) => {
  try {
    let q = collection(db, 'categories');

    if (filters.brandId) {
      q = query(q, where('brandId', '==', filters.brandId));
    }

    if (filters.parentCategoryId) {
      q = query(q, where('parentCategoryId', '==', filters.parentCategoryId));
    }

    if (filters.mainCategoriesOnly) {
      q = query(q, where('parentCategoryId', '==', null));
    }

    q = query(q, orderBy('name'));
    const snapshot = await getDocs(q);
    const categories = snapshot.docs.map(docToObject);
    return { data: categories };
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};

export const createCategory = async (categoryData) => {
  try {
    const data = {
      ...prepareData(categoryData),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isActive: categoryData.isActive !== undefined ? categoryData.isActive : true,
      parentCategoryId: categoryData.parentCategoryId || null
    };
    const docRef = await addDoc(collection(db, 'categories'), data);
    return { data: { id: docRef.id, ...data } };
  } catch (error) {
    console.error('Error creating category:', error);
    throw error;
  }
};

export const updateCategory = async (id, categoryData) => {
  try {
    const data = {
      ...prepareData(categoryData),
      updatedAt: Timestamp.now(),
      parentCategoryId: categoryData.parentCategoryId || null
    };
    await updateDoc(doc(db, 'categories', id), data);
    return { data: { id, ...data } };
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
};

export const deleteCategory = async (id) => {
  try {
    await deleteDoc(doc(db, 'categories', id));
    return { success: true };
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
};

// ==================== INVENTORY ====================
export const getInventory = async (filters = {}) => {
  try {
    let q = collection(db, 'inventory');

    if (filters.brand) {
      q = query(q, where('brandId', '==', filters.brand));
    }

    if (filters.category) {
      q = query(q, where('categoryId', '==', filters.category));
    }

    q = query(q, orderBy('productName'));
    const snapshot = await getDocs(q);
    let inventory = snapshot.docs.map(docToObject);

    // Filter low stock items if needed
    if (filters.lowStock) {
      inventory = inventory.filter(item => {
        const totalQty = item.sizes?.reduce((sum, s) => sum + (s.quantity || 0), 0) || 0;
        return totalQty <= (item.lowStockThreshold || 10);
      });
    }

    // Populate brand and category references
    const [brandsRes, categoriesRes] = await Promise.all([
      getBrands(),
      getCategories()
    ]);
    const brands = brandsRes.data;
    const categories = categoriesRes.data;

    inventory = inventory.map(item => ({
      ...item,
      brand: brands.find(b => (b.id || b._id) === item.brandId),
      category: categories.find(c => (c.id || c._id) === item.categoryId)
    }));

    return { data: inventory };
  } catch (error) {
    console.error('Error fetching inventory:', error);
    throw error;
  }
};

export const createInventoryItem = async (itemData) => {
  try {
    const data = {
      ...prepareData(itemData),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      brandId: itemData.brand,
      categoryId: itemData.category,
      sizes: itemData.sizes || []
    };
    const docRef = await addDoc(collection(db, 'inventory'), data);
    return { data: { id: docRef.id, ...data } };
  } catch (error) {
    console.error('Error creating inventory item:', error);
    throw error;
  }
};

export const updateInventoryItem = async (id, itemData) => {
  try {
    const data = {
      ...prepareData(itemData),
      updatedAt: Timestamp.now(),
      brandId: itemData.brand || itemData.brandId,
      categoryId: itemData.category || itemData.categoryId
    };
    await updateDoc(doc(db, 'inventory', id), data);
    return { data: { id, ...data } };
  } catch (error) {
    console.error('Error updating inventory item:', error);
    throw error;
  }
};

export const deleteInventoryItem = async (id) => {
  try {
    await deleteDoc(doc(db, 'inventory', id));
    return { success: true };
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    throw error;
  }
};

// ==================== CUSTOMERS ====================
export const getCustomers = async (filters = {}) => {
  try {
    let q = collection(db, 'customers');

    if (filters.type) {
      q = query(q, where('customerType', '==', filters.type));
    }

    q = query(q, orderBy('name'));
    const snapshot = await getDocs(q);
    const customers = snapshot.docs.map(docToObject);
    return { data: customers };
  } catch (error) {
    console.error('Error fetching customers:', error);
    throw error;
  }
};

export const getCustomer = async (id) => {
  try {
    const docSnap = await getDoc(doc(db, 'customers', id));
    if (!docSnap.exists()) {
      throw new Error('Customer not found');
    }

    const customer = docToObject(docSnap);

    // Get customer's sales
    const salesQuery = query(
      collection(db, 'sales'),
      where('customerId', '==', id),
      orderBy('saleDate', 'desc')
    );
    const salesSnapshot = await getDocs(salesQuery);
    const recentSales = salesSnapshot.docs.map(docToObject).slice(0, 10);

    // Calculate summary
    const summary = {
      totalPurchases: recentSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0),
      totalPaid: recentSales.reduce((sum, s) => sum + (s.paidAmount || 0), 0),
      totalOutstanding: recentSales.reduce((sum, s) => sum + (s.remainingAmount || 0), 0)
    };

    return {
      data: {
        customer,
        recentSales,
        summary
      }
    };
  } catch (error) {
    console.error('Error fetching customer:', error);
    throw error;
  }
};

export const createCustomer = async (customerData) => {
  try {
    const data = {
      ...prepareData(customerData),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    const docRef = await addDoc(collection(db, 'customers'), data);
    return { data: { id: docRef.id, ...data } };
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
};

export const updateCustomer = async (id, customerData) => {
  try {
    const data = {
      ...prepareData(customerData),
      updatedAt: Timestamp.now()
    };
    await updateDoc(doc(db, 'customers', id), data);
    return { data: { id, ...data } };
  } catch (error) {
    console.error('Error updating customer:', error);
    throw error;
  }
};

export const deleteCustomer = async (id) => {
  try {
    await deleteDoc(doc(db, 'customers', id));
    return { success: true };
  } catch (error) {
    console.error('Error deleting customer:', error);
    throw error;
  }
};

// ==================== SALES ====================
export const getSales = async (filters = {}) => {
  try {
    let q = collection(db, 'sales');

    if (filters.status) {
      q = query(q, where('paymentStatus', '==', filters.status));
    }

    q = query(q, orderBy('saleDate', 'desc'));
    const snapshot = await getDocs(q);
    let sales = snapshot.docs.map(docToObject);

    // Populate customer references
    const customersRes = await getCustomers();
    const customers = customersRes.data;

    sales = sales.map(sale => ({
      ...sale,
      customer: customers.find(c => (c.id || c._id) === sale.customerId)
    }));

    return { data: sales };
  } catch (error) {
    console.error('Error fetching sales:', error);
    throw error;
  }
};

export const createSale = async (saleData) => {
  try {
    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}`;

    // Calculate totals
    const totalAmount = saleData.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const paidAmount = saleData.paidAmount || 0;
    const remainingAmount = totalAmount - paidAmount;
    const paymentStatus = remainingAmount === 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Unpaid';

    const data = {
      ...prepareData(saleData),
      invoiceNumber,
      customerId: saleData.customer,
      totalAmount,
      paidAmount,
      remainingAmount,
      paymentStatus,
      saleDate: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      items: saleData.items.map(item => ({
        ...item,
        inventoryId: item.inventory
      }))
    };

    const docRef = await addDoc(collection(db, 'sales'), data);

    // Update inventory quantities
    for (const item of saleData.items) {
      const inventoryRef = doc(db, 'inventory', item.inventory);
      const inventoryDoc = await getDoc(inventoryRef);

      if (inventoryDoc.exists()) {
        const inventoryData = inventoryDoc.data();
        const sizes = inventoryData.sizes || [];
        const sizeIndex = sizes.findIndex(s => s.size === item.size);

        if (sizeIndex >= 0) {
          const newSizes = [...sizes];
          newSizes[sizeIndex] = {
            ...newSizes[sizeIndex],
            quantity: Math.max(0, (newSizes[sizeIndex].quantity || 0) - (item.quantity || 0))
          };
          await updateDoc(inventoryRef, { sizes: newSizes });
        }
      }
    }

    return { data: { id: docRef.id, ...data } };
  } catch (error) {
    console.error('Error creating sale:', error);
    throw error;
  }
};

export const addItemsToSale = async (saleId, items) => {
  try {
    const saleRef = doc(db, 'sales', saleId);
    const saleDoc = await getDoc(saleRef);

    if (!saleDoc.exists()) {
      throw new Error('Sale not found');
    }

    const saleData = saleDoc.data();
    const existingItems = saleData.items || [];
    const newItems = items.map(item => ({
      ...item,
      inventoryId: item.inventory
    }));

    const updatedItems = [...existingItems, ...newItems];
    const additionalAmount = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const newTotalAmount = (saleData.totalAmount || 0) + additionalAmount;
    const newRemainingAmount = newTotalAmount - (saleData.paidAmount || 0);
    const newPaymentStatus = newRemainingAmount === 0 ? 'Paid' : saleData.paidAmount > 0 ? 'Partial' : 'Unpaid';

    await updateDoc(saleRef, {
      items: updatedItems,
      totalAmount: newTotalAmount,
      remainingAmount: newRemainingAmount,
      paymentStatus: newPaymentStatus,
      updatedAt: Timestamp.now()
    });

    // Update inventory
    for (const item of items) {
      const inventoryRef = doc(db, 'inventory', item.inventory);
      const inventoryDoc = await getDoc(inventoryRef);

      if (inventoryDoc.exists()) {
        const inventoryData = inventoryDoc.data();
        const sizes = inventoryData.sizes || [];
        const sizeIndex = sizes.findIndex(s => s.size === item.size);

        if (sizeIndex >= 0) {
          const newSizes = [...sizes];
          newSizes[sizeIndex] = {
            ...newSizes[sizeIndex],
            quantity: Math.max(0, (newSizes[sizeIndex].quantity || 0) - (item.quantity || 0))
          };
          await updateDoc(inventoryRef, { sizes: newSizes });
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error adding items to sale:', error);
    throw error;
  }
};

export const addPayment = async (saleId, paymentData) => {
  try {
    const saleRef = doc(db, 'sales', saleId);
    const saleDoc = await getDoc(saleRef);

    if (!saleDoc.exists()) {
      throw new Error('Sale not found');
    }

    const saleData = saleDoc.data();
    const paymentAmount = paymentData.amount || 0;
    const newPaidAmount = (saleData.paidAmount || 0) + paymentAmount;
    const newRemainingAmount = (saleData.totalAmount || 0) - newPaidAmount;
    const newPaymentStatus = newRemainingAmount === 0 ? 'Paid' : newPaidAmount > 0 ? 'Partial' : 'Unpaid';

    // Add payment to payments array
    const payments = saleData.payments || [];
    payments.push({
      amount: paymentAmount,
      paymentMethod: paymentData.paymentMethod || 'Cash',
      notes: paymentData.notes || '',
      date: Timestamp.now()
    });

    await updateDoc(saleRef, {
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      paymentStatus: newPaymentStatus,
      payments,
      updatedAt: Timestamp.now()
    });

    return { success: true };
  } catch (error) {
    console.error('Error adding payment:', error);
    throw error;
  }
};

export const deleteSale = async (id) => {
  try {
    const saleRef = doc(db, 'sales', id);
    const saleDoc = await getDoc(saleRef);

    if (saleDoc.exists()) {
      const saleData = saleDoc.data();

      // Restore inventory
      for (const item of saleData.items || []) {
        const inventoryRef = doc(db, 'inventory', item.inventoryId);
        const inventoryDoc = await getDoc(inventoryRef);

        if (inventoryDoc.exists()) {
          const inventoryData = inventoryDoc.data();
          const sizes = inventoryData.sizes || [];
          const sizeIndex = sizes.findIndex(s => s.size === item.size);

          if (sizeIndex >= 0) {
            const newSizes = [...sizes];
            newSizes[sizeIndex] = {
              ...newSizes[sizeIndex],
              quantity: (newSizes[sizeIndex].quantity || 0) + (item.quantity || 0)
            };
            await updateDoc(inventoryRef, { sizes: newSizes });
          }
        }
      }
    }

    await deleteDoc(saleRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting sale:', error);
    throw error;
  }
};

// ==================== PRODUCTION ====================
export const getProductions = async () => {
  try {
    const q = query(collection(db, 'productions'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    let productions = snapshot.docs.map(docToObject);

    // Populate category references
    const categoriesRes = await getCategories();
    const categories = categoriesRes.data;

    productions = productions.map(prod => ({
      ...prod,
      category: categories.find(c => (c.id || c._id) === prod.category)
    }));

    return { data: productions };
  } catch (error) {
    console.error('Error fetching productions:', error);
    throw error;
  }
};

export const createProduction = async (productionData) => {
  try {
    const batchNumber = `BATCH-${Date.now()}`;
    const data = {
      ...prepareData(productionData),
      batchNumber,
      category: productionData.category,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      addedToInventory: false
    };
    const docRef = await addDoc(collection(db, 'productions'), data);
    return { data: { id: docRef.id, ...data } };
  } catch (error) {
    console.error('Error creating production:', error);
    throw error;
  }
};

export const updateProduction = async (id, productionData) => {
  try {
    const data = {
      ...prepareData(productionData),
      updatedAt: Timestamp.now()
    };
    await updateDoc(doc(db, 'productions', id), data);
    return { data: { id, ...data } };
  } catch (error) {
    console.error('Error updating production:', error);
    throw error;
  }
};

export const moveToInventory = async (productionId, { brandId }) => {
  try {
    const prodRef = doc(db, 'productions', productionId);
    const prodDoc = await getDoc(prodRef);

    if (!prodDoc.exists()) {
      throw new Error('Production batch not found');
    }

    const prodData = prodDoc.data();

    // Create inventory item
    const inventoryData = {
      brandId,
      categoryId: prodData.category,
      productName: prodData.productName,
      sizes: prodData.sizeBreakdown || [],
      costPerUnit: prodData.costPerUnit,
      sellingPrice: prodData.sellingPrice,
      lowStockThreshold: 10,
      notes: `From production batch: ${prodData.batchName}`,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    await addDoc(collection(db, 'inventory'), inventoryData);

    // Update production status
    await updateDoc(prodRef, {
      status: 'Added to Stock',
      addedToInventory: true,
      updatedAt: Timestamp.now()
    });

    return { success: true };
  } catch (error) {
    console.error('Error moving to inventory:', error);
    throw error;
  }
};

export const deleteProduction = async (id) => {
  try {
    await deleteDoc(doc(db, 'productions', id));
    return { success: true };
  } catch (error) {
    console.error('Error deleting production:', error);
    throw error;
  }
};

// ==================== STATS ====================
export const getDashboardStats = async () => {
  try {
    const [inventoryRes, salesRes, customersRes, productionsRes] = await Promise.all([
      getInventory(),
      getSales(),
      getCustomers(),
      getProductions()
    ]);

    const inventory = inventoryRes.data;
    const sales = salesRes.data;
    const customers = customersRes.data;
    const productions = productionsRes.data;

    // Calculate inventory stats
    const totalStock = inventory.reduce((sum, item) => {
      return sum + (item.sizes?.reduce((s, size) => s + (size.quantity || 0), 0) || 0);
    }, 0);

    const totalValue = inventory.reduce((sum, item) => {
      const qty = item.sizes?.reduce((s, size) => s + (size.quantity || 0), 0) || 0;
      return sum + (qty * (item.costPerUnit || 0));
    }, 0);

    const lowStockItems = inventory.filter(item => {
      const qty = item.sizes?.reduce((s, size) => s + (size.quantity || 0), 0) || 0;
      return qty <= (item.lowStockThreshold || 10);
    });

    // Calculate sales stats
    const totalSales = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalPaid = sales.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
    const totalCredit = sales.reduce((sum, s) => sum + (s.remainingAmount || 0), 0);

    // Sales by date (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSales = sales.filter(s => {
      const saleDate = s.saleDate?.toDate ? s.saleDate.toDate() : new Date(s.saleDate);
      return saleDate >= thirtyDaysAgo;
    });

    const salesByDate = {};
    recentSales.forEach(sale => {
      const date = sale.saleDate?.toDate ? sale.saleDate.toDate() : new Date(sale.saleDate);
      const dateKey = date.toISOString().split('T')[0];
      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = { totalSales: 0, count: 0 };
      }
      salesByDate[dateKey].totalSales += sale.totalAmount || 0;
      salesByDate[dateKey].count += 1;
    });

    // Top products
    const productSales = {};
    sales.forEach(sale => {
      sale.items?.forEach(item => {
        if (!productSales[item.productName]) {
          productSales[item.productName] = { totalQuantity: 0, totalRevenue: 0 };
        }
        productSales[item.productName].totalQuantity += item.quantity || 0;
        productSales[item.productName].totalRevenue += item.totalPrice || 0;
      });
    });

    const topProducts = Object.entries(productSales)
      .map(([name, stats]) => ({ _id: name, ...stats }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    return {
      data: {
        inventory: {
          totalStock,
          totalValue,
          totalProducts: inventory.length,
          lowStockItems: lowStockItems.map(item => ({
            productName: item.productName,
            brand: item.brand?.name || 'N/A',
            category: item.category?.name || 'N/A',
            quantity: item.sizes?.reduce((s, size) => s + (size.quantity || 0), 0) || 0
          }))
        },
        sales: {
          totalSales,
          totalPaid,
          totalCredit,
          totalTransactions: sales.length
        },
        customers: {
          total: customers.length
        },
        production: {
          inProcess: productions.filter(p => p.status === 'In Process').length
        },
        salesByDate: Object.entries(salesByDate).map(([date, stats]) => ({
          _id: date,
          ...stats
        })),
        topProducts
      }
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
};

export const getSalesStats = async () => {
  try {
    const salesRes = await getSales();
    const sales = salesRes.data;

    return {
      data: {
        totalSales: sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0),
        totalPaid: sales.reduce((sum, s) => sum + (s.paidAmount || 0), 0),
        totalCredit: sales.reduce((sum, s) => sum + (s.remainingAmount || 0), 0),
        totalTransactions: sales.length
      }
    };
  } catch (error) {
    console.error('Error fetching sales stats:', error);
    throw error;
  }
};

export const getInventoryStats = async () => {
  try {
    const inventoryRes = await getInventory();
    const inventory = inventoryRes.data;

    const totalStock = inventory.reduce((sum, item) => {
      return sum + (item.sizes?.reduce((s, size) => s + (size.quantity || 0), 0) || 0);
    }, 0);

    const totalValue = inventory.reduce((sum, item) => {
      const qty = item.sizes?.reduce((s, size) => s + (size.quantity || 0), 0) || 0;
      return sum + (qty * (item.costPerUnit || 0));
    }, 0);

    return {
      data: {
        totalStock,
        totalValue,
        totalProducts: inventory.length
      }
    };
  } catch (error) {
    console.error('Error fetching inventory stats:', error);
    throw error;
  }
};

// ==================== SLIDERS ====================
export const getSliders = async () => {
  try {
    const q = query(collection(db, 'sliders'), orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    const sliders = snapshot.docs.map(docToObject);
    return { data: sliders };
  } catch (error) {
    console.error('Error fetching sliders:', error);
    throw error;
  }
};

export const createSlider = async (sliderData) => {
  try {
    const data = {
      ...prepareData(sliderData),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      status: sliderData.status !== undefined ? sliderData.status : true,
      order: sliderData.order || 0
    };
    const docRef = await addDoc(collection(db, 'sliders'), data);
    return { data: { id: docRef.id, ...data } };
  } catch (error) {
    console.error('Error creating slider:', error);
    throw error;
  }
};

export const updateSlider = async (id, sliderData) => {
  try {
    const data = {
      ...prepareData(sliderData),
      updatedAt: Timestamp.now()
    };
    await updateDoc(doc(db, 'sliders', id), data);
    return { data: { id, ...data } };
  } catch (error) {
    console.error('Error updating slider:', error);
    throw error;
  }
};

export const deleteSlider = async (id) => {
  try {
    await deleteDoc(doc(db, 'sliders', id));
    return { success: true };
  } catch (error) {
    console.error('Error deleting slider:', error);
    throw error;
  }
};

export const reorderSliders = async (updates) => {
  try {
    // Update multiple sliders' order values
    const updatePromises = updates.map(({ id, order }) =>
      updateDoc(doc(db, 'sliders', id), { order, updatedAt: Timestamp.now() })
    );
    await Promise.all(updatePromises);
    return { success: true };
  } catch (error) {
    console.error('Error reordering sliders:', error);
    throw error;
  }
};

// ==================== ORDERS ====================
export const getOrders = async (filters = {}) => {
  try {
    let q = collection(db, 'orders');

    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }

    q = query(q, orderBy('orderDate', 'desc'));
    const snapshot = await getDocs(q);
    let orders = snapshot.docs.map(docToObject);

    // Populate customer references if customerId exists
    const customersRes = await getCustomers();
    const customers = customersRes.data;

    orders = orders.map(order => ({
      ...order,
      customer: order.customerId ? customers.find(c => (c.id || c._id) === order.customerId) : order.customer
    }));

    return { data: orders };
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
};

export const getOrder = async (id) => {
  try {
    const docSnap = await getDoc(doc(db, 'orders', id));
    if (!docSnap.exists()) {
      throw new Error('Order not found');
    }

    const order = docToObject(docSnap);

    // Populate customer if customerId exists
    if (order.customerId) {
      try {
        const customersRes = await getCustomers();
        const customers = customersRes.data;
        order.customer = customers.find(c => (c.id || c._id) === order.customerId);
      } catch (error) {
        console.error('Error fetching customer:', error);
      }
    }

    return { data: order };
  } catch (error) {
    console.error('Error fetching order:', error);
    throw error;
  }
};

export const createOrder = async (orderData) => {
  try {
    // Generate order number
    const orderNumber = `ORD-${Date.now()}`;

    const data = {
      ...prepareData(orderData),
      orderNumber,
      orderDate: Timestamp.now(),
      status: orderData.status || 'Pending',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, 'orders'), data);
    return { data: { id: docRef.id, ...data } };
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
};

export const updateOrderStatus = async (id, newStatus) => {
  try {
    const validStatuses = ['Pending', 'Accepted', 'Shipped', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Get current order to check previous status
    const orderRef = doc(db, 'orders', id);
    const orderDoc = await getDoc(orderRef);

    if (!orderDoc.exists()) {
      throw new Error('Order not found');
    }

    const currentOrder = orderDoc.data();
    const previousStatus = currentOrder.status;

    // If status is changing to "Accepted", reduce inventory atomically
    if (newStatus === 'Accepted' && previousStatus === 'Pending') {
      await runTransaction(db, async (transaction) => {
        // Re-read order to ensure we have latest data
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) {
          throw new Error('Order not found');
        }

        const order = orderSnap.data();

        // Process each item in the order
        for (const item of order.items || []) {
          if (!item.inventoryId) continue;

          const inventoryRef = doc(db, 'inventory', item.inventoryId);
          const inventorySnap = await transaction.get(inventoryRef);

          if (!inventorySnap.exists()) {
            console.warn(`Inventory item ${item.inventoryId} not found`);
            continue;
          }

          const inventoryData = inventorySnap.data();
          const sizes = inventoryData.sizes || [];
          const sizeIndex = sizes.findIndex(s => s.size === item.size);

          if (sizeIndex >= 0) {
            const currentQuantity = sizes[sizeIndex].quantity || 0;
            const requestedQuantity = item.quantity || 0;

            // Check if enough stock available
            if (currentQuantity < requestedQuantity) {
              throw new Error(
                `Insufficient stock for ${item.productName} (Size: ${item.size}). ` +
                `Available: ${currentQuantity}, Requested: ${requestedQuantity}`
              );
            }

            // Update size quantity atomically
            const newSizes = [...sizes];
            newSizes[sizeIndex] = {
              ...newSizes[sizeIndex],
              quantity: currentQuantity - requestedQuantity
            };

            transaction.update(inventoryRef, {
              sizes: newSizes,
              updatedAt: Timestamp.now()
            });
          } else {
            throw new Error(`Size ${item.size} not found for ${item.productName}`);
          }
        }

        // Update order status
        const updateData = {
          status: newStatus,
          updatedAt: Timestamp.now()
        };

        transaction.update(orderRef, updateData);
      });
    } else {
      // For other status changes, just update order
      const updateData = {
        status: newStatus,
        updatedAt: Timestamp.now()
      };

      // Add tracking number if status is Shipped
      if (newStatus === 'Shipped' && !currentOrder.trackingNumber) {
        updateData.trackingNumber = `TRACK-${Date.now()}`;
      }

      await updateDoc(orderRef, updateData);
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
};

export const updateOrder = async (id, orderData) => {
  try {
    const data = {
      ...prepareData(orderData),
      updatedAt: Timestamp.now()
    };
    await updateDoc(doc(db, 'orders', id), data);
    return { data: { id, ...data } };
  } catch (error) {
    console.error('Error updating order:', error);
    throw error;
  }
};

export const deleteOrder = async (id) => {
  try {
    await deleteDoc(doc(db, 'orders', id));
    return { success: true };
  } catch (error) {
    console.error('Error deleting order:', error);
    throw error;
  }
};

// ==================== ONLINE SALES ANALYTICS ====================
export const getOnlineSalesStats = async () => {
  try {
    const ordersRes = await getOrders();
    const orders = ordersRes.data;

    // Filter only delivered orders for revenue calculation
    const deliveredOrders = orders.filter(o => o.status === 'Delivered');

    // Calculate total online revenue
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    // Calculate product-wise sales
    const productSales = {};
    deliveredOrders.forEach(order => {
      order.items?.forEach(item => {
        const productKey = `${item.productName}_${item.size || 'N/A'}`;
        if (!productSales[productKey]) {
          productSales[productKey] = {
            productName: item.productName,
            size: item.size || 'N/A',
            sku: item.sku || 'N/A',
            totalQuantity: 0,
            totalRevenue: 0,
            unitPrice: item.unitPrice || 0
          };
        }
        productSales[productKey].totalQuantity += item.quantity || 0;
        productSales[productKey].totalRevenue += (item.unitPrice || 0) * (item.quantity || 0);
      });
    });

    // Convert to array and sort by revenue
    const productSalesArray = Object.values(productSales)
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Calculate metrics
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'Pending').length;
    const acceptedOrders = orders.filter(o => o.status === 'Accepted').length;
    const shippedOrders = orders.filter(o => o.status === 'Shipped').length;
    const deliveredOrdersCount = deliveredOrders.length;

    return {
      data: {
        totalRevenue,
        totalOrders,
        pendingOrders,
        acceptedOrders,
        shippedOrders,
        deliveredOrders: deliveredOrdersCount,
        productSales: productSalesArray,
        // Additional metrics
        averageOrderValue: deliveredOrdersCount > 0 ? totalRevenue / deliveredOrdersCount : 0,
        totalUnitsSold: productSalesArray.reduce((sum, p) => sum + p.totalQuantity, 0)
      }
    };
  } catch (error) {
    console.error('Error fetching online sales stats:', error);
    throw error;
  }
};

export const getProductOnlineSales = async (productId) => {
  try {
    const ordersRes = await getOrders();
    const orders = ordersRes.data.filter(o => o.status === 'Delivered');

    let totalQuantity = 0;
    let totalRevenue = 0;

    orders.forEach(order => {
      order.items?.forEach(item => {
        if (item.inventoryId === productId) {
          totalQuantity += item.quantity || 0;
          totalRevenue += (item.unitPrice || 0) * (item.quantity || 0);
        }
      });
    });

    return {
      data: {
        totalQuantity,
        totalRevenue
      }
    };
  } catch (error) {
    console.error('Error fetching product online sales:', error);
    throw error;
  }
};

// ==================== REVIEWS ====================
export const getReviews = async (filters = {}) => {
  try {
    let q = collection(db, 'reviews');

    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }

    q = query(q, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const reviews = snapshot.docs.map(docToObject);
    return { data: reviews };
  } catch (error) {
    console.error('Error fetching reviews:', error);
    throw error;
  }
};

export const updateReviewStatus = async (reviewId, status) => {
  try {
    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    await updateDoc(doc(db, 'reviews', reviewId), {
      status,
      updatedAt: Timestamp.now()
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating review status:', error);
    throw error;
  }
};

export const deleteReview = async (id) => {
  try {
    await deleteDoc(doc(db, 'reviews', id));
    return { success: true };
  } catch (error) {
    console.error('Error deleting review:', error);
    throw error;
  }
};
