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

// Helper function to safely convert Firestore Timestamp to Date
const convertTimestamp = (timestamp) => {
  if (!timestamp) return null;

  // If it's already a Date object
  if (timestamp instanceof Date) {
    return timestamp;
  }

  // If it has toDate method (Firestore Timestamp)
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }

  // If it has seconds property (Firestore Timestamp format)
  if (timestamp.seconds !== undefined) {
    return new Date(timestamp.seconds * 1000);
  }

  // If it's a number (timestamp in milliseconds)
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }

  // Return as-is if we can't convert it
  return timestamp;
};

// Helper function to convert Firestore document to plain object
const docToObject = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    _id: doc.id, // Support both id and _id for compatibility
    ...data,
    // Convert Firestore Timestamps to Date objects
    createdAt: convertTimestamp(data.createdAt),
    updatedAt: convertTimestamp(data.updatedAt),
    saleDate: convertTimestamp(data.saleDate),
    expectedCompletionDate: convertTimestamp(data.expectedCompletionDate),
    orderDate: convertTimestamp(data.orderDate),
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

  // Clean arrays - remove undefined, null, and empty string elements
  Object.keys(prepared).forEach(key => {
    if (Array.isArray(prepared[key])) {
      prepared[key] = prepared[key].filter(item =>
        item !== undefined &&
        item !== null &&
        item !== '' &&
        !(typeof item === 'object' && Object.keys(item).length === 0)
      );
    }
  });

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
    throw error;
  }
};

export const deleteBrand = async (id) => {
  try {
    await deleteDoc(doc(db, 'brands', id));
    return { success: true };
  } catch (error) {
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

    throw error;
  }
};

export const deleteCategory = async (id) => {
  try {
    await deleteDoc(doc(db, 'categories', id));
    return { success: true };
  } catch (error) {

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

    throw error;
  }
};

export const createInventoryItem = async (itemData) => {
  try {
    console.log('🔍 [API] createInventoryItem - Received itemData:', itemData);

    const prepared = prepareData(itemData);
    console.log('🔍 [API] createInventoryItem - After prepareData:', prepared);

    // Remove undefined values - Firestore doesn't accept undefined
    const cleanData = Object.fromEntries(
      Object.entries(prepared).filter(([_, value]) => value !== undefined)
    );
    console.log('🔍 [API] createInventoryItem - After removing undefined:', cleanData);

    // Clean productImages array - remove empty/undefined/null elements
    const cleanProductImages = Array.isArray(itemData.productImages)
      ? itemData.productImages.filter(img => img && img !== '' && img !== undefined && img !== null)
      : [];

    const data = {
      ...cleanData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      sizes: itemData.sizes || [],
      productImages: cleanProductImages
    };

    // Only add brandId and categoryId if they are defined
    if (itemData.brand !== undefined && itemData.brand !== null && itemData.brand !== '') {
      data.brandId = itemData.brand;
    }
    if (itemData.category !== undefined && itemData.category !== null && itemData.category !== '') {
      data.categoryId = itemData.category;
    }

    // Deep clean: Remove undefined from nested objects and arrays
    const deepClean = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(item => deepClean(item)).filter(item => item !== undefined && item !== null && item !== '');
      }
      if (obj && typeof obj === 'object') {
        const cleaned = {};
        Object.keys(obj).forEach(key => {
          const value = obj[key];
          if (value !== undefined && value !== null) {
            cleaned[key] = deepClean(value);
          }
        });
        return cleaned;
      }
      return obj;
    };

    const cleanedData = deepClean(data);

    // Final cleanup to remove any undefined values that might have been added
    const finalData = Object.fromEntries(
      Object.entries(cleanedData).filter(([_, value]) => value !== undefined)
    );

    // Check for undefined values before sending to Firestore
    const undefinedFields = Object.entries(finalData).filter(([key, value]) => value === undefined);
    if (undefinedFields.length > 0) {
      console.error('❌ [API] createInventoryItem - Found undefined fields in finalData:', undefinedFields);
      console.error('❌ [API] createInventoryItem - Full finalData:', finalData);
    } else {
      console.log('✅ [API] createInventoryItem - No undefined fields, sending to Firestore:', finalData);
    }

    const docRef = await addDoc(collection(db, 'inventory'), finalData);
    return { data: { id: docRef.id, ...finalData } };
  } catch (error) {
    console.error('❌ [API] createInventoryItem - Error:', error);
    console.error('❌ [API] createInventoryItem - Error message:', error.message);
    throw error;
  }
};

