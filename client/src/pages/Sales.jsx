import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, DollarSign, CreditCard, Trash2, ShoppingCart, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { getSales, getCustomers, getInventory, createSale, updateSale, addItemsToSale, addPayment, deleteSale } from '../services/api';
import { showSuccess, showError } from '../utils/toast';
import { ListItemShimmer } from '../components/Shimmer';

const Sales = () => {
    const [sales, setSales] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [editingSale, setEditingSale] = useState(null);
    const [selectedSale, setSelectedSale] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [saleFormData, setSaleFormData] = useState({
        customer: '',
        items: [],
        paidAmount: '',
        saleType: 'Cash',
        notes: ''
    });

    const [currentItem, setCurrentItem] = useState({
        inventory: '',
        size: '',
        quantity: '',
        unitPrice: ''
    });

    const [paymentData, setPaymentData] = useState({
        amount: '',
        method: 'Cash',
        notes: ''
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
            console.error('Error fetching sales:', error);
            showError(error.message || 'Error fetching data. Please check if Firestore index is created.');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateValue) => {
        if (!dateValue) return 'N/A';

        let date;
        if (dateValue instanceof Date) {
            date = dateValue;
        } else if (dateValue?.toDate) {
            date = dateValue.toDate();
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
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const resetSaleForm = () => {
        setSaleFormData({
            customer: '',
            items: [],
            paidAmount: '',
            saleType: 'Cash',
            notes: ''
        });
        setCurrentItem({
            inventory: '',
            size: '',
            quantity: '',
            unitPrice: ''
        });
        setEditingSale(null);
    };

    const handleEditSale = (sale) => {
        setEditingSale(sale);
        setSaleFormData({
            customer: sale.customerId || sale.customer?.id || sale.customer?._id || '',
            items: sale.items?.map(item => ({
                inventory: item.inventoryId || item.inventory,
                productName: item.productName,
                size: item.size,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice || (item.unitPrice * item.quantity),
                inventorySellingPrice: item.inventorySellingPrice,
                inventoryCostPrice: item.inventoryCostPrice,
                profitPerUnit: item.profitPerUnit,
                totalProfit: item.totalProfit
            })) || [],
            paidAmount: sale.paidAmount || '',
            saleType: sale.saleType || 'Cash',
            notes: sale.notes || ''
        });
        setShowSaleModal(true);
    };

    const handleCurrentItemChange = (field, value) => {
        setCurrentItem(prev => {
            const updated = { ...prev, [field]: value };

            if (field === 'inventory') {
                const selectedInventory = inventory.find(inv => (inv.id || inv._id) === value);
                if (selectedInventory) {
                    const sizes = selectedInventory.sizes || [];
                    if (sizes.length > 0 && !updated.size) {
                        updated.size = sizes[0].size;
                    }
                    updated.unitPrice = selectedInventory.sellingPrice || '';
                }
                updated.size = '';
            }

            if (field === 'quantity' || field === 'unitPrice') {
                const qty = parseFloat(updated.quantity) || 0;
                const price = parseFloat(updated.unitPrice) || 0;
                updated.totalPrice = qty * price;
            }

            return updated;
        });
    };

    const handleItemChange = (index, field, value) => {
        setSaleFormData(prev => {
            const newItems = [...prev.items];
            newItems[index] = { ...newItems[index], [field]: value };

            if (field === 'quantity' || field === 'unitPrice') {
                const qty = parseFloat(newItems[index].quantity) || 0;
                const price = parseFloat(newItems[index].unitPrice) || 0;
                newItems[index].totalPrice = qty * price;
            }

            return { ...prev, items: newItems };
        });
    };

    const handleAddItem = () => {
        if (!currentItem.inventory || !currentItem.size || !currentItem.quantity || !currentItem.unitPrice) {
            showError('Please fill all item fields');
            return;
        }

        const selectedInventory = inventory.find(inv => (inv.id || inv._id) === currentItem.inventory);
        if (!selectedInventory) {
            showError('Inventory item not found');
            return;
        }

        const qty = parseFloat(currentItem.quantity) || 0;
        const price = parseFloat(currentItem.unitPrice) || 0;
        const costPrice = selectedInventory.costPerUnit || 0;
        const profitPerUnit = price - costPrice;
        const totalProfit = profitPerUnit * qty;

        const newItem = {
            inventory: currentItem.inventory,
            productName: selectedInventory.productName,
            size: currentItem.size,
            quantity: qty,
            unitPrice: price,
            totalPrice: qty * price,
            inventorySellingPrice: selectedInventory.sellingPrice,
            inventoryCostPrice: costPrice,
            profitPerUnit,
            totalProfit
        };

        setSaleFormData(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));

        setCurrentItem({
            inventory: '',
            size: '',
            quantity: '',
            unitPrice: ''
        });
    };

    const handleRemoveItem = (index) => {
        setSaleFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleSubmitSale = async (e) => {
        e.preventDefault();

        if (saleFormData.items.length === 0) {
            showError('Please add at least one item');
            return;
        }

        setSaving(true);
        try {
            const saleDataToSubmit = {
                ...saleFormData,
                paidAmount: saleFormData.paidAmount === '' ? 0 : parseFloat(saleFormData.paidAmount) || 0,
                items: saleFormData.items.map(item => ({
                    ...item,
                    quantity: parseFloat(item.quantity) || 0,
                    unitPrice: parseFloat(item.unitPrice) || 0,
                    totalPrice: (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)
                }))
            };

            if (editingSale) {
                await updateSale(editingSale.id || editingSale._id, saleDataToSubmit);
                showSuccess('Sale updated successfully!');
            } else {
                await createSale(saleDataToSubmit);
                showSuccess('Sale created successfully!');
            }

            setShowSaleModal(false);
            resetSaleForm();
            fetchData();
        } catch (error) {
            showError(error.message || error.response?.data?.error || `Error ${editingSale ? 'updating' : 'creating'} sale`);
        } finally {
            setSaving(false);
        }
    };

    const handleAddPayment = async (e) => {
        e.preventDefault();
        if (!paymentData.amount) {
            showError('Please enter payment amount');
            return;
        }

        setSaving(true);
        try {
            await addPayment(selectedSale.id || selectedSale._id, {
                amount: parseFloat(paymentData.amount),
                method: paymentData.method,
                notes: paymentData.notes
            });
            showSuccess('Payment added successfully!');
            setShowPaymentModal(false);
            setPaymentData({ amount: '', method: 'Cash', notes: '' });
            fetchData();
        } catch (error) {
            showError(error.message || 'Error adding payment');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSale = async (id) => {
        if (!window.confirm('Are you sure you want to delete this sale?')) {
            return;
        }

        setDeleting(id);
        try {
            await deleteSale(id);
            showSuccess('Sale deleted successfully!');
            fetchData();
        } catch (error) {
            showError(error.message || 'Error deleting sale');
        } finally {
            setDeleting(null);
        }
    };

    const getSelectedInventorySizes = () => {
        if (!currentItem.inventory) return [];
        const selectedInventory = inventory.find(inv => (inv.id || inv._id) === currentItem.inventory);
        return selectedInventory?.sizes || [];
    };

    const filteredSales = sales.filter(sale => {
        const matchesSearch = !searchTerm ||
            sale.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sale.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
    const paginatedSales = filteredSales.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Sales & Credit</h1>
                <button
                    onClick={() => {
                        resetSaleForm();
                        setShowSaleModal(true);
                    }}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    New Sale
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search by invoice or customer..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-field pl-10 w-full"
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

                {loading ? (
                    <ListItemShimmer count={5} />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Invoice</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Customer</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Total</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Paid</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Remaining</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedSales.map((sale) => (
                                        <tr key={sale.id || sale._id} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4">{sale.invoiceNumber}</td>
                                            <td className="py-3 px-4">{sale.customer?.name || 'N/A'}</td>
                                            <td className="py-3 px-4">{formatDate(sale.saleDate)}</td>
                                            <td className="py-3 px-4">Rs. {sale.totalAmount?.toLocaleString() || 0}</td>
                                            <td className="py-3 px-4">Rs. {sale.paidAmount?.toLocaleString() || 0}</td>
                                            <td className="py-3 px-4">
                                                <span className={`font-medium ${(sale.remainingAmount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                    Rs. {(sale.remainingAmount || 0).toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${sale.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' :
                                                    sale.paymentStatus === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-red-100 text-red-800'
                                                    }`}>
                                                    {sale.paymentStatus}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedSale(sale);
                                                            setShowDetailsModal(true);
                                                        }}
                                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditSale(sale)}
                                                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                        title="Edit Sale"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    {sale.paymentStatus !== 'Paid' && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedSale(sale);
                                                                setShowPaymentModal(true);
                                                            }}
                                                            className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                                                            title="Add Payment"
                                                        >
                                                            <DollarSign className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteSale(sale.id || sale._id)}
                                                        disabled={deleting === (sale.id || sale._id)}
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                                                        title="Delete Sale"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex justify-between items-center mt-4">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Previous
                                </button>
                                <span className="text-gray-600">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Sale Modal */}
            {showSaleModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">
                                        {editingSale ? 'Edit Sale' : 'Create New Sale'}
                                    </h3>
                                    {editingSale && (
                                        <p className="text-sm text-gray-600">
                                            Invoice: {editingSale.invoiceNumber}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        setShowSaleModal(false);
                                        resetSaleForm();
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmitSale} className="p-6">
                            <div className="space-y-4">
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
                                                {customer.name} {customer.shopName ? `(${customer.shopName})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="border-t border-gray-200 pt-4">
                                    <h4 className="font-semibold text-gray-700 mb-3">Add Items</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
                                        <select
                                            value={currentItem.inventory}
                                            onChange={(e) => handleCurrentItemChange('inventory', e.target.value)}
                                            className="input-field"
                                        >
                                            <option value="">Select Product</option>
                                            {inventory.map(item => (
                                                <option key={item.id || item._id} value={item.id || item._id}>
                                                    {item.productName}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            value={currentItem.size}
                                            onChange={(e) => handleCurrentItemChange('size', e.target.value)}
                                            className="input-field"
                                            disabled={!currentItem.inventory}
                                        >
                                            <option value="">Select Size</option>
                                            {getSelectedInventorySizes().map(size => (
                                                <option key={size.size} value={size.size}>
                                                    {size.size} (Qty: {size.quantity})
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            value={currentItem.quantity}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                                    handleCurrentItemChange('quantity', value);
                                                }
                                            }}
                                            className="input-field"
                                            placeholder="Qty"
                                        />
                                        <input
                                            type="text"
                                            value={currentItem.unitPrice}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                                    handleCurrentItemChange('unitPrice', value);
                                                }
                                            }}
                                            className="input-field"
                                            placeholder="Unit Price"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddItem}
                                            className="btn-secondary"
                                        >
                                            Add Item
                                        </button>
                                    </div>

                                    {saleFormData.items.length > 0 && (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-gray-200">
                                                        <th className="text-left py-2 px-3">Product</th>
                                                        <th className="text-left py-2 px-3">Size</th>
                                                        <th className="text-left py-2 px-3">Qty</th>
                                                        <th className="text-left py-2 px-3">Unit Price</th>
                                                        <th className="text-left py-2 px-3">Total</th>
                                                        <th className="text-left py-2 px-3">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {saleFormData.items.map((item, index) => (
                                                        <tr key={index} className="border-b border-gray-100">
                                                            <td className="py-2 px-3">{item.productName}</td>
                                                            <td className="py-2 px-3">{item.size}</td>
                                                            <td className="py-2 px-3">
                                                                <input
                                                                    type="text"
                                                                    value={item.quantity}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value;
                                                                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                                                            handleItemChange(index, 'quantity', value);
                                                                        }
                                                                    }}
                                                                    className="input-field w-20"
                                                                />
                                                            </td>
                                                            <td className="py-2 px-3">
                                                                <input
                                                                    type="text"
                                                                    value={item.unitPrice}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value;
                                                                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                                                            handleItemChange(index, 'unitPrice', value);
                                                                        }
                                                                    }}
                                                                    className="input-field w-24"
                                                                />
                                                            </td>
                                                            <td className="py-2 px-3">Rs. {item.totalPrice?.toLocaleString() || 0}</td>
                                                            <td className="py-2 px-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveItem(index)}
                                                                    className="text-red-600 hover:text-red-800"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr>
                                                        <td colSpan="4" className="text-right py-2 px-3 font-semibold">Total:</td>
                                                        <td className="py-2 px-3 font-semibold">
                                                            Rs. {saleFormData.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0).toLocaleString()}
                                                        </td>
                                                        <td></td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Paid Amount</label>
                                        <input
                                            type="text"
                                            value={saleFormData.paidAmount}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                                    setSaleFormData({ ...saleFormData, paidAmount: value });
                                                }
                                            }}
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
                                        rows="3"
                                        placeholder="Additional notes..."
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
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
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="btn-primary"
                                >
                                    {saving ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            <span>{editingSale ? 'Updating Sale...' : 'Creating Sale...'}</span>
                                        </>
                                    ) : (
                                        <span>{editingSale ? 'Update Sale' : 'Create Sale'}</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {showDetailsModal && selectedSale && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold text-gray-800">Sale Details</h3>
                                <button
                                    onClick={() => setShowDetailsModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600">Invoice Number</p>
                                    <p className="font-semibold">{selectedSale.invoiceNumber}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Date</p>
                                    <p className="font-semibold">{formatDate(selectedSale.saleDate)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Customer</p>
                                    <p className="font-semibold">{selectedSale.customer?.name || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Status</p>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${selectedSale.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' :
                                        selectedSale.paymentStatus === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                        {selectedSale.paymentStatus}
                                    </span>
                                </div>
                            </div>
                            <div className="border-t border-gray-200 pt-4">
                                <h4 className="font-semibold mb-3">Items</h4>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="text-left py-2">Product</th>
                                            <th className="text-left py-2">Size</th>
                                            <th className="text-left py-2">Qty</th>
                                            <th className="text-left py-2">Unit Price</th>
                                            <th className="text-left py-2">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedSale.items?.map((item, index) => (
                                            <tr key={index} className="border-b border-gray-100">
                                                <td className="py-2">{item.productName}</td>
                                                <td className="py-2">{item.size}</td>
                                                <td className="py-2">{item.quantity}</td>
                                                <td className="py-2">Rs. {item.unitPrice?.toLocaleString()}</td>
                                                <td className="py-2">Rs. {item.totalPrice?.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan="4" className="text-right py-2 font-semibold">Total Amount:</td>
                                            <td className="py-2 font-semibold">Rs. {selectedSale.totalAmount?.toLocaleString()}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan="4" className="text-right py-2">Paid Amount:</td>
                                            <td className="py-2">Rs. {selectedSale.paidAmount?.toLocaleString()}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan="4" className="text-right py-2 font-semibold">Remaining:</td>
                                            <td className="py-2 font-semibold">Rs. {selectedSale.remainingAmount?.toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && selectedSale && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold text-gray-800">Add Payment</h3>
                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <form onSubmit={handleAddPayment} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                                <input
                                    type="text"
                                    required
                                    value={paymentData.amount}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                            setPaymentData({ ...paymentData, amount: value });
                                        }
                                    }}
                                    className="input-field"
                                    placeholder="0"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Remaining: Rs. {selectedSale.remainingAmount?.toLocaleString() || 0}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                                <select
                                    value={paymentData.method}
                                    onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                                    className="input-field"
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="Card">Card</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                <textarea
                                    value={paymentData.notes}
                                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                                    className="input-field"
                                    rows="3"
                                    placeholder="Payment notes..."
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentModal(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="btn-primary"
                                >
                                    {saving ? 'Adding...' : 'Add Payment'}
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
