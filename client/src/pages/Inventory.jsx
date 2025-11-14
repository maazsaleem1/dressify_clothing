import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit2, Trash2, Package, AlertCircle } from 'lucide-react';
import { getInventory, getBrands, getCategories, createInventoryItem, updateInventoryItem, deleteInventoryItem, getSales } from '../services/api';

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sales, setSales] = useState([]);
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
  const [formData, setFormData] = useState({
    brand: '',
    category: '',
    subcategory: '',
    productName: '',
    quantity: '',
    costPerUnit: '',
    sellingPrice: '',
    lowStockThreshold: 10,
    notes: '',
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
          console.error('Error fetching subcategories:', error);
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
    } catch (error) {
      console.error('Error fetching data:', error);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let dataToSubmit;

      // Use subcategory if selected, otherwise use category
      const finalCategory = formData.subcategory || formData.category;

      if (useSizes) {
        // Use size breakdown
        const filteredSizes = formData.sizes.filter(s => s.quantity > 0);
        dataToSubmit = { ...formData, category: finalCategory, subcategory: '', sizes: filteredSizes };
      } else {
        // Use simple quantity - convert to single size entry
        dataToSubmit = {
          ...formData,
          category: finalCategory,
          subcategory: '',
          sizes: formData.quantity > 0 ? [{ size: 'One Size', quantity: parseInt(formData.quantity) }] : []
        };
      }

      if (editingItem) {
        await updateInventoryItem(editingItem.id, dataToSubmit);
      } else {
        await createInventoryItem(dataToSubmit);
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving item:', error);
      alert(error.message || 'Error saving item');
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

    setFormData({
      brand: brandId,
      category: isSubcategory ? parentCategoryId : categoryId,
      subcategory: isSubcategory ? categoryId : '',
      productName: item.productName,
      quantity: isOneSize ? item.sizes[0].quantity : '',
      costPerUnit: item.costPerUnit,
      sellingPrice: item.sellingPrice,
      lowStockThreshold: item.lowStockThreshold,
      notes: item.notes || '',
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
        console.error('Error fetching subcategories:', error);
      }
    }

    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return;
    }

    console.log('=== DELETING INVENTORY ITEM ===');
    console.log('Item ID:', id);
    setDeleting(id);

    try {
      console.log('Calling deleteInventoryItem API...');
      await deleteInventoryItem(id);
      console.log('Item deleted successfully');
      await fetchData();
      console.log('=== DELETE SUCCESS ===');
    } catch (error) {
      console.error('=== DELETE ERROR ===');
      console.error('Error:', error);
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
      alert(error.message || 'Error deleting item. Please try again.');
    } finally {
      setDeleting(null);
    }
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
      lowStockThreshold: 10,
      notes: '',
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

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.brand?.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getTotalQuantity = (sizes) => {
    return sizes.reduce((sum, s) => sum + s.quantity, 0);
  };

  const isLowStock = (item) => {
    return getTotalQuantity(item.sizes) <= item.lowStockThreshold;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Dressify Clothing</h2>
          <p className="text-gray-600 mt-1">Manage your stock and track availability</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Add Stock
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="input-field"
          >
            <option value="">All Brands</option>
            {brands.map(brand => (
              <option key={brand.id || brand._id} value={brand.id || brand._id}>{brand.name}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="input-field"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id || cat._id} value={cat.id || cat._id}>{cat.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showLowStock}
              onChange={(e) => setShowLowStock(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm font-medium text-gray-700">Show Low Stock Only</span>
          </label>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No inventory items found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sizes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Earned</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventory.map((item) => {
                  const totalQty = getTotalQuantity(item.sizes);
                  const initialQty = item.initialQuantity || totalQty; // Fallback to current if no initial
                  const soldQty = initialQty - totalQty;
                  const lowStock = isLowStock(item);

                  return (
                    <tr key={item.id || item._id} className={lowStock ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {lowStock && <AlertCircle className="text-red-500 mr-2" size={16} />}
                          <span className="font-medium text-gray-900">{item.productName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {item.brand?.name ? (
                          <span className="text-gray-800 font-medium">{item.brand.name}</span>
                        ) : item.brandId ? (
                          <span className="text-gray-400 italic">Loading...</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {item.category?.name ? (
                          <span className="text-gray-800 font-medium">{item.category.name}</span>
                        ) : item.categoryId ? (
                          <span className="text-gray-400 italic">Loading...</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        Rs. {item.costPerUnit.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        Rs. {item.sellingPrice.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Rs. {(totalQty * item.costPerUnit).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {(() => {
                          const totalEarned = calculateTotalEarned(item.id || item._id);
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
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="input-field"
                    placeholder="1500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Price you sell to customers</p>
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