export const updateInventoryItem = async (id, itemData) => {
  try {
    console.log('🔍 [API] updateInventoryItem - Received itemData:', itemData);
    console.log('🔍 [API] updateInventoryItem - Document ID:', id);

    const prepared = prepareData(itemData);
    console.log('🔍 [API] updateInventoryItem - After prepareData:', prepared);

    // Remove undefined values - Firestore doesn't accept undefined
    const cleanData = Object.fromEntries(
      Object.entries(prepared).filter(([_, value]) => value !== undefined)
    );
    console.log('🔍 [API] updateInventoryItem - After removing undefined:', cleanData);

    // Clean productImages array - remove empty/undefined/null elements
    const cleanProductImages = Array.isArray(itemData.productImages)
      ? itemData.productImages.filter(img => img && img !== '' && img !== undefined && img !== null)
      : (itemData.productImages || []);

    const data = {
      ...cleanData,
      updatedAt: Timestamp.now(),
      productImages: cleanProductImages
    };

    // Only add brandId and categoryId if they are defined
    const brandId = itemData.brand || itemData.brandId;
    if (brandId !== undefined && brandId !== null && brandId !== '') {
      data.brandId = brandId;
    }
    const categoryId = itemData.category || itemData.categoryId;
    if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
      data.categoryId = categoryId;
    }

    // Deep clean: Remove undefined from nested objects and arrays
    const deepClean = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(item => deepClean(item)).filter(item => item !== undefined && item !== null && item !== '');
      }
      if (obj && typeof obj === 'object') {
        const cleaned = {};
        Object.keys(obj).forEach(key => {
          const value = obj[key];
          if (value !== undefined && value !== null) {
            cleaned[key] = deepClean(value);
          }
        });
        return cleaned;
      }
      return obj;
    };

    const cleanedData = deepClean(data);

    // Final cleanup to remove any undefined values that might have been added
    const finalData = Object.fromEntries(
      Object.entries(cleanedData).filter(([_, value]) => value !== undefined)
    );

    // Check for undefined values before sending to Firestore
    const undefinedFields = Object.entries(finalData).filter(([key, value]) => value === undefined);
    if (undefinedFields.length > 0) {
      console.error('❌ [API] updateInventoryItem - Found undefined fields in finalData:', undefinedFields);
      console.error('❌ [API] updateInventoryItem - Full finalData:', finalData);
    } else {
      console.log('✅ [API] updateInventoryItem - No undefined fields, sending to Firestore:', finalData);
    }

    await updateDoc(doc(db, 'inventory', id), finalData);
    return { data: { id, ...finalData } };
  } catch (error) {
    console.error('❌ [API] updateInventoryItem - Error:', error);
    console.error('❌ [API] updateInventoryItem - Error message:', error.message);
    throw error;
  }
};

export const deleteInventoryItem = async (id) => {
  try {
    await deleteDoc(doc(db, 'inventory', id));
    return { success: true };
  } catch (error) {

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

    throw error;
  }
};

export const deleteCustomer = async (id) => {
  try {
    await deleteDoc(doc(db, 'customers', id));
    return { success: true };
  } catch (error) {

    throw error;
  }
};

