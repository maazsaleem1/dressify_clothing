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

const paymentToObject = (docSnap) => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    _id: docSnap.id,
    ...data,
    paymentDate: convertTimestamp(data.paymentDate),
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

    // Prefer latest-first; fall back if createdAt index missing with filters
    try {
      q = query(q, orderBy('createdAt', 'desc'));
    } catch (_) {
      q = query(q, orderBy('productName'));
    }
    let snapshot;
    try {
      snapshot = await getDocs(q);
    } catch (indexError) {
      // Composite index missing (brand/category + createdAt) — fetch without order, sort client-side
      let fallbackQ = collection(db, 'inventory');
      if (filters.brand) {
        fallbackQ = query(fallbackQ, where('brandId', '==', filters.brand));
      }
      if (filters.category) {
        fallbackQ = query(fallbackQ, where('categoryId', '==', filters.category));
      }
      snapshot = await getDocs(fallbackQ);
    }
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

    // Latest products on top (createdAt desc); items without date go last
    const toMs = (v) => {
      if (!v) return 0;
      if (v instanceof Date) return v.getTime();
      if (typeof v?.toDate === 'function') return v.toDate().getTime();
      if (v?.seconds != null) return v.seconds * 1000;
      const d = new Date(v);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };
    inventory.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

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

    // Set base purchase & landed cost fields for product costing
    const totalQty = parseFloat(itemData.initialQuantity) ||
      (itemData.sizes || []).reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
    const unitInput = parseFloat(itemData.costPerUnit) || 0;
    const basePurchaseCost = parseFloat(itemData.basePurchaseCost) || (unitInput * totalQty) || 0;
    const costPerUnit = totalQty > 0
      ? Math.round(basePurchaseCost / totalQty)
      : Math.round(unitInput);
    await updateDoc(doc(db, 'inventory', docRef.id), {
      initialQuantity: totalQty || finalData.initialQuantity,
      basePurchaseCost,
      productExpensesTotal: 0,
      totalLandedCost: basePurchaseCost,
      costPerUnit,
      fundingOwnAmount: parseFloat(itemData.fundingOwnAmount) >= 0
        ? parseFloat(itemData.fundingOwnAmount)
        : Math.max(0, basePurchaseCost - (parseFloat(itemData.fundingInvestorAmount) || 0)),
      fundingInvestorId: itemData.fundingInvestorId || null,
      fundingInvestorName: itemData.fundingInvestorName || '',
      fundingInvestorAmount: parseFloat(itemData.fundingInvestorAmount) || 0
    });

    return { data: { id: docRef.id, ...finalData, basePurchaseCost, costPerUnit } };
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

    if (itemData.basePurchaseCost != null && itemData.basePurchaseCost !== '') {
      await recalculateInventoryLandedCost(id, {
        basePurchaseCost: parseFloat(itemData.basePurchaseCost)
      });
    } else {
      await recalculateInventoryLandedCost(id);
    }

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
      customer: customers.find(c => (c.id || c._id) === sale.customerId),
      items: sale.items?.map(it => ({
        ...it,
        addedToSaleAt: it.addedToSaleAt ? convertTimestamp(it.addedToSaleAt) : undefined
      }))
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
          customer: customers.find(c => (c.id || c._id) === sale.customerId),
          items: sale.items?.map(it => ({
            ...it,
            addedToSaleAt: it.addedToSaleAt ? convertTimestamp(it.addedToSaleAt) : undefined
          }))
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
      addedBy: saleData.addedBy || '',
      saleDate: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      items: saleData.items.map(item => ({
        ...item,
        inventoryId: item.inventory,
        addedToSaleAt: Timestamp.now()
      }))
    };

    const docRef = await addDoc(collection(db, 'sales'), data);

    // If paid at sale time, record initial payment on sale and in payments collection for reporting
    if (paidAmount > 0) {
      const paymentMethod = saleData.saleType || 'Cash';
      const paymentDocRef = await addDoc(collection(db, 'payments'), {
        saleId: docRef.id,
        invoiceNumber,
        customerId: saleData.customer || null,
        customerName: saleData.customerName || '',
        amount: paidAmount,
        paymentDate: Timestamp.now(),
        paymentType: 'Initial Sale',
        paymentMethod,
        notes: saleData.notes || '',
        addedBy: saleData.addedBy || ''
      });
      const initialPayment = {
        amount: paidAmount,
        paymentMethod,
        notes: saleData.notes || '',
        date: Timestamp.now(),
        paymentType: 'Initial Sale',
        paymentId: paymentDocRef.id,
        collectionId: paymentDocRef.id,
        addedBy: saleData.addedBy || ''
      };
      await updateDoc(doc(db, 'sales', docRef.id), {
        payments: [initialPayment],
        updatedAt: Timestamp.now()
      });
    }

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
    const oldItemsList = existingSale.items || [];
    const usedOldIndices = new Set();
    const data = {
      ...Object.fromEntries(
        Object.entries(preparedData).filter(([_, value]) => value !== undefined)
      ),
      customerId: saleData.customer || existingSale.customerId || null,
      totalAmount,
      paidAmount,
      remainingAmount,
      paymentStatus,
      items: saleData.items.map(item => {
        const invId = item.inventory || item.inventoryId;
        const matchedIdx = oldItemsList.findIndex(
          (oi, idx) =>
            !usedOldIndices.has(idx) &&
            oi.inventoryId === invId &&
            oi.size === item.size
        );
        let addedToSaleAt;
        if (matchedIdx >= 0) {
          usedOldIndices.add(matchedIdx);
          addedToSaleAt = oldItemsList[matchedIdx].addedToSaleAt || Timestamp.now();
        } else {
          addedToSaleAt = Timestamp.now();
        }
        return {
          productName: item.productName || '',
          size: item.size || '',
          quantity: item.quantity || 0,
          unitPrice: item.unitPrice || 0,
          totalPrice: item.totalPrice || 0,
          inventoryId: invId || null,
          inventorySellingPrice: item.inventorySellingPrice || null,
          inventoryCostPrice: item.inventoryCostPrice || null,
          profitPerUnit: item.profitPerUnit || null,
          totalProfit: item.totalProfit || null,
          addedToSaleAt
        };
      }),
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
      inventoryId: item.inventory,
      addedToSaleAt: Timestamp.now()
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
    const paymentMethod = paymentData.paymentMethod || paymentData.method || 'Cash';
    const newPaidAmount = (saleData.paidAmount || 0) + paymentAmount;
    const newRemainingAmount = (saleData.totalAmount || 0) - newPaidAmount;
    const newPaymentStatus = newRemainingAmount === 0 ? 'Paid' : newPaidAmount > 0 ? 'Partial' : 'Unpaid';

    // Get customer name for payment record
    let customerName = saleData.customerName || '';
    if (saleData.customerId) {
      try {
        const custDoc = await getDoc(doc(db, 'customers', saleData.customerId));
        if (custDoc.exists()) customerName = custDoc.data().name || customerName;
      } catch (_) { }
    }

    const recoveryDate = paymentData.paymentDate || paymentData.date
      ? Timestamp.fromDate(new Date(
        (paymentData.paymentDate || paymentData.date) +
        ((String(paymentData.paymentDate || paymentData.date).includes('T')) ? '' : 'T12:00:00')
      ))
      : Timestamp.now();

    const recoveryPayment = {
      amount: paymentAmount,
      paymentMethod,
      notes: paymentData.notes || '',
      date: recoveryDate,
      paymentType: 'Recovery',
      addedBy: paymentData.addedBy || ''
    };

    const payments = saleData.payments || [];

    // Record in payments collection for reports (daily/monthly payment totals)
    const paymentDocRef = await addDoc(collection(db, 'payments'), {
      saleId,
      invoiceNumber: saleData.invoiceNumber || '',
      customerId: saleData.customerId || null,
      customerName,
      amount: paymentAmount,
      paymentDate: recoveryDate,
      paymentType: 'Recovery',
      paymentMethod,
      notes: paymentData.notes || '',
      addedBy: paymentData.addedBy || ''
    });

    recoveryPayment.paymentId = paymentDocRef.id;
    recoveryPayment.collectionId = paymentDocRef.id;
    payments.push(recoveryPayment);

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

const recalculateSalePaymentTotals = (totalAmount, payments) => {
  const paidAmount = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const total = parseFloat(totalAmount) || 0;
  const remainingAmount = Math.max(0, total - paidAmount);
  const paymentStatus = remainingAmount <= 0 && paidAmount > 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Unpaid';
  return { paidAmount, remainingAmount, paymentStatus };
};

const findSalePaymentIndex = (payments, paymentKey) => {
  if (typeof paymentKey === 'string' && paymentKey.startsWith('idx-')) {
    const idx = parseInt(paymentKey.replace('idx-', ''), 10);
    return Number.isNaN(idx) ? -1 : idx;
  }
  return payments.findIndex(p => p.paymentId === paymentKey || p.collectionId === paymentKey);
};

const findPaymentsCollectionDoc = async (saleId, salePayment) => {
  const collId = salePayment.collectionId || salePayment.paymentId;
  if (collId) {
    const d = await getDoc(doc(db, 'payments', collId));
    if (d.exists()) return d;
  }
  const snap = await getDocs(query(collection(db, 'payments'), where('saleId', '==', saleId)));
  const payDate = salePayment.date?.toDate ? salePayment.date.toDate() : new Date(salePayment.date || 0);
  const amount = parseFloat(salePayment.amount) || 0;
  for (const d of snap.docs) {
    const data = d.data();
    const dDate = data.paymentDate?.toDate ? data.paymentDate.toDate() : new Date(data.paymentDate);
    if (Math.abs((parseFloat(data.amount) || 0) - amount) < 0.01 &&
      Math.abs(dDate.getTime() - payDate.getTime()) < 120000) {
      return d;
    }
  }
  return null;
};

export const updateSalePayment = async (saleId, paymentKey, paymentData) => {
  try {
    const saleRef = doc(db, 'sales', saleId);
    const saleDoc = await getDoc(saleRef);
    if (!saleDoc.exists()) throw new Error('Sale not found');

    const saleData = saleDoc.data();
    const payments = [...(saleData.payments || [])];
    const idx = findSalePaymentIndex(payments, paymentKey);
    if (idx < 0 || idx >= payments.length) throw new Error('Payment not found');

    const oldPayment = payments[idx];
    const updatedPayment = {
      ...oldPayment,
      amount: parseFloat(paymentData.amount) || 0,
      paymentMethod: paymentData.paymentMethod || paymentData.method || oldPayment.paymentMethod || 'Cash',
      notes: paymentData.notes != null ? paymentData.notes : (oldPayment.notes || ''),
      paymentType: oldPayment.paymentType || 'Recovery',
      editedBy: paymentData.editedBy || paymentData.addedBy || oldPayment.editedBy || ''
    };
    if (paymentData.date) {
      updatedPayment.date = Timestamp.fromDate(new Date(paymentData.date));
    }

    payments[idx] = updatedPayment;
    const { paidAmount, remainingAmount, paymentStatus } = recalculateSalePaymentTotals(saleData.totalAmount, payments);

    await updateDoc(saleRef, {
      payments,
      paidAmount,
      remainingAmount,
      paymentStatus,
      updatedAt: Timestamp.now()
    });

    const collDoc = await findPaymentsCollectionDoc(saleId, oldPayment);
    if (collDoc) {
      await updateDoc(doc(db, 'payments', collDoc.id), {
        amount: updatedPayment.amount,
        paymentMethod: updatedPayment.paymentMethod,
        notes: updatedPayment.notes,
        paymentDate: updatedPayment.date || oldPayment.date || Timestamp.now(),
        editedBy: updatedPayment.editedBy || '',
        updatedAt: Timestamp.now()
      });
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
};

export const deleteSalePayment = async (saleId, paymentKey) => {
  try {
    const saleRef = doc(db, 'sales', saleId);
    const saleDoc = await getDoc(saleRef);
    if (!saleDoc.exists()) throw new Error('Sale not found');

    const saleData = saleDoc.data();
    const payments = [...(saleData.payments || [])];
    const idx = findSalePaymentIndex(payments, paymentKey);
    if (idx < 0 || idx >= payments.length) throw new Error('Payment not found');

    const removedPayment = payments[idx];
    payments.splice(idx, 1);
    const { paidAmount, remainingAmount, paymentStatus } = recalculateSalePaymentTotals(saleData.totalAmount, payments);

    await updateDoc(saleRef, {
      payments,
      paidAmount,
      remainingAmount,
      paymentStatus,
      updatedAt: Timestamp.now()
    });

    const collDoc = await findPaymentsCollectionDoc(saleId, removedPayment);
    if (collDoc) {
      await deleteDoc(doc(db, 'payments', collDoc.id));
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
};

/**
 * Get all payment records (initial + recovery) for reporting.
 * @param {Object} filters - Optional { startDate, endDate } as ISO date strings (YYYY-MM-DD)
 * @returns Payments with saleId, invoiceNumber, customerName, amount, paymentDate, paymentType
 */
export const getPayments = async (filters = {}) => {
  try {
    const paymentsRef = collection(db, 'payments');
    let q;

    if (filters.startDate || filters.endDate) {
      const start = filters.startDate
        ? Timestamp.fromDate(new Date(filters.startDate + 'T00:00:00'))
        : Timestamp.fromDate(new Date(0));
      const end = filters.endDate
        ? Timestamp.fromDate(new Date(filters.endDate + 'T23:59:59.999'))
        : Timestamp.now();
      q = query(
        paymentsRef,
        where('paymentDate', '>=', start),
        where('paymentDate', '<=', end),
        orderBy('paymentDate', 'desc')
      );
    } else {
      q = query(paymentsRef, orderBy('paymentDate', 'desc'));
    }

    const snapshot = await getDocs(q);
    const payments = snapshot.docs.map(paymentToObject);
    return { data: payments };
  } catch (error) {
    if (error.message && (error.message.includes('index') || error.message.includes('requires an index'))) {
      console.warn('Payments index missing. Fetching all payments and filtering client-side.');
      const snapshot = await getDocs(collection(db, 'payments'));
      let payments = snapshot.docs.map(paymentToObject);
      if (filters.startDate || filters.endDate) {
        const startStr = filters.startDate || '1970-01-01';
        const endStr = filters.endDate || '9999-12-31';
        payments = payments.filter(p => {
          const d = p.paymentDate;
          const date = d instanceof Date ? d : (d?.toDate ? d.toDate() : new Date(d));
          const key = date.toISOString().split('T')[0];
          return key >= startStr && key <= endStr;
        });
        payments.sort((a, b) => {
          const da = a.paymentDate instanceof Date ? a.paymentDate : (a.paymentDate?.toDate?.() || new Date(a.paymentDate));
          const db_ = b.paymentDate instanceof Date ? b.paymentDate : (b.paymentDate?.toDate?.() || new Date(b.paymentDate));
          return db_.getTime() - da.getTime();
        });
      }
      return { data: payments };
    }
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

    // Remove related payment docs so Reports "Payment breakdown" stays in sync
    try {
      const paySnap = await getDocs(
        query(collection(db, 'payments'), where('saleId', '==', id))
      );
      await Promise.all(paySnap.docs.map((d) => deleteDoc(d.ref)));
    } catch (payErr) {
      console.warn('Could not delete related payment docs for sale:', id, payErr);
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

/** Recalculate landed cost per piece: (basePurchase + product expenses) / initialQuantity */
export const recalculateInventoryLandedCost = async (inventoryId, options = {}) => {
  const invRef = doc(db, 'inventory', inventoryId);
  const invDoc = await getDoc(invRef);
  if (!invDoc.exists()) return;

  const inv = invDoc.data();
  const initialQuantity = parseFloat(inv.initialQuantity) ||
    (inv.sizes || []).reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);

  let basePurchaseCost = options.basePurchaseCost != null
    ? parseFloat(options.basePurchaseCost)
    : parseFloat(inv.basePurchaseCost);

  if (!basePurchaseCost || isNaN(basePurchaseCost)) {
    const cpu = parseFloat(inv.costPerUnit) || 0;
    const pet = parseFloat(inv.productExpensesTotal) || 0;
    basePurchaseCost = Math.max(0, cpu * initialQuantity - pet);
    if ((!basePurchaseCost || isNaN(basePurchaseCost)) && cpu && initialQuantity) {
      basePurchaseCost = cpu * initialQuantity;
    }
  }

  let productExpensesTotal = 0;
  try {
    const expSnap = await getDocs(
      query(collection(db, 'expenses'), where('inventoryId', '==', inventoryId))
    );
    productExpensesTotal = expSnap.docs.reduce(
      (sum, d) => sum + (parseFloat(d.data().amount) || 0),
      0
    );
  } catch (e) {
    console.warn('Could not fetch product expenses for costing:', e);
  }

  const totalLandedCost = basePurchaseCost + productExpensesTotal;
  const costPerUnit = initialQuantity > 0
    ? Math.round(totalLandedCost / initialQuantity)
    : Math.round(parseFloat(inv.costPerUnit) || 0);

  await updateDoc(invRef, {
    basePurchaseCost,
    productExpensesTotal,
    totalLandedCost,
    costPerUnit,
    initialQuantity: initialQuantity || inv.initialQuantity,
    updatedAt: Timestamp.now()
  });

  return { basePurchaseCost, productExpensesTotal, totalLandedCost, costPerUnit, initialQuantity };
};

export const getProductExpenses = async (inventoryId) => {
  try {
    const q = query(
      collection(db, 'expenses'),
      where('inventoryId', '==', inventoryId),
      orderBy('expenseDate', 'desc')
    );
    const snapshot = await getDocs(q);
    return { data: snapshot.docs.map(docToObject) };
  } catch (error) {
    if (error.message?.includes('index')) {
      const snapshot = await getDocs(collection(db, 'expenses'));
      const expenses = snapshot.docs
        .map(docToObject)
        .filter(e => e.inventoryId === inventoryId)
        .sort((a, b) => {
          const da = convertTimestamp(a.expenseDate)?.getTime() || 0;
          const db = convertTimestamp(b.expenseDate)?.getTime() || 0;
          return db - da;
        });
      return { data: expenses };
    }
    throw error;
  }
};

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

export const createExpense = async (expenseData, options = {}) => {
  try {
    const inventoryId = expenseData.inventoryId && expenseData.inventoryId !== ''
      ? expenseData.inventoryId
      : null;
    const data = {
      description: expenseData.description || '',
      amount: parseFloat(expenseData.amount) || 0,
      category: expenseData.category || 'Other',
      notes: expenseData.notes || '',
      expenseScope: inventoryId ? 'product' : 'general',
      productName: expenseData.productName || '',
      expenseDate: expenseData.expenseDate ? Timestamp.fromDate(new Date(expenseData.expenseDate)) : Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    if (inventoryId) data.inventoryId = inventoryId;

    const docRef = await addDoc(collection(db, 'expenses'), data);
    if (inventoryId && !options.skipRecalc) {
      await recalculateInventoryLandedCost(inventoryId);
    }
    return { data: { id: docRef.id, ...data }, inventoryId };
  } catch (error) {
    throw error;
  }
};

/** Create multiple expenses in one go; recalculates product cost once at the end */
export const createExpensesBatch = async (expensesList) => {
  const inventoryIdsToRecalc = new Set();
  const results = [];
  for (const expenseData of expensesList) {
    const { data, inventoryId } = await createExpense(expenseData, { skipRecalc: true });
    results.push(data);
    if (inventoryId) inventoryIdsToRecalc.add(inventoryId);
  }
  for (const invId of inventoryIdsToRecalc) {
    await recalculateInventoryLandedCost(invId);
  }
  return { data: results };
};

export const updateExpense = async (id, expenseData) => {
  try {
    const oldDoc = await getDoc(doc(db, 'expenses', id));
    const oldInventoryId = oldDoc.exists() ? oldDoc.data().inventoryId : null;

    const inventoryId = expenseData.inventoryId && expenseData.inventoryId !== ''
      ? expenseData.inventoryId
      : null;
    const data = {
      description: expenseData.description || '',
      amount: parseFloat(expenseData.amount) || 0,
      category: expenseData.category || 'Other',
      notes: expenseData.notes || '',
      expenseScope: inventoryId ? 'product' : 'general',
      productName: expenseData.productName || '',
      expenseDate: expenseData.expenseDate ? Timestamp.fromDate(new Date(expenseData.expenseDate)) : Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    if (inventoryId) {
      data.inventoryId = inventoryId;
    } else {
      data.inventoryId = null;
    }

    await updateDoc(doc(db, 'expenses', id), data);

    const idsToRecalc = new Set([oldInventoryId, inventoryId].filter(Boolean));
    for (const invId of idsToRecalc) {
      await recalculateInventoryLandedCost(invId);
    }
    return { data: { id, ...data } };
  } catch (error) {
    throw error;
  }
};

export const deleteExpense = async (id) => {
  try {
    const oldDoc = await getDoc(doc(db, 'expenses', id));
    const oldInventoryId = oldDoc.exists() ? oldDoc.data().inventoryId : null;

    await deleteDoc(doc(db, 'expenses', id));

    if (oldInventoryId) {
      await recalculateInventoryLandedCost(oldInventoryId);
    }
    return { success: true };
  } catch (error) {
    throw error;
  }
};

/**
 * Month closing:
 * - This-month sales paid vs prior recovery
 * - Own vs investor funding split (inventory tags)
 * - COGS, closing stock, net = trading + recovery − expenses
 */
const buildMonthlyProfitLossData = (year, month, sales, payments, expenses, inventory) => {
  const inMonth = (dateVal) => {
    const d = convertTimestamp(dateVal);
    if (!d || isNaN(d.getTime())) return false;
    return d.getFullYear() === year && d.getMonth() === month - 1;
  };

  const getCostPerUnit = (item, inventoryById) => {
    const invId = item.inventoryId || item.inventory;
    const inv = invId ? inventoryById[invId] : null;
    let costPerUnit = parseFloat(inv?.costPerUnit) || 0;
    if (!costPerUnit && item.productName) {
      const byName = (inventory || []).find((i) => i.productName === item.productName);
      costPerUnit = parseFloat(byName?.costPerUnit) || 0;
    }
    if (!costPerUnit) costPerUnit = parseFloat(item.costPerUnit) || 0;
    return costPerUnit;
  };

  const getLineTotal = (item) =>
    parseFloat(item.totalPrice) ||
    ((parseFloat(item.unitPrice) || 0) * (parseFloat(item.quantity) || 0));

  const inventoryById = {};
  (inventory || []).forEach((inv) => {
    const id = inv.id || inv._id;
    if (id) inventoryById[id] = inv;
  });

  const isInvestorFundedInv = (inv) =>
    !!(inv?.fundingInvestorId) && (parseFloat(inv?.fundingInvestorAmount) || 0) > 0;

  const getItemFundingMeta = (item) => {
    const invId = item.inventoryId || item.inventory;
    let inv = invId ? inventoryById[invId] : null;
    if (!inv && item.productName) {
      inv = (inventory || []).find((i) => i.productName === item.productName) || null;
    }
    const investor = isInvestorFundedInv(inv);
    return {
      inv,
      funding: investor ? 'investor' : 'own',
      investorId: inv?.fundingInvestorId || null,
      investorName: inv?.fundingInvestorName || '',
      fundingInvestorAmount: parseFloat(inv?.fundingInvestorAmount) || 0
    };
  };

  /** Split a payment amount across sale lines by bill share → own vs investor */
  const allocateAmountByFunding = (sale, amount) => {
    const items = sale?.items || [];
    if (!sale || !items.length) {
      return { own: amount, investor: 0, lines: [] };
    }
    const saleTotal =
      parseFloat(sale.totalAmount) ||
      items.reduce((sum, item) => sum + getLineTotal(item), 0) ||
      0;
    let own = 0;
    let investor = 0;
    const lines = [];
    items.forEach((item) => {
      const lineBill = getLineTotal(item);
      const share = saleTotal > 0 ? lineBill / saleTotal : 1 / items.length;
      const lineAmt = amount * share;
      const meta = getItemFundingMeta(item);
      if (meta.funding === 'investor') {
        investor += lineAmt;
      } else {
        own += lineAmt;
      }
      lines.push({
        productName: item.productName || 'N/A',
        size: item.size || '',
        amount: Math.round(lineAmt),
        funding: meta.funding,
        investorName: meta.investorName
      });
    });
    return { own, investor, lines };
  };

  /** Sale COGS split by funding (own vs investor inventory) */
  const getSaleFundingCosts = (sale) => {
    let ownCost = 0;
    let investorCost = 0;
    (sale?.items || []).forEach((item) => {
      const qty = parseFloat(item.quantity) || 0;
      const lineCost = qty * getCostPerUnit(item, inventoryById);
      const meta = getItemFundingMeta(item);
      if (meta.funding === 'investor') investorCost += lineCost;
      else ownCost += lineCost;
    });
    return { ownCost, investorCost, totalCost: ownCost + investorCost };
  };

  const paymentTime = (p) =>
    convertTimestamp(p.paymentDate || p.date || p.createdAt)?.getTime() || 0;

  const salesById = {};
  (sales || []).forEach((s) => {
    const id = s.id || s._id;
    if (id) salesById[id] = s;
  });

  const monthSales = (sales || []).filter((s) => inMonth(s.saleDate || s.createdAt));
  const monthSaleIds = new Set(monthSales.map((s) => s.id || s._id).filter(Boolean));

  let totalSales = 0;
  let soldQty = 0;
  let soldCost = 0;
  let ownSoldCost = 0;
  let investorSoldCost = 0;
  let ownSoldQty = 0;
  let investorSoldQty = 0;
  let monthDue = 0;
  const soldProductMap = {};
  const monthSalesDetail = [];

  monthSales.forEach((sale) => {
    const items = sale.items || [];
    const saleTotal =
      parseFloat(sale.totalAmount) ||
      items.reduce((sum, item) => sum + getLineTotal(item), 0) ||
      0;
    totalSales += saleTotal;

    const salePaid = parseFloat(sale.paidAmount) || 0;
    const saleRemaining =
      parseFloat(sale.remainingAmount) >= 0
        ? parseFloat(sale.remainingAmount)
        : Math.max(0, saleTotal - salePaid);
    monthDue += saleRemaining;

    const customerName = sale.customer?.name || sale.customerName || 'Unknown';
    const invoiceNumber = sale.invoiceNumber || '';

    const saleItemsDetail = [];
    items.forEach((item) => {
      const qty = parseFloat(item.quantity) || 0;
      const costPerUnit = getCostPerUnit(item, inventoryById);
      const lineCost = qty * costPerUnit;
      const lineBill = getLineTotal(item);
      const meta = getItemFundingMeta(item);
      soldQty += qty;
      soldCost += lineCost;
      if (meta.funding === 'investor') {
        investorSoldCost += lineCost;
        investorSoldQty += qty;
      } else {
        ownSoldCost += lineCost;
        ownSoldQty += qty;
      }

      const key = item.inventoryId || item.inventory || item.productName || 'unknown';
      if (!soldProductMap[key]) {
        soldProductMap[key] = {
          productName: item.productName || 'N/A',
          size: item.size || '',
          qty: 0,
          bill: 0,
          cost: 0,
          costPerUnit,
          funding: meta.funding,
          investorName: meta.investorName
        };
      }
      soldProductMap[key].qty += qty;
      soldProductMap[key].bill += lineBill;
      soldProductMap[key].cost += lineCost;

      saleItemsDetail.push({
        productName: item.productName || 'N/A',
        size: item.size || '',
        qty,
        bill: Math.round(lineBill),
        cost: Math.round(lineCost),
        funding: meta.funding,
        investorName: meta.investorName
      });
    });

    monthSalesDetail.push({
      id: sale.id || sale._id,
      invoiceNumber,
      customerName,
      contact: sale.customer?.contact || '',
      saleDate: sale.saleDate || sale.createdAt,
      billed: Math.round(saleTotal),
      paid: Math.round(salePaid),
      due: Math.round(saleRemaining),
      items: saleItemsDetail
    });
  });

  const saleIds = new Set((sales || []).map((s) => s.id || s._id).filter(Boolean));
  let monthSalesPaid = 0;
  let priorRecovery = 0;
  let priorRecoveryCost = 0;
  let priorRecoveryProfit = 0;
  let totalPaid = 0;
  let paymentsCount = 0;
  let ownMonthSalesPaid = 0;
  let investorMonthSalesPaid = 0;
  let ownPriorRecovery = 0;
  let investorPriorRecovery = 0;
  let ownPriorRecoveryCost = 0;
  let ownPriorRecoveryProfit = 0;
  let investorPriorRecoveryCost = 0;
  let investorPriorRecoveryProfit = 0;
  const priorRecoveryDetail = [];
  const monthSalesPaidDetail = [];
  const ownMonthPaidDetail = [];
  const investorMonthPaidDetail = [];
  const ownPriorRecoveryDetail = [];
  const investorPriorRecoveryDetail = [];

  // Remaining uncovered COGS per sale (own / investor), reduced as payments arrive chronologically
  const costRemainingBySale = {};
  const ensureCostRemaining = (saleId) => {
    if (!costRemainingBySale[saleId]) {
      const costs = getSaleFundingCosts(salesById[saleId]);
      costRemainingBySale[saleId] = { own: costs.ownCost, investor: costs.investorCost };
    }
    return costRemainingBySale[saleId];
  };

  // Process ALL payments in date order so prior months' payments reduce remaining cost first
  const sortedPayments = [...(payments || [])].sort((a, b) => paymentTime(a) - paymentTime(b));

  const pushSplitDetails = (baseEntry, splitParts, isPrior) => {
    const { own, investor, lines, ownCost = 0, ownProfit = 0, invCost = 0, invProfit = 0 } =
      splitParts;
    const ownEntry = {
      ...baseEntry,
      amount: Math.round(own),
      costAmount: Math.round(ownCost),
      profitAmount: Math.round(ownProfit),
      funding: 'own',
      productLines: (lines || []).filter((l) => l.funding === 'own')
    };
    const invEntry = {
      ...baseEntry,
      amount: Math.round(investor),
      costAmount: Math.round(invCost),
      profitAmount: Math.round(invProfit),
      funding: 'investor',
      productLines: (lines || []).filter((l) => l.funding === 'investor'),
      investorNames: [
        ...new Set(
          (lines || [])
            .filter((l) => l.funding === 'investor' && l.investorName)
            .map((l) => l.investorName)
        )
      ]
    };
    if (own > 0.5) {
      if (isPrior) {
        ownPriorRecovery += own;
        ownPriorRecoveryCost += ownCost;
        ownPriorRecoveryProfit += ownProfit;
        ownPriorRecoveryDetail.push(ownEntry);
      } else {
        ownMonthSalesPaid += own;
        ownMonthPaidDetail.push(ownEntry);
      }
    }
    if (investor > 0.5) {
      if (isPrior) {
        investorPriorRecovery += investor;
        investorPriorRecoveryCost += invCost;
        investorPriorRecoveryProfit += invProfit;
        investorPriorRecoveryDetail.push(invEntry);
      } else {
        investorMonthSalesPaid += investor;
        investorMonthPaidDetail.push(invEntry);
      }
    }
  };

  sortedPayments.forEach((p) => {
    if (p.saleId && !saleIds.has(p.saleId)) return;
    const amount = parseFloat(p.amount) || 0;
    if (amount <= 0) return;

    const sale = p.saleId ? salesById[p.saleId] : null;
    const split = sale
      ? allocateAmountByFunding(sale, amount)
      : { own: amount, investor: 0, lines: [] };

    // Apply payment against remaining COGS (capital back first, then profit)
    let ownCostPart = 0;
    let ownProfitPart = split.own;
    let invCostPart = 0;
    let invProfitPart = split.investor;
    if (p.saleId && sale) {
      const rem = ensureCostRemaining(p.saleId);
      ownCostPart = Math.min(split.own, Math.max(0, rem.own));
      rem.own -= ownCostPart;
      ownProfitPart = split.own - ownCostPart;
      invCostPart = Math.min(split.investor, Math.max(0, rem.investor));
      rem.investor -= invCostPart;
      invProfitPart = split.investor - invCostPart;
    }
    const costPart = ownCostPart + invCostPart;
    const profitPart = ownProfitPart + invProfitPart;

    // Only this-month payments count toward month totals / details
    if (!inMonth(p.paymentDate || p.date || p.createdAt)) return;

    totalPaid += amount;
    paymentsCount += 1;

    const saleInThisMonth = p.saleId ? monthSaleIds.has(p.saleId) : false;
    const customerName =
      p.customerName ||
      sale?.customer?.name ||
      sale?.customerName ||
      'Unknown';
    const invoiceNumber = p.invoiceNumber || sale?.invoiceNumber || '';
    const entry = {
      id: p.id || p._id,
      amount: Math.round(amount),
      costAmount: Math.round(costPart),
      profitAmount: Math.round(profitPart),
      paymentDate: p.paymentDate || p.date || p.createdAt,
      customerName,
      invoiceNumber,
      saleId: p.saleId || null,
      note: p.notes || p.method || ''
    };

    const splitParts = {
      own: split.own,
      investor: split.investor,
      lines: split.lines,
      ownCost: ownCostPart,
      ownProfit: ownProfitPart,
      invCost: invCostPart,
      invProfit: invProfitPart
    };

    if (saleInThisMonth || (!p.saleId && !sale)) {
      monthSalesPaid += amount;
      monthSalesPaidDetail.push({
        ...entry,
        ownAmount: Math.round(split.own),
        investorAmount: Math.round(split.investor),
        customerName: saleInThisMonth ? customerName : customerName || 'Direct / unlinked'
      });
      pushSplitDetails(entry, splitParts, false);
    } else {
      priorRecovery += amount;
      priorRecoveryCost += costPart;
      priorRecoveryProfit += profitPart;
      priorRecoveryDetail.push({
        ...entry,
        ownAmount: Math.round(split.own),
        investorAmount: Math.round(split.investor),
        originalSaleDate: sale?.saleDate || sale?.createdAt || null
      });
      pushSplitDetails(
        { ...entry, originalSaleDate: sale?.saleDate || sale?.createdAt || null },
        splitParts,
        true
      );
    }
  });

  let generalExpenses = 0;
  let productExpenses = 0;
  let generalExpensesCount = 0;
  const expensesDetail = [];
  (expenses || []).forEach((expense) => {
    if (!inMonth(expense.expenseDate || expense.createdAt)) return;
    const amount = parseFloat(expense.amount) || 0;
    const isProduct = !!(expense.inventoryId) || expense.expenseScope === 'product';
    if (isProduct) {
      productExpenses += amount;
    } else {
      generalExpenses += amount;
      generalExpensesCount += 1;
      expensesDetail.push({
        id: expense.id || expense._id,
        title: expense.title || expense.category || expense.description || 'Expense',
        category: expense.category || '',
        amount: Math.round(amount),
        expenseDate: expense.expenseDate || expense.createdAt,
        notes: expense.notes || ''
      });
    }
  });

  let closingStockQty = 0;
  let closingStockValue = 0;
  let ownClosingStockValue = 0;
  let investorClosingStockValue = 0;
  let ownClosingStockQty = 0;
  let investorClosingStockQty = 0;
  const closingStockDetail = [];
  (inventory || []).forEach((inv) => {
    const sizes = inv.sizes || [];
    const qty = sizes.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
    if (qty <= 0) return;
    const costPerUnit = parseFloat(inv.costPerUnit) || 0;
    const value = Math.round(qty * costPerUnit);
    const investor = isInvestorFundedInv(inv);
    closingStockQty += qty;
    closingStockValue += value;
    if (investor) {
      investorClosingStockValue += value;
      investorClosingStockQty += qty;
    } else {
      ownClosingStockValue += value;
      ownClosingStockQty += qty;
    }
    closingStockDetail.push({
      id: inv.id || inv._id,
      productName: inv.productName || 'N/A',
      qty: Math.round(qty),
      costPerUnit: Math.round(costPerUnit),
      value,
      brand: inv.brand?.name || inv.brandName || '',
      funding: investor ? 'investor' : 'own',
      investorName: inv.fundingInvestorName || '',
      fundingInvestorAmount: parseFloat(inv.fundingInvestorAmount) || 0,
      sizes: sizes
        .filter((s) => (parseFloat(s.quantity) || 0) > 0)
        .map((s) => ({ size: s.size, quantity: parseFloat(s.quantity) || 0 }))
    });
  });
  closingStockDetail.sort((a, b) => b.value - a.value);

  const soldProducts = Object.values(soldProductMap)
    .map((p) => ({
      ...p,
      qty: Math.round(p.qty),
      bill: Math.round(p.bill),
      cost: Math.round(p.cost),
      profit: Math.round(p.bill - p.cost)
    }))
    .sort((a, b) => b.bill - a.bill);

  const tradingProfit = monthSalesPaid - soldCost;
  // Pichla recovery: sirf cost ke upar wala hissa net profit mein (cost wapas ≠ profit)
  const netProfit = tradingProfit + priorRecoveryProfit - generalExpenses;
  const cashAfterExpenses = totalPaid - soldCost - generalExpenses;
  // Aapka net — own trading + own recovery-profit − expenses (cost recovery alag)
  const ownTrading = ownMonthSalesPaid - ownSoldCost;
  const ownNetWithRecovery = ownTrading + ownPriorRecoveryProfit - generalExpenses;

  const sortByPayDate = (list) => {
    list.sort((a, b) => {
      const da = convertTimestamp(a.paymentDate)?.getTime() || 0;
      const db = convertTimestamp(b.paymentDate)?.getTime() || 0;
      return db - da;
    });
  };
  sortByPayDate(priorRecoveryDetail);
  sortByPayDate(monthSalesPaidDetail);
  sortByPayDate(ownMonthPaidDetail);
  sortByPayDate(investorMonthPaidDetail);
  sortByPayDate(ownPriorRecoveryDetail);
  sortByPayDate(investorPriorRecoveryDetail);
  expensesDetail.sort((a, b) => {
    const da = convertTimestamp(a.expenseDate)?.getTime() || 0;
    const db = convertTimestamp(b.expenseDate)?.getTime() || 0;
    return db - da;
  });
  monthSalesDetail.sort((a, b) => {
    const da = convertTimestamp(a.saleDate)?.getTime() || 0;
    const db = convertTimestamp(b.saleDate)?.getTime() || 0;
    return db - da;
  });

  return {
    month,
    year,
    totalSales: Math.round(totalSales),
    totalPaid: Math.round(totalPaid),
    monthSalesPaid: Math.round(monthSalesPaid),
    priorRecovery: Math.round(priorRecovery),
    priorRecoveryCost: Math.round(priorRecoveryCost),
    priorRecoveryProfit: Math.round(priorRecoveryProfit),
    ownMonthSalesPaid: Math.round(ownMonthSalesPaid),
    investorMonthSalesPaid: Math.round(investorMonthSalesPaid),
    ownPriorRecovery: Math.round(ownPriorRecovery),
    investorPriorRecovery: Math.round(investorPriorRecovery),
    ownPriorRecoveryCost: Math.round(ownPriorRecoveryCost),
    ownPriorRecoveryProfit: Math.round(ownPriorRecoveryProfit),
    investorPriorRecoveryCost: Math.round(investorPriorRecoveryCost),
    investorPriorRecoveryProfit: Math.round(investorPriorRecoveryProfit),
    soldQty: Math.round(soldQty),
    soldCost: Math.round(soldCost),
    ownSoldCost: Math.round(ownSoldCost),
    investorSoldCost: Math.round(investorSoldCost),
    ownSoldQty: Math.round(ownSoldQty),
    investorSoldQty: Math.round(investorSoldQty),
    monthDue: Math.round(monthDue),
    totalExpenses: Math.round(generalExpenses),
    generalExpenses: Math.round(generalExpenses),
    productExpenses: Math.round(productExpenses),
    tradingProfit: Math.round(tradingProfit),
    ownTrading: Math.round(ownTrading),
    ownNetWithRecovery: Math.round(ownNetWithRecovery),
    netProfit: Math.round(netProfit),
    cashAfterExpenses: Math.round(cashAfterExpenses),
    closingStockQty: Math.round(closingStockQty),
    closingStockValue: Math.round(closingStockValue),
    ownClosingStockQty: Math.round(ownClosingStockQty),
    ownClosingStockValue: Math.round(ownClosingStockValue),
    investorClosingStockQty: Math.round(investorClosingStockQty),
    investorClosingStockValue: Math.round(investorClosingStockValue),
    salesCount: monthSales.length,
    expensesCount: generalExpensesCount,
    paymentsCount,
    soldProducts,
    monthSalesDetail,
    priorRecoveryDetail,
    monthSalesPaidDetail,
    ownMonthPaidDetail,
    investorMonthPaidDetail,
    ownPriorRecoveryDetail,
    investorPriorRecoveryDetail,
    expensesDetail,
    closingStockDetail
  };
};

export const getMonthlyProfitLoss = async (year, month) => {
  const pad = (n) => String(n).padStart(2, '0');
  const startStr = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endStr = `${year}-${pad(month)}-${pad(lastDay)}`;

  try {
    // All payments needed so prior months' payments reduce remaining COGS before this month's recovery
    const [salesRes, paymentsRes, expensesRes, inventoryRes] = await Promise.all([
      getSales(),
      getPayments(),
      getExpenses({ startDate: startStr, endDate: endStr }),
      getInventory()
    ]);

    const data = buildMonthlyProfitLossData(
      year,
      month,
      salesRes.data || [],
      paymentsRes.data || [],
      expensesRes.data || [],
      inventoryRes.data || []
    );

    return { data };
  } catch (error) {
    // Fallback without date filters on expenses
    try {
      const [salesRes, paymentsRes, expensesRes, inventoryRes] = await Promise.all([
        getSales(),
        getPayments(),
        getExpenses(),
        getInventory()
      ]);

      const data = buildMonthlyProfitLossData(
        year,
        month,
        salesRes.data || [],
        paymentsRes.data || [],
        expensesRes.data || [],
        inventoryRes.data || []
      );

      return { data };
    } catch (fallbackError) {
      throw fallbackError;
    }
  }
};

// ==================== INVESTORS ====================

export const getInvestors = async () => {
  try {
    const snapshot = await getDocs(query(collection(db, 'investors'), orderBy('name', 'asc')));
    return { data: snapshot.docs.map(docToObject) };
  } catch (error) {
    if (error.message && (error.message.includes('index') || error.message.includes('requires an index'))) {
      const snapshot = await getDocs(collection(db, 'investors'));
      const data = snapshot.docs.map(docToObject).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      );
      return { data };
    }
    throw error;
  }
};

export const createInvestor = async (investorData) => {
  try {
    const data = {
      name: (investorData.name || '').trim(),
      contact: investorData.contact || '',
      notes: investorData.notes || '',
      isActive: investorData.isActive !== false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    const docRef = await addDoc(collection(db, 'investors'), data);
    return { data: { id: docRef.id, ...data } };
  } catch (error) {
    throw error;
  }
};

export const updateInvestor = async (id, investorData) => {
  try {
    const data = {
      name: (investorData.name || '').trim(),
      contact: investorData.contact || '',
      notes: investorData.notes || '',
      isActive: investorData.isActive !== false,
      updatedAt: Timestamp.now()
    };
    await updateDoc(doc(db, 'investors', id), data);
    return { data: { id, ...data } };
  } catch (error) {
    throw error;
  }
};

export const deleteInvestor = async (id) => {
  try {
    await deleteDoc(doc(db, 'investors', id));
    return { success: true };
  } catch (error) {
    throw error;
  }
};

/** Ledger: capital_in (money received from investor) | payout (money given to investor) */
export const getInvestorLedger = async (investorId) => {
  try {
    const q = query(
      collection(db, 'investorLedger'),
      where('investorId', '==', investorId),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return { data: snapshot.docs.map(docToObject) };
  } catch (error) {
    if (error.message && (error.message.includes('index') || error.message.includes('requires an index'))) {
      const snapshot = await getDocs(collection(db, 'investorLedger'));
      const data = snapshot.docs
        .map(docToObject)
        .filter((e) => e.investorId === investorId)
        .sort((a, b) => {
          const da = convertTimestamp(a.date) || new Date(0);
          const db_ = convertTimestamp(b.date) || new Date(0);
          return db_.getTime() - da.getTime();
        });
      return { data };
    }
    throw error;
  }
};

export const addInvestorLedgerEntry = async (entryData) => {
  try {
    const type = entryData.type === 'payout' ? 'payout' : 'capital_in';
    const data = {
      investorId: entryData.investorId,
      investorName: entryData.investorName || '',
      type,
      amount: parseFloat(entryData.amount) || 0,
      notes: entryData.notes || '',
      date: entryData.date
        ? Timestamp.fromDate(new Date(entryData.date + (String(entryData.date).includes('T') ? '' : 'T12:00:00')))
        : Timestamp.now(),
      createdAt: Timestamp.now(),
      addedBy: entryData.addedBy || ''
    };
    const docRef = await addDoc(collection(db, 'investorLedger'), data);
    return { data: { id: docRef.id, ...data } };
  } catch (error) {
    throw error;
  }
};

export const deleteInvestorLedgerEntry = async (id) => {
  try {
    await deleteDoc(doc(db, 'investorLedger', id));
    return { success: true };
  } catch (error) {
    throw error;
  }
};

const getSaleLineTotalForInvestor = (item) =>
  parseFloat(item.totalPrice) ||
  ((parseFloat(item.unitPrice) || 0) * (parseFloat(item.quantity) || 0));

const getProductSalePaymentStatsForItem = (sales, inventoryItemId) => {
  let soldQty = 0;
  let soldAmount = 0;
  let paidAmount = 0;
  let remainingAmount = 0;

  (sales || []).forEach((sale) => {
    const items = sale.items || [];
    if (!items.length) return;
    const saleTotal =
      parseFloat(sale.totalAmount) ||
      items.reduce((sum, line) => sum + getSaleLineTotalForInvestor(line), 0) ||
      0;
    const salePaid = parseFloat(sale.paidAmount) || 0;
    const saleRemaining =
      parseFloat(sale.remainingAmount) >= 0
        ? parseFloat(sale.remainingAmount)
        : Math.max(0, saleTotal - salePaid);

    items.forEach((item) => {
      const invId = item.inventoryId || item.inventory;
      if (invId !== inventoryItemId) return;
      const lineTotal = getSaleLineTotalForInvestor(item);
      soldQty += parseFloat(item.quantity) || 0;
      soldAmount += lineTotal;
      if (saleTotal > 0) {
        const share = lineTotal / saleTotal;
        paidAmount += salePaid * share;
        remainingAmount += saleRemaining * share;
      }
    });
  });

  return {
    soldQty,
    soldAmount: Math.round(soldAmount),
    paidAmount: Math.round(paidAmount),
    remainingAmount: Math.round(remainingAmount)
  };
};

/**
 * Portfolio for one investor: linked products, pro-rata recovery of investor capital
 * vs total landed cost (purchase + product expenses). Product expenses count as own capital.
 */
export const getInvestorPortfolio = async (investorId) => {
  try {
    const [invRes, salesRes, ledgerRes] = await Promise.all([
      getInventory(),
      getSales(),
      getInvestorLedger(investorId)
    ]);

    const inventory = invRes.data || [];
    const sales = salesRes.data || [];
    const ledger = ledgerRes.data || [];

    const linkedProducts = inventory.filter(
      (item) => item.fundingInvestorId === investorId && (parseFloat(item.fundingInvestorAmount) || 0) > 0
    );

    let capitalAllocated = 0;
    let soldBilled = 0;
    let paidReceived = 0;
    let customerDue = 0;
    let investorRecovered = 0;
    let ownCapitalInProducts = 0;
    let productExpensesOwn = 0;
    let totalLandedLinked = 0;
    let totalProfitAboveCost = 0;

    const products = linkedProducts.map((item) => {
      const itemId = item.id || item._id;
      const basePurchase = parseFloat(item.basePurchaseCost) || 0;
      const expenses = parseFloat(item.productExpensesTotal) || 0;
      const landed =
        parseFloat(item.totalLandedCost) || basePurchase + expenses || 0;
      const investorAmt = parseFloat(item.fundingInvestorAmount) || 0;
      const ownPurchase =
        parseFloat(item.fundingOwnAmount) >= 0
          ? parseFloat(item.fundingOwnAmount)
          : Math.max(0, basePurchase - investorAmt);
      // Product expenses always own
      const ownTotalInLanded = ownPurchase + expenses;

      const stats = getProductSalePaymentStatsForItem(sales, itemId);
      const investorShare = landed > 0 ? investorAmt / landed : 0;
      const investorSharePct = Math.round(investorShare * 1000) / 10; // 1 decimal
      const recovered = Math.min(
        investorAmt,
        Math.round(stats.paidAmount * investorShare)
      );
      const costRecoveredTotal = Math.min(landed, stats.paidAmount);
      const profitAboveCost = Math.max(0, stats.paidAmount - landed);
      const recoveryPctOfInvestor =
        investorAmt > 0 ? Math.round((recovered / investorAmt) * 1000) / 10 : 0;

      capitalAllocated += investorAmt;
      soldBilled += stats.soldAmount;
      paidReceived += stats.paidAmount;
      customerDue += stats.remainingAmount;
      investorRecovered += recovered;
      ownCapitalInProducts += ownTotalInLanded;
      productExpensesOwn += expenses;
      totalLandedLinked += landed;
      totalProfitAboveCost += profitAboveCost;

      return {
        id: itemId,
        productName: item.productName || 'N/A',
        basePurchaseCost: Math.round(basePurchase),
        productExpensesTotal: Math.round(expenses),
        totalLandedCost: Math.round(landed),
        fundingOwnAmount: Math.round(ownPurchase),
        fundingInvestorAmount: Math.round(investorAmt),
        ownCapitalWithExpenses: Math.round(ownTotalInLanded),
        investorSharePct,
        recoveryPctOfInvestor,
        soldQty: stats.soldQty,
        soldAmount: stats.soldAmount,
        paidAmount: stats.paidAmount,
        remainingAmount: stats.remainingAmount,
        investorRecovered: recovered,
        investorStillInStock: Math.max(0, investorAmt - recovered),
        costRecoveredTotal: Math.round(costRecoveredTotal),
        profitAboveCost: Math.round(profitAboveCost)
      };
    });

    const capitalIn = ledger
      .filter((e) => e.type === 'capital_in')
      .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const payouts = ledger
      .filter((e) => e.type === 'payout')
      .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

    return {
      data: {
        products,
        summary: {
          capitalReceived: Math.round(capitalIn),
          capitalPaidOut: Math.round(payouts),
          capitalBalanceWithYou: Math.round(capitalIn - payouts),
          capitalAllocatedToStock: Math.round(capitalAllocated),
          ownCapitalInLinkedProducts: Math.round(ownCapitalInProducts),
          productExpensesOwn: Math.round(productExpensesOwn),
          totalLandedLinked: Math.round(totalLandedLinked),
          soldBilled: Math.round(soldBilled),
          paidReceived: Math.round(paidReceived),
          customerDue: Math.round(customerDue),
          investorCapitalRecovered: Math.round(investorRecovered),
          investorCapitalStillIn: Math.max(0, Math.round(capitalAllocated - investorRecovered)),
          totalProfitAboveCost: Math.round(totalProfitAboveCost),
          // Overall funding % of this investor across linked stock
          overallInvestorSharePct:
            totalLandedLinked > 0
              ? Math.round((capitalAllocated / totalLandedLinked) * 1000) / 10
              : 0
        },
        ledger
      }
    };
  } catch (error) {
    throw error;
  }
};
