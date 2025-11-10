import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, DollarSign, CreditCard, Trash2 } from 'lucide-react';
import { getSales, getCustomers, getInventory, createSale, addPayment, deleteSale } from '../services/api';

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [saleFormData, setSaleFormData] = useState({
    customer: '',
    items: [],
    paidAmount: 0,
    saleType: 'Cash',
    notes: ''
  });

  const [paymentFormData, setPaymentFormData] = useState({
    amount: 0,
    paymentMethod: 'Cash',
    notes: ''
  });

  const [currentItem, setCurrentItem] = useState({
    inventory: '',
    size: '',
    quantity: 1,
    unitPrice: 0
  });

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [salesRes, customersRes, inventoryRes] = await Promise.all([
        getSales({ status: filterStatus }),
        getCustomers(),
        getInventory()
      ]);
      setSales(salesRes.data);
      setCustomers(customersRes.data);
      setInventory(inventoryRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    if (!currentItem.inventory || !currentItem.size || currentItem.quantity <= 0) {
      alert('Please fill all item details');
      return;
    }

    const inventoryItem = inventory.find(i => i._id === currentItem.inventory);
    const sizeStock = inventoryItem.sizes.find(s => s.size === currentItem.size);

    if (!sizeStock || sizeStock.quantity < currentItem.quantity) {
      alert('Insufficient stock!');
      return;
    }

    const newItem = {
      ...currentItem,
      productName: inventoryItem.productName,
      totalPrice: currentItem.quantity * currentItem.unitPrice
    };

    setSaleFormData({
      ...saleFormData,
      items: [...saleFormData.items, newItem]
    });

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
    if (saleFormData.items.length === 0) {
      alert('Please add at least one item');
      return;
    }

    try {
      await createSale(saleFormData);
      setShowSaleModal(false);
      resetSaleForm();
      fetchData();
    } catch (error) {
      console.error('Error creating sale:', error);
      alert(error.response?.data?.error || 'Error creating sale');
    }
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    try {
      await addPayment(selectedSale._id, paymentFormData);
      setShowPaymentModal(false);
      setPaymentFormData({ amount: 0, paymentMethod: 'Cash', notes: '' });
      fetchData();
    } catch (error) {
      console.error('Error adding payment:', error);
      alert(error.response?.data?.error || 'Error adding payment');
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

  const resetSaleForm = () => {
    setSaleFormData({
      customer: '',
      items: [],
      paidAmount: 0,
      saleType: 'Cash',
      notes: ''
    });
    setCurrentItem({
      inventory: '',
      size: '',
      quantity: 1,
      unitPrice: 0
    });
  };

  const handleInventoryChange = (inventoryId) => {
    const item = inventory.find(i => i._id === inventoryId);
    setCurrentItem({
      ...currentItem,
      inventory: inventoryId,
      unitPrice: item?.sellingPrice || 0,
      size: '',
      quantity: 1
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
                  <tr key={sale._id} className="hover:bg-gray-50">
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
                      {new Date(sale.saleDate).toLocaleDateString()}
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
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        sale.paymentStatus === 'Paid' 
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
                        {sale.remainingAmount > 0 && (
                          <button
                            onClick={() => {
                              setSelectedSale(sale);
                              setPaymentFormData({
                                amount: sale.remainingAmount,
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
                          onClick={() => handleDeleteSale(sale._id)}
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
                    <option key={customer._id} value={customer._id}>
                      {customer.name} {customer.market ? `- ${customer.market}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Add Items */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-4">Add Items</h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                  <select
                    value={currentItem.inventory}
                    onChange={(e) => handleInventoryChange(e.target.value)}
                    className="input-field md:col-span-2"
                  >
                    <option value="">Select Product</option>
                    {inventory.map(item => (
                      <option key={item._id} value={item._id}>
                        {item.productName} - {item.brand?.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={currentItem.size}
                    onChange={(e) => setCurrentItem({ ...currentItem, size: e.target.value })}
                    className="input-field"
                    disabled={!currentItem.inventory}
                  >
                    <option value="">Size</option>
                    {currentItem.inventory && inventory.find(i => i._id === currentItem.inventory)?.sizes.map(s => (
                      <option key={s.size} value={s.size}>
                        {s.size} ({s.quantity} available)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={currentItem.quantity}
                    onChange={(e) => setCurrentItem({ ...currentItem, quantity: parseInt(e.target.value) || 1 })}
                    className="input-field"
                    placeholder="Qty"
                  />
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="btn-primary"
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
                          <p className="text-sm text-gray-600">
                            Size: {item.size} | Qty: {item.quantity} | Price: Rs. {item.unitPrice}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="font-bold text-gray-900">Rs. {item.totalPrice.toLocaleString()}</p>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-800"
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
                    value={saleFormData.paidAmount}
                    onChange={(e) => setSaleFormData({ ...saleFormData, paidAmount: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                    placeholder="0"
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
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Sale
                </button>
              </div>
            </form>
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
                  value={paymentFormData.amount}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: parseFloat(e.target.value) || 0 })}
                  className="input-field"
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
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add Payment
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