// ==================== SALES ====================
export const getSales = async (filters = {}) => {
  try {
    let q = query(collection(db, 'sales'));

    // Try to use server-side filtering if status is provided
    if (filters.status && filters.status.trim() !== '') {
      q = query(q, where('paymentStatus', '==', filters.status), orderBy('saleDate', 'desc'));
    } else {
      q = query(q, orderBy('saleDate', 'desc'));
    }

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
    // If the error is about missing index, try fetching all and filtering client-side
    if (error.message && (error.message.includes('index') || error.message.includes('requires an index'))) {
      console.warn('Firestore index missing. Fetching all sales and filtering client-side.');
      try {
        // Fetch all sales without the status filter
        let q = query(collection(db, 'sales'), orderBy('saleDate', 'desc'));
        const snapshot = await getDocs(q);
        let sales = snapshot.docs.map(docToObject);

        // Client-side filtering
        if (filters.status && filters.status.trim() !== '') {
          sales = sales.filter(sale => sale.paymentStatus === filters.status);
        }

        // Populate customer references
        const customersRes = await getCustomers();
        const customers = customersRes.data;

        sales = sales.map(sale => ({
          ...sale,
          customer: customers.find(c => (c.id || c._id) === sale.customerId)
        }));

        return { data: sales };
      } catch (fallbackError) {
        throw fallbackError;
      }
    }
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

    throw error;
  }
};

export const updateSale = async (saleId, saleData) => {
  try {
    const saleRef = doc(db, 'sales', saleId);
    const saleDoc = await getDoc(saleRef);

    if (!saleDoc.exists()) {
      throw new Error('Sale not found');
    }

    const existingSale = saleDoc.data();

    // Calculate new totals
    const totalAmount = saleData.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const paidAmount = saleData.paidAmount || existingSale.paidAmount || 0;
    const remainingAmount = totalAmount - paidAmount;
    const paymentStatus = remainingAmount === 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Unpaid';

    // Get old items to restore inventory
    const oldItems = existingSale.items || [];
    const newItems = saleData.items || [];

    // Create maps to track inventory changes by inventoryId + size
    const inventoryChanges = new Map();

    // Process old items: restore inventory (add back)
    for (const item of oldItems) {
      if (item.inventoryId) {
        const key = `${item.inventoryId}_${item.size}`;
        const currentChange = inventoryChanges.get(key) || { inventoryId: item.inventoryId, size: item.size, quantity: 0 };
        currentChange.quantity += (item.quantity || 0); // Add back old quantity
        inventoryChanges.set(key, currentChange);
      }
    }

    // Process new items: deduct inventory (subtract)
    for (const item of newItems) {
      const inventoryId = item.inventory || item.inventoryId;
      if (inventoryId) {
        const key = `${inventoryId}_${item.size}`;
        const currentChange = inventoryChanges.get(key) || { inventoryId, size: item.size, quantity: 0 };
        currentChange.quantity -= (item.quantity || 0); // Subtract new quantity
        inventoryChanges.set(key, currentChange);
      }
    }

    // Apply inventory changes (net difference)
    for (const change of inventoryChanges.values()) {
      if (change.quantity !== 0) { // Only update if there's a change
        const inventoryRef = doc(db, 'inventory', change.inventoryId);
        const inventoryDoc = await getDoc(inventoryRef);

        if (inventoryDoc.exists()) {
          const inventoryData = inventoryDoc.data();
          const sizes = inventoryData.sizes || [];
          const sizeIndex = sizes.findIndex(s => s.size === change.size);

          if (sizeIndex >= 0) {
            const newSizes = [...sizes];
            const currentQty = newSizes[sizeIndex].quantity || 0;
            newSizes[sizeIndex] = {
              ...newSizes[sizeIndex],
              quantity: Math.max(0, currentQty + change.quantity) // Add the net change
            };
            await updateDoc(inventoryRef, { sizes: newSizes });
          }
        }
      }
    }

    // Update sale - filter out undefined values
    const preparedData = prepareData(saleData);
    const data = {
      ...Object.fromEntries(
        Object.entries(preparedData).filter(([_, value]) => value !== undefined)
      ),
      customerId: saleData.customer || existingSale.customerId || null,
      totalAmount,
      paidAmount,
      remainingAmount,
      paymentStatus,
      items: saleData.items.map(item => ({
        productName: item.productName || '',
        size: item.size || '',
        quantity: item.quantity || 0,
        unitPrice: item.unitPrice || 0,
        totalPrice: item.totalPrice || 0,
        inventoryId: item.inventory || item.inventoryId || null,
        inventorySellingPrice: item.inventorySellingPrice || null,
        inventoryCostPrice: item.inventoryCostPrice || null,
        profitPerUnit: item.profitPerUnit || null,
        totalProfit: item.totalProfit || null
      })),
      saleType: saleData.saleType || existingSale.saleType || 'Cash',
      notes: saleData.notes !== undefined ? saleData.notes : (existingSale.notes || ''),
      updatedAt: Timestamp.now()
    };

    // Remove any remaining undefined values
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );

    await updateDoc(saleRef, cleanData);

    return { success: true };
  } catch (error) {
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

    throw error;
  }
};

