import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, DollarSign, CreditCard, Trash2, ShoppingCart } from 'lucide-react';
import { getSales, getCustomers, getInventory, createSale, addItemsToSale, addPayment, deleteSale } from '../services/api';

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSaleDetailsModal, setShowSaleDetailsModal] = useState(false);
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [saleFormData, setSaleFormData] = useState({
    customer: '',
    items: [],
    paidAmount: '', // Empty for free typing
    saleType: 'Cash',
    notes: ''
  });

  const [paymentFormData, setPaymentFormData] = useState({
    amount: '', // Empty for free typing
    paymentMethod: 'Cash',
    notes: ''
  });

  const [currentItem, setCurrentItem] = useState({
    inventory: '',
    size: '',
    quantity: '', // Empty for free typing
    unitPrice: '' // Empty for free typing
  });

  const [addItemsFormData, setAddItemsFormData] = useState({
    items: []
  });

  const [currentNewItem, setCurrentNewItem] = useState({
    inventory: '',
    size: '',
    quantity: '',
    unitPrice: ''
  });

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('=== FETCHING DATA ===');
      const [salesRes, customersRes, inventoryRes] = await Promise.all([
        getSales({ status: filterStatus }),
        getCustomers(),
        getInventory()
      ]);
      console.log('Sales Response:', salesRes);
      console.log('Customers Response:', customersRes);
      console.log('Inventory Response:', inventoryRes);
      console.log('Inventory Items:', inventoryRes.data);

      setSales(salesRes.data);
      setCustomers(customersRes.data);
      setInventory(inventoryRes.data);
      console.log('=== DATA FETCHED SUCCESSFULLY ===');
    } catch (error) {
      console.error('=== ERROR FETCHING DATA ===');
      console.error('Error:', error);
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
      if (error.response) {
        console.error('Error Response:', error.response);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    console.log('=== ADDING ITEM TO SALE ===');
    console.log('1. Current Item:', currentItem);
    console.log('2. Inventory List:', inventory);

    // Convert empty string to 0 for validation
    const qtyToCheck = currentItem.quantity === '' ? 0 : currentItem.quantity;
    if (!currentItem.inventory || qtyToCheck <= 0) {
      console.log('ERROR: Missing inventory or quantity');
      alert('Please select product and enter quantity');
      return;
    }

    // Convert empty string to 0 for validation
    const priceToCheck = currentItem.unitPrice === '' ? 0 : currentItem.unitPrice;
    if (!priceToCheck || priceToCheck <= 0) {
      console.log('ERROR: Invalid price');
      alert('Please enter a valid selling price');
      return;
    }

    const inventoryItem = inventory.find(i => (i.id || i._id) === currentItem.inventory);
    console.log('3. Found Inventory Item:', inventoryItem);

    if (!inventoryItem) {
      console.log('ERROR: Inventory item not found');
      alert('Product not found');
      return;
    }

    // Check if item has sizes
    const hasSizes = inventoryItem.sizes && inventoryItem.sizes.length > 0;
    console.log('4. Has Sizes:', hasSizes);
    console.log('5. Sizes Array:', inventoryItem.sizes);

    if (hasSizes && !currentItem.size) {
      console.log('ERROR: Size required but not selected');
      alert('Please select a size');
      return;
    }

    // If no sizes, use "One Size" or first available
    const selectedSize = currentItem.size || (hasSizes ? inventoryItem.sizes[0].size : 'One Size');
    console.log('6. Selected Size:', selectedSize);

    const sizeStock = hasSizes
      ? inventoryItem.sizes.find(s => s.size === selectedSize)
      : inventoryItem.sizes && inventoryItem.sizes.length > 0
        ? inventoryItem.sizes[0]
        : null;

    console.log('7. Size Stock:', sizeStock);

    if (hasSizes && (!sizeStock || sizeStock.quantity < currentItem.quantity)) {
      console.log('ERROR: Insufficient stock');
      alert(`Insufficient stock! Available: ${sizeStock?.quantity || 0}`);
      return;
    }

    // Ensure quantity and price are numbers
    const finalQty = typeof currentItem.quantity === 'string' && currentItem.quantity === '' ? 1 : currentItem.quantity;
    const finalPrice = typeof currentItem.unitPrice === 'string' && currentItem.unitPrice === '' ? 0 : currentItem.unitPrice;

    const newItem = {
      ...currentItem,
      quantity: finalQty,
      unitPrice: finalPrice,
      size: selectedSize,
      productName: inventoryItem.productName,
      totalPrice: finalQty * finalPrice,
      inventorySellingPrice: inventoryItem.sellingPrice || 0, // Actual price from inventory
      inventoryCostPrice: inventoryItem.costPerUnit || 0, // Cost price
      profitPerUnit: finalPrice - (inventoryItem.sellingPrice || 0), // Profit per unit
      totalProfit: (finalPrice - (inventoryItem.sellingPrice || 0)) * finalQty // Total profit
    };

    console.log('8. New Item Created:', newItem);
    console.log('   Custom Price:', currentItem.unitPrice);
    console.log('   Inventory Suggested Price:', inventoryItem.sellingPrice);

    setSaleFormData({
      ...saleFormData,
      items: [...saleFormData.items, newItem]
    });

    console.log('9. Updated Sale Form Data:', {
      ...saleFormData,
      items: [...saleFormData.items, newItem]
    });
    console.log('=== ITEM ADDED SUCCESSFULLY ===');

    setCurrentItem({
      inventory: '',
      size: '',
      quantity: 1,
      unitPrice: 0
    });
  };

  const handleRemoveItem = (index) => {
    const newItems = saleFormData.items.filter((_, i) => i !== index);
    setSaleFormData({ ...saleFormData, items: newItems });
  };

  const getTotalAmount = () => {
    return saleFormData.items.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const handleSubmitSale = async (e) => {
    e.preventDefault();
    console.log('=== SALE CREATION START ===');
    console.log('1. Form Data:', saleFormData);
    console.log('2. Items Count:', saleFormData.items.length);

    if (saleFormData.items.length === 0) {
      console.log('ERROR: No items in sale');
      alert('Please add at least one item');
      return;
    }

    // Validate items
    console.log('3. Validating Items:');
    saleFormData.items.forEach((item, index) => {
      console.log(`   Item ${index + 1}:`, {
        inventory: item.inventory,
        productName: item.productName,
        size: item.size,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      });
    });

    setSaving(true);
    try {
      console.log('4. Calling createSale API...');
      // Ensure paidAmount is a number before submitting
      const saleDataToSubmit = {
        ...saleFormData,
        paidAmount: saleFormData.paidAmount === '' ? 0 : saleFormData.paidAmount
      };
      console.log('5. Sale Data Being Sent:', JSON.stringify(saleDataToSubmit, null, 2));

      const result = await createSale(saleDataToSubmit);
      console.log('6. Sale Created Successfully!');
      console.log('7. Response:', result);

      setShowSaleModal(false);
      resetSaleForm();
      fetchData();
      console.log('=== SALE CREATION SUCCESS ===');
    } catch (error) {
      console.error('=== SALE CREATION ERROR ===');
      console.error('Error Object:', error);
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
      if (error.response) {
        console.error('Error Response:', error.response);
        console.error('Error Response Data:', error.response.data);
        console.error('Error Response Status:', error.response.status);
      }
      console.error('Full Error Details:', JSON.stringify(error, null, 2));
      alert(error.message || error.response?.data?.error || 'Error creating sale');
      console.log('=== SALE CREATION FAILED ===');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Ensure amount is a number before submitting
      const paymentData = {
        ...paymentFormData,
        amount: paymentFormData.amount === '' ? 0 : paymentFormData.amount
      };
      await addPayment(selectedSale.id || selectedSale._id, paymentData);
      setShowPaymentModal(false);
      setPaymentFormData({ amount: '', paymentMethod: 'Cash', notes: '' });
      fetchData();
    } catch (error) {
      console.error('Error adding payment:', error);
      alert(error.response?.data?.error || 'Error adding payment');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSale = async (id) => {
    if (window.confirm('Are you sure? This will restore inventory.')) {
      try {
        await deleteSale(id);
        fetchData();
      } catch (error) {
        console.error('Error deleting sale:', error);
      }
    }
  };

  const handleAddNewItem = () => {
    const qtyToCheck = currentNewItem.quantity === '' ? 0 : currentNewItem.quantity;
    if (!currentNewItem.inventory || qtyToCheck <= 0) {
      alert('Please select product and enter quantity');
      return;
    }

    const priceToCheck = currentNewItem.unitPrice === '' ? 0 : currentNewItem.unitPrice;
    if (!priceToCheck || priceToCheck <= 0) {
      alert('Please enter a valid selling price');
      return;
    }

    const inventoryItem = inventory.find(i => (i.id || i._id) === currentNewItem.inventory);
    if (!inventoryItem) {
      alert('Product not found');
      return;
    }

    const sizeObj = inventoryItem.sizes.find(s => s.size === currentNewItem.size);
    if (!sizeObj) {
      alert('Please select a size');
      return;
    }

    if (sizeObj.quantity < currentNewItem.quantity) {
      alert(`Insufficient stock! Available: ${sizeObj.quantity}`);
      return;
    }

    const newItem = {
      inventory: currentNewItem.inventory,
      productName: inventoryItem.productName,
      size: currentNewItem.size,
      quantity: Number(currentNewItem.quantity),
      unitPrice: Number(currentNewItem.unitPrice),
      totalPrice: Number(currentNewItem.quantity) * Number(currentNewItem.unitPrice)
    };

    setAddItemsFormData({
      items: [...addItemsFormData.items, newItem]
    });

    setCurrentNewItem({
      inventory: '',
      size: '',
      quantity: '',
      unitPrice: ''
    });
  };

  const handleRemoveNewItem = (index) => {
    setAddItemsFormData({
      items: addItemsFormData.items.filter((_, i) => i !== index)
    });
  };

  const handleSubmitAddItems = async (e) => {
    e.preventDefault();
    if (addItemsFormData.items.length === 0) {
      alert('Please add at least one item');
      return;
    }

    setSaving(true);
    try {
      await addItemsToSale(selectedSale.id || selectedSale._id, addItemsFormData.items);
      setShowAddItemsModal(false);
      setAddItemsFormData({ items: [] });
      setCurrentNewItem({ inventory: '', size: '', quantity: '', unitPrice: '' });
      fetchData();
      alert('Items added successfully!');
    } catch (error) {
      console.error('Error adding items to sale:', error);
      alert(error.message || 'Error adding items to sale');
    } finally {
      setSaving(false);
    }
  };

  const handleNewInventoryChange = (inventoryId) => {
    const item = inventory.find(i => (i.id || i._id) === inventoryId);
    if (!item) return;

    const hasSizes = item.sizes && item.sizes.length > 0;
    const firstSize = hasSizes ? item.sizes[0].size : '';

    setCurrentNewItem({
      ...currentNewItem,
      inventory: inventoryId,
      unitPrice: '',
      size: (hasSizes && item.sizes.length === 1) ? firstSize : '',
      quantity: ''
    });
  };

  const resetSaleForm = () => {
    setSaleFormData({
      customer: '',
      items: [],
      paidAmount: '', // Empty for free typing
      saleType: 'Cash',
      notes: ''
    });
    setCurrentItem({
      inventory: '',
      size: '',
      quantity: '', // Empty for free typing
      unitPrice: '' // Empty for free typing
    });
  };

  const handleInventoryChange = (inventoryId) => {
    const item = inventory.find(i => (i.id || i._id) === inventoryId);
    if (!item) return;

    // Auto-select first size if only one size available
    const hasSizes = item.sizes && item.sizes.length > 0;
    const firstSize = hasSizes ? item.sizes[0].size : '';

    // Don't auto-fill price - let user enter freely
    // Only show suggested price as hint
    setCurrentItem({
      ...currentItem,
      inventory: inventoryId,
      unitPrice: '', // Empty so user can type freely
      size: (hasSizes && item.sizes.length === 1) ? firstSize : '',
      quantity: '' // Empty for free typing
    });
  };

  const filteredSales = sales.filter(sale => {
    const matchesSearch = sale.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customer?.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Sales & Credit Management</h2>
          <p className="text-gray-600 mt-1">Track sales transactions and manage credit payments</p>
        </div>
        <button
          onClick={() => {
            resetSaleForm();
            setShowSaleModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          New Sale
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by invoice or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-field"
          >
            <option value="">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
            <option value="Unpaid">Unpaid</option>
          </select>
        </div>
      </div>

      {/* Sales Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No sales found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSales.map((sale) => (
                  <tr key={sale.id || sale._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                      {sale.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-gray-900">{sale.customer?.name}</p>
                        {sale.customer?.market && (
                          <p className="text-xs text-gray-500">{sale.customer.market}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {sale.saleDate ? (
                        sale.saleDate.toDate ?
                          sale.saleDate.toDate().toLocaleDateString() :
                          new Date(sale.saleDate.seconds * 1000).toLocaleDateString()
                      ) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">
                      Rs. {sale.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                      Rs. {sale.paidAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-medium">
                      Rs. {sale.remainingAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sale.paymentStatus === 'Paid'
                        ? 'bg-green-100 text-green-700'
                        : sale.paymentStatus === 'Partial'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-red-100 text-red-700'
                        }`}>
                        {sale.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedSale(sale);
                            setShowSaleDetailsModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedSale(sale);
                            setAddItemsFormData({ items: [] });
                            setCurrentNewItem({ inventory: '', size: '', quantity: '', unitPrice: '' });
                            setShowAddItemsModal(true);
                          }}
                          className="text-purple-600 hover:text-purple-800"
                          title="Add More Items"
                        >
                          <ShoppingCart size={18} />
                        </button>
                        {sale.remainingAmount > 0 && (
                          <button
                            onClick={() => {
                              setSelectedSale(sale);
                              setPaymentFormData({
                                amount: '', // Empty for free typing
                                paymentMethod: 'Cash',
                                notes: ''
                              });
                              setShowPaymentModal(true);
                            }}
                            className="text-green-600 hover:text-green-800"
                            title="Add Payment"
                          >
                            <CreditCard size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteSale(sale.id || sale._id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Sale Modal */}
      {showSaleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">Create New Sale</h3>
            </div>
            <form onSubmit={handleSubmitSale} className="p-6 space-y-6">
              {/* Customer Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                <select
                  required
                  value={saleFormData.customer}
                  onChange={(e) => setSaleFormData({ ...saleFormData, customer: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select Customer</option>
                  {customers.map(customer => (
                    <option key={customer.id || customer._id} value={customer.id || customer._id}>
                      {customer.name} {customer.market ? `- ${customer.market}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Add Items */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-4">Add Items</h4>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4">
                  <select
                    value={currentItem.inventory}
                    onChange={(e) => handleInventoryChange(e.target.value)}
                    className="input-field md:col-span-2"
                  >
                    <option value="">Select Product</option>
                    {inventory.map(item => (
                      <option key={item.id || item._id} value={item.id || item._id}>
                        {item.productName} - {item.brand?.name || 'N/A'}
                      </option>
                    ))}
                  </select>
                  <select
                    value={currentItem.size}
                    onChange={(e) => setCurrentItem({ ...currentItem, size: e.target.value })}
                    className="input-field"
                    disabled={!currentItem.inventory}
                  >
                    <option value="">Select Size</option>
                    {currentItem.inventory && (() => {
                      const selectedItem = inventory.find(i => (i.id || i._id) === currentItem.inventory);
                      if (!selectedItem || !selectedItem.sizes || selectedItem.sizes.length === 0) {
                        return <option value="One Size">One Size</option>;
                      }
                      return selectedItem.sizes.map(s => (
                        <option key={s.size} value={s.size}>
                          {s.size} ({s.quantity || 0} available)
                        </option>
                      ));
                    })()}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={currentItem.quantity === '' || currentItem.quantity === 0 ? '' : currentItem.quantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setCurrentItem({ ...currentItem, quantity: '' });
                      } else {
                        const numValue = parseInt(value);
                        if (!isNaN(numValue)) {
                          setCurrentItem({ ...currentItem, quantity: numValue });
                        }
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '') {
                        setCurrentItem({ ...currentItem, quantity: 1 });
                      }
                    }}
                    className="input-field"
                    placeholder="Qty"
                  />
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={currentItem.unitPrice === 0 ? '' : currentItem.unitPrice}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow empty string for free typing
                        if (value === '') {
                          setCurrentItem({ ...currentItem, unitPrice: '' });
                        } else {
                          const numValue = parseFloat(value);
                          if (!isNaN(numValue)) {
                            setCurrentItem({ ...currentItem, unitPrice: numValue });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        // Set to 0 if empty on blur
                        if (e.target.value === '') {
                          setCurrentItem({ ...currentItem, unitPrice: 0 });
                        }
                      }}
                      className="input-field pr-16"
                      placeholder="Enter price"
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">Rs.</span>
                    {currentItem.inventory && (() => {
                      const selectedItem = inventory.find(i => (i.id || i._id) === currentItem.inventory);
                      if (selectedItem?.sellingPrice) {
                        return (
                          <p className="text-xs text-gray-500 mt-1">
                            Suggested: Rs. {selectedItem.sellingPrice}
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="btn-primary"
                    disabled={
                      !currentItem.inventory ||
                      !currentItem.unitPrice ||
                      currentItem.unitPrice === '' ||
                      (typeof currentItem.unitPrice === 'number' && currentItem.unitPrice <= 0) ||
                      !currentItem.quantity ||
                      currentItem.quantity === '' ||
                      (typeof currentItem.quantity === 'number' && currentItem.quantity <= 0)
                    }
                  >
                    Add
                  </button>
                </div>

                {/* Items List */}
                {saleFormData.items.length > 0 && (
                  <div className="space-y-2">
                    {saleFormData.items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">{item.productName}</p>
                          <div className="flex items-center gap-4 mt-1 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Size:</span>
                              <span className="text-sm text-gray-600">{item.size}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Qty:</span>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity === 0 ? '' : item.quantity}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  let newQty = 1;
                                  if (value !== '') {
                                    const numValue = parseInt(value);
                                    if (!isNaN(numValue)) {
                                      newQty = numValue;
                                    }
                                  }
                                  const updatedItems = [...saleFormData.items];
                                  const inventoryItem = inventory.find(i => (i.id || i._id) === item.inventory);
                                  const actualPrice = inventoryItem?.sellingPrice || 0;
                                  const soldPrice = item.unitPrice || 0;
                                  updatedItems[index] = {
                                    ...item,
                                    quantity: newQty,
                                    totalPrice: soldPrice * newQty,
                                    profitPerUnit: soldPrice - actualPrice,
                                    totalProfit: (soldPrice - actualPrice) * newQty
                                  };
                                  setSaleFormData({ ...saleFormData, items: updatedItems });
                                }}
                                onBlur={(e) => {
                                  if (e.target.value === '') {
                                    const updatedItems = [...saleFormData.items];
                                    const inventoryItem = inventory.find(i => (i.id || i._id) === item.inventory);
                                    const actualPrice = inventoryItem?.sellingPrice || 0;
                                    const soldPrice = item.unitPrice || 0;
                                    updatedItems[index] = {
                                      ...item,
                                      quantity: 1,
                                      totalPrice: soldPrice * 1,
                                      profitPerUnit: soldPrice - actualPrice,
                                      totalProfit: (soldPrice - actualPrice) * 1
                                    };
                                    setSaleFormData({ ...saleFormData, items: updatedItems });
                                  }
                                }}
                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Price:</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice === 0 ? '' : item.unitPrice}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  let newPrice = 0;
                                  if (value !== '') {
                                    const numValue = parseFloat(value);
                                    if (!isNaN(numValue)) {
                                      newPrice = numValue;
                                    }
                                  }
                                  const updatedItems = [...saleFormData.items];
                                  const inventoryItem = inventory.find(i => (i.id || i._id) === item.inventory);
                                  const actualPrice = inventoryItem?.sellingPrice || 0;
                                  updatedItems[index] = {
                                    ...item,
                                    unitPrice: newPrice,
                                    totalPrice: newPrice * item.quantity,
                                    profitPerUnit: newPrice - actualPrice,
                                    totalProfit: (newPrice - actualPrice) * item.quantity
                                  };
                                  setSaleFormData({ ...saleFormData, items: updatedItems });
                                }}
                                onBlur={(e) => {
                                  if (e.target.value === '') {
                                    const updatedItems = [...saleFormData.items];
                                    const inventoryItem = inventory.find(i => (i.id || i._id) === item.inventory);
                                    const actualPrice = inventoryItem?.sellingPrice || 0;
                                    updatedItems[index] = {
                                      ...item,
                                      unitPrice: 0,
                                      totalPrice: 0,
                                      profitPerUnit: 0 - actualPrice,
                                      totalProfit: (0 - actualPrice) * item.quantity
                                    };
                                    setSaleFormData({ ...saleFormData, items: updatedItems });
                                  }
                                }}
                                className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                              <span className="text-xs text-gray-500">Rs.</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="font-bold text-gray-900">Rs. {item.totalPrice.toLocaleString()}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-800"
                            title="Remove"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end pt-3 border-t border-gray-200">
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Total Amount</p>
                        <p className="text-2xl font-bold text-gray-900">Rs. {getTotalAmount().toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid Now</label>
                  <input
                    type="number"
                    min="0"
                    max={getTotalAmount()}
                    value={saleFormData.paidAmount === 0 ? '' : saleFormData.paidAmount}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setSaleFormData({ ...saleFormData, paidAmount: '' });
                      } else {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                          setSaleFormData({ ...saleFormData, paidAmount: numValue });
                        }
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '') {
                        setSaleFormData({ ...saleFormData, paidAmount: 0 });
                      }
                    }}
                    className="input-field"
                    placeholder="Enter amount"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sale Type</label>
                  <select
                    value={saleFormData.saleType}
                    onChange={(e) => setSaleFormData({ ...saleFormData, saleType: e.target.value })}
                    className="input-field"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Credit">Credit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={saleFormData.notes}
                  onChange={(e) => setSaleFormData({ ...saleFormData, notes: e.target.value })}
                  className="input-field"
                  rows="2"
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowSaleModal(false);
                    resetSaleForm();
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
                      <span>Creating Sale...</span>
                    </>
                  ) : (
                    <span>Create Sale</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sale Details Modal */}
      {showSaleDetailsModal && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">Sale Details</h3>
              <p className="text-sm text-gray-600 mt-1">
                Invoice: {selectedSale.invoiceNumber} | Date: {selectedSale.saleDate ? (
                  selectedSale.saleDate.toDate ?
                    selectedSale.saleDate.toDate().toLocaleDateString() :
                    new Date(selectedSale.saleDate.seconds * 1000).toLocaleDateString()
                ) : 'N/A'}
              </p>
            </div>
            <div className="p-6 space-y-6">
              {/* Customer Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-800 mb-2">Customer Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Name</p>
                    <p className="font-medium text-gray-900">{selectedSale.customer?.name || 'N/A'}</p>
                  </div>
                  {selectedSale.customer?.market && (
                    <div>
                      <p className="text-xs text-gray-500">Market</p>
                      <p className="font-medium text-gray-900">{selectedSale.customer.market}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Items List with Details */}
              <div>
                <h4 className="font-semibold text-gray-800 mb-4">Items Sold</h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actual Price</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sold Price</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit/Unit</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Profit</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedSale.items && selectedSale.items.map((item, index) => {
                        // Try to get actual price from stored value, or fetch from current inventory
                        let actualPrice = item.inventorySellingPrice || 0;
                        if (actualPrice === 0 && item.inventoryId) {
                          // Try to find in current inventory
                          const currentInventoryItem = inventory.find(i => (i.id || i._id) === item.inventoryId);
                          if (currentInventoryItem?.sellingPrice) {
                            actualPrice = currentInventoryItem.sellingPrice;
                          }
                        }
                        const soldPrice = item.unitPrice || 0;
                        const profitPerUnit = item.profitPerUnit !== undefined ? item.profitPerUnit : (soldPrice - actualPrice);
                        const totalProfit = item.totalProfit !== undefined ? item.totalProfit : (profitPerUnit * (item.quantity || 0));
                        const totalPrice = item.totalPrice || (soldPrice * (item.quantity || 0));

                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.size}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{item.quantity || 0}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              Rs. {actualPrice.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              Rs. {soldPrice.toLocaleString()}
                            </td>
                            <td className={`px-4 py-3 text-sm font-medium ${profitPerUnit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              Rs. {profitPerUnit.toLocaleString()}
                            </td>
                            <td className={`px-4 py-3 text-sm font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              Rs. {totalProfit.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                              Rs. {totalPrice.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                      {(() => {
                        const calculatedTotalProfit = selectedSale.items?.reduce((sum, item) => {
                          // Try to get actual price from stored value, or fetch from current inventory
                          let actualPrice = item.inventorySellingPrice || 0;
                          if (actualPrice === 0 && item.inventoryId) {
                            // Try to find in current inventory
                            const currentInventoryItem = inventory.find(i => (i.id || i._id) === item.inventoryId);
                            if (currentInventoryItem?.sellingPrice) {
                              actualPrice = currentInventoryItem.sellingPrice;
                            }
                          }
                          const soldPrice = item.unitPrice || 0;
                          const profitPerUnit = item.profitPerUnit !== undefined ? item.profitPerUnit : (soldPrice - actualPrice);
                          const itemTotalProfit = item.totalProfit !== undefined ? item.totalProfit : (profitPerUnit * (item.quantity || 0));
                          return sum + itemTotalProfit;
                        }, 0) || 0;
                        return (
                          <tr>
                            <td colSpan="6" className="px-4 py-3 text-right font-semibold text-gray-700">
                              Total Profit:
                            </td>
                            <td className={`px-4 py-3 text-sm font-bold ${calculatedTotalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              Rs. {calculatedTotalProfit.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-900">
                              Rs. {selectedSale.totalAmount.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                  <p className="text-xl font-bold text-gray-900">Rs. {selectedSale.totalAmount.toLocaleString()}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Paid Amount</p>
                  <p className="text-xl font-bold text-green-600">Rs. {selectedSale.paidAmount.toLocaleString()}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Remaining</p>
                  <p className="text-xl font-bold text-orange-600">Rs. {selectedSale.remainingAmount.toLocaleString()}</p>
                </div>
              </div>

              {selectedSale.notes && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Notes</p>
                  <p className="text-sm text-gray-800">{selectedSale.notes}</p>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowSaleDetailsModal(false)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">Add Payment</h3>
              <p className="text-sm text-gray-600 mt-1">
                Invoice: {selectedSale.invoiceNumber}
              </p>
            </div>
            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4">
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Remaining Amount</p>
                <p className="text-2xl font-bold text-orange-600">
                  Rs. {selectedSale.remainingAmount.toLocaleString()}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedSale.remainingAmount}
                  value={paymentFormData.amount === 0 ? '' : paymentFormData.amount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setPaymentFormData({ ...paymentFormData, amount: '' });
                    } else {
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        setPaymentFormData({ ...paymentFormData, amount: numValue });
                      }
                    }
                  }}
                  onBlur={(e) => {
                    if (e.target.value === '') {
                      setPaymentFormData({ ...paymentFormData, amount: 0 });
                    }
                  }}
                  className="input-field"
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={paymentFormData.paymentMethod}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentMethod: e.target.value })}
                  className="input-field"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                  className="input-field"
                  rows="2"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
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
                      <span>Adding Payment...</span>
                    </>
                  ) : (
                    <span>Add Payment</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Items to Sale Modal */}
      {showAddItemsModal && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">Add Items to Sale</h3>
              <p className="text-sm text-gray-600 mt-1">
                Invoice: {selectedSale.invoiceNumber} | Customer: {selectedSale.customer?.name}
              </p>
            </div>
            <form onSubmit={handleSubmitAddItems} className="p-6 space-y-6">
              {/* Add Item Form */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <h4 className="font-semibold text-gray-800">Add New Item</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                    <select
                      value={currentNewItem.inventory}
                      onChange={(e) => handleNewInventoryChange(e.target.value)}
                      className="input-field"
                    >
                      <option value="">Select Product</option>
                      {inventory.map(item => (
                        <option key={item.id || item._id} value={item.id || item._id}>
                          {item.productName} - Rs. {item.sellingPrice}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                    <select
                      value={currentNewItem.size}
                      onChange={(e) => setCurrentNewItem({ ...currentNewItem, size: e.target.value })}
                      className="input-field"
                      disabled={!currentNewItem.inventory}
                    >
                      <option value="">Select Size</option>
                      {currentNewItem.inventory && inventory.find(i => (i.id || i._id) === currentNewItem.inventory)?.sizes.map(size => (
                        <option key={size.size} value={size.size}>
                          {size.size} (Avail: {size.quantity})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={currentNewItem.quantity === 0 ? '' : currentNewItem.quantity}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setCurrentNewItem({ ...currentNewItem, quantity: '' });
                        } else {
                          const numValue = parseInt(value);
                          if (!isNaN(numValue)) {
                            setCurrentNewItem({ ...currentNewItem, quantity: numValue });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value === '') {
                          setCurrentNewItem({ ...currentNewItem, quantity: 0 });
                        }
                      }}
                      className="input-field"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                    <input
                      type="number"
                      min="0"
                      value={currentNewItem.unitPrice === 0 ? '' : currentNewItem.unitPrice}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setCurrentNewItem({ ...currentNewItem, unitPrice: '' });
                        } else {
                          const numValue = parseFloat(value);
                          if (!isNaN(numValue)) {
                            setCurrentNewItem({ ...currentNewItem, unitPrice: numValue });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value === '') {
                          setCurrentNewItem({ ...currentNewItem, unitPrice: 0 });
                        }
                      }}
                      className="input-field"
                      placeholder="0"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddNewItem}
                  className="btn-secondary w-full"
                >
                  <Plus size={16} className="inline mr-2" />
                  Add Item
                </button>
              </div>

              {/* Items List */}
              {addItemsFormData.items.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">Items to Add ({addItemsFormData.items.length})</h4>
                  <div className="space-y-2">
                    {addItemsFormData.items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          <p className="text-sm text-gray-600">
                            Size: {item.size} | Qty: {item.quantity} | Price: Rs. {item.unitPrice}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">
                            Rs. {item.totalPrice.toLocaleString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveNewItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-700">Additional Amount:</span>
                      <span className="text-xl font-bold text-blue-600">
                        Rs. {addItemsFormData.items.reduce((sum, item) => sum + item.totalPrice, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddItemsModal(false)}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-2"
                  disabled={saving || addItemsFormData.items.length === 0}
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Adding Items...</span>
                    </>
                  ) : (
                    <span>Add {addItemsFormData.items.length} Item(s) to Sale</span>
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

export default Sales;

