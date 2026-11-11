import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit2, Trash2, Package, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, DollarSign, X, Users, ClipboardList } from 'lucide-react';
import { getInventory, getBrands, getCategories, createInventoryItem, updateInventoryItem, deleteInventoryItem, adjustInventoryStock, getSales, getOnlineSalesStats, getProductExpenses, createExpensesBatch, deleteExpense, getInvestors } from '../services/api';
import ImageUpload from '../components/ImageUpload';
import { showSuccess, showError } from '../utils/toast';
import { TableRowShimmer } from '../components/Shimmer';

const STAFF_MEMBERS = ['Almas', 'Shahzad'];
const STOCK_ADJUST_REASONS = [
  { value: 'Missing', label: 'Missing / lost', hint: 'Piece milay nahi' },
  { value: 'Theft', label: 'Theft / chori', hint: 'Stock chori ho gaya' },
  { value: 'Damage', label: 'Damage', hint: 'Kharab / unusable' },
  { value: 'Count error', label: 'Count correction', hint: 'Zyada ya kam entry fix' },
  { value: 'Found', label: 'Found / add stock', hint: 'Extra pieces milay' },
  { value: 'Other', label: 'Other', hint: 'Notes me likhein' }
];

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sales, setSales] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [onlineSales, setOnlineSales] = useState({}); // Store online sales per product
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);

  const [useSizes, setUseSizes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedItems, setExpandedItems] = useState(new Set()); // Track expanded items
  const [showCostingModal, setShowCostingModal] = useState(false);
  const [costingItem, setCostingItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null); // product buyer / payment detail
  const [productExpenses, setProductExpenses] = useState([]);
  const [loadingCosting, setLoadingCosting] = useState(false);
  const [savingProductExpense, setSavingProductExpense] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustCounts, setAdjustCounts] = useState([]); // [{ size, systemQty, physicalQty }]
  const [adjustForm, setAdjustForm] = useState({
    reason: 'Missing',
    notes: '',
    addedBy: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [savingAdjust, setSavingAdjust] = useState(false);
  const newProductExpenseLine = () => ({
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    category: 'Labour',
    customCategory: '',
    description: '',
    amount: ''
  });
  const [productExpenseLines, setProductExpenseLines] = useState([newProductExpenseLine()]);
  const [productExpenseDate, setProductExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const productExpenseCategories = [
    'Tea & Food', 'Labour', 'Rafu', 'Wash', 'Weaving', 'Rent', 'Transport', 'Maintenance', 'Other'
  ];
  const productPresetCategories = productExpenseCategories.filter((c) => c !== 'Other');
  const resolveProductExpenseCategory = (line) =>
    line.category === 'Other' ? (line.customCategory || '').trim() : line.category;
  const itemsPerPage = 10;
  const [formData, setFormData] = useState({
    brand: '',
    category: '',
    subcategory: '',
    productName: '',
    quantity: '',
    basePurchaseCost: '',
    costPerUnit: '',
    fundingOwnAmount: '',
    fundingInvestorId: '',
    fundingInvestorName: '',
    fundingInvestorAmount: '',
    sellingPrice: '', // Original price (Was price for sale items)
    onlinePrice: '', // Online/website price (Now price for sale items)
    sku: '', // Product SKU/Model number
    description: '', // Product description for website
    onlineStatus: false, // Show/hide on website
    lowStockThreshold: 10,
    notes: '',
    imageUrl: '', // Main product image
    productImages: [], // Multiple product images (front, back, close-up, etc.)
    // Badge fields - multiple ways to set badges
    tag: '', // 'new' or 'sale'
    status: '', // 'new' or 'sale'
    isNew: false,
    isSale: false,
    new: false,
    sale: false,
    sizes: [
      { size: 'S', quantity: 0 },
      { size: 'M', quantity: 0 },
      { size: 'L', quantity: 0 },
      { size: 'XL', quantity: 0 }
    ]
  });
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);

  useEffect(() => {
    fetchData();
  }, [filterBrand, filterCategory, showLowStock]);

  // Filter categories by selected brand
  useEffect(() => {
    if (formData.brand) {
      const filtered = categories.filter(cat =>
        cat.brandId === formData.brand &&
        !cat.parentCategoryId // Only main categories (not subcategories)
      );
      setFilteredCategories(filtered);
    } else {
      setFilteredCategories([]);
    }
    // Reset category and subcategory when brand changes
    setFormData(prev => ({ ...prev, category: '', subcategory: '' }));
    setSubcategories([]);
  }, [formData.brand, categories]);

  // Fetch subcategories when category is selected
  useEffect(() => {
    const fetchSubcategories = async () => {
      if (formData.category && formData.brand) {
        try {
          const res = await getCategories({ parentCategoryId: formData.category });
          setSubcategories(res.data);
        } catch (error) {
          setSubcategories([]);
        }
      } else {
        setSubcategories([]);
      }
    };
    fetchSubcategories();
  }, [formData.category, formData.brand]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invRes, brandsRes, catsRes, salesRes, investorsRes] = await Promise.all([
        getInventory({ brand: filterBrand, category: filterCategory, lowStock: showLowStock }),
        getBrands(),
        getCategories(),
        getSales(),
        getInvestors()
      ]);
      setInventory(invRes.data);
      setBrands(brandsRes.data);
      setCategories(catsRes.data);
      setSales(salesRes.data);
      setInvestors(investorsRes.data || []);

      // Fetch online sales stats and map to products
      try {
        const onlineSalesRes = await getOnlineSalesStats();
        const productSalesMap = {};
        onlineSalesRes.data.productSales?.forEach(product => {
          // Create a key from product name and size to match inventory items
          const key = `${product.productName}_${product.size}`;
          if (!productSalesMap[key]) {
            productSalesMap[key] = {
              totalQuantity: 0,
              totalRevenue: 0
            };
          }
          productSalesMap[key].totalQuantity += product.totalQuantity;
          productSalesMap[key].totalRevenue += product.totalRevenue;
        });
        setOnlineSales(productSalesMap);
      } catch (error) {
        // Error fetching online sales - continue without it
      }
    } catch (error) {
      // Error fetching data
    } finally {
      setLoading(false);
    }
  };

  // Calculate total earned amount for an inventory item
  const calculateTotalEarned = (inventoryItemId) => {
    let totalEarned = 0;

    sales.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          if (item.inventoryId === inventoryItemId) {
            // Use the actual sold price (unitPrice) × quantity
            totalEarned += (item.unitPrice || 0) * (item.quantity || 0);
          }
        });
      }
    });

    return totalEarned;
  };

  const getSaleLineTotal = (item) =>
    parseFloat(item.totalPrice) ||
    ((parseFloat(item.unitPrice) || 0) * (parseFloat(item.quantity) || 0));

  // Sold qty + billed + paid. Untagged paid splits by bill share; tagged payments go to that product.
  const getProductSalePaymentStats = (inventoryItemId) => {
    let soldQty = 0;
    let soldAmount = 0;
    let paidAmount = 0;
    let remainingAmount = 0;

    sales.forEach((sale) => {
      const items = sale.items || [];
      if (!items.length) return;

      const saleTotal =
        parseFloat(sale.totalAmount) ||
        items.reduce((sum, line) => sum + getSaleLineTotal(line), 0) ||
        0;
      const salePaid = parseFloat(sale.paidAmount) || 0;

      let productLineTotal = 0;
      let productSoldQty = 0;
      items.forEach((item) => {
        const invId = item.inventoryId || item.inventory;
        if (String(invId) !== String(inventoryItemId)) return;
        productLineTotal += getSaleLineTotal(item);
        productSoldQty += parseFloat(item.quantity) || 0;
      });
      if (productSoldQty <= 0 && productLineTotal <= 0) return;

      let taggedToProduct = 0;
      let allTagged = 0;
      (sale.payments || []).forEach((p) => {
        const againstId = p.againstInventoryId;
        if (!againstId) return;
        const amt = parseFloat(p.amount) || 0;
        allTagged += amt;
        if (String(againstId) === String(inventoryItemId)) {
          taggedToProduct += amt;
        }
      });
      const untaggedPaid = Math.max(0, salePaid - allTagged);
      const share = saleTotal > 0 ? productLineTotal / saleTotal : 0;
      const productPaid = taggedToProduct + untaggedPaid * share;

      soldQty += productSoldQty;
      soldAmount += productLineTotal;
      paidAmount += productPaid;
      remainingAmount += Math.max(0, productLineTotal - productPaid);
    });

    return {
      soldQty,
      soldAmount: Math.round(soldAmount),
      paidAmount: Math.round(paidAmount),
      remainingAmount: Math.round(remainingAmount)
    };
  };

  /** Per-sale buyers for one inventory product: who bought, billed / paid / due */
  const getProductBuyerDetails = (inventoryItemId) => {
    const buyers = [];
    (sales || []).forEach((sale) => {
      const items = sale.items || [];
      if (!items.length) return;

      const saleTotal =
        parseFloat(sale.totalAmount) ||
        items.reduce((sum, line) => sum + getSaleLineTotal(line), 0) ||
        0;
      const salePaid = parseFloat(sale.paidAmount) || 0;

      let productLinesTotal = 0;
      items.forEach((line) => {
        const invId = line.inventoryId || line.inventory;
        if (String(invId) !== String(inventoryItemId)) return;
        productLinesTotal += getSaleLineTotal(line);
      });

      let allTagged = 0;
      (sale.payments || []).forEach((p) => {
        if (p.againstInventoryId) allTagged += parseFloat(p.amount) || 0;
      });
      const untaggedPaid = Math.max(0, salePaid - allTagged);

      items.forEach((line, lineIndex) => {
        const invId = line.inventoryId || line.inventory;
        if (String(invId) !== String(inventoryItemId)) return;

        const lineTotal = getSaleLineTotal(line);
        const qty = parseFloat(line.quantity) || 0;
        const share = saleTotal > 0 ? lineTotal / saleTotal : 0;
        const productLineShare = productLinesTotal > 0 ? lineTotal / productLinesTotal : 0;

        let taggedToLine = 0;
        (sale.payments || []).forEach((p) => {
          if (String(p.againstInventoryId || '') !== String(inventoryItemId)) return;
          const amt = parseFloat(p.amount) || 0;
          if (typeof p.againstLineIndex === 'number') {
            if (p.againstLineIndex === lineIndex) taggedToLine += amt;
          } else {
            taggedToLine += amt * productLineShare;
          }
        });

        const paid = taggedToLine + untaggedPaid * share;

        buyers.push({
          saleId: sale.id || sale._id,
          customerName: sale.customer?.name || sale.customerName || 'Unknown',
          contact: sale.customer?.contact || sale.customerContact || '',
          invoiceNumber: sale.invoiceNumber || '',
          saleDate: sale.saleDate || sale.createdAt,
          qty,
          size: line.size || '',
          unitPrice: parseFloat(line.unitPrice) || 0,
          billed: Math.round(lineTotal),
          paid: Math.round(paid),
          due: Math.round(Math.max(0, lineTotal - paid))
        });
      });
    });

    buyers.sort((a, b) => {
      const da = a.saleDate instanceof Date ? a.saleDate.getTime() : new Date(a.saleDate || 0).getTime();
      const db = b.saleDate instanceof Date ? b.saleDate.getTime() : new Date(b.saleDate || 0).getTime();
      return (db || 0) - (da || 0);
    });
    return buyers;
  };

  /**
   * Capital-first: Paid − (initial stock × cost).
   * writtenOffQty (missing/damage) stays in capital so reducing stock doesn't fake profit.
   * Missing loss = writtenOff × cost (capital not recoverable via sales).
   */
  const getProductRealizedProfit = (inventoryItem, onlineData = null) => {
    const itemId = inventoryItem?.id || inventoryItem?._id;
    const pay = getProductSalePaymentStats(itemId);
    const costPerUnit = parseFloat(inventoryItem?.costPerUnit) || 0;
    const onlineQty = parseFloat(onlineData?.totalQuantity) || 0;
    const onlineRevenue = parseFloat(onlineData?.totalRevenue) || 0;
    const currentQty = (inventoryItem?.sizes || []).reduce(
      (sum, s) => sum + (parseFloat(s.quantity) || 0),
      0
    );
    const writtenOffQty = parseFloat(inventoryItem?.writtenOffQty) || 0;
    const soldQtyAll = pay.soldQty + onlineQty;
    // Include written-off so capital does not shrink when stock is adjusted down
    const initialQty = currentQty + soldQtyAll + writtenOffQty;
    const soldCost = soldQtyAll * costPerUnit;
    const missingLoss = writtenOffQty * costPerUnit;
    const stockCapital = initialQty * costPerUnit;
    const paidTotal = pay.paidAmount + onlineRevenue;
    const realizedProfit = paidTotal - stockCapital;
    const capitalLeft = Math.max(0, stockCapital - paidTotal);
    const profitAfterCapital = Math.max(0, paidTotal - stockCapital);
    return {
      ...pay,
      onlineQty,
      onlineRevenue: Math.round(onlineRevenue),
      soldQtyAll,
      writtenOffQty: Math.round(writtenOffQty),
      missingLoss: Math.round(missingLoss),
      initialQty: Math.round(initialQty),
      soldCost: Math.round(soldCost),
      stockCapital: Math.round(stockCapital),
      paidTotal: Math.round(paidTotal),
      realizedProfit: Math.round(realizedProfit),
      capitalLeft: Math.round(capitalLeft),
      profitAfterCapital: Math.round(profitAfterCapital),
      costPerUnit
    };
  };

  const openAdjustStock = (item) => {
    const sizes = (item.sizes || []).length
      ? item.sizes
      : [{ size: 'One Size', quantity: 0 }];
    setAdjustItem(item);
    setAdjustCounts(
      sizes.map((s) => ({
        size: s.size || 'One Size',
        systemQty: parseFloat(s.quantity) || 0,
        physicalQty: String(parseFloat(s.quantity) || 0)
      }))
    );
    setAdjustForm({
      reason: 'Missing',
      notes: '',
      addedBy: '',
      date: new Date().toISOString().split('T')[0]
    });
    setShowAdjustModal(true);
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    if (!adjustItem) return;
    if (!adjustForm.addedBy) {
      showError('Please select who is adjusting stock');
      return;
    }
    if (!adjustForm.reason) {
      showError('Please select a reason');
      return;
    }
    const counts = adjustCounts.map((row) => ({
      size: row.size,
      physicalQty: row.physicalQty === '' ? 0 : parseInt(row.physicalQty, 10) || 0
    }));
    const hasChange = counts.some((row, i) => row.physicalQty !== adjustCounts[i].systemQty);
    if (!hasChange) {
      showError('No stock change — physical matches system');
      return;
    }
    setSavingAdjust(true);
    try {
      const res = await adjustInventoryStock(adjustItem.id || adjustItem._id, {
        counts,
        reason: adjustForm.reason,
        notes: adjustForm.notes,
        addedBy: adjustForm.addedBy,
        date: adjustForm.date
      });
      const missing = res?.data?.adjustment?.missingQty || 0;
      const loss = res?.data?.lossAmount || 0;
      showSuccess(
        missing > 0
          ? `Stock updated · ${missing} pcs missing (loss Rs. ${loss.toLocaleString()})`
          : 'Stock updated successfully'
      );
      setShowAdjustModal(false);
      setAdjustItem(null);
      await fetchData();
    } catch (err) {
      showError(err.message || 'Could not adjust stock');
    } finally {
      setSavingAdjust(false);
    }
  };

  // Calculate sold quantity from sales records
  const calculateSoldQuantity = (inventoryItemId) => {
    return getProductSalePaymentStats(inventoryItemId).soldQty;
  };

  // Format date for display
  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';

    let date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (dateValue?.toDate) {
      date = dateValue.toDate();
    } else if (dateValue?.seconds) {
      date = new Date(dateValue.seconds * 1000);
    } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      date = new Date(dateValue);
    } else {
      return 'N/A';
    }

    if (isNaN(date.getTime())) {
      return 'N/A';
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let dataToSubmit;

      // Use subcategory if selected, otherwise use category
      const finalCategory = formData.subcategory || formData.category;

      // Auto-detect sale badge if originalPrice > onlinePrice
      let badgeData = { ...formData };
      const sellingPriceNum = parseFloat(formData.sellingPrice) || 0;
      const onlinePriceNum = parseFloat(formData.onlinePrice) || 0;

      // If sellingPrice > onlinePrice, auto-mark as sale
      if (sellingPriceNum > 0 && onlinePriceNum > 0 && sellingPriceNum > onlinePriceNum) {
        if (!badgeData.tag && !badgeData.status && !badgeData.isSale && !badgeData.sale) {
          badgeData.tag = 'sale';
          badgeData.isSale = true;
          badgeData.sale = true;
        }
      }

      if (useSizes) {
        // Use size breakdown
        const filteredSizes = formData.sizes.filter(s => s.quantity > 0);
        dataToSubmit = { ...badgeData, category: finalCategory, subcategory: '', sizes: filteredSizes };
      } else {
        // Use simple quantity - convert to single size entry
        dataToSubmit = {
          ...badgeData,
          category: finalCategory,
          subcategory: '',
          sizes: formData.quantity > 0 ? [{ size: 'One Size', quantity: parseInt(formData.quantity) }] : []
        };
      }

      // Remove undefined values before submitting - Firestore doesn't accept undefined
      const cleanData = Object.fromEntries(
        Object.entries(dataToSubmit).filter(([_, value]) => value !== undefined)
      );
      dataToSubmit = cleanData;

      // Log to check for undefined values
      console.log('🔍 [Inventory] Data before processing:', dataToSubmit);
      const undefinedFields = Object.entries(dataToSubmit).filter(([key, value]) => value === undefined);
      if (undefinedFields.length > 0) {
        console.error('❌ [Inventory] Found undefined fields:', undefinedFields);
      }

      if (editingItem) {
        // Calculate new total quantity from sizes
        const newTotalQty = useSizes
          ? dataToSubmit.sizes.reduce((sum, s) => sum + (s.quantity || 0), 0)
          : parseInt(dataToSubmit.quantity || 0);

        // Calculate sold quantity (this won't change on edit)
        const soldQty = calculateSoldQuantity(editingItem.id);

        // Initial quantity should be: Current + Sold (total ever added)
        // This ensures Initial - Sold = Current always makes sense
        const newInitialQty = newTotalQty + soldQty;
        dataToSubmit.initialQuantity = newInitialQty;
        const baseCost = parseFloat(formData.basePurchaseCost);
        const unitCost = parseFloat(formData.costPerUnit) || 0;
        dataToSubmit.basePurchaseCost = !isNaN(baseCost) && baseCost > 0
          ? baseCost
          : unitCost * newInitialQty;

        const invAmt = parseFloat(formData.fundingInvestorAmount) || 0;
        const ownAmt = parseFloat(formData.fundingOwnAmount);
        dataToSubmit.fundingInvestorAmount = invAmt;
        dataToSubmit.fundingInvestorId = formData.fundingInvestorId || null;
        dataToSubmit.fundingInvestorName = formData.fundingInvestorName || '';
        dataToSubmit.fundingOwnAmount = !isNaN(ownAmt) && ownAmt >= 0
          ? ownAmt
          : Math.max(0, dataToSubmit.basePurchaseCost - invAmt);

        // Final cleanup before update
        const finalData = Object.fromEntries(
          Object.entries(dataToSubmit).filter(([_, value]) => value !== undefined)
        );

        // Log final data being sent
        console.log('📤 [Inventory] Final data for UPDATE:', finalData);
        const finalUndefined = Object.entries(finalData).filter(([key, value]) => value === undefined);
        if (finalUndefined.length > 0) {
          console.error('❌ [Inventory] Final data still has undefined:', finalUndefined);
        }

        await updateInventoryItem(editingItem.id, finalData);
        showSuccess('Inventory item updated successfully!');
      } else {
        // For new items, set initialQuantity to the total quantity being added
        const newTotalQty = useSizes
          ? dataToSubmit.sizes.reduce((sum, s) => sum + (s.quantity || 0), 0)
          : parseInt(dataToSubmit.quantity || 0);
        dataToSubmit.initialQuantity = newTotalQty;
        const baseCost = parseFloat(formData.basePurchaseCost);
        const unitCost = parseFloat(formData.costPerUnit) || 0;
        dataToSubmit.basePurchaseCost = !isNaN(baseCost) && baseCost > 0
          ? baseCost
          : unitCost * newTotalQty;

        const invAmt = parseFloat(formData.fundingInvestorAmount) || 0;
        const ownAmt = parseFloat(formData.fundingOwnAmount);
        dataToSubmit.fundingInvestorAmount = invAmt;
        dataToSubmit.fundingInvestorId = formData.fundingInvestorId || null;
        dataToSubmit.fundingInvestorName = formData.fundingInvestorName || '';
        dataToSubmit.fundingOwnAmount = !isNaN(ownAmt) && ownAmt >= 0
          ? ownAmt
          : Math.max(0, dataToSubmit.basePurchaseCost - invAmt);

        // Final cleanup before create
        const finalData = Object.fromEntries(
          Object.entries(dataToSubmit).filter(([_, value]) => value !== undefined)
        );

        // Log final data being sent
        console.log('📤 [Inventory] Final data for CREATE:', finalData);
        const finalUndefined = Object.entries(finalData).filter(([key, value]) => value === undefined);
        if (finalUndefined.length > 0) {
          console.error('❌ [Inventory] Final data still has undefined:', finalUndefined);
        }

        await createInventoryItem(finalData);
        showSuccess('Inventory item added successfully!');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      showError(error.message || 'Error saving item');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (item) => {
    setEditingItem(item);

    // Check if item uses size breakdown or simple quantity
    const hasMultipleSizes = item.sizes && item.sizes.length > 1;
    const isOneSize = item.sizes && item.sizes.length === 1 && item.sizes[0].size === 'One Size';

    setUseSizes(hasMultipleSizes);

    const categoryId = item.category?.id || item.categoryId;
    const brandId = item.brand?.id || item.brandId;

    // Check if category is a subcategory
    const categoryData = categories.find(c => (c.id || c._id) === categoryId);
    const isSubcategory = categoryData?.parentCategoryId;
    const parentCategoryId = categoryData?.parentCategoryId;

    // Determine badge from multiple possible fields
    const badgeTag = item.tag || item.status || '';
    const isNewBadge = item.isNew || item.new || badgeTag === 'new' || item.status === 'new';
    const isSaleBadge = item.isSale || item.sale || badgeTag === 'sale' || item.status === 'sale';

    setFormData({
      brand: brandId,
      category: isSubcategory ? parentCategoryId : categoryId,
      subcategory: isSubcategory ? categoryId : '',
      productName: item.productName,
      quantity: isOneSize ? item.sizes[0].quantity : '',
      basePurchaseCost: item.basePurchaseCost || (item.initialQuantity && item.costPerUnit
        ? Math.round(item.initialQuantity * parseFloat(item.costPerUnit))
        : ''),
      costPerUnit: item.costPerUnit != null && item.costPerUnit !== ''
        ? Math.round(parseFloat(item.costPerUnit) || 0)
        : '',
      fundingOwnAmount: item.fundingOwnAmount != null && item.fundingOwnAmount !== ''
        ? String(item.fundingOwnAmount)
        : '',
      fundingInvestorId: item.fundingInvestorId || '',
      fundingInvestorName: item.fundingInvestorName || '',
      fundingInvestorAmount: item.fundingInvestorAmount != null && item.fundingInvestorAmount !== ''
        ? String(item.fundingInvestorAmount)
        : '',
      sellingPrice: item.sellingPrice,
      onlinePrice: item.onlinePrice || '',
      sku: item.sku || '',
      description: item.description || '',
      onlineStatus: item.onlineStatus !== undefined ? item.onlineStatus : false,
      lowStockThreshold: item.lowStockThreshold,
      notes: item.notes || '',
      imageUrl: item.imageUrl || '',
      productImages: item.productImages || [],
      tag: badgeTag,
      status: item.status || '',
      isNew: isNewBadge,
      isSale: isSaleBadge,
      new: isNewBadge,
      sale: isSaleBadge,
      sizes: hasMultipleSizes ? item.sizes : [
        { size: 'S', quantity: 0 },
        { size: 'M', quantity: 0 },
        { size: 'L', quantity: 0 },
        { size: 'XL', quantity: 0 }
      ]
    });

    // Fetch subcategories if editing with a category
    if (brandId && categoryId && !isSubcategory) {
      try {
        const res = await getCategories({ parentCategoryId: categoryId });
        setSubcategories(res.data);
      } catch (error) {
        // Error fetching subcategories
      }
    }

    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return;
    }

    setDeleting(id);

    try {
      await deleteInventoryItem(id);
      showSuccess('Inventory item deleted successfully!');
      await fetchData();
    } catch (error) {
      showError(error.message || 'Error deleting item. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const toggleExpand = (itemId) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };


  const getItemInitialQty = (item) => {
    if (!item) return 0;
    return parseFloat(item.initialQuantity) ||
      (item.sizes || []).reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
  };

  const getFormTotalQty = (data = formData, withSizes = useSizes) => {
    if (withSizes) {
      return data.sizes.reduce((s, x) => s + (parseFloat(x.quantity) || 0), 0);
    }
    return parseFloat(data.quantity) || 0;
  };

  const computeCostPerUnitFromPurchase = (basePurchaseCost, qty) => {
    const base = parseFloat(basePurchaseCost);
    if (qty > 0 && base > 0 && !isNaN(base)) {
      return String(Math.round(base / qty));
    }
    return null;
  };

  const applyPurchaseCostSync = (updates) => {
    const merged = { ...formData, ...updates };
    const computed = computeCostPerUnitFromPurchase(merged.basePurchaseCost, getFormTotalQty(merged));
    if (computed != null) {
      merged.costPerUnit = computed;
    }
    return merged;
  };

  const openProductDetail = (item) => {
    setDetailItem(item);
  };

  const openCostingModal = async (item) => {
    setCostingItem(item);
    setShowCostingModal(true);
    setProductExpenseLines([newProductExpenseLine()]);
    setProductExpenseDate(new Date().toISOString().split('T')[0]);
    await loadProductExpenses(item.id || item._id, item);
  };

  const updateProductExpenseLine = (key, field, value) => {
    setProductExpenseLines(lines => lines.map(l => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const addProductExpenseLine = () => {
    setProductExpenseLines(lines => [...lines, newProductExpenseLine()]);
  };

  const removeProductExpenseLine = (key) => {
    setProductExpenseLines(lines => (lines.length <= 1 ? lines : lines.filter(l => l.key !== key)));
  };

  const loadProductExpenses = async (itemId, itemOverride) => {
    setLoadingCosting(true);
    try {
      const res = await getProductExpenses(itemId);
      setProductExpenses(res.data || []);
      if (itemOverride) setCostingItem(itemOverride);
      else {
        const fresh = await getInventory();
        const updated = (fresh.data || []).find(i => (i.id || i._id) === itemId);
        if (updated) setCostingItem(updated);
      }
    } catch (e) {
      showError(e.message || 'Could not load product expenses');
    } finally {
      setLoadingCosting(false);
    }
  };

  const handleAddProductExpense = async (e) => {
    e.preventDefault();
    if (!costingItem) return;
    const validLines = productExpenseLines.filter(l => parseFloat(l.amount) > 0);
    if (validLines.length === 0) {
      showError('Add at least one expense with an amount');
      return;
    }
    if (validLines.some((l) => l.category === 'Other' && !(l.customCategory || '').trim())) {
      showError('Other select kiya hai — custom category name likhein');
      return;
    }
    setSavingProductExpense(true);
    try {
      const payloads = validLines.map(line => {
        const category = resolveProductExpenseCategory(line);
        return {
          description: line.description.trim() || category,
          amount: parseFloat(line.amount) || 0,
          category,
          expenseDate: productExpenseDate,
          inventoryId: costingItem.id || costingItem._id,
          productName: costingItem.productName
        };
      });
      await createExpensesBatch(payloads);
      showSuccess(
        validLines.length === 1
          ? 'Product expense added — cost per piece updated'
          : `${validLines.length} expenses added — cost per piece updated`
      );
      setProductExpenseLines([newProductExpenseLine()]);
      await fetchData();
      const fresh = await getInventory();
      const updated = (fresh.data || []).find(i => (i.id || i._id) === (costingItem.id || costingItem._id));
      if (updated) setCostingItem(updated);
      await loadProductExpenses(costingItem.id || costingItem._id, updated);
    } catch (err) {
      showError(err.message || 'Error adding expense');
    } finally {
      setSavingProductExpense(false);
    }
  };

  const handleDeleteProductExpense = async (expenseId) => {
    if (!window.confirm('Delete this product expense? Cost per piece will be recalculated.')) return;
    try {
      await deleteExpense(expenseId);
      showSuccess('Expense deleted');
      await fetchData();
      if (costingItem) {
        const fresh = await getInventory();
        const updated = (fresh.data || []).find(i => (i.id || i._id) === (costingItem.id || costingItem._id));
        if (updated) setCostingItem(updated);
        await loadProductExpenses(costingItem.id || costingItem._id, updated);
      }
    } catch (err) {
      showError(err.message || 'Error deleting expense');
    }
  };

  const resetForm = () => {
    setFormData({
      brand: '',
      category: '',
      subcategory: '',
      productName: '',
      quantity: '',
      basePurchaseCost: '',
      costPerUnit: '',
      fundingOwnAmount: '',
      fundingInvestorId: '',
      fundingInvestorName: '',
      fundingInvestorAmount: '',
      sellingPrice: '',
      onlinePrice: '',
      sku: '',
      description: '',
      onlineStatus: false,
      lowStockThreshold: 10,
      notes: '',
      imageUrl: '',
      productImages: [],
      tag: '',
      status: '',
      isNew: false,
      isSale: false,
      new: false,
      sale: false,
      sizes: [
        { size: 'S', quantity: 0 },
        { size: 'M', quantity: 0 },
        { size: 'L', quantity: 0 },
        { size: 'XL', quantity: 0 }
      ]
    });
    setUseSizes(false);
    setEditingItem(null);
    setFilteredCategories([]);
    setSubcategories([]);
  };

  const handleSizeChange = (index, value) => {
    const newSizes = [...formData.sizes];
    newSizes[index].quantity = parseInt(value) || 0;
    setFormData(applyPurchaseCostSync({ sizes: newSizes }));
  };

  // Filter inventory - onlineStatus does NOT affect admin inventory display
  // onlineStatus only controls website visibility, not admin panel visibility
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = !searchTerm ||
      item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.brand?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInventory = filteredInventory.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterBrand, filterCategory, showLowStock]);

  const getTotalQuantity = (sizes) => {
    return (sizes || []).reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
  };

  /** On hand / sold / written-off snapshot for UI + stock value (on-hand only). */
  const getStockSnapshot = (item) => {
    const onHand = getTotalQuantity(item?.sizes);
    const sold = calculateSoldQuantity(item?.id || item?._id);
    const writtenOff = parseFloat(item?.writtenOffQty) || 0;
    const costPerUnit = parseFloat(item?.costPerUnit) || 0;
    const lifetime = onHand + sold + writtenOff;
    const storedInitial = parseFloat(item?.initialQuantity) || 0;
    const initial = Math.max(storedInitial, lifetime);
    return {
      onHand,
      sold,
      writtenOff,
      lifetime,
      initial,
      costPerUnit,
      onHandValue: Math.round(onHand * costPerUnit),
      // Total capital at cost for lifetime pieces (initial × cost)
      actualCostValue: Math.round(initial * costPerUnit),
      writeOffLoss: Math.round(writtenOff * costPerUnit),
      adjustments: Array.isArray(item?.stockAdjustments) ? item.stockAdjustments : []
    };
  };

  const formatAdjDate = (dateValue) => {
    if (!dateValue) return '';
    let d;
    if (dateValue?.toDate) d = dateValue.toDate();
    else if (dateValue?.seconds) d = new Date(dateValue.seconds * 1000);
    else d = new Date(dateValue);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const isLowStock = (item) => {
    return getTotalQuantity(item.sizes) <= item.lowStockThreshold;
  };

  const lowStockCount = inventory.filter((item) => isLowStock(item)).length;

  return (
    <div className="space-y-5 pb-8">
      {/* Page header — Squarespace / Shopify style */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="page-title">Products</h2>
            <span className="text-lg font-medium text-ink-muted tabular-nums">
              {filteredInventory.length}
            </span>
          </div>
          <p className="page-subtitle">
            Stock, payments & realized profit
            {lowStockCount > 0 && (
              <span className="text-amber-800"> · {lowStockCount} low stock</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus size={18} />
          <span>Add product</span>
        </button>
      </div>

      {/* Main list card */}
      <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 sm:p-5 border-b border-neutral-100 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" size={18} />
              <input
                type="text"
                placeholder="Search by product, SKU, brand…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-ink placeholder-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 outline-none transition-colors"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <select
                value={filterBrand}
                onChange={(e) => setFilterBrand(e.target.value)}
                className="px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm text-ink focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 outline-none"
              >
                <option value="">All brands</option>
                {brands.map((brand) => (
                  <option key={brand.id || brand._id} value={brand.id || brand._id}>{brand.name}</option>
                ))}
              </select>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm text-ink focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 outline-none"
              >
                <option value="">All categories</option>
                {categories.map((cat) => (
                  <option key={cat.id || cat._id} value={cat.id || cat._id}>{cat.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowLowStock((v) => !v)}
                className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${showLowStock
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-white border-neutral-200 text-ink-muted hover:bg-neutral-50'
                  }`}
              >
                <Filter size={15} />
                Low stock
                {lowStockCount > 0 && (
                  <span className={`tabular-nums text-[11px] px-1.5 py-0.5 rounded-full ${showLowStock ? 'bg-amber-200/80' : 'bg-neutral-100'}`}>
                    {lowStockCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <>
            <div className="md:hidden space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-neutral-100 p-4 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-14 h-14 rounded-lg bg-neutral-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-neutral-100 rounded w-3/4" />
                      <div className="h-3 bg-neutral-100 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ink-muted normal-case tracking-normal">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ink-muted normal-case tracking-normal">Stock</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ink-muted normal-case tracking-normal">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ink-muted normal-case tracking-normal">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TableRowShimmer key={i} cols={4} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : filteredInventory.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
              <Package size={26} className="text-neutral-400" />
            </div>
            <p className="text-base font-semibold text-ink">No products found</p>
            <p className="text-sm text-ink-muted mt-1 max-w-sm mx-auto">
              Filters clear karein ya naya product add karein
            </p>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="btn-primary mt-5 inline-flex items-center gap-2"
            >
              <Plus size={16} />
              Add product
            </button>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3 p-3 sm:p-4 bg-neutral-50/50">
              {paginatedInventory.length === 0 ? (
                <div className="text-center py-10">
                  <Package size={40} className="mx-auto text-neutral-300 mb-3" />
                  <p className="text-sm text-ink-muted">No products on this page</p>
                </div>
              ) : (
                paginatedInventory.map((item) => {
                  const stock = getStockSnapshot(item);
                  const totalQty = stock.onHand;
                  const soldQty = stock.sold;
                  const initialQty = stock.initial;
                  const writtenOffQty = stock.writtenOff;
                  const lowStock = isLowStock(item);
                  const sellingPrice = parseFloat(item.sellingPrice) || 0;
                  const onlinePrice = parseFloat(item.onlinePrice) || sellingPrice;
                  const isSale = sellingPrice > onlinePrice && onlinePrice > 0;
                  const hasSaleBadge = item.tag === 'sale' || item.status === 'sale' ||
                    item.isSale || item.sale || isSale;
                  const isNew = item.tag === 'new' || item.status === 'new' ||
                    item.isNew || item.new;

                  const itemId = item.id || item._id;
                  const isExpanded = expandedItems.has(itemId);
                  const pay = getProductSalePaymentStats(itemId);
                  const payStatus =
                    pay.soldQty <= 0
                      ? null
                      : pay.remainingAmount <= 0
                        ? 'Paid'
                        : pay.paidAmount > 0
                          ? 'Partial'
                          : 'Unpaid';

                  return (
                    <div
                      key={itemId}
                      className={`bg-white rounded-2xl border overflow-hidden transition-shadow shadow-soft ${lowStock ? 'border-amber-300' : 'border-neutral-200/90'
                        }`}
                    >
                      <div
                        onClick={() => openProductDetail(item)}
                        className="p-4 cursor-pointer active:bg-neutral-50"
                      >
                        <div className="flex items-start gap-3">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.productName}
                              className="w-14 h-14 object-cover rounded-xl flex-shrink-0 border border-neutral-100"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-14 h-14 bg-neutral-100 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Package size={22} className="text-neutral-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                  <span className="font-semibold text-ink text-[15px] break-words leading-snug">
                                    {item.productName || 'Unnamed Product'}
                                  </span>
                                  {lowStock && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                                      Low
                                    </span>
                                  )}
                                  {isNew && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-ink text-white">
                                      NEW
                                    </span>
                                  )}
                                  {hasSaleBadge && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                                      SALE
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-ink-muted truncate">
                                  {[
                                    item.brand?.name,
                                    item.sku,
                                    `${totalQty} on hand`,
                                    writtenOffQty > 0 ? `${writtenOffQty} written off` : null
                                  ].filter(Boolean).join(' · ')}
                                </p>
                                {pay.soldQty > 0 && (
                                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                                    {payStatus && (
                                      <span
                                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${payStatus === 'Paid'
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                          : payStatus === 'Partial'
                                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                                            : 'bg-rose-50 text-rose-800 border-rose-200'
                                          }`}
                                      >
                                        {payStatus}
                                      </span>
                                    )}
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-ink-muted font-medium">
                                      Sold {pay.soldQty}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-ink font-medium tabular-nums">
                                      Paid Rs. {pay.paidAmount.toLocaleString()}
                                    </span>
                                    {pay.remainingAmount > 0 && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 font-medium tabular-nums border border-amber-100">
                                        Due Rs. {pay.remainingAmount.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpand(itemId);
                                }}
                                className="flex-shrink-0 w-9 h-9 rounded-full bg-neutral-50 border border-neutral-200 flex items-center justify-center text-ink-muted"
                                title={isExpanded ? 'Less' : 'More'}
                              >
                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-neutral-100 space-y-3 pt-3 bg-neutral-50/80">
                          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-0.5 p-1 rounded-xl border border-neutral-200 bg-white shadow-soft">
                              <button
                                type="button"
                                onClick={() => handleEdit(item)}
                                disabled={deleting === itemId}
                                className="h-9 px-3 rounded-lg text-ink-muted hover:text-ink hover:bg-neutral-100 flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-40"
                                title="Edit"
                              >
                                <Edit2 size={14} />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => openCostingModal(item)}
                                className="h-9 px-3 rounded-lg text-ink-muted hover:text-ink hover:bg-neutral-100 flex items-center gap-1.5 text-xs font-semibold transition-colors"
                                title="Costing"
                              >
                                <DollarSign size={14} />
                                Cost
                              </button>
                              <button
                                type="button"
                                onClick={() => openAdjustStock(item)}
                                className="h-9 px-3 rounded-lg text-ink-muted hover:text-ink hover:bg-neutral-100 flex items-center gap-1.5 text-xs font-semibold transition-colors"
                                title="Adjust stock"
                              >
                                <ClipboardList size={14} />
                                Adjust
                              </button>
                              <span className="w-px h-5 bg-neutral-200 mx-0.5" aria-hidden />
                              <button
                                type="button"
                                onClick={() => handleDelete(itemId)}
                                disabled={deleting === itemId}
                                className="h-9 px-3 rounded-lg text-rose-600 hover:bg-rose-50 flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-40"
                                title="Delete"
                              >
                                {deleting === itemId ? (
                                  <span className="w-3.5 h-3.5 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                                Delete
                              </button>
                            </div>
                          </div>
                          {/* Badges */}
                          <div className="flex gap-2 mb-3 flex-wrap">
                            {isNew && (
                              <span className="px-3 py-1 bg-gradient-to-r from-gray-900 to-black text-white text-xs font-bold rounded-full uppercase tracking-wide shadow-md">
                                NEW
                              </span>
                            )}
                            {isSale && (
                              <span className="px-3 py-1 bg-gradient-to-r from-red-600 to-red-700 text-white text-xs font-bold rounded-full uppercase tracking-wide shadow-md">
                                SALE
                              </span>
                            )}
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${item.onlineStatus
                              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                              : 'bg-gray-200 text-gray-600'
                              }`}>
                              {item.onlineStatus ? '🌐 Online' : '🔒 Hidden'}
                            </span>
                          </div>
                          {/* Date Added */}
                          {item.createdAt && (
                            <div className="pt-3 border-t border-gray-200">
                              <div className="text-sm text-gray-700 mb-2 font-semibold">Date Added</div>
                              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <div className="text-sm font-medium text-gray-900">
                                  {formatDate(item.createdAt)}
                                </div>
                              </div>
                            </div>
                          )}
                          {/* Detailed Sizes */}
                          <div className="pt-3 border-t border-gray-200">
                            <div className="text-sm text-gray-700 mb-2 font-semibold">Size Breakdown</div>
                            <div className="flex flex-wrap gap-2">
                              {item.sizes.map((s, idx) => {
                                // For sizes, if current > stored initial, it means more items were added
                                const storedInitial = s.initialQuantity;
                                const sizeCurrent = s.quantity;
                                const sizeInitial = storedInitial && sizeCurrent <= storedInitial
                                  ? storedInitial
                                  : sizeCurrent;
                                const sizeSold = sizeInitial > sizeCurrent ? sizeInitial - sizeCurrent : 0;
                                return (
                                  <div key={idx} className="flex-1 min-w-[80px] bg-gray-50 p-2 rounded-lg border border-gray-200">
                                    <div className="text-xs text-gray-500 mb-1">Size {s.size}</div>
                                    <div className="text-sm font-bold text-gray-900">{s.quantity} units</div>
                                    {sizeSold > 0 && (
                                      <div className="text-xs text-red-500 mt-1">Sold: {sizeSold}</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Price Details */}
                          <div className="pt-3 border-t border-gray-200">
                            <div className="text-sm text-gray-700 mb-2 font-semibold">Pricing</div>
                            {hasSaleBadge && sellingPrice > onlinePrice && sellingPrice > 0 && onlinePrice > 0 ? (
                              <div className="bg-red-50 p-3 rounded-lg border border-red-200 space-y-1">
                                <div className="text-sm text-gray-600 line-through">
                                  Was Rs. {sellingPrice.toLocaleString()}
                                </div>
                                <div className="font-bold text-red-700 text-lg">
                                  Now Rs. {onlinePrice.toLocaleString()}
                                </div>
                              </div>
                            ) : (
                              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <div className="text-gray-700 font-semibold text-lg">
                                  Rs. {onlinePrice.toLocaleString()}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Stock Information - Detailed */}
                          <div className="pt-3 border-t border-gray-200">
                            <div className="text-sm text-gray-700 mb-2 font-semibold">Stock Details</div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                                <p className="text-[11px] text-ink-muted">Lifetime</p>
                                <p className="text-base font-bold text-ink tabular-nums mt-0.5">{initialQty}</p>
                              </div>
                              <div className={`p-2.5 rounded-xl border ${lowStock ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                <p className="text-[11px] text-ink-muted">On hand</p>
                                <p className={`text-base font-bold tabular-nums mt-0.5 ${lowStock ? 'text-rose-700' : 'text-emerald-700'}`}>{totalQty}</p>
                              </div>
                              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                                <p className="text-[11px] text-ink-muted">Sold</p>
                                <p className="text-base font-bold text-amber-800 tabular-nums mt-0.5">{soldQty}</p>
                              </div>
                              <div className={`p-2.5 rounded-xl border ${writtenOffQty > 0 ? 'bg-rose-50 border-rose-200' : 'bg-neutral-50 border-neutral-200'}`}>
                                <p className="text-[11px] text-ink-muted">Written off</p>
                                <p className={`text-base font-bold tabular-nums mt-0.5 ${writtenOffQty > 0 ? 'text-rose-700' : 'text-ink-muted'}`}>{writtenOffQty}</p>
                              </div>
                            </div>
                            {writtenOffQty > 0 && (
                              <p className="text-xs text-rose-700 mt-2">
                                {writtenOffQty} pcs physically removed (missing/theft) · loss Rs. {stock.writeOffLoss.toLocaleString()}
                              </p>
                            )}
                            <p className="text-xs text-ink-muted mt-1.5">
                              On-hand value Rs. {stock.onHandValue.toLocaleString()} (only pieces still with you)
                            </p>
                          </div>

                          {/* Sales & Payment (offline sales) */}
                          {(() => {
                            const pay = getProductSalePaymentStats(itemId);
                            if (pay.soldQty <= 0 && pay.soldAmount <= 0) return null;
                            return (
                              <div className="pt-3 border-t border-gray-200">
                                <div className="text-sm text-gray-700 mb-2 font-semibold">Sales & Payment</div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                                    <div className="text-[11px] font-medium normal-case tracking-normal text-orange-700/80 font-semibold">Sold Qty</div>
                                    <div className="text-base font-bold text-orange-800 mt-1">{pay.soldQty} pcs</div>
                                  </div>
                                  <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                                    <div className="text-[11px] font-medium normal-case tracking-normal text-neutral-500 font-semibold">Billed</div>
                                    <div className="text-base font-bold text-ink mt-1 break-words">Rs. {pay.soldAmount.toLocaleString()}</div>
                                  </div>
                                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                                    <div className="text-[11px] font-medium normal-case tracking-normal text-emerald-700/80 font-semibold">Payment In</div>
                                    <div className="text-base font-bold text-emerald-700 mt-1 break-words">Rs. {pay.paidAmount.toLocaleString()}</div>
                                  </div>
                                  <div className={`p-3 rounded-lg border ${pay.remainingAmount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                    <div className={`text-[11px] font-medium normal-case tracking-normal font-semibold ${pay.remainingAmount > 0 ? 'text-rose-700/80' : 'text-emerald-700/80'}`}>
                                      Remaining
                                    </div>
                                    <div className={`text-base font-bold mt-1 break-words ${pay.remainingAmount > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                      Rs. {pay.remainingAmount.toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                                <p className="text-[11px] text-neutral-400 mt-2">
                                  Payment is shared from each invoice by this product’s bill amount.
                                </p>
                              </div>
                            );
                          })()}

                          {/* Cost and Value */}
                          <div className="pt-3 border-t border-gray-200">
                            <div className="text-sm text-gray-700 mb-2 font-semibold">Financial Summary</div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <div className="text-xs text-gray-600 mb-1.5 font-medium">Cost/Unit</div>
                                <div className="text-base sm:text-lg font-bold text-gray-900 break-words">
                                  Rs. {parseFloat(item.costPerUnit || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                <div className="text-xs text-gray-600 mb-1.5 font-medium">On-hand value</div>
                                <div className="text-base sm:text-lg font-bold text-blue-700 break-words" style={{ minHeight: '24px' }}>
                                  Rs. {stock.onHandValue.toLocaleString('en-IN')}
                                </div>
                                <div className="text-[11px] text-ink-muted mt-1">{totalQty} pcs × cost</div>
                              </div>
                              <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 col-span-2">
                                <div className="text-xs text-gray-600 mb-1.5 font-medium">Actual cost value</div>
                                <div className="text-base sm:text-lg font-bold text-ink break-words tabular-nums">
                                  Rs. {stock.actualCostValue.toLocaleString('en-IN')}
                                </div>
                                <div className="text-[11px] text-ink-muted mt-1">
                                  Lifetime {initialQty} pcs × Rs. {stock.costPerUnit.toLocaleString()}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Revenue - Enhanced */}
                          {(() => {
                            const totalEarned = calculateTotalEarned(itemId);
                            const productKey = `${item.productName}_${item.sizes?.[0]?.size || 'N/A'}`;
                            const onlineData = onlineSales[productKey];
                            const totalRevenue = parseFloat(totalEarned || 0) + parseFloat(onlineData?.totalRevenue || 0);

                            return (
                              <div className="pt-3 border-t border-gray-200 mt-3">
                                <div className="text-sm text-gray-700 mb-2 font-semibold">Revenue</div>
                                <div className="space-y-3">
                                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-gray-700 font-medium">Offline Sales:</span>
                                      <div className="text-right">
                                        <div className="text-base sm:text-lg font-bold text-green-700 break-words" style={{ minHeight: '24px' }}>
                                          Rs. {(isNaN(totalEarned) ? 0 : parseFloat(totalEarned || 0)).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                        </div>
                                        {soldQty > 0 && (
                                          <div className="text-xs text-gray-600 mt-1">
                                            ({soldQty} units sold)
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {onlineData && onlineData.totalRevenue > 0 ? (
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-700 font-medium">Online Sales:</span>
                                        <div className="text-right">
                                          <div className="text-base sm:text-lg font-bold text-blue-700 break-words">
                                            Rs. {parseFloat(onlineData.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                          </div>
                                          <div className="text-xs text-gray-600 mt-1">
                                            ({onlineData.totalQuantity} units)
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : null}
                                  <div className="bg-gradient-to-r from-green-100 to-green-50 p-4 rounded-lg border-2 border-green-300">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm sm:text-base font-bold text-gray-800">Total Revenue:</span>
                                      <span className={`text-lg sm:text-xl font-bold break-words ${totalRevenue > 0 ? 'text-green-700' : 'text-gray-500'}`} style={{ minHeight: '28px' }}>
                                        Rs. {(isNaN(totalRevenue) ? 0 : parseFloat(totalRevenue || 0)).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Realized — Paid − stock capital (pehle capital, phir profit) */}
                          {(() => {
                            const productKey = `${item.productName}_${item.sizes?.[0]?.size || 'N/A'}`;
                            const onlineData = onlineSales[productKey];
                            const rp = getProductRealizedProfit(item, onlineData);
                            const inProfit = rp.profitAfterCapital > 0;
                            const capitalPending = rp.capitalLeft > 0;
                            const showAmount = inProfit ? rp.profitAfterCapital : rp.capitalLeft;

                            return (
                              <div className="pt-3 border-t border-gray-200 mt-3">
                                <div className="text-sm text-gray-700 mb-2 font-semibold">Realized Profit</div>
                                <div className={`bg-gradient-to-r p-4 rounded-lg border-2 ${inProfit ? 'from-green-100 to-green-50 border-green-300' : capitalPending ? 'from-amber-100 to-amber-50 border-amber-300' : 'from-gray-100 to-gray-50 border-gray-300'}`}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm sm:text-base font-bold text-gray-800">
                                      {inProfit ? 'Profit:' : capitalPending ? 'Capital left:' : 'Break Even:'}
                                    </span>
                                    <span className={`text-lg sm:text-xl font-bold break-words ${inProfit ? 'text-green-700' : capitalPending ? 'text-amber-800' : 'text-gray-500'}`} style={{ minHeight: '28px' }}>
                                      {capitalPending ? '−' : inProfit ? '+' : ''}Rs. {(isNaN(showAmount) ? 0 : parseFloat(showAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                                    <div>Paid Rs. {rp.paidTotal.toLocaleString('en-IN')} − Stock capital Rs. {rp.stockCapital.toLocaleString('en-IN')}</div>
                                    {rp.writtenOffQty > 0 && (
                                      <div className="text-rose-700">
                                        Missing/write-off {rp.writtenOffQty} pcs · loss Rs. {rp.missingLoss.toLocaleString('en-IN')}
                                      </div>
                                    )}
                                    {capitalPending && (
                                      <div className="text-amber-800">Abhi capital recover nahi hua — uske baad profit</div>
                                    )}
                                    {rp.remainingAmount > 0 && (
                                      <div className="text-amber-700">
                                        Due Rs. {rp.remainingAmount.toLocaleString('en-IN')} — jab aayega capital/profit badhega
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View — clean, less congested */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[1080px] border-separate border-spacing-0">
                <thead>
                  <tr className="bg-neutral-50/90">
                    <th className="sticky left-0 z-20 bg-neutral-50/95 backdrop-blur px-5 py-3.5 text-left text-[11px] font-semibold text-ink-muted border-b border-neutral-200">
                      Product
                    </th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-ink-muted border-b border-neutral-200">Stock</th>
                    <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-ink-muted border-b border-neutral-200">Price</th>
                    <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-ink-muted border-b border-neutral-200 hidden lg:table-cell">Cost value</th>
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-ink-muted border-b border-neutral-200 hidden lg:table-cell">Collections</th>
                    <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-ink-muted border-b border-neutral-200 hidden xl:table-cell">P&amp;L</th>
                    <th className="sticky right-0 z-20 bg-neutral-50/95 backdrop-blur px-4 py-3.5 text-right text-[11px] font-semibold text-ink-muted border-b border-neutral-200">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInventory.map((item) => {
                    const stock = getStockSnapshot(item);
                    const totalQty = stock.onHand;
                    const soldQty = stock.sold;
                    const initialQty = stock.initial;
                    const writtenOffQty = stock.writtenOff;
                    const lowStock = isLowStock(item);
                    const itemId = item.id || item._id;
                    const sellingPrice = parseFloat(item.sellingPrice) || 0;
                    const onlinePrice = parseFloat(item.onlinePrice) || sellingPrice;
                    const isSaleBadge = item.tag === 'sale' || item.status === 'sale' ||
                      item.isSale || item.sale ||
                      (sellingPrice > onlinePrice && onlinePrice > 0);
                    const isNewBadge = item.tag === 'new' || item.status === 'new' || item.isNew || item.new;
                    const pay = getProductSalePaymentStats(itemId);
                    const productKey = `${item.productName}_${item.sizes?.[0]?.size || 'N/A'}`;
                    const onlineData = onlineSales[productKey];
                    const rp = getProductRealizedProfit(item, onlineData);
                    const inProfit = rp.profitAfterCapital > 0;
                    const capitalPending = rp.capitalLeft > 0;
                    const showAmount = inProfit ? rp.profitAfterCapital : rp.capitalLeft;
                    const payStatus =
                      pay.soldQty <= 0 && pay.soldAmount <= 0
                        ? null
                        : pay.remainingAmount <= 0
                          ? 'Paid'
                          : pay.paidAmount > 0
                            ? 'Partial'
                            : 'Unpaid';
                    const sizePreview = (item.sizes || [])
                      .filter((s) => (parseFloat(s.quantity) || 0) > 0 || (item.sizes || []).length <= 2)
                      .slice(0, 3);

                    return (
                      <tr
                        key={itemId}
                        onClick={() => openProductDetail(item)}
                        className={`group cursor-pointer transition-colors ${
                          lowStock ? 'bg-amber-50/30 hover:bg-amber-50/50' : 'bg-white hover:bg-neutral-50/80'
                        }`}
                        title="Open buyers & payments"
                      >
                        {/* Product */}
                        <td className={`sticky left-0 z-10 px-5 py-4 border-b border-neutral-100 align-top min-w-[240px] max-w-[320px] ${
                          lowStock ? 'bg-amber-50/30 group-hover:bg-amber-50/50' : 'bg-white group-hover:bg-neutral-50/80'
                        }`}>
                          <div className="flex items-start gap-3">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.productName}
                                className="w-12 h-12 object-cover rounded-xl border border-neutral-100 shrink-0"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center shrink-0">
                                <Package size={18} className="text-neutral-400" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-ink text-[15px] leading-snug break-words group-hover:text-ink">
                                  {item.productName || 'Unnamed Product'}
                                </span>
                                {lowStock && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900">
                                    Low
                                  </span>
                                )}
                                {isNewBadge && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-ink text-white">NEW</span>
                                )}
                                {isSaleBadge && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-100">SALE</span>
                                )}
                              </div>
                              <p className="text-xs text-ink-muted mt-1 truncate">
                                {[item.brand?.name, item.category?.name].filter(Boolean).join(' · ') || '—'}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {sizePreview.map((s, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-100 text-[11px] font-medium text-ink tabular-nums"
                                  >
                                    {s.size}
                                    <span className="text-ink-muted font-normal mx-1">·</span>
                                    {s.quantity}
                                  </span>
                                ))}
                                {(item.sizes || []).length > 3 && (
                                  <span className="text-[11px] text-ink-muted">+{(item.sizes || []).length - 3}</span>
                                )}
                                <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                  item.onlineStatus
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                                    : 'bg-neutral-50 text-ink-muted border-neutral-200'
                                }`}>
                                  {item.onlineStatus ? 'Online' : 'Hidden'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Stock */}
                        <td className="px-4 py-4 border-b border-neutral-100 align-top whitespace-nowrap">
                          <p className={`text-xl font-bold tabular-nums tracking-tight ${lowStock ? 'text-rose-700' : 'text-ink'}`}>
                            {totalQty}
                            <span className="text-xs font-medium text-ink-muted ml-1.5">on hand</span>
                          </p>
                          <p className="text-[11px] text-ink-muted mt-1.5 tabular-nums">
                            Lifetime {initialQty}
                            <span className="mx-1.5 text-neutral-300">·</span>
                            Sold {soldQty}
                          </p>
                          {writtenOffQty > 0 ? (
                            <p className="text-[11px] font-semibold text-rose-700 mt-1 tabular-nums">
                              Written off {writtenOffQty}
                            </p>
                          ) : (
                            <p className="text-[11px] text-ink-faint mt-1">No write-offs</p>
                          )}
                        </td>

                        {/* Price */}
                        <td className="px-4 py-4 border-b border-neutral-100 align-top text-right whitespace-nowrap">
                          {isSaleBadge && sellingPrice > onlinePrice && onlinePrice > 0 ? (
                            <div>
                              <p className="text-xs text-ink-muted line-through tabular-nums">Rs. {sellingPrice.toLocaleString()}</p>
                              <p className="text-base font-bold text-rose-700 tabular-nums mt-0.5">Rs. {onlinePrice.toLocaleString()}</p>
                            </div>
                          ) : (
                            <p className="text-base font-semibold text-ink tabular-nums">Rs. {onlinePrice.toLocaleString()}</p>
                          )}
                          <p className="text-[11px] text-ink-muted mt-1.5 tabular-nums">
                            Cost Rs. {(parseFloat(item.costPerUnit) || 0).toLocaleString()}
                          </p>
                        </td>

                        {/* Cost value: on-hand + actual (lifetime) */}
                        <td className="px-4 py-4 border-b border-neutral-100 align-top text-right whitespace-nowrap hidden lg:table-cell">
                          <p className="text-[11px] text-ink-muted">On hand</p>
                          <p className="text-base font-semibold text-sky-700 tabular-nums">
                            Rs. {stock.onHandValue.toLocaleString('en-IN')}
                          </p>
                          <p className="text-[11px] text-ink-muted mt-2">Actual cost</p>
                          <p className="text-sm font-bold text-ink tabular-nums">
                            Rs. {stock.actualCostValue.toLocaleString('en-IN')}
                          </p>
                          <p className="text-[10px] text-ink-muted mt-0.5 tabular-nums">
                            {initialQty} pcs × Rs. {stock.costPerUnit.toLocaleString()}
                          </p>
                          {writtenOffQty > 0 && (
                            <p className="text-[11px] text-rose-700 font-medium mt-1.5 tabular-nums">
                              Write-off Rs. {stock.writeOffLoss.toLocaleString()}
                            </p>
                          )}
                        </td>

                        {/* Collections */}
                        <td className="px-4 py-4 border-b border-neutral-100 align-top hidden lg:table-cell min-w-[148px]">
                          {!payStatus ? (
                            <span className="text-xs text-ink-faint">No sales yet</span>
                          ) : (
                            <div>
                              <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                                payStatus === 'Paid'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                                  : payStatus === 'Partial'
                                    ? 'bg-amber-50 text-amber-900 border-amber-100'
                                    : 'bg-rose-50 text-rose-800 border-rose-100'
                              }`}>
                                {payStatus}
                              </span>
                              <p className="text-sm font-semibold text-ink tabular-nums mt-2">
                                Rs. {pay.paidAmount.toLocaleString()}
                              </p>
                              <p className="text-[11px] text-ink-muted mt-0.5 tabular-nums">
                                {pay.soldQty} sold
                                {pay.remainingAmount > 0 && (
                                  <span className="text-amber-800 font-medium"> · Due Rs. {pay.remainingAmount.toLocaleString()}</span>
                                )}
                              </p>
                            </div>
                          )}
                        </td>

                        {/* P&L */}
                        <td className="px-4 py-4 border-b border-neutral-100 align-top text-right whitespace-nowrap hidden xl:table-cell">
                          <p className={`text-base font-bold tabular-nums ${
                            inProfit ? 'text-emerald-700' : capitalPending ? 'text-amber-800' : 'text-ink-muted'
                          }`}>
                            {capitalPending ? '−' : inProfit ? '+' : ''}
                            Rs. {(isNaN(showAmount) ? 0 : parseFloat(showAmount || 0)).toLocaleString('en-IN')}
                          </p>
                          <p className={`text-[11px] font-medium mt-1 ${
                            inProfit ? 'text-emerald-700' : capitalPending ? 'text-amber-800' : 'text-ink-muted'
                          }`}>
                            {inProfit ? 'Profit' : capitalPending ? 'Capital left' : 'Break even'}
                          </p>
                        </td>

                        {/* Actions */}
                        <td
                          className={`sticky right-0 z-10 px-4 py-4 border-b border-neutral-100 align-middle ${
                            lowStock ? 'bg-amber-50/30 group-hover:bg-amber-50/50' : 'bg-white group-hover:bg-neutral-50/80'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end">
                            <div className="inline-flex items-center gap-0.5 p-1 rounded-xl border border-neutral-200/90 bg-white shadow-soft">
                              <button
                                type="button"
                                onClick={() => handleEdit(item)}
                                disabled={deleting === itemId}
                                className="w-9 h-9 rounded-lg text-ink-muted hover:text-ink hover:bg-neutral-100 flex items-center justify-center transition-colors disabled:opacity-40"
                                title="Edit product"
                                aria-label="Edit product"
                              >
                                <Edit2 size={15} strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                onClick={() => openCostingModal(item)}
                                className="w-9 h-9 rounded-lg text-ink-muted hover:text-ink hover:bg-neutral-100 flex items-center justify-center transition-colors"
                                title="Costing"
                                aria-label="Costing"
                              >
                                <DollarSign size={15} strokeWidth={2} />
                              </button>
                              <button
                                type="button"
                                onClick={() => openAdjustStock(item)}
                                className="w-9 h-9 rounded-lg text-ink-muted hover:text-ink hover:bg-neutral-100 flex items-center justify-center transition-colors"
                                title="Adjust stock"
                                aria-label="Adjust stock"
                              >
                                <ClipboardList size={15} strokeWidth={2} />
                              </button>
                              <span className="w-px h-5 bg-neutral-200 mx-0.5" aria-hidden />
                              <button
                                type="button"
                                onClick={() => handleDelete(itemId)}
                                disabled={deleting === itemId}
                                className="w-9 h-9 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center justify-center transition-colors disabled:opacity-40"
                                title="Delete"
                                aria-label="Delete"
                              >
                                {deleting === itemId ? (
                                  <span className="w-3.5 h-3.5 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                                ) : (
                                  <Trash2 size={15} strokeWidth={2} />
                                )}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {!loading && filteredInventory.length > itemsPerPage && (
          <div className="px-4 sm:px-6 py-4 bg-neutral-50/80 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-ink-muted text-center sm:text-left">
              Showing <span className="font-semibold text-ink tabular-nums">{startIndex + 1}</span>–
              <span className="font-semibold text-ink tabular-nums">{Math.min(endIndex, filteredInventory.length)}</span> of{' '}
              <span className="font-semibold text-ink tabular-nums">{filteredInventory.length}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-ink bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft size={16} />
                <span className="hidden sm:inline">Prev</span>
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[40px] px-3 py-2 text-sm font-semibold rounded-xl transition-colors ${currentPage === pageNum
                        ? 'bg-ink text-white'
                        : 'text-ink bg-white border border-neutral-200 hover:bg-neutral-50'
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-ink bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-elevated max-w-2xl w-full max-h-[92dvh] overflow-y-auto border border-neutral-200/80">
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-5 sm:px-6 py-4 border-b border-neutral-100 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-ink tracking-tight">
                  {editingItem ? 'Edit product' : 'Add product'}
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Stock, pricing & online visibility
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-ink-muted"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                  <select
                    required
                    value={formData.brand}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        brand: e.target.value,
                        category: '',
                        subcategory: ''
                      });
                    }}
                    className="input-field"
                  >
                    <option value="">Select Brand</option>
                    {brands.map(brand => (
                      <option key={brand.id || brand._id} value={brand.id || brand._id}>{brand.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value, subcategory: '' })}
                    className="input-field"
                    disabled={!formData.brand}
                  >
                    <option value="">{formData.brand ? 'Select Category' : 'Select Brand First'}</option>
                    {filteredCategories.map(cat => (
                      <option key={cat.id || cat._id} value={cat.id || cat._id}>{cat.name}</option>
                    ))}
                  </select>
                  {!formData.brand && (
                    <p className="text-xs text-red-500 mt-1">Please select a brand first</p>
                  )}
                </div>
              </div>

              {/* Subcategory Selection */}
              {formData.category && subcategories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory (Optional)</label>
                  <select
                    value={formData.subcategory}
                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                    className="input-field"
                  >
                    <option value="">None (Use Main Category)</option>
                    {subcategories.map(subcat => (
                      <option key={subcat.id || subcat._id} value={subcat.id || subcat._id}>
                        {subcat.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Optional: Select a subcategory if available</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Winter Hoodie"
                />
              </div>

              {/* Image Upload */}
              <ImageUpload
                imageUrl={formData.imageUrl}
                onImageChange={(url) => setFormData({ ...formData, imageUrl: url })}
                label="Product Image"
                folder="upload pics/inventory"
                disabled={saving}
              />

              {/* Size Option Toggle */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="useSizes"
                  checked={useSizes}
                  onChange={(e) => setUseSizes(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <label htmlFor="useSizes" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Track by sizes (S, M, L, XL) - Leave unchecked for simple quantity
                </label>
              </div>

              {/* Conditional Quantity or Sizes */}
              {useSizes ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Size Breakdown</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {formData.sizes.map((size, index) => (
                      <div key={index}>
                        <label className="block text-xs text-gray-600 mb-1">
                          Size {size.size}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={size.quantity}
                          onChange={(e) => handleSizeChange(index, e.target.value)}
                          className="input-field"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Quantity *</label>
                  <input
                    type="number"
                    required={!useSizes}
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData(applyPurchaseCostSync({ quantity: e.target.value }))}
                    className="input-field"
                    placeholder="e.g., 100"
                  />
                  <p className="text-xs text-gray-500 mt-1">Total number of items in stock</p>
                </div>
              )}

              <div className="border border-amber-100 bg-amber-50/50 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-amber-900 mb-2">Purchase and landed cost</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total purchase cost (Rs.)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.basePurchaseCost}
                      onChange={(e) => {
                        const basePurchaseCost = e.target.value;
                        const base = parseFloat(basePurchaseCost) || 0;
                        const invAmt = parseFloat(formData.fundingInvestorAmount) || 0;
                        setFormData(applyPurchaseCostSync({
                          basePurchaseCost,
                          fundingOwnAmount: formData.fundingInvestorId
                            ? String(Math.max(0, base - invAmt))
                            : (base > 0 ? String(base) : formData.fundingOwnAmount)
                        }));
                      }}
                      className="input-field"
                      placeholder="e.g. 2000000 for full batch"
                    />
                    <p className="text-xs text-gray-500 mt-1">Total amount paid for this stock (all pieces)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cost per piece (estimate)</label>
                    <input
                      type="text"
                      readOnly
                      value={(() => {
                        const qty = useSizes
                          ? formData.sizes.reduce((s, x) => s + (parseFloat(x.quantity) || 0), 0)
                          : parseFloat(formData.quantity) || 0;
                        const base = parseFloat(formData.basePurchaseCost);
                        const unit = parseFloat(formData.costPerUnit) || 0;
                        if (qty > 0 && base > 0) return 'Rs. ' + Math.round(base / qty).toLocaleString();
                        if (unit > 0) return 'Rs. ' + unit.toLocaleString();
                        return '—';
                      })()}
                      className="input-field bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">Updates when you add product expenses via Costing</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-amber-100">
                  <p className="text-sm font-semibold text-amber-900 mb-1">Who funded this purchase?</p>
                  <p className="text-xs text-gray-500 mb-3">
                    Own + investor amounts should match purchase cost. Product expenses (transport, rafu) stay as your cost and raise landed cost before profit.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Your money (Rs.)</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.fundingOwnAmount}
                        onChange={(e) => setFormData({ ...formData, fundingOwnAmount: e.target.value })}
                        className="input-field"
                        placeholder="Own capital in purchase"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Investor</label>
                      <select
                        value={formData.fundingInvestorId}
                        onChange={(e) => {
                          const id = e.target.value;
                          const inv = investors.find((i) => (i.id || i._id) === id);
                          const base = parseFloat(formData.basePurchaseCost) || 0;
                          const invAmt = parseFloat(formData.fundingInvestorAmount) || 0;
                          setFormData({
                            ...formData,
                            fundingInvestorId: id,
                            fundingInvestorName: inv?.name || '',
                            fundingOwnAmount: id
                              ? String(Math.max(0, base - invAmt))
                              : (base > 0 ? String(base) : formData.fundingOwnAmount),
                            fundingInvestorAmount: id ? formData.fundingInvestorAmount : ''
                          });
                        }}
                        className="input-field"
                      >
                        <option value="">None (100% own)</option>
                        {investors.map((inv) => (
                          <option key={inv.id || inv._id} value={inv.id || inv._id}>
                            {inv.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Investor money (Rs.)</label>
                      <input
                        type="number"
                        min="0"
                        disabled={!formData.fundingInvestorId}
                        value={formData.fundingInvestorAmount}
                        onChange={(e) => {
                          const fundingInvestorAmount = e.target.value;
                          const base = parseFloat(formData.basePurchaseCost) || 0;
                          const invAmt = parseFloat(fundingInvestorAmount) || 0;
                          setFormData({
                            ...formData,
                            fundingInvestorAmount,
                            fundingOwnAmount: String(Math.max(0, base - invAmt))
                          });
                        }}
                        className="input-field disabled:bg-gray-50"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {formData.fundingInvestorId && (() => {
                    const base = parseFloat(formData.basePurchaseCost) || 0;
                    const own = parseFloat(formData.fundingOwnAmount) || 0;
                    const invAmt = parseFloat(formData.fundingInvestorAmount) || 0;
                    const sum = own + invAmt;
                    const mismatch = base > 0 && Math.abs(sum - base) > 1;
                    return (
                      <p className={`text-xs mt-2 ${mismatch ? 'text-rose-600 font-medium' : 'text-emerald-700'}`}>
                        {mismatch
                          ? `Warning: Own (${own.toLocaleString()}) + Investor (${invAmt.toLocaleString()}) = ${sum.toLocaleString()} ≠ purchase ${base.toLocaleString()}`
                          : `Split OK: Own Rs. ${own.toLocaleString()} + Investor Rs. ${invAmt.toLocaleString()} = Rs. ${sum.toLocaleString()}`}
                      </p>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Per Unit *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    readOnly={!!(parseFloat(formData.basePurchaseCost) > 0 && getFormTotalQty() > 0)}
                    value={formData.costPerUnit}
                    onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })}
                    className={`input-field ${parseFloat(formData.basePurchaseCost) > 0 && getFormTotalQty() > 0 ? 'bg-gray-50' : ''}`}
                    placeholder="e.g. 233"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {parseFloat(formData.basePurchaseCost) > 0 && getFormTotalQty() > 0
                      ? 'Auto: purchase cost ÷ quantity. Updates via Costing when you add expenses.'
                      : 'Enter manually, or fill total purchase cost above to auto-calculate'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (Original/Was) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="input-field"
                    placeholder="4690"
                  />
                  <p className="text-xs text-gray-500 mt-1">Original price (shown as "Was" for sale items)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Low Stock Alert Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.lowStockThreshold}
                    onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                    className="input-field"
                    placeholder="10"
                  />
                  <p className="text-xs text-gray-500 mt-1">Alert when stock falls below this number</p>
                </div>
              </div>

              {/* Online/Website Settings Section */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span>🌐</span>
                  Online Store Settings
                </h4>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU/Model Number</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="input-field"
                    placeholder="e.g., MT0405P"
                  />
                  <p className="text-xs text-gray-500 mt-1">Product identifier for website (shown as "Product Name - SKU")</p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sale Price / Now Price (Rs.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.onlinePrice}
                    onChange={(e) => {
                      const newOnlinePrice = e.target.value;
                      // Auto-detect sale if sellingPrice > onlinePrice
                      const sellingPriceNum = parseFloat(formData.sellingPrice) || 0;
                      const onlinePriceNum = parseFloat(newOnlinePrice) || 0;
                      const shouldBeSale = sellingPriceNum > onlinePriceNum && onlinePriceNum > 0;

                      setFormData({
                        ...formData,
                        onlinePrice: newOnlinePrice,
                        // Auto-apply sale badge if price is lower
                        tag: shouldBeSale ? (formData.tag || 'sale') : (formData.tag === 'sale' ? '' : formData.tag),
                        isSale: shouldBeSale || formData.isSale,
                        sale: shouldBeSale || formData.sale
                      });
                    }}
                    className="input-field"
                    placeholder="3690"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Sale price (shown as "Now"). If set lower than Original Price ({formData.sellingPrice || '0'}), automatically marks as SALE.
                    {formData.sellingPrice && formData.onlinePrice &&
                      parseFloat(formData.sellingPrice) > parseFloat(formData.onlinePrice) && (
                        <span className="text-green-600 font-medium ml-1">✓ Sale badge will be applied</span>
                      )}
                  </p>
                  {!formData.onlinePrice && (
                    <p className="text-xs text-blue-500 mt-1">
                      💡 Leave empty to use Original Price ({formData.sellingPrice || 'set above'}) as the regular price
                    </p>
                  )}
                </div>

                {/* Badge Selection */}
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Product Badges</label>
                  <p className="text-xs text-gray-500 mb-3">
                    Select badges to display on website. "NEW" and "SALE" badges appear as black rectangles in top-right corner.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                      <input
                        type="checkbox"
                        id="isNew"
                        checked={formData.isNew || formData.new || formData.tag === 'new' || formData.status === 'new'}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setFormData({
                            ...formData,
                            isNew: isChecked,
                            new: isChecked,
                            tag: isChecked ? 'new' : (formData.tag === 'new' ? '' : formData.tag),
                            status: isChecked ? 'new' : (formData.status === 'new' ? '' : formData.status),
                            // Clear sale if new is selected
                            isSale: isChecked ? false : formData.isSale,
                            sale: isChecked ? false : formData.sale
                          });
                        }}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <label htmlFor="isNew" className="flex items-center gap-2 cursor-pointer flex-1">
                        <span className="px-2 py-1 bg-black text-white text-xs font-medium rounded">NEW</span>
                        <span className="text-sm text-gray-700">New Arrival Badge</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                      <input
                        type="checkbox"
                        id="isSale"
                        checked={formData.isSale || formData.sale || formData.tag === 'sale' || formData.status === 'sale' ||
                          (formData.sellingPrice && formData.onlinePrice &&
                            parseFloat(formData.sellingPrice) > parseFloat(formData.onlinePrice) && parseFloat(formData.onlinePrice) > 0)}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setFormData({
                            ...formData,
                            isSale: isChecked,
                            sale: isChecked,
                            tag: isChecked ? 'sale' : (formData.tag === 'sale' ? '' : formData.tag),
                            status: isChecked ? 'sale' : (formData.status === 'sale' ? '' : formData.status),
                            // Clear new if sale is selected
                            isNew: isChecked ? false : formData.isNew,
                            new: isChecked ? false : formData.new
                          });
                        }}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <label htmlFor="isSale" className="flex items-center gap-2 cursor-pointer flex-1">
                        <span className="px-2 py-1 bg-black text-white text-xs font-medium rounded">SALE</span>
                        <span className="text-sm text-gray-700">Sale Badge</span>
                      </label>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    💡 Tip: Sale badge is automatically applied when Sale Price is lower than Original Price.
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field"
                    rows="4"
                    placeholder="Enter detailed product description for website visitors..."
                  />
                  <p className="text-xs text-gray-500 mt-1">This description will appear on your website product page</p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Additional Product Images</label>
                  <p className="text-xs text-gray-500 mb-2">Upload multiple images (front, back, close-up, etc.) for the website</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[0, 1, 2, 3].map((index) => (
                      <div key={index}>
                        <ImageUpload
                          imageUrl={formData.productImages[index] || ''}
                          onImageChange={(url) => {
                            const newImages = [...(formData.productImages || [])];
                            if (url) {
                              newImages[index] = url;
                            } else {
                              newImages.splice(index, 1);
                            }
                            setFormData({ ...formData, productImages: newImages });
                          }}
                          label={`Image ${index + 1}`}
                          folder="upload pics/inventory"
                          disabled={saving}
                          className="text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="onlineStatus"
                    checked={formData.onlineStatus}
                    onChange={(e) => setFormData({ ...formData, onlineStatus: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <label htmlFor="onlineStatus" className="text-sm font-medium text-gray-700 cursor-pointer flex-1">
                    Show this product on website
                  </label>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${formData.onlineStatus
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                    }`}>
                    {formData.onlineStatus ? 'Visible Online' : 'Hidden'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {formData.onlineStatus
                    ? '✅ This product will be visible on your website'
                    : '❌ This product will be hidden from your website'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input-field"
                  rows="3"
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-2"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingItem ? 'Update' : 'Add'} Item</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Product Costing Modal */}
      {showCostingModal && costingItem && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-elevated max-w-2xl w-full max-h-[92dvh] overflow-y-auto border border-neutral-200/80">
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-5 sm:px-6 py-4 border-b border-neutral-100 flex justify-between items-start gap-3">
              <div>
                <h3 className="text-lg font-bold text-ink tracking-tight">Product costing</h3>
                <p className="text-sm text-ink-muted mt-0.5">{costingItem.productName}</p>
              </div>
              <button
                type="button"
                onClick={() => { setShowCostingModal(false); setCostingItem(null); }}
                className="w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-ink-muted"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              {(() => {
                const qty = getItemInitialQty(costingItem);
                const base = parseFloat(costingItem.basePurchaseCost) || 0;
                const expTotal = parseFloat(costingItem.productExpensesTotal) || productExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                const total = parseFloat(costingItem.totalLandedCost) || base + expTotal;
                const perPiece = qty > 0 ? total / qty : parseFloat(costingItem.costPerUnit) || 0;
                const invFund = parseFloat(costingItem.fundingInvestorAmount) || 0;
                const ownFund = parseFloat(costingItem.fundingOwnAmount);
                const ownDisplay = !isNaN(ownFund) ? ownFund : Math.max(0, base - invFund);
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-gray-50 p-3 rounded-lg border"><p className="text-xs text-gray-500">Original qty</p><p className="font-bold">{qty.toLocaleString()}</p></div>
                      <div className="bg-gray-50 p-3 rounded-lg border"><p className="text-xs text-gray-500">Base purchase</p><p className="font-bold">Rs. {base.toLocaleString()}</p></div>
                      <div className="bg-amber-50 p-3 rounded-lg border border-amber-100"><p className="text-xs text-gray-500">Product expenses (your cost)</p><p className="font-bold text-amber-800">Rs. {expTotal.toLocaleString()}</p></div>
                      <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200"><p className="text-xs text-gray-500">Landed / piece</p><p className="font-bold text-emerald-800">Rs. {Math.round(perPiece).toLocaleString()}</p></div>
                    </div>
                    {(invFund > 0 || costingItem.fundingInvestorName) && (
                      <p className="text-xs text-gray-600 bg-white border rounded-lg px-3 py-2">
                        Purchase funding: Own Rs. {ownDisplay.toLocaleString()}
                        {costingItem.fundingInvestorName
                          ? ` · ${costingItem.fundingInvestorName} Rs. ${invFund.toLocaleString()}`
                          : ''}
                        . Profit starts after landed Rs. {total.toLocaleString()} is recovered from payments.
                      </p>
                    )}
                  </div>
                );
              })()}
              <p className="text-xs text-gray-500">Formula: (Base purchase + product expenses) / original quantity. Sales do not change per-piece cost.</p>

              <form onSubmit={handleAddProductExpense} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-800">Add expenses to this product</h4>
                  <button type="button" onClick={addProductExpenseLine} className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                    <Plus size={16} /> Add line
                  </button>
                </div>
                <input type="date" className="input-field max-w-xs" value={productExpenseDate} onChange={(e) => setProductExpenseDate(e.target.value)} />
                <div className="space-y-2">
                  {productExpenseLines.map(line => (
                    <div key={line.key} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-12 sm:col-span-3">
                        <select
                          className="input-field text-sm"
                          value={productPresetCategories.includes(line.category) || line.category === 'Other' ? line.category : 'Other'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setProductExpenseLines((lines) =>
                              lines.map((l) =>
                                l.key === line.key
                                  ? { ...l, category: val, customCategory: val === 'Other' ? l.customCategory : '' }
                                  : l
                              )
                            );
                          }}
                        >
                          {productExpenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {line.category === 'Other' && (
                          <input
                            type="text"
                            className="input-field text-sm mt-2"
                            placeholder="Custom category name *"
                            value={line.customCategory || ''}
                            onChange={(e) => updateProductExpenseLine(line.key, 'customCategory', e.target.value)}
                            autoFocus
                          />
                        )}
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <input className="input-field text-sm" placeholder="Amount (Rs.)" value={line.amount} onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) updateProductExpenseLine(line.key, 'amount', v); }} />
                      </div>
                      <div className="col-span-5 sm:col-span-5">
                        <input className="input-field text-sm" placeholder="Description (optional)" value={line.description} onChange={(e) => updateProductExpenseLine(line.key, 'description', e.target.value)} />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button type="button" onClick={() => removeProductExpenseLine(line.key)} disabled={productExpenseLines.length <= 1} className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-30">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {productExpenseLines.some(l => parseFloat(l.amount) > 0) && (
                  <p className="text-sm font-medium text-gray-700 text-right">
                    Total: Rs. {productExpenseLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0).toLocaleString()}
                  </p>
                )}
                <button type="submit" disabled={savingProductExpense} className="btn-primary">
                  {savingProductExpense ? 'Saving...' : (() => {
                    const n = productExpenseLines.filter(l => parseFloat(l.amount) > 0).length;
                    if (n > 1) return `Save ${n} expenses and update cost`;
                    return 'Add expense and update cost';
                  })()}
                </button>
              </form>

              <div>
                <h4 className="font-semibold text-gray-800 mb-2">Expense history</h4>
                {loadingCosting ? (
                  <p className="text-gray-500 text-sm">Loading...</p>
                ) : productExpenses.length === 0 ? (
                  <p className="text-gray-500 text-sm">No product expenses yet.</p>
                ) : (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50"><tr>
                        <th className="text-left p-2">Date</th><th className="text-left p-2">Description</th><th className="text-left p-2">Category</th><th className="text-right p-2">Amount</th><th className="p-2"></th>
                      </tr></thead>
                      <tbody>
                        {productExpenses.map(exp => (
                          <tr key={exp.id || exp._id} className="border-t">
                            <td className="p-2">{exp.expenseDate ? new Date(exp.expenseDate?.toDate ? exp.expenseDate.toDate() : exp.expenseDate).toLocaleDateString() : '—'}</td>
                            <td className="p-2">{exp.description}</td>
                            <td className="p-2">{exp.category}</td>
                            <td className="p-2 text-right font-medium">Rs. {(parseFloat(exp.amount) || 0).toLocaleString()}</td>
                            <td className="p-2"><button type="button" onClick={() => handleDeleteProductExpense(exp.id || exp._id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adjust stock — physical count / write-off / add */}
      {showAdjustModal && adjustItem && (() => {
        const costPerUnit = parseFloat(adjustItem.costPerUnit) || 0;
        const snap = getStockSnapshot(adjustItem);
        const rows = adjustCounts.map((row) => {
          const physical = row.physicalQty === '' ? 0 : parseInt(row.physicalQty, 10) || 0;
          const diff = physical - row.systemQty;
          return { ...row, physical, diff };
        });
        const totalMissing = rows.reduce((s, r) => s + (r.diff < 0 ? Math.abs(r.diff) : 0), 0);
        const totalFound = rows.reduce((s, r) => s + (r.diff > 0 ? r.diff : 0), 0);
        const lossPreview = Math.round(totalMissing * costPerUnit);
        const newOnHand = rows.reduce((s, r) => s + r.physical, 0);
        const newOnHandValue = Math.round(newOnHand * costPerUnit);
        const hasChange = rows.some((r) => r.diff !== 0);
        const canSubmit = hasChange && !!adjustForm.addedBy && !!adjustForm.reason && !!adjustForm.date && !savingAdjust;
        const history = [...(adjustItem.stockAdjustments || [])].slice().reverse();

        return (
          <div
            className="fixed inset-0 z-[100] bg-ink/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => { if (!savingAdjust) { setShowAdjustModal(false); setAdjustItem(null); } }}
          >
            <div
              className="bg-neutral-100 rounded-t-2xl sm:rounded-2xl shadow-elevated max-w-xl w-full max-h-[min(94dvh,900px)] flex flex-col overflow-hidden border border-neutral-200/80"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 bg-white px-5 py-4 border-b border-neutral-100 flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-3">
                  <span className="w-10 h-10 rounded-xl bg-ink text-white flex items-center justify-center shrink-0">
                    <ClipboardList size={18} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-ink tracking-tight">Stock count &amp; adjust</h3>
                    <p className="text-sm text-ink-muted mt-0.5 truncate">{adjustItem.productName}</p>
                    <p className="text-[11px] text-ink-muted mt-1">
                      Physical count likho — kam = write-off · zyada = add stock
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowAdjustModal(false); setAdjustItem(null); }}
                  className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-ink-muted shrink-0"
                  aria-label="Close"
                  disabled={savingAdjust}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAdjustStock} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
                {/* Current snapshot */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Lifetime', value: snap.initial, tone: 'text-ink' },
                    { label: 'On hand now', value: snap.onHand, tone: 'text-emerald-700' },
                    { label: 'Sold', value: snap.sold, tone: 'text-amber-800' },
                    { label: 'Written off', value: snap.writtenOff, tone: snap.writtenOff > 0 ? 'text-rose-700' : 'text-ink-muted' }
                  ].map((m) => (
                    <div key={m.label} className="bg-white rounded-xl border border-neutral-200/90 px-3 py-2.5 shadow-soft">
                      <p className="text-[10px] font-medium text-ink-muted">{m.label}</p>
                      <p className={`text-lg font-bold tabular-nums mt-0.5 ${m.tone}`}>{m.value}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-xl border border-neutral-200/90 shadow-soft overflow-hidden">
                  <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">Physical count</p>
                      <p className="text-[11px] text-ink-muted mt-0.5">Jo ab warehouse me maujood hai</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdjustCounts((prev) => prev.map((r) => ({ ...r, physicalQty: '0' })))}
                      className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-1.5 rounded-lg hover:bg-rose-100"
                    >
                      Clear all to 0
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[420px]">
                      <thead className="bg-neutral-50/80">
                        <tr>
                          <th className="text-left py-2.5 px-4 text-[11px] font-medium text-ink-muted">Size</th>
                          <th className="text-right py-2.5 px-3 text-[11px] font-medium text-ink-muted">System</th>
                          <th className="text-right py-2.5 px-3 text-[11px] font-medium text-ink-muted">Physical</th>
                          <th className="text-right py-2.5 px-4 text-[11px] font-medium text-ink-muted">Change</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {rows.map((row, idx) => (
                          <tr key={`${row.size}-${idx}`} className="hover:bg-neutral-50/60">
                            <td className="py-3 px-4 font-medium text-ink">{row.size}</td>
                            <td className="py-3 px-3 text-right tabular-nums text-ink-muted">{row.systemQty}</td>
                            <td className="py-3 px-3 text-right">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={adjustCounts[idx].physicalQty}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '' || /^\d+$/.test(value)) {
                                    setAdjustCounts((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, physicalQty: value } : r))
                                    );
                                  }
                                }}
                                className="input-field text-right tabular-nums w-[5.5rem] ml-auto py-2 font-semibold"
                                aria-label={`Physical count for ${row.size}`}
                              />
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className={`inline-flex min-w-[3rem] justify-end px-2 py-0.5 rounded-md text-xs font-bold tabular-nums ${
                                row.diff < 0
                                  ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                  : row.diff > 0
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : 'bg-neutral-50 text-ink-muted border border-neutral-100'
                              }`}>
                                {row.diff > 0 ? `+${row.diff}` : row.diff}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Impact preview */}
                <div className={`rounded-xl border px-4 py-3.5 ${
                  totalMissing > 0 && totalFound === 0
                    ? 'bg-rose-50 border-rose-100'
                    : totalFound > 0 && totalMissing === 0
                      ? 'bg-emerald-50 border-emerald-100'
                      : hasChange
                        ? 'bg-amber-50 border-amber-100'
                        : 'bg-white border-neutral-200'
                }`}>
                  {!hasChange ? (
                    <p className="text-sm text-ink-muted">Physical count system jaisa hai — koi change nahi</p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">After save</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span className="text-ink">
                          On hand <strong className="tabular-nums">{snap.onHand} → {newOnHand}</strong>
                        </span>
                        <span className="text-ink-muted">
                          Value <strong className="tabular-nums text-ink">Rs. {snap.onHandValue.toLocaleString()} → Rs. {newOnHandValue.toLocaleString()}</strong>
                        </span>
                      </div>
                      {totalMissing > 0 && (
                        <p className="text-sm font-semibold text-rose-800">
                          Physically remove −{totalMissing} pcs · write-off loss Rs. {lossPreview.toLocaleString()}
                        </p>
                      )}
                      {totalFound > 0 && (
                        <p className="text-sm font-semibold text-emerald-800">
                          Add +{totalFound} pcs to on-hand stock
                        </p>
                      )}
                      <p className="text-xs text-ink-muted">
                        Written-off pieces history me rehte hain — Initial/Sold same; sirf on-hand &amp; value update
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-neutral-200/90 shadow-soft p-4 space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1">Staff *</label>
                      <select
                        required
                        value={adjustForm.addedBy}
                        onChange={(e) => setAdjustForm({ ...adjustForm, addedBy: e.target.value })}
                        className="input-field"
                      >
                        <option value="">Select staff</option>
                        {STAFF_MEMBERS.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1">Date *</label>
                      <input
                        type="date"
                        required
                        value={adjustForm.date}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setAdjustForm({ ...adjustForm, date: e.target.value })}
                        className="input-field"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1">Reason *</label>
                    <select
                      required
                      value={adjustForm.reason}
                      onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                      className="input-field"
                    >
                      {STOCK_ADJUST_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-ink-muted mt-1">
                      {STOCK_ADJUST_REASONS.find((r) => r.value === adjustForm.reason)?.hint || ''}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1">Notes</label>
                    <textarea
                      value={adjustForm.notes}
                      onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                      className="input-field"
                      rows="2"
                      placeholder="e.g. Warehouse count — 12 pcs missing / chori"
                    />
                  </div>
                </div>

                {history.length > 0 && (
                  <div className="bg-white rounded-xl border border-neutral-200/90 shadow-soft overflow-hidden">
                    <div className="px-4 py-3 border-b border-neutral-100">
                      <p className="text-sm font-semibold text-ink">Adjustment history</p>
                      <p className="text-[11px] text-ink-muted mt-0.5">Physically hataaye / add kiye gaye pieces</p>
                    </div>
                    <ul className="divide-y divide-neutral-100 max-h-48 overflow-y-auto">
                      {history.map((adj) => (
                        <li key={adj.id || `${adj.reason}-${adj.date}`} className="px-4 py-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">
                              {adj.reason}
                              {adj.missingQty > 0 && (
                                <span className="text-rose-700"> · −{adj.missingQty} pcs</span>
                              )}
                              {adj.foundQty > 0 && (
                                <span className="text-emerald-700"> · +{adj.foundQty} pcs</span>
                              )}
                            </p>
                            <p className="text-[11px] text-ink-muted mt-0.5">
                              {formatAdjDate(adj.date)}
                              {adj.addedBy ? ` · ${adj.addedBy}` : ''}
                              {adj.notes ? ` · ${adj.notes}` : ''}
                            </p>
                          </div>
                          <span className={`text-xs font-semibold tabular-nums shrink-0 ${adj.lossAmount > 0 ? 'text-rose-700' : 'text-ink-muted'}`}>
                            {adj.lossAmount > 0 ? `−Rs. ${Number(adj.lossAmount).toLocaleString()}` : adj.foundQty > 0 ? 'Added' : '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-1 pb-1 sticky bottom-0 bg-neutral-100/95 backdrop-blur py-3 -mx-1 px-1">
                  <button
                    type="button"
                    onClick={() => { setShowAdjustModal(false); setAdjustItem(null); }}
                    className="btn-secondary"
                    disabled={savingAdjust}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingAdjust ? 'Saving...' : 'Save stock adjustment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Product buyers / payment detail — Shopify/Deel-style clean sheet */}
      {detailItem && (() => {
        const itemId = detailItem.id || detailItem._id;
        const buyers = getProductBuyerDetails(itemId);
        const pay = getProductSalePaymentStats(itemId);
        const productKey = `${detailItem.productName}_${detailItem.sizes?.[0]?.size || 'N/A'}`;
        const onlineData = onlineSales[productKey];
        const rp = getProductRealizedProfit(detailItem, onlineData);
        const fmt = (n) => `Rs. ${Math.round(Math.abs(parseFloat(n) || 0)).toLocaleString()}`;
        const paymentStatus =
          pay.soldQty <= 0
            ? null
            : pay.remainingAmount <= 0
              ? 'Paid'
              : pay.paidAmount > 0
                ? 'Partial'
                : 'Unpaid';
        const statusStyles = {
          Paid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          Partial: 'bg-amber-50 text-amber-900 border-amber-200',
          Unpaid: 'bg-rose-50 text-rose-800 border-rose-200'
        };
        const paidPct =
          pay.soldAmount > 0
            ? Math.min(100, Math.round((pay.paidAmount / pay.soldAmount) * 100))
            : 0;

        const rowStatus = (b) =>
          b.due <= 0 ? 'Paid' : b.paid > 0 ? 'Partial' : 'Unpaid';

        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-[2px] p-0 sm:p-5"
            onClick={() => setDetailItem(null)}
          >
            <div
              className="w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-neutral-100 shadow-2xl border border-neutral-200/80"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-neutral-200 px-4 sm:px-6 py-4">
                <div className="flex items-start gap-3 sm:gap-4">
                  {detailItem.imageUrl ? (
                    <img
                      src={detailItem.imageUrl}
                      alt=""
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-neutral-200 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center flex-shrink-0">
                      <Package size={22} className="text-neutral-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-lg sm:text-xl font-bold text-ink tracking-tight break-words">
                        {detailItem.productName || 'Product'}
                      </h3>
                      {paymentStatus && (
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusStyles[paymentStatus]}`}>
                          {paymentStatus}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-ink-muted">
                      {[detailItem.brand?.name, detailItem.sku].filter(Boolean).join(' · ') || 'Sale & payment breakdown'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailItem(null)}
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 text-ink-muted flex items-center justify-center transition-colors"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                {/* KPI strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { label: 'Sold', value: `${pay.soldQty} pcs`, tone: 'text-ink' },
                    { label: 'Billed', value: fmt(pay.soldAmount), tone: 'text-ink' },
                    { label: 'Collected', value: fmt(pay.paidAmount), tone: 'text-emerald-700' },
                    { label: 'Outstanding', value: fmt(pay.remainingAmount), tone: pay.remainingAmount > 0 ? 'text-amber-800' : 'text-emerald-700' }
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="bg-white rounded-xl border border-neutral-200/90 px-3.5 py-3 shadow-soft"
                    >
                      <p className="text-[11px] font-medium normal-case tracking-normal text-ink-muted">{m.label}</p>
                      <p className={`mt-1 text-base sm:text-lg font-bold tabular-nums tracking-tight ${m.tone}`}>
                        {m.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Collection progress + profit */}
                <div className="bg-white rounded-xl border border-neutral-200/90 p-4 sm:p-5 shadow-soft space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium normal-case tracking-normal text-ink-muted">Collection</p>
                      <p className="text-2xl font-bold text-ink tabular-nums tracking-tight mt-0.5">
                        {paidPct}%
                        <span className="text-sm font-medium text-ink-muted ml-2">received</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-medium normal-case tracking-normal text-ink-muted">
                        {rp.profitAfterCapital > 0 ? 'Realized profit' : rp.capitalLeft > 0 ? 'Capital left' : 'Realized'}
                      </p>
                      <p className={`text-xl font-bold tabular-nums tracking-tight mt-0.5 ${rp.profitAfterCapital > 0 ? 'text-emerald-700' : rp.capitalLeft > 0 ? 'text-amber-800' : 'text-ink-muted'}`}>
                        {rp.profitAfterCapital > 0 ? '+' : rp.capitalLeft > 0 ? '−' : ''}{fmt(rp.profitAfterCapital > 0 ? rp.profitAfterCapital : rp.capitalLeft)}
                      </p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-ink transition-all duration-500"
                      style={{ width: `${paidPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-ink-muted">
                    Paid {fmt(rp.paidTotal)} − stock capital {fmt(rp.stockCapital)}
                    {rp.capitalLeft > 0
                      ? ' · Pehle capital recover, phir profit'
                      : pay.remainingAmount > 0
                        ? ' · Due clear hone pe profit badhega'
                        : pay.soldQty > 0
                          ? ' · Capital recover + collected'
                          : ''}
                  </p>
                  {rp.writtenOffQty > 0 && (
                    <p className="text-xs text-rose-700 font-medium">
                      Write-off {rp.writtenOffQty} pcs · loss {fmt(rp.missingLoss)} (in capital, not sale)
                    </p>
                  )}
                </div>

                {/* Buyers */}
                <div className="bg-white rounded-xl border border-neutral-200/90 shadow-soft overflow-hidden">
                  <div className="px-4 sm:px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-ink-muted" />
                      <h4 className="text-sm font-semibold text-ink">Buyers</h4>
                    </div>
                    <span className="text-xs text-ink-muted tabular-nums">
                      {buyers.length} sale{buyers.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {buyers.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <div className="mx-auto w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3">
                        <Package size={20} className="text-neutral-400" />
                      </div>
                      <p className="text-sm font-medium text-ink">No sales yet</p>
                      <p className="text-xs text-ink-muted mt-1">Jab sale hogi, buyers yahan dikhenge</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-neutral-100">
                      {buyers.map((b, i) => {
                        const st = rowStatus(b);
                        const rowPct = b.billed > 0 ? Math.min(100, Math.round((b.paid / b.billed) * 100)) : 0;
                        const initial = (b.customerName || '?').trim().charAt(0).toUpperCase();
                        return (
                          <li key={`${b.saleId}-${i}`} className="px-4 sm:px-5 py-4 hover:bg-neutral-50/80 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-full bg-ink text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                                {initial}
                              </div>
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-ink truncate">{b.customerName}</p>
                                    <p className="text-xs text-ink-muted mt-0.5">
                                      {[b.invoiceNumber || null, formatDate(b.saleDate), b.size ? `Size ${b.size}` : null]
                                        .filter(Boolean)
                                        .join(' · ')}
                                      {b.contact ? ` · ${b.contact}` : ''}
                                    </p>
                                  </div>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${statusStyles[st]}`}>
                                    {st}
                                  </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
                                  <div>
                                    <p className="text-[10px] font-medium normal-case tracking-normal text-ink-muted">Qty</p>
                                    <p className="font-semibold text-ink tabular-nums">{b.qty}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-medium normal-case tracking-normal text-ink-muted">Paid</p>
                                    <p className="font-semibold text-emerald-700 tabular-nums">{fmt(b.paid)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-medium normal-case tracking-normal text-ink-muted">Due</p>
                                    <p className={`font-semibold tabular-nums ${b.due > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                                      {fmt(b.due)}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${st === 'Paid' ? 'bg-emerald-600' : st === 'Partial' ? 'bg-amber-500' : 'bg-neutral-300'}`}
                                      style={{ width: `${rowPct}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-ink-muted tabular-nums w-16 text-right">
                                    {fmt(b.billed)} bill
                                  </span>
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <p className="text-[11px] text-ink-muted text-center pb-1">
                  Multi-item sales pe Paid / Due is product ke bill share se calculate hota hai
                </p>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default Inventory;