export const deleteProduction = async (id) => {
  try {
    await deleteDoc(doc(db, 'productions', id));
    return { success: true };
  } catch (error) {

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

    throw error;
  }
};

export const deleteSlider = async (id) => {
  try {
    await deleteDoc(doc(db, 'sliders', id));
    return { success: true };
  } catch (error) {

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

      }
    }

    return { data: order };
  } catch (error) {

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

    throw error;
  }
};

export const deleteOrder = async (id) => {
  try {
    await deleteDoc(doc(db, 'orders', id));
    return { success: true };
  } catch (error) {

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

    throw error;
  }
};

// ==================== REVIEWS ====================
export const getReviews = async (filters = {}) => {
  try {
    let q = collection(db, 'reviews');

    // Apply filters without orderBy to avoid composite index requirement
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }

    if (filters.productId) {
      q = query(q, where('productId', '==', filters.productId));
    }

    // Fetch without orderBy - sort client-side instead
    const snapshot = await getDocs(q);
    let reviews = snapshot.docs.map(docToObject);

    // Sort client-side by createdAt (descending) - no index needed
    reviews.sort((a, b) => {
      const dateA = a.createdAt?.seconds || a.createdAt?._seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
      const dateB = b.createdAt?.seconds || b.createdAt?._seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
      return dateB - dateA; // Descending order (newest first)
    });

    return { data: reviews };
  } catch (error) {

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

    throw error;
  }
};

export const deleteReview = async (id) => {
  try {
    await deleteDoc(doc(db, 'reviews', id));
    return { success: true };
  } catch (error) {

    throw error;
  }
};

// ==================== EXPENSES ====================
export const getExpenses = async (filters = {}) => {
  try {
    let q = collection(db, 'expenses');

    if (filters.startDate && filters.endDate) {
      const startTimestamp = Timestamp.fromDate(new Date(filters.startDate));
      const endTimestamp = Timestamp.fromDate(new Date(filters.endDate));
      endTimestamp.seconds += 86400; // Add 1 day to include the end date
      q = query(q, where('expenseDate', '>=', startTimestamp), where('expenseDate', '<=', endTimestamp), orderBy('expenseDate', 'desc'));
    } else if (filters.month && filters.year && !isNaN(filters.month) && !isNaN(filters.year)) {
      // Filter by month and year
      const startDate = new Date(filters.year, filters.month - 1, 1, 0, 0, 0, 0);
      const endDate = new Date(filters.year, filters.month, 0, 23, 59, 59, 999);
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);
      q = query(q, where('expenseDate', '>=', startTimestamp), where('expenseDate', '<=', endTimestamp), orderBy('expenseDate', 'desc'));
    } else {
      // No filters, just order by date
      q = query(q, orderBy('expenseDate', 'desc'));
    }

    const snapshot = await getDocs(q);
    let expenses = snapshot.docs.map(docToObject);

    return { data: expenses };
  } catch (error) {
    // If the error is about missing index, try fetching all and filtering client-side
    if (error.message && (error.message.includes('index') || error.message.includes('requires an index'))) {
      console.warn('Firestore index missing for expenses. Using client-side filtering.');
      try {
        // Fetch all expenses without filter
        let q = query(collection(db, 'expenses'), orderBy('expenseDate', 'desc'));
        const snapshot = await getDocs(q);
        let expenses = snapshot.docs.map(docToObject);

        // Client-side filtering
        if (filters.month && filters.year) {
          expenses = expenses.filter(expense => {
            const expenseDate = convertTimestamp(expense.expenseDate);
            if (!expenseDate) return false;
            return expenseDate.getFullYear() === filters.year && expenseDate.getMonth() === filters.month - 1;
          });
        } else if (filters.startDate && filters.endDate) {
          const startDate = new Date(filters.startDate);
          const endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59, 999);
          expenses = expenses.filter(expense => {
            const expenseDate = convertTimestamp(expense.expenseDate);
            if (!expenseDate) return false;
            return expenseDate >= startDate && expenseDate <= endDate;
          });
        }

        return { data: expenses };
      } catch (fallbackError) {
        throw fallbackError;
      }
    }
    throw error;
  }
};

