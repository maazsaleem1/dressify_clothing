import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Users, Eye, Phone, MapPin } from 'lucide-react';
import { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer } from '../services/api';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    shopName: '',
    market: '',
    contact: '',
    email: '',
    address: '',
    customerType: 'Walk-in',
    creditLimit: 0
  });

  useEffect(() => {
    fetchCustomers();
  }, [filterType]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await getCustomers({ type: filterType });
      setCustomers(response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer._id, formData);
      } else {
        await createCustomer(formData);
      }
      setShowModal(false);
      resetForm();
      fetchCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      alert(error.response?.data?.error || 'Error saving customer');
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      shopName: customer.shopName || '',
      market: customer.market || '',
      contact: customer.contact || '',
      email: customer.email || '',
      address: customer.address || '',
      customerType: customer.customerType,
      creditLimit: customer.creditLimit || 0
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await deleteCustomer(id);
        fetchCustomers();
      } catch (error) {
        console.error('Error deleting customer:', error);
      }
    }
  };

  const handleViewDetails = async (customerId) => {
    try {
      const response = await getCustomer(customerId);
      setSelectedCustomer(response.data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching customer details:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      shopName: '',
      market: '',
      contact: '',
      email: '',
      address: '',
      customerType: 'Walk-in',
      creditLimit: 0
    });
    setEditingCustomer(null);
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.shopName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.market?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Customer Management</h2>
          <p className="text-gray-600 mt-1">Manage your customer database and credit accounts</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Add Customer
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input-field"
          >
            <option value="">All Types</option>
            <option value="Walk-in">Walk-in</option>
            <option value="Credit">Credit</option>
            <option value="Regular">Regular</option>
          </select>
        </div>
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Users size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No customers found</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <div key={customer._id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{customer.name}</h3>
                    {customer.shopName && (
                      <p className="text-sm text-gray-600">{customer.shopName}</p>
                    )}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  customer.customerType === 'Credit' 
                    ? 'bg-orange-100 text-orange-700'
                    : customer.customerType === 'Regular'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {customer.customerType}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                {customer.market && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin size={16} className="text-gray-400" />
                    {customer.market}
                  </div>
                )}
                {customer.contact && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone size={16} className="text-gray-400" />
                    {customer.contact}
                  </div>
                )}
                {customer.customerType === 'Credit' && (
                  <div className="mt-3 p-2 bg-orange-50 rounded-lg">
                    <p className="text-xs text-gray-600">Credit Limit</p>
                    <p className="text-lg font-bold text-orange-600">
                      Rs. {customer.creditLimit.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleViewDetails(customer._id)}
                  className="flex-1 btn-secondary text-sm py-2"
                >
                  <Eye size={16} className="inline mr-1" />
                  View
                </button>
                <button
                  onClick={() => handleEdit(customer)}
                  className="flex-1 btn-secondary text-sm py-2"
                >
                  <Edit2 size={16} className="inline mr-1" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(customer._id)}
                  className="btn-danger text-sm py-2 px-3"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="Ali Garments"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
                  <input
                    type="text"
                    value={formData.shopName}
                    onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                    className="input-field"
                    placeholder="Ali's Fashion Store"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Market/Location</label>
                  <input
                    type="text"
                    value={formData.market}
                    onChange={(e) => setFormData({ ...formData, market: e.target.value })}
                    className="input-field"
                    placeholder="Saddar Market"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                  <input
                    type="text"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="input-field"
                    placeholder="+92 300 1234567"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field"
                  placeholder="customer@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="input-field"
                  rows="2"
                  placeholder="Full address..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Type *</label>
                  <select
                    required
                    value={formData.customerType}
                    onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                    className="input-field"
                  >
                    <option value="Walk-in">Walk-in</option>
                    <option value="Credit">Credit</option>
                    <option value="Regular">Regular</option>
                  </select>
                </div>
                {formData.customerType === 'Credit' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit (Rs.)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.creditLimit}
                      onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                      className="input-field"
                      placeholder="50000"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingCustomer ? 'Update' : 'Add'} Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">Customer Details</h3>
            </div>
            <div className="p-6 space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card">
                  <h4 className="font-semibold text-gray-700 mb-3">Basic Information</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Name:</span> {selectedCustomer.customer.name}</p>
                    {selectedCustomer.customer.shopName && (
                      <p><span className="font-medium">Shop:</span> {selectedCustomer.customer.shopName}</p>
                    )}
                    <p><span className="font-medium">Type:</span> {selectedCustomer.customer.customerType}</p>
                    {selectedCustomer.customer.market && (
                      <p><span className="font-medium">Market:</span> {selectedCustomer.customer.market}</p>
                    )}
                    {selectedCustomer.customer.contact && (
                      <p><span className="font-medium">Contact:</span> {selectedCustomer.customer.contact}</p>
                    )}
                  </div>
                </div>

                <div className="card">
                  <h4 className="font-semibold text-gray-700 mb-3">Financial Summary</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-600">Total Purchases</p>
                      <p className="text-xl font-bold text-gray-900">
                        Rs. {selectedCustomer.summary.totalPurchases.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Total Paid</p>
                      <p className="text-lg font-semibold text-green-600">
                        Rs. {selectedCustomer.summary.totalPaid.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Outstanding</p>
                      <p className="text-lg font-semibold text-orange-600">
                        Rs. {selectedCustomer.summary.totalOutstanding.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Sales */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3">Recent Transactions</h4>
                {selectedCustomer.recentSales.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No transactions yet</p>
                ) : (
                  <div className="space-y-2">
                    {selectedCustomer.recentSales.map((sale) => (
                      <div key={sale._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-800">{sale.invoiceNumber}</p>
                          <p className="text-xs text-gray-600">
                            {new Date(sale.saleDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            Rs. {sale.totalAmount.toLocaleString()}
                          </p>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            sale.paymentStatus === 'Paid' 
                              ? 'bg-green-100 text-green-700'
                              : sale.paymentStatus === 'Partial'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {sale.paymentStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;

