import React, { useState, useEffect } from 'react';
import { Search, Eye, CheckCircle, Truck, Package, XCircle, Clock, Edit2, X, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import { getOrders, updateOrderStatus, getOrder } from '../services/api';
import { sendOrderConfirmationEmail } from '../services/emailService';
import { showSuccess, showError, showInfo } from '../utils/toast';
import { TableRowShimmer } from '../components/Shimmer';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchOrders();
  }, [filterStatus]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await getOrders({ status: filterStatus });
      setOrders(response.data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (orderId) => {
    try {
      const response = await getOrder(orderId);
      setSelectedOrder(response.data);
      setShowDetailsModal(true);
    } catch (error) {
      showError('Error loading order details');
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    if (!window.confirm(`Change order status to "${newStatus}"?`)) {
      return;
    }

    setUpdating(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
      showSuccess(`Order status updated to ${newStatus} successfully!`);
      await fetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        const response = await getOrder(orderId);
        setSelectedOrder(response.data);
      }
    } catch (error) {
      showError(error.message || 'Error updating order status');
    } finally {
      setUpdating(null);
    }
  };

  const handleSendEmail = async (order) => {
    if (!order.customer?.email) {
      showError('Customer email is required to send confirmation email');
      return;
    }

    if (!window.confirm(`Send order confirmation email to ${order.customer.email}?`)) {
      return;
    }

    setSendingEmail(order.id || order._id);
    try {
      const result = await sendOrderConfirmationEmail(order);
      showSuccess('Order confirmation email sent successfully!');
    } catch (error) {
      showError(error.message || 'Failed to send email. Please try again.');
    } finally {
      setSendingEmail(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Accepted': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'Shipped': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'Delivered': return 'bg-green-100 text-green-700 border-green-300';
      case 'Cancelled': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending': return <Clock size={16} />;
      case 'Accepted': return <CheckCircle size={16} />;
      case 'Shipped': return <Truck size={16} />;
      case 'Delivered': return <Package size={16} />;
      case 'Cancelled': return <XCircle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const getNextStatus = (currentStatus) => {
    const statusFlow = {
      'Pending': 'Accepted',
      'Accepted': 'Shipped',
      'Shipped': 'Delivered',
      'Delivered': null,
      'Cancelled': null
    };
    return statusFlow[currentStatus] || null;
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.phone?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Order Management</h2>
          <p className="text-gray-600 mt-1">Manage and track website orders</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by order number, customer name, email, or phone..."
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
            <option value="Pending">Pending</option>
            <option value="Accepted">Accepted</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Array.from({ length: 10 }).map((_, i) => (
                  <TableRowShimmer key={i} cols={8} />
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedOrders.map((order) => {
                  const nextStatus = getNextStatus(order.status);
                  return (
                    <tr key={order.id || order._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">#{order.orderNumber}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{order.customer?.name || 'N/A'}</p>
                          {order.customer?.email && (
                            <p className="text-sm text-gray-500">{order.customer.email}</p>
                          )}
                          {order.customer?.phone && (
                            <p className="text-sm text-gray-500">{order.customer.phone}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {order.orderDate ? (
                          order.orderDate.toDate ?
                            order.orderDate.toDate().toLocaleDateString() :
                            new Date(order.orderDate.seconds * 1000).toLocaleDateString()
                        ) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {order.items?.length || 0} item(s)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-gray-900">
                          Rs. {order.totalAmount?.toLocaleString() || '0'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                          {order.paymentMethod || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 w-fit ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewDetails(order.id || order._id)}
                            className="text-blue-600 hover:text-blue-800"
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>
                          {order.customer?.email && (
                            <button
                              onClick={() => handleSendEmail(order)}
                              className="text-purple-600 hover:text-purple-800 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={sendingEmail === (order.id || order._id)}
                              title="Send Confirmation Email"
                            >
                              {sendingEmail === (order.id || order._id) ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                              ) : (
                                <Mail size={18} />
                              )}
                            </button>
                          )}
                          {nextStatus && (
                            <button
                              onClick={() => handleStatusUpdate(order.id || order._id, nextStatus)}
                              className="text-green-600 hover:text-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={updating === (order.id || order._id)}
                              title={`Update to ${nextStatus}`}
                            >
                              {updating === (order.id || order._id) ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                              ) : (
                                <Edit2 size={18} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredOrders.length > itemsPerPage && (
          <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
              <span className="font-medium">{Math.min(endIndex, filteredOrders.length)}</span> of{' '}
              <span className="font-medium">{filteredOrders.length}</span> orders
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft size={16} />
                Previous
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
                      className={`px-3 py-2 text-sm font-medium rounded-lg ${currentPage === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
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
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {showDetailsModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Order Details</h3>
                <p className="text-sm text-gray-600 mt-1">Order #{selectedOrder.orderNumber}</p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Status Section */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-800">Order Status</h4>
                  <span className={`px-4 py-2 rounded-full text-sm font-medium border flex items-center gap-2 ${getStatusColor(selectedOrder.status)}`}>
                    {getStatusIcon(selectedOrder.status)}
                    {selectedOrder.status}
                  </span>
                </div>
                {getNextStatus(selectedOrder.status) && (
                  <button
                    onClick={() => {
                      handleStatusUpdate(selectedOrder.id || selectedOrder._id, getNextStatus(selectedOrder.status));
                    }}
                    className="btn-primary w-full mt-2"
                    disabled={updating === (selectedOrder.id || selectedOrder._id)}
                  >
                    {updating === (selectedOrder.id || selectedOrder._id) ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        Update to {getNextStatus(selectedOrder.status)}
                      </>
                    )}
                  </button>
                )}
                {/* Status Progress */}
                <div className="mt-4 flex items-center justify-between">
                  {['Pending', 'Accepted', 'Shipped', 'Delivered'].map((status, index) => {
                    const isCompleted = ['Pending', 'Accepted', 'Shipped', 'Delivered'].indexOf(selectedOrder.status) >= index;
                    const isCurrent = selectedOrder.status === status;
                    return (
                      <div key={status} className="flex items-center flex-1">
                        <div className="flex flex-col items-center flex-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isCompleted
                            ? 'bg-primary-600 border-primary-600 text-white'
                            : 'bg-white border-gray-300 text-gray-400'
                            }`}>
                            {isCompleted ? <CheckCircle size={16} /> : <Clock size={16} />}
                          </div>
                          <span className={`text-xs mt-2 ${isCurrent ? 'font-semibold text-primary-600' : 'text-gray-500'}`}>
                            {status}
                          </span>
                        </div>
                        {index < 3 && (
                          <div className={`flex-1 h-0.5 mx-2 ${isCompleted ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Customer Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card">
                  <h4 className="font-semibold text-gray-800 mb-3">Customer Information</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium text-gray-600">Name:</span> {selectedOrder.customer?.name || 'N/A'}</p>
                    <p><span className="font-medium text-gray-600">Email:</span> {selectedOrder.customer?.email || 'N/A'}</p>
                    <p><span className="font-medium text-gray-600">Phone:</span> {selectedOrder.customer?.phone || 'N/A'}</p>
                    {selectedOrder.shippingAddress && (
                      <>
                        <p className="font-medium text-gray-600 mt-3">Shipping Address:</p>
                        <p className="text-gray-800">{selectedOrder.shippingAddress}</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="card">
                  <h4 className="font-semibold text-gray-800 mb-3">Order Information</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium text-gray-600">Order Date:</span> {
                      selectedOrder.orderDate ? (
                        selectedOrder.orderDate.toDate ?
                          selectedOrder.orderDate.toDate().toLocaleString() :
                          new Date(selectedOrder.orderDate.seconds * 1000).toLocaleString()
                      ) : 'N/A'
                    }</p>
                    <p><span className="font-medium text-gray-600">Payment Method:</span> {selectedOrder.paymentMethod || 'N/A'}</p>
                    <p><span className="font-medium text-gray-600">Payment Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs ${selectedOrder.paymentStatus === 'Paid'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                        }`}>
                        {selectedOrder.paymentStatus || 'Pending'}
                      </span>
                    </p>
                    {selectedOrder.trackingNumber && (
                      <p><span className="font-medium text-gray-600">Tracking #:</span> {selectedOrder.trackingNumber}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Products List */}
              <div>
                <h4 className="font-semibold text-gray-800 mb-3">Order Items</h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedOrder.items?.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {item.imageUrl && (
                                <img
                                  src={item.imageUrl}
                                  alt={item.productName}
                                  className="w-12 h-12 object-cover rounded"
                                  onError={(e) => e.target.style.display = 'none'}
                                />
                              )}
                              <div>
                                <p className="font-medium text-gray-900">{item.productName}</p>
                                {item.sku && (
                                  <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.size || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">{item.quantity || 0}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">Rs. {item.unitPrice?.toLocaleString() || '0'}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                            Rs. {((item.unitPrice || 0) * (item.quantity || 0)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                      <tr>
                        <td colSpan="4" className="px-4 py-3 text-right font-semibold text-gray-700">
                          Total Amount:
                        </td>
                        <td className="px-4 py-3 text-lg font-bold text-gray-900">
                          Rs. {selectedOrder.totalAmount?.toLocaleString() || '0'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-2">Order Notes</h4>
                  <p className="text-sm text-gray-700">{selectedOrder.notes}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-between items-center">
              {selectedOrder.customer?.email && (
                <button
                  onClick={() => handleSendEmail(selectedOrder)}
                  className="btn-primary flex items-center gap-2"
                  disabled={sendingEmail === (selectedOrder.id || selectedOrder._id)}
                >
                  {sendingEmail === (selectedOrder.id || selectedOrder._id) ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Mail size={18} />
                      <span>Send Confirmation Email</span>
                    </>
                  )}
                </button>
              )}
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

export default Orders;