export const createExpense = async (expenseData) => {
  try {
    const data = {
      ...prepareData(expenseData),
      expenseDate: expenseData.expenseDate ? Timestamp.fromDate(new Date(expenseData.expenseDate)) : Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    const docRef = await addDoc(collection(db, 'expenses'), data);
    return { data: { id: docRef.id, ...data } };
  } catch (error) {
    throw error;
  }
};

export const updateExpense = async (id, expenseData) => {
  try {
    const data = {
      ...prepareData(expenseData),
      expenseDate: expenseData.expenseDate ? Timestamp.fromDate(new Date(expenseData.expenseDate)) : Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    await updateDoc(doc(db, 'expenses', id), data);
    return { data: { id, ...data } };
  } catch (error) {
    throw error;
  }
};

export const deleteExpense = async (id) => {
  try {
    await deleteDoc(doc(db, 'expenses', id));
    return { success: true };
  } catch (error) {
    throw error;
  }
};

export const getMonthlyProfitLoss = async (year, month) => {
  try {
    // Get sales for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);

    const salesQuery = query(
      collection(db, 'sales'),
      where('saleDate', '>=', startTimestamp),
      where('saleDate', '<=', endTimestamp),
      orderBy('saleDate', 'desc')
    );
    const salesSnapshot = await getDocs(salesQuery);
    const sales = salesSnapshot.docs.map(docToObject);
    const totalSales = sales.reduce((sum, sale) => sum + (parseFloat(sale.totalAmount) || 0), 0);

    // Get expenses for the month
    const expensesQuery = query(
      collection(db, 'expenses'),
      where('expenseDate', '>=', startTimestamp),
      where('expenseDate', '<=', endTimestamp),
      orderBy('expenseDate', 'desc')
    );
    const expensesSnapshot = await getDocs(expensesQuery);
    const expenses = expensesSnapshot.docs.map(docToObject);
    const totalExpenses = expenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);

    const netProfit = totalSales - totalExpenses;

    return {
      data: {
        month,
        year,
        totalSales: parseFloat(totalSales) || 0,
        totalExpenses: parseFloat(totalExpenses) || 0,
        netProfit: parseFloat(netProfit) || 0,
        salesCount: sales.length,
        expensesCount: expenses.length
      }
    };
  } catch (error) {
    // Fallback to client-side calculation if index doesn't exist
    try {
      const [salesRes, expensesRes] = await Promise.all([
        getSales(),
        getExpenses()
      ]);

      const sales = salesRes.data.filter(sale => {
        const saleDate = convertTimestamp(sale.saleDate);
        if (!saleDate) return false;
        return saleDate.getFullYear() === year && saleDate.getMonth() === month - 1;
      });

      const expenses = expensesRes.data.filter(expense => {
        const expenseDate = convertTimestamp(expense.expenseDate);
        if (!expenseDate) return false;
        return expenseDate.getFullYear() === year && expenseDate.getMonth() === month - 1;
      });

      const totalSales = sales.reduce((sum, sale) => sum + (parseFloat(sale.totalAmount) || 0), 0);
      const totalExpenses = expenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);
      const netProfit = totalSales - totalExpenses;

      return {
        data: {
          month,
          year,
          totalSales: parseFloat(totalSales) || 0,
          totalExpenses: parseFloat(totalExpenses) || 0,
          netProfit: parseFloat(netProfit) || 0,
          salesCount: sales.length,
          expensesCount: expenses.length
        }
      };
    } catch (fallbackError) {
      throw fallbackError;
    }
  }
};
