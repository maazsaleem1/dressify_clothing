import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit2, Trash2, Package, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { getInventory, getBrands, getCategories, createInventoryItem, updateInventoryItem, deleteInventoryItem, getSales, getOnlineSalesStats } from '../services/api';
import ImageUpload from '../components/ImageUpload';
import { showSuccess, showError } from '../utils/toast';
import { TableRowShimmer } from '../components/Shimmer';

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sales, setSales] = useState([]);
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
  const itemsPerPage = 10;
  const [formData, setFormData] = useState({
    brand: '',
    category: '',
    subcategory: '',
    productName: '',
    quantity: '',
    costPerUnit: '',
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
      const [invRes, brandsRes, catsRes, salesRes] = await Promise.all([
        getInventory({ brand: filterBrand, category: filterCategory, lowStock: showLowStock }),
        getBrands(),
        getCategories(),
        getSales()
      ]);
      setInventory(invRes.data);
      setBrands(brandsRes.data);
      setCategories(catsRes.data);
      setSales(salesRes.data);

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

  // Calculate sold quantity from sales records
  const calculateSoldQuantity = (inventoryItemId) => {
    let totalSold = 0;

    sales.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          if (item.inventoryId === inventoryItemId) {
            totalSold += item.quantity || 0;
          }
        });
      }
    });

    return totalSold;
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

      if (editingItem) {
        await updateInventoryItem(editingItem.id, dataToSubmit);
        showSuccess('Inventory item updated successfully!');
      } else {
        await createInventoryItem(dataToSubmit);
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
      costPerUnit: item.costPerUnit,
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

  const resetForm = () => {
    setFormData({
      brand: '',
      category: '',
      subcategory: '',
      productName: '',
      quantity: '',
      costPerUnit: '',
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
    setFormData({ ...formData, sizes: newSizes });
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
    return sizes.reduce((sum, s) => sum + s.quantity, 0);
  };

  const isLowStock = (item) => {
    return getTotalQuantity(item.sizes) <= item.lowStockThreshold;
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl shadow-lg p-6 sm:p-8 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-lg">
                <Package className="text-white" size={28} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold">Inventory Management</h2>
            </div>
            <p className="text-blue-100 text-sm sm:text-base ml-14">Manage your stock, track availability, and monitor profits</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="bg-white text-indigo-700 hover:bg-blue-50 font-semibold px-6 py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 w-full sm:w-auto transform hover:scale-105"
          >
            <Plus size={20} />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="text-gray-600" size={20} />
          <h3 className="text-lg font-semibold text-gray-800">Filters & Search</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
            />
          </div>
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none bg-white"
          >
            <option value="">All Brands</option>
            {brands.map(brand => (
              <option key={brand.id || brand._id} value={brand.id || brand._id}>{brand.name}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none bg-white"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id || cat._id} value={cat.id || cat._id}>{cat.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 cursor-pointer sm:col-span-2 lg:col-span-1 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 hover:bg-red-100 transition-colors">
            <input
              type="checkbox"
              checked={showLowStock}
              onChange={(e) => setShowLowStock(e.target.checked)}
              className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
            />
            <span className="text-sm font-medium text-red-700 flex items-center gap-1">
              <AlertCircle size={16} />
              Low Stock Only
            </span>
          </label>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        {loading ? (
          <>
            {/* Mobile Shimmer */}
            <div className="md:hidden space-y-4 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-lg p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
            {/* Desktop Shimmer */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Brand</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Category</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sizes</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Stock</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">Cost</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Online</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">Stock Value</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">Revenue</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">Total Profit</th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <TableRowShimmer key={i} cols={12} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : filteredInventory.length === 0 ? (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No inventory items found</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View - Shows ALL products regardless of onlineStatus */}
            <div className="md:hidden space-y-4 p-4">
              {paginatedInventory.length === 0 ? (
                <div className="text-center py-8">
                  <Package size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No products found</p>
                  <p className="text-xs text-gray-400 mt-2">Try adjusting your filters</p>
                </div>
              ) : (
                paginatedInventory.map((item) => {
                  const totalQty = getTotalQuantity(item.sizes);
                  const soldQty = calculateSoldQuantity(item.id || item._id);
                  const initialQty = item.initialQuantity || (totalQty + soldQty);
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

                  return (
                    <div key={itemId} className={`bg-white border-2 rounded-xl overflow-hidden transition-all shadow-md hover:shadow-lg ${lowStock ? 'border-red-400 bg-gradient-to-br from-red-50 to-red-100/50' : 'border-gray-200 hover:border-indigo-300'}`}>
                      {/* Clickable Header */}
                      <div
                        onClick={() => toggleExpand(itemId)}
                        className="p-5 cursor-pointer hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-blue-50/50 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.productName}
                              className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Package size={24} className="text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  {lowStock && <AlertCircle className="text-red-500" size={16} />}
                                  <span className="font-semibold text-gray-900 text-base break-words">{item.productName || 'Unnamed Product'}</span>
                                  {item.sku && (
                                    <span className="text-xs text-gray-500 whitespace-nowrap">({item.sku})</span>
                                  )}
                                </div>
                                {item.brand?.name && (
                                  <p className="text-xs text-gray-600">{item.brand.name}</p>
                                )}
                                {item.createdAt && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Added: {formatDate(item.createdAt)}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {isExpanded ? (
                                  <ChevronUp size={20} className="text-gray-400" />
                                ) : (
                                  <ChevronDown size={20} className="text-gray-400" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Details */}
                      {isExpanded && (
                        <div className="px-5 pb-5 border-t-2 border-gray-200 space-y-4 pt-4 bg-gradient-to-b from-gray-50/50 to-white">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(item);
                              }}
                              className="px-4 py-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow"
                              disabled={deleting === itemId}
                              title="Edit"
                            >
                              <Edit2 size={18} />
                              <span className="text-sm">Edit</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(itemId);
                              }}
                              className="px-4 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow"
                              disabled={deleting === itemId}
                              title="Delete"
                            >
                              {deleting === itemId ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                  <span className="text-sm">Deleting...</span>
                                </>
                              ) : (
                                <>
                                  <Trash2 size={18} />
                                  <span className="text-sm">Delete</span>
                                </>
                              )}
                            </button>
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
                                const sizeInitial = s.initialQuantity || s.quantity;
                                const sizeSold = sizeInitial - s.quantity;
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
                            <div className="space-y-2">
                              <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-lg">
                                <span className="text-sm text-gray-700 font-medium">Initial Stock:</span>
                                <span className="text-base font-bold text-gray-900">{initialQty} units</span>
                              </div>
                              <div className="flex items-center justify-between bg-green-50 p-2.5 rounded-lg border border-green-200">
                                <span className="text-sm text-gray-700 font-medium">Current Stock:</span>
                                <span className={`text-lg font-bold ${lowStock ? 'text-red-600' : 'text-green-700'}`}>
                                  {totalQty} units
                                </span>
                              </div>
                              {soldQty > 0 && (
                                <div className="flex items-center justify-between bg-orange-50 p-2.5 rounded-lg border border-orange-200">
                                  <span className="text-sm text-gray-700 font-medium">Sold:</span>
                                  <span className="text-base font-bold text-orange-700">{soldQty} units</span>
                                </div>
                              )}
                            </div>
                          </div>

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
                                <div className="text-xs text-gray-600 mb-1.5 font-medium">Stock Value</div>
                                <div className="text-base sm:text-lg font-bold text-blue-700 break-words" style={{ minHeight: '24px' }}>
                                  Rs. {(isNaN(initialQty) || isNaN(item.costPerUnit)) ? '0' : (initialQty * parseFloat(item.costPerUnit || 0)).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
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

                          {/* Total Profit */}
                          {(() => {
                            const totalEarned = calculateTotalEarned(itemId);
                            const productKey = `${item.productName}_${item.sizes?.[0]?.size || 'N/A'}`;
                            const onlineData = onlineSales[productKey];
                            const totalRevenue = parseFloat(totalEarned || 0) + parseFloat(onlineData?.totalRevenue || 0);
                            const stockValue = (isNaN(initialQty) || isNaN(item.costPerUnit)) ? 0 : (initialQty * parseFloat(item.costPerUnit || 0));
                            const totalProfit = totalRevenue - stockValue;

                            return (
                              <div className="pt-3 border-t border-gray-200 mt-3">
                                <div className="text-sm text-gray-700 mb-2 font-semibold">Total Profit</div>
                                <div className={`bg-gradient-to-r p-4 rounded-lg border-2 ${totalProfit > 0 ? 'from-green-100 to-green-50 border-green-300' : totalProfit < 0 ? 'from-red-100 to-red-50 border-red-300' : 'from-gray-100 to-gray-50 border-gray-300'}`}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm sm:text-base font-bold text-gray-800">
                                      {totalProfit > 0 ? 'Profit:' : totalProfit < 0 ? 'Loss:' : 'Break Even:'}
                                    </span>
                                    <span className={`text-lg sm:text-xl font-bold break-words ${totalProfit > 0 ? 'text-green-700' : totalProfit < 0 ? 'text-red-700' : 'text-gray-500'}`} style={{ minHeight: '28px' }}>
                                      Rs. {(isNaN(totalProfit) ? 0 : parseFloat(totalProfit || 0)).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <div className="mt-2 text-xs text-gray-600">
                                    <div>Revenue: Rs. {(isNaN(totalRevenue) ? 0 : parseFloat(totalRevenue || 0)).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
                                    <div>Stock Value: Rs. {(isNaN(stockValue) ? 0 : parseFloat(stockValue || 0)).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
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

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-gradient-to-r from-gray-50 via-gray-100 to-gray-50 border-b-2 border-gray-300">
                  <tr>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Product</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden md:table-cell">Brand</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden lg:table-cell">Category</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Sizes</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden lg:table-cell">Stock</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden xl:table-cell">Cost</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Price</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden md:table-cell">Online</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden xl:table-cell">Stock Value</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden xl:table-cell">Revenue</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden xl:table-cell">Total Profit</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden lg:table-cell">Date Added</th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedInventory.map((item) => {
                    const totalQty = getTotalQuantity(item.sizes);
                    const soldQty = calculateSoldQuantity(item.id || item._id);
                    const initialQty = item.initialQuantity || (totalQty + soldQty);
                    const lowStock = isLowStock(item);

                    return (
                      <tr key={item.id || item._id} className={`transition-colors ${lowStock ? 'bg-red-50/50 border-l-4 border-l-red-500' : 'hover:bg-indigo-50/30'} border-b border-gray-100`}>
                        <td className="px-4 sm:px-6 py-5">
                          <div className="flex items-center gap-3">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.productName}
                                className="w-12 h-12 object-cover rounded-lg"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                                <Package size={20} className="text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              {lowStock && <AlertCircle className="text-red-500 mb-1" size={16} />}
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-medium text-gray-900 break-words">{item.productName || 'Unnamed Product'}</span>
                                {item.sku && (
                                  <span className="text-xs text-gray-500 whitespace-nowrap">- {item.sku}</span>
                                )}
                              </div>
                              {/* Badge indicators */}
                              <div className="flex gap-2 mt-1 flex-wrap">
                                {(() => {
                                  const isNew = item.tag === 'new' || item.status === 'new' ||
                                    item.isNew || item.new;
                                  const isSale = item.tag === 'sale' || item.status === 'sale' ||
                                    item.isSale || item.sale ||
                                    (item.sellingPrice && item.onlinePrice && item.sellingPrice > item.onlinePrice && item.onlinePrice > 0);
                                  return (
                                    <>
                                      {isNew && (
                                        <span className="px-2 py-0.5 bg-black text-white text-xs font-semibold rounded uppercase tracking-wide">
                                          NEW
                                        </span>
                                      )}
                                      {isSale && (
                                        <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-semibold rounded uppercase tracking-wide">
                                          SALE
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm hidden md:table-cell">
                          {item.brand?.name ? (
                            <span className="text-gray-800 font-medium">{item.brand.name}</span>
                          ) : item.brandId ? (
                            <span className="text-gray-400 italic">Loading...</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm hidden lg:table-cell">
                          {item.category?.name ? (
                            <span className="text-gray-800 font-medium">{item.category.name}</span>
                          ) : item.categoryId ? (
                            <span className="text-gray-400 italic">Loading...</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-5">
                          <div className="flex flex-wrap gap-1">
                            {item.sizes.map((s, idx) => {
                              const sizeInitial = s.initialQuantity || s.quantity;
                              const sizeSold = sizeInitial - s.quantity;
                              return (
                                <span key={idx} className="px-2 py-1 bg-gray-100 text-xs rounded" title={`Initial: ${sizeInitial}, Current: ${s.quantity}, Sold: ${sizeSold}`}>
                                  {s.size}: {s.quantity}
                                  {sizeSold > 0 && <span className="text-red-500 ml-1">(-{sizeSold})</span>}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 hidden lg:table-cell">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Initial:</span>
                              <span className="font-semibold text-gray-700">{initialQty}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Current:</span>
                              <span className={`font-bold ${lowStock ? 'text-red-600' : 'text-green-600'}`}>
                                {totalQty}
                              </span>
                            </div>
                            {soldQty > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Sold:</span>
                                <span className="font-medium text-orange-600">{soldQty}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm text-gray-600 hidden xl:table-cell">
                          <div className="flex flex-col gap-1">
                            <div>
                              <span className="text-xs text-gray-500">Cost/Unit: </span>
                              <span className="font-medium">Rs. {parseFloat(item.costPerUnit || 0).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-xs text-gray-500">Stock Value: </span>
                              <span className="font-bold text-blue-700">
                                Rs. {(isNaN(initialQty) || isNaN(item.costPerUnit)) ? '0' : (initialQty * parseFloat(item.costPerUnit || 0)).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm">
                          {(() => {
                            const sellingPrice = parseFloat(item.sellingPrice) || 0;
                            const onlinePrice = parseFloat(item.onlinePrice) || sellingPrice;
                            const isSale = sellingPrice > onlinePrice && onlinePrice > 0;

                            // Check for sale badge
                            const hasSaleBadge = item.tag === 'sale' || item.status === 'sale' ||
                              item.isSale || item.sale || isSale;

                            if (hasSaleBadge && sellingPrice > onlinePrice && sellingPrice > 0 && onlinePrice > 0) {
                              return (
                                <div className="space-y-0.5">
                                  <div className="text-xs text-gray-500 line-through">
                                    Was Rs. {sellingPrice.toLocaleString()}
                                  </div>
                                  <div className="font-bold text-red-600 text-base">
                                    Now Rs. {onlinePrice.toLocaleString()}
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="text-gray-900 font-medium">
                                  Rs. {onlinePrice.toLocaleString()}
                                  {item.onlinePrice && item.onlinePrice !== item.sellingPrice && !hasSaleBadge && (
                                    <div className="text-xs text-blue-600 mt-1 font-normal">
                                      Online: Rs. {item.onlinePrice.toLocaleString()}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                          })()}
                        </td>
                        <td className="px-3 sm:px-6 py-4 hidden md:table-cell">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.onlineStatus
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                              }`}>
                              {item.onlineStatus ? '🌐 Online' : '🔒 Hidden'}
                            </span>
                            {item.onlineStatus && item.sku && (
                              <span className="text-xs text-gray-500">SKU: {item.sku}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm font-medium text-gray-900 hidden xl:table-cell">
                          Rs. {(isNaN(initialQty) || isNaN(item.costPerUnit)) ? '0' : (initialQty * parseFloat(item.costPerUnit || 0)).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm hidden xl:table-cell">
                          {(() => {
                            const totalEarned = calculateTotalEarned(item.id || item._id);
                            const onlineSalesData = onlineSales[item.id || item._id];
                            return (
                              <div className="flex flex-col gap-1">
                                <span className={`font-bold ${totalEarned > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                  Rs. {totalEarned.toLocaleString()}
                                </span>
                                {totalEarned > 0 && soldQty > 0 && (
                                  <span className="text-xs text-gray-500">
                                    ({soldQty} sold)
                                  </span>
                                )}
                                {(() => {
                                  // Find online sales for this product
                                  const productKey = `${item.productName}_${item.sizes?.[0]?.size || 'N/A'}`;
                                  const onlineData = onlineSales[productKey];
                                  if (onlineData && onlineData.totalRevenue > 0) {
                                    return (
                                      <div className="mt-1 pt-1 border-t border-gray-200">
                                        <span className="text-xs text-blue-600 font-semibold">
                                          Online: Rs. {onlineData.totalRevenue.toLocaleString()}
                                        </span>
                                        <span className="text-xs text-gray-500 ml-1">
                                          ({onlineData.totalQuantity} units)
                                        </span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm hidden xl:table-cell">
                          {(() => {
                            const totalEarned = calculateTotalEarned(item.id || item._id);
                            const productKey = `${item.productName}_${item.sizes?.[0]?.size || 'N/A'}`;
                            const onlineData = onlineSales[productKey];
                            const totalRevenue = parseFloat(totalEarned || 0) + parseFloat(onlineData?.totalRevenue || 0);
                            const stockValue = (isNaN(initialQty) || isNaN(item.costPerUnit)) ? 0 : (initialQty * parseFloat(item.costPerUnit || 0));
                            const totalProfit = totalRevenue - stockValue;

                            return (
                              <div className="flex flex-col gap-1">
                                <span className={`font-bold text-base ${totalProfit > 0 ? 'text-green-600' : totalProfit < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                  Rs. {(isNaN(totalProfit) ? 0 : parseFloat(totalProfit || 0)).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </span>
                                {totalProfit !== 0 && (
                                  <span className={`text-xs ${totalProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {totalProfit > 0 ? 'Profit' : 'Loss'}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">
                          {item.createdAt ? formatDate(item.createdAt) : 'N/A'}
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-primary-600 hover:text-primary-800"
                              disabled={deleting === (item.id || item._id)}
                              title="Edit"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id || item._id)}
                              className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                              disabled={deleting === (item.id || item._id)}
                              title="Delete"
                            >
                              {deleting === (item.id || item._id) ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                  <span className="text-xs">Deleting...</span>
                                </>
                              ) : (
                                <Trash2 size={18} />
                              )}
                            </button>
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
          <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-gray-100 border-t-2 border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-700 text-center sm:text-left font-medium">
              Showing <span className="font-bold text-indigo-700">{startIndex + 1}</span> to{' '}
              <span className="font-bold text-indigo-700">{Math.min(endIndex, filteredInventory.length)}</span> of{' '}
              <span className="font-bold text-indigo-700">{filteredInventory.length}</span> products
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-sm hover:shadow"
              >
                <ChevronLeft size={18} />
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
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
                      className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow ${currentPage === pageNum
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md'
                        : 'text-gray-700 bg-white border-2 border-gray-300 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-700'
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
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-sm hover:shadow"
              >
                <span className="hidden sm:inline">Next</span>
                <span className="sm:hidden">Next</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">
                {editingItem ? 'Edit Inventory Item' : 'Add New Stock'}
              </h3>
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
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="input-field"
                    placeholder="e.g., 100"
                  />
                  <p className="text-xs text-gray-500 mt-1">Total number of items in stock</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Per Unit *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.costPerUnit}
                    onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })}
                    className="input-field"
                    placeholder="1200"
                  />
                  <p className="text-xs text-gray-500 mt-1">Your purchase/production cost</p>
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
    </div>
  );
};

export default Inventory;

