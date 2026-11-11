import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Eye, DollarSign, CreditCard, Trash2, ShoppingCart, ChevronLeft, ChevronRight, Edit2, Printer, UserPlus, Share2, FileText, AlertTriangle, MoreHorizontal, X, Wallet, AlertCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getSales, getCustomers, getInventory, createSale, updateSale, addItemsToSale, addPayment, updateSalePayment, deleteSalePayment, deleteSale, createCustomer } from '../services/api';
import { showSuccess, showError } from '../utils/toast';
import { ListItemShimmer } from '../components/Shimmer';

const STAFF_MEMBERS = ['Almas', 'Shahzad'];

const formatMoney = (amount) => `Rs. ${(parseFloat(amount) || 0).toLocaleString()}`;

const getCustomerInitial = (name) => {
    const parts = (name || 'C').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0][0] || 'C').toUpperCase();
};

/** Clean display name: "dawood international" → "Dawood International" */
const formatDisplayName = (name) => {
    if (!name || typeof name !== 'string') return name || '';
    return name
        .trim()
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
};

const getSaleItemLineTotal = (item) =>
    parseFloat(item?.totalPrice) ||
    ((parseFloat(item?.unitPrice) || 0) * (parseFloat(item?.quantity) || 0));

/**
 * Per-line billed / paid / due for a sale.
 * Tagged payments go to that line; untagged paid splits by bill share.
 * excludePayment: optional payment object to ignore (e.g. while editing it).
 */
const getSaleLineDueBreakdown = (sale, excludePayment = null) => {
    const items = sale?.items || [];
    const saleTotal =
        parseFloat(sale?.totalAmount) ||
        items.reduce((sum, line) => sum + getSaleItemLineTotal(line), 0) ||
        0;
    const salePaid = parseFloat(sale?.paidAmount) || 0;

    const payments = (sale?.payments || []).filter((p) => {
        if (!excludePayment) return true;
        if (excludePayment._paymentKey && p._paymentKey) {
            return p._paymentKey !== excludePayment._paymentKey;
        }
        if (excludePayment.collectionId || excludePayment.paymentId) {
            const key = excludePayment.collectionId || excludePayment.paymentId;
            return (p.collectionId || p.paymentId) !== key;
        }
        return p !== excludePayment;
    });

    let allTagged = 0;
    const taggedByLine = items.map(() => 0);
    payments.forEach((p) => {
        if (!p.againstInventoryId) return;
        const amt = parseFloat(p.amount) || 0;
        allTagged += amt;
        if (typeof p.againstLineIndex === 'number' && p.againstLineIndex >= 0 && p.againstLineIndex < items.length) {
            taggedByLine[p.againstLineIndex] += amt;
            return;
        }
        // Tagged to product but no line index → split across that product's lines
        const againstId = String(p.againstInventoryId);
        let productTotal = 0;
        items.forEach((line) => {
            if (String(line.inventoryId || line.inventory) === againstId) {
                productTotal += getSaleItemLineTotal(line);
            }
        });
        if (productTotal <= 0) return;
        items.forEach((line, idx) => {
            if (String(line.inventoryId || line.inventory) !== againstId) return;
            const lt = getSaleItemLineTotal(line);
            taggedByLine[idx] += amt * (lt / productTotal);
        });
    });

    // If we exclude a payment, paidAmount still includes it — subtract excluded amount
    let adjustedPaid = salePaid;
    if (excludePayment) {
        adjustedPaid = Math.max(0, salePaid - (parseFloat(excludePayment.amount) || 0));
    }
    const untaggedPaid = Math.max(0, adjustedPaid - allTagged);

    return items.map((item, index) => {
        const billed = getSaleItemLineTotal(item);
        const share = saleTotal > 0 ? billed / saleTotal : 0;
        const paid = taggedByLine[index] + untaggedPaid * share;
        const due = Math.max(0, billed - paid);
        return {
            index,
            item,
            billed: Math.round(billed),
            paid: Math.round(paid),
            due: Math.round(due)
        };
    });
};

const formatSaleLineLabel = (item, index, dueAmount = null) => {
    const name = item?.productName || `Line ${index + 1}`;
    const size = item?.size ? ` · ${item.size}` : '';
    const qty = parseFloat(item?.quantity) || 0;
    const duePart =
        dueAmount != null
            ? ` · Due Rs. ${Number(dueAmount).toLocaleString()}`
            : ` · Rs. ${getSaleItemLineTotal(item).toLocaleString()}`;
    return `${name}${size} · Qty ${qty}${duePart}`;
};

/** Optional against-product payload from sale line index ('' = whole sale). */
const resolveAgainstProduct = (sale, lineIndexStr) => {
    if (lineIndexStr === '' || lineIndexStr == null) {
        return {
            againstInventoryId: '',
            againstProductName: '',
            againstSize: '',
            againstLineIndex: ''
        };
    }
    const idx = parseInt(lineIndexStr, 10);
    const item = sale?.items?.[idx];
    if (!item || Number.isNaN(idx)) {
        return {
            againstInventoryId: '',
            againstProductName: '',
            againstSize: '',
            againstLineIndex: ''
        };
    }
    return {
        againstInventoryId: String(item.inventoryId || item.inventory || ''),
        againstProductName: item.productName || '',
        againstSize: item.size || '',
        againstLineIndex: idx
    };
};

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
    const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
    const [editingPaymentKey, setEditingPaymentKey] = useState(null);
    const [originalEditPaymentAmount, setOriginalEditPaymentAmount] = useState(0);
    const [deletingPaymentKey, setDeletingPaymentKey] = useState(null);
    const [showDeletePaymentModal, setShowDeletePaymentModal] = useState(false);
    const [paymentToDelete, setPaymentToDelete] = useState(null);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [paymentHistoryFilter, setPaymentHistoryFilter] = useState('All'); // For filtering payment history in sale details
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
        notes: '',
        addedBy: ''
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
        notes: '',
        addedBy: '',
        paymentDate: new Date().toISOString().split('T')[0],
        againstLineIndex: ''
    });

    const [editPaymentData, setEditPaymentData] = useState({
        amount: '',
        method: 'Cash',
        notes: '',
        editedBy: '',
        paymentDate: new Date().toISOString().split('T')[0],
        againstLineIndex: ''
    });

    const [newCustomerData, setNewCustomerData] = useState({
        name: '',
        contact: '',
        shopName: '',
        address: '',
        customerType: 'Walk-in'
    });
    const [openMenuId, setOpenMenuId] = useState(null);
    const menuRef = useRef(null);

    useEffect(() => {
        fetchData();
    }, [filterStatus]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [salesRes, customersRes, inventoryRes] = await Promise.all([
                getSales({ status: filterStatus }),
                getCustomers(),
                getInventory()
            ]);
            setSales(salesRes.data || []);
            setCustomers(customersRes.data || []);
            setInventory(inventoryRes.data || []);
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
        } else if (dateValue?.seconds != null) {
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
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const parseSaleDate = (dateValue) => {
        if (!dateValue) return null;
        if (dateValue instanceof Date) return dateValue;
        if (dateValue?.toDate) return dateValue.toDate();
        if (dateValue?.seconds != null) return new Date(dateValue.seconds * 1000);
        const d = new Date(dateValue);
        return isNaN(d.getTime()) ? null : d;
    };

    const formatDateParts = (dateValue) => {
        const date = parseSaleDate(dateValue);
        if (!date) return { day: 'N/A', time: '' };
        return {
            day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        };
    };

    /** When this line was added to the sale (not inventory created date). */
    const formatLineAddedToSale = (item, fallbackDate) => {
        const v = item?.addedToSaleAt;
        if (v != null && v !== '') {
            return formatDate(v);
        }
        return fallbackDate ? formatDate(fallbackDate) : 'N/A';
    };

    const resetSaleForm = () => {
        setSaleFormData({
            customer: '',
            items: [],
            paidAmount: '',
            saleType: 'Cash',
            notes: '',
            addedBy: ''
        });
        setNewCustomerData({
            name: '',
            contact: '',
            shopName: '',
            address: '',
            customerType: 'Walk-in'
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
                    totalProfit: item.totalProfit,
                addedToSaleAt: item.addedToSaleAt ?? null
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
                    const preferred =
                        sizes.find((s) => (parseFloat(s.quantity) || 0) > 0) || sizes[0];
                    updated.size = preferred?.size || '';
                    updated.unitPrice = selectedInventory.sellingPrice ?? '';
                } else {
                updated.size = '';
                    updated.unitPrice = '';
                }
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
            totalProfit,
            addedToSaleAt: new Date()
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

    const getSaleItemsTotal = (items = saleFormData.items) =>
        items.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || ((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0))), 0);

    const handleSubmitSale = async (e) => {
        e.preventDefault();

        if (saleFormData.items.length === 0) {
            showError('Please add at least one item');
            return;
        }
        if (!editingSale && !saleFormData.addedBy) {
            showError('Please select who is adding this sale');
            return;
        }

        const itemsTotal = getSaleItemsTotal();
        const paidNow = saleFormData.paidAmount === '' ? 0 : parseFloat(saleFormData.paidAmount) || 0;
        if (paidNow < 0) {
            showError('Paid amount cannot be negative');
            return;
        }
        if (paidNow > itemsTotal + 0.001) {
            showError(`Paid amount cannot exceed bill total (Rs. ${itemsTotal.toLocaleString()})`);
            return;
        }

        setSaving(true);
        try {
            const saleDataToSubmit = {
                ...saleFormData,
                paidAmount: paidNow,
                items: saleFormData.items.map(item => ({
                    ...item,
                    quantity: parseFloat(item.quantity) || 0,
                    unitPrice: parseFloat(item.unitPrice) || 0,
                    totalPrice: (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)
                }))
            };
            if (!editingSale) {
                const cust = customers.find(c => (c.id || c._id) === saleFormData.customer);
                saleDataToSubmit.customerName = cust?.name || '';
            }

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

    const getAgainstLineMax = (sale, againstLineIndex, saleMax, excludePayment = null) => {
        const saleCap = Math.max(0, parseFloat(saleMax) || 0);
        if (againstLineIndex === '' || againstLineIndex == null) return saleCap;
        const line = getSaleLineDueBreakdown(sale, excludePayment).find(
            (l) => String(l.index) === String(againstLineIndex)
        );
        if (!line) return saleCap;
        return Math.min(Math.max(0, line.due), saleCap);
    };

    const handleAddPayment = async (e) => {
        e.preventDefault();
        if (!paymentData.amount) {
            showError('Please enter payment amount');
            return;
        }
        const amount = parseFloat(paymentData.amount);
        const remaining = parseFloat(selectedSale?.remainingAmount) || 0;
        const againstMax = getAgainstLineMax(selectedSale, paymentData.againstLineIndex, remaining);
        if (!(amount > 0)) {
            showError('Amount must be greater than 0');
            return;
        }
        if (amount > againstMax + 0.001) {
            if (paymentData.againstLineIndex !== '' && paymentData.againstLineIndex != null) {
                showError(
                    `Amount cannot exceed this product's due (Rs. ${againstMax.toLocaleString()}). Use Whole sale (auto split) for a larger amount.`
                );
            } else {
                showError(`Amount cannot exceed remaining due (Rs. ${remaining.toLocaleString()})`);
            }
            return;
        }
        if (!paymentData.addedBy) {
            showError('Please select who is adding this payment');
            return;
        }
        if (!paymentData.paymentDate) {
            showError('Please select the payment date');
            return;
        }

        setSaving(true);
        try {
            const against = resolveAgainstProduct(selectedSale, paymentData.againstLineIndex);
            await addPayment(selectedSale.id || selectedSale._id, {
                amount,
                paymentMethod: paymentData.method,
                method: paymentData.method,
                notes: paymentData.notes,
                addedBy: paymentData.addedBy,
                paymentDate: paymentData.paymentDate,
                date: paymentData.paymentDate,
                ...against
            });
            showSuccess('Payment added successfully!');
            setShowPaymentModal(false);
            setPaymentData({
                amount: '',
                method: 'Cash',
                notes: '',
                addedBy: '',
                paymentDate: new Date().toISOString().split('T')[0],
                againstLineIndex: ''
            });
            await refreshSelectedSale();
        } catch (error) {
            showError(error.message || 'Error adding payment');
        } finally {
            setSaving(false);
        }
    };

    const refreshSelectedSale = async () => {
        await fetchData();
        if (!selectedSale) return;
        const salesRes = await getSales({ status: filterStatus });
        const updated = (salesRes.data || []).find(s => (s.id || s._id) === (selectedSale.id || selectedSale._id));
        if (updated) setSelectedSale(updated);
    };

    const getPaymentKey = (payment, index) =>
        payment.paymentId || payment.collectionId || `idx-${index}`;

    const openEditPayment = (payment) => {
        const d = payment.date;
        let dateStr = new Date().toISOString().split('T')[0];
        if (d) {
            const dateObj = d instanceof Date ? d : (d?.toDate ? d.toDate() : new Date(d));
            if (!isNaN(dateObj.getTime())) {
                dateStr = dateObj.toISOString().split('T')[0];
            }
        }
        const originalAmt = parseFloat(payment.amount) || 0;
        setEditingPaymentKey(payment._paymentKey || getPaymentKey(payment, 0));
        setOriginalEditPaymentAmount(originalAmt);
        const lineIdx =
            typeof payment.againstLineIndex === 'number'
                ? String(payment.againstLineIndex)
                : '';
        setEditPaymentData({
            amount: payment.amount != null ? String(payment.amount) : '',
            method: payment.paymentMethod || 'Cash',
            notes: payment.notes || '',
            editedBy: '',
            paymentDate: dateStr,
            againstLineIndex: lineIdx
        });
        setShowEditPaymentModal(true);
    };

    const handleUpdatePayment = async (e) => {
        e.preventDefault();
        if (!editPaymentData.amount || !selectedSale || !editingPaymentKey) {
            showError('Please enter payment amount');
            return;
        }
        const amount = parseFloat(editPaymentData.amount);
        const remaining = parseFloat(selectedSale.remainingAmount) || 0;
        const saleMax = remaining + (originalEditPaymentAmount || 0);
        const paymentsList = selectedSale.payments || [];
        const editingPay =
            paymentsList.find(
                (p, i) =>
                    (p.paymentId || p.collectionId || `idx-${i}`) === editingPaymentKey ||
                    p._paymentKey === editingPaymentKey
            ) || null;
        const againstMax = getAgainstLineMax(
            selectedSale,
            editPaymentData.againstLineIndex,
            saleMax,
            editingPay
        );
        if (!(amount > 0)) {
            showError('Amount must be greater than 0');
            return;
        }
        if (amount > againstMax + 0.001) {
            if (editPaymentData.againstLineIndex !== '' && editPaymentData.againstLineIndex != null) {
                showError(
                    `Amount cannot exceed this product's due (Rs. ${againstMax.toLocaleString()}). Use Whole sale (auto split) for a larger amount.`
                );
            } else {
                showError(`Amount cannot exceed Rs. ${saleMax.toLocaleString()} (remaining + this payment)`);
            }
            return;
        }
        if (!editPaymentData.editedBy) {
            showError('Please select who is editing this payment');
            return;
        }
        if (!editPaymentData.paymentDate) {
            showError('Please select the payment date');
            return;
        }
        setSaving(true);
        try {
            const against = resolveAgainstProduct(selectedSale, editPaymentData.againstLineIndex);
            await updateSalePayment(selectedSale.id || selectedSale._id, editingPaymentKey, {
                amount,
                paymentMethod: editPaymentData.method,
                method: editPaymentData.method,
                notes: editPaymentData.notes,
                editedBy: editPaymentData.editedBy,
                date: editPaymentData.paymentDate,
                ...against
            });
            showSuccess('Payment updated successfully!');
            setShowEditPaymentModal(false);
            setEditingPaymentKey(null);
            setOriginalEditPaymentAmount(0);
            await refreshSelectedSale();
        } catch (error) {
            showError(error.message || 'Error updating payment');
        } finally {
            setSaving(false);
        }
    };

    const openDeletePaymentConfirm = (payment) => {
        let paymentDate;
        if (payment.date?.toDate) {
            paymentDate = payment.date.toDate();
        } else if (payment.date?.seconds) {
            paymentDate = new Date(payment.date.seconds * 1000);
        } else if (payment.date) {
            paymentDate = new Date(payment.date);
        } else {
            paymentDate = null;
        }
        setPaymentToDelete({
            key: payment._paymentKey,
            amount: parseFloat(payment.amount) || 0,
            method: payment.paymentMethod || 'Cash',
            type: payment.paymentType || 'Payment',
            dateLabel: paymentDate && !isNaN(paymentDate.getTime())
                ? paymentDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                : '—'
        });
        setShowDeletePaymentModal(true);
    };

    const handleDeletePayment = async () => {
        if (!paymentToDelete?.key || !selectedSale) return;
        setDeletingPaymentKey(paymentToDelete.key);
        try {
            await deleteSalePayment(selectedSale.id || selectedSale._id, paymentToDelete.key);
            showSuccess('Payment deleted successfully!');
            setShowDeletePaymentModal(false);
            setPaymentToDelete(null);
            await refreshSelectedSale();
        } catch (error) {
            showError(error.message || 'Error deleting payment');
        } finally {
            setDeletingPaymentKey(null);
        }
    };

    const handleDeleteSale = async (id) => {
        if (!window.confirm('Are you sure you want to delete this sale? This action cannot be undone.')) {
            return;
        }

        setDeleting(id);
        try {
            await deleteSale(id);
            showSuccess('Sale deleted successfully!');

            // Close any open modals that might be showing this sale
            if (selectedSale && (selectedSale.id === id || selectedSale._id === id)) {
                setShowDetailsModal(false);
                setShowPaymentModal(false);
                setSelectedSale(null);
            }

            // Refresh the data
            await fetchData();

            // Reset to first page if current page becomes empty
            const [salesRes] = await Promise.all([getSales({ status: filterStatus })]);
            const updatedSales = salesRes.data;
            const filteredSales = updatedSales.filter(sale => {
                const matchesSearch = !searchTerm ||
                    sale.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    sale.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
                return matchesSearch;
            });

            const totalPagesAfterDelete = Math.ceil(filteredSales.length / itemsPerPage);
            if (currentPage > totalPagesAfterDelete && totalPagesAfterDelete > 0) {
                setCurrentPage(totalPagesAfterDelete);
            }
        } catch (error) {
            console.error('Error deleting sale:', error);
            showError(error.message || 'Error deleting sale. Please try again.');
        } finally {
            setDeleting(null);
        }
    };

    const handleCreateCustomer = async (e) => {
        e.preventDefault();
        if (!newCustomerData.name.trim()) {
            showError('Please enter customer name');
            return;
        }

        setSaving(true);
        try {
            const response = await createCustomer(newCustomerData);
            const newCustomer = response.data;
            showSuccess('Customer added successfully!');

            // Refresh customers list
            const customersRes = await getCustomers();
            setCustomers(customersRes.data);

            // Auto-select the newly created customer
            setSaleFormData(prev => ({
                ...prev,
                customer: newCustomer.id || newCustomer._id
            }));

            // Close customer modal
            setShowCustomerModal(false);
            setNewCustomerData({
                name: '',
                contact: '',
                shopName: '',
                address: '',
                customerType: 'Walk-in'
            });
        } catch (error) {
            showError(error.message || 'Error creating customer');
        } finally {
            setSaving(false);
        }
    };

    const handlePrintReceipt = (sale) => {
        // Check if mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showError('Please allow popups to print receipt');
            return;
        }

        const saleDate = formatDate(sale.saleDate);
        const customerName = sale.customer?.name || 'Walk-in Customer';
        const customerContact = sale.customer?.contact || '';
        const totalAmount = parseFloat(sale.totalAmount) || 0;
        const paidAmount = parseFloat(sale.paidAmount) || 0;
        const remainingAmount = parseFloat(sale.remainingAmount) || 0;
        const paymentStatus = sale.paymentStatus || 'N/A';

        const formatItemLabel = (item) => {
            const name = item.productName || 'N/A';
            const size = (item.size || '').trim();
            const showSize = size && size.toLowerCase() !== 'one size' && size.toLowerCase() !== 'n/a';
            return showSize ? `${name} (${size})` : name;
        };

        const itemRows = (sale.items || []).map((item, index) => {
            const qty = parseInt(item.quantity, 10) || 0;
            const rate = parseFloat(item.unitPrice) || 0;
            const amount = parseFloat(item.totalPrice) || 0;
            return `
                <div class="item-block">
                    <div class="item-name">${index + 1}. ${formatItemLabel(item)}</div>
                    <div class="item-row">
                        <span>${qty.toLocaleString()} x Rs.${rate.toLocaleString()}</span>
                        <span>Rs.${amount.toLocaleString()}</span>
                    </div>
                </div>
            `;
        }).join('') || '<div class="item-block"><div class="item-name">No items</div></div>';

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${sale.invoiceNumber}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }

                    @media print {
                        @page { size: 80mm auto; margin: 4mm 3mm; }
                        html, body { width: 80mm; }
                    }

                    body {
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 12px;
                        line-height: 1.4;
                        color: #000;
                        width: 80mm;
                        max-width: 80mm;
                        margin: 0 auto;
                        padding: 8px 6px 16px;
                        background: #fff;
                    }

                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .divider {
                        border: none;
                        border-top: 1px dashed #000;
                        margin: 8px 0;
                    }
                    .divider-solid {
                        border: none;
                        border-top: 1px solid #000;
                        margin: 8px 0;
                    }

                    .store-name {
                        font-size: 16px;
                        font-weight: bold;
                        letter-spacing: 1px;
                        text-transform: uppercase;
                    }

                    .tagline {
                        font-size: 11px;
                        margin-top: 2px;
                    }

                    .receipt-title {
                        font-size: 13px;
                        font-weight: bold;
                        margin: 6px 0 4px;
                        letter-spacing: 2px;
                    }

                    .info-line {
                        display: flex;
                        justify-content: space-between;
                        gap: 8px;
                        font-size: 11px;
                        margin: 3px 0;
                    }

                    .info-line span:last-child {
                        text-align: right;
                        word-break: break-word;
                    }

                    .item-block { margin: 6px 0; }

                    .item-name {
                        font-size: 12px;
                        font-weight: bold;
                        margin-bottom: 2px;
                        word-break: break-word;
                    }

                    .item-row {
                        display: flex;
                        justify-content: space-between;
                        font-size: 11px;
                    }

                    .totals { margin-top: 4px; }

                    .total-line {
                        display: flex;
                        justify-content: space-between;
                        font-size: 12px;
                        margin: 4px 0;
                    }

                    .total-line.grand {
                        font-size: 14px;
                        font-weight: bold;
                        margin-top: 6px;
                    }

                    .total-line.due {
                        font-weight: bold;
                    }

                    .footer {
                        text-align: center;
                        font-size: 11px;
                        margin-top: 10px;
                    }

                    .footer p { margin: 3px 0; }
                </style>
            </head>
            <body>
                <div class="center">
                    <div class="store-name">Dressify Clothing</div>
                    <div class="tagline">Your Fashion Destination</div>
                </div>

                <hr class="divider-solid">

                <div class="center receipt-title">SALES RECEIPT</div>

                <hr class="divider">

                <div class="info-line">
                    <span>Invoice</span>
                    <span>${sale.invoiceNumber}</span>
                    </div>
                <div class="info-line">
                    <span>Date</span>
                    <span>${saleDate}</span>
                    </div>
                <div class="info-line">
                    <span>Customer</span>
                    <span>${customerName}</span>
                </div>
                ${customerContact ? `
                <div class="info-line">
                    <span>Contact</span>
                    <span>${customerContact}</span>
                </div>` : ''}
                <div class="info-line">
                    <span>Status</span>
                    <span class="bold">${paymentStatus}</span>
                </div>

                <hr class="divider">

                ${itemRows}

                <hr class="divider-solid">

                <div class="totals">
                    <div class="total-line grand">
                        <span>TOTAL</span>
                        <span>Rs. ${totalAmount.toLocaleString()}</span>
                    </div>
                    ${paidAmount > 0 ? `
                    <div class="total-line">
                        <span>Paid</span>
                        <span>Rs. ${paidAmount.toLocaleString()}</span>
                    </div>` : ''}
                    ${remainingAmount > 0 ? `
                    <div class="total-line due">
                        <span>Balance Due</span>
                        <span>Rs. ${remainingAmount.toLocaleString()}</span>
                    </div>` : ''}
                </div>

                ${sale.notes ? `
                <hr class="divider">
                <div style="font-size:11px;">
                    <div class="bold">Note:</div>
                    <div>${sale.notes}</div>
                </div>` : ''}

                <hr class="divider-solid">

                <div class="footer">
                    <p class="bold">Thank you for your business!</p>
                    <p>Please visit again</p>
                </div>

                <script>
                    window.onload = function() {
                        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                        if (!isMobile) {
                            setTimeout(function() {
                                window.print();
                                window.onafterprint = function() { window.close(); };
                            }, 400);
                        }
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();

        // Show success message
        if (isMobile) {
            showSuccess('Receipt opened. Use the print button or browser menu to print.');
        }
    };

    const handleShareReceipt = async (sale) => {
        const saleDate = formatDate(sale.saleDate);
        const customerName = sale.customer?.name || 'Walk-in Customer';
        const customerContact = sale.customer?.contact || '';

        // Create receipt text for WhatsApp
        let receiptText = `*DRESSIFY CLOTHING*\n`;
        receiptText += `*Invoice Receipt*\n\n`;
        receiptText += `*Invoice #:* ${sale.invoiceNumber}\n`;
        receiptText += `*Date:* ${saleDate}\n`;
        receiptText += `*Status:* ${sale.paymentStatus || 'N/A'}\n\n`;
        receiptText += `*Customer:* ${customerName}\n`;
        if (customerContact) {
            receiptText += `*Contact:* ${customerContact}\n`;
        }
        receiptText += `\n*Items:*\n`;

        sale.items?.forEach((item, index) => {
            receiptText += `${index + 1}. ${item.productName || 'N/A'} (${item.size || 'N/A'})\n`;
            receiptText += `   Qty: ${item.quantity || 0} × Rs. ${(parseFloat(item.unitPrice) || 0).toLocaleString()} = Rs. ${(parseFloat(item.totalPrice) || 0).toLocaleString()}\n`;
        });

        receiptText += `\n*Total Amount:* Rs. ${(parseFloat(sale.totalAmount) || 0).toLocaleString()}\n`;
        receiptText += `*Paid Amount:* Rs. ${(parseFloat(sale.paidAmount) || 0).toLocaleString()}\n`;

        if ((parseFloat(sale.remainingAmount) || 0) > 0) {
            receiptText += `*Remaining:* Rs. ${(parseFloat(sale.remainingAmount) || 0).toLocaleString()}\n`;
        }

        if (sale.notes) {
            receiptText += `\n*Notes:* ${sale.notes}\n`;
        }

        receiptText += `\nThank you for your business!`;

        // Encode the text for WhatsApp URL
        const encodedText = encodeURIComponent(receiptText);

        // Check if mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
            // For mobile, use WhatsApp API
            const whatsappUrl = `https://wa.me/?text=${encodedText}`;
            window.open(whatsappUrl, '_blank');
            showSuccess('Opening WhatsApp to share receipt...');
        } else {
            // For desktop, copy to clipboard and show message
            try {
                await navigator.clipboard.writeText(receiptText);
                showSuccess('Receipt copied to clipboard! You can paste it in WhatsApp.');
            } catch (err) {
                // Fallback: open WhatsApp web
                const whatsappUrl = `https://web.whatsapp.com/send?text=${encodedText}`;
                window.open(whatsappUrl, '_blank');
                showSuccess('Opening WhatsApp Web to share receipt...');
            }
        }
    };

    const generateInvoicePdf = (sale) => {
        const saleDate = formatDate(sale.saleDate);
        const customerName = sale.customer?.name || 'Walk-in Customer';
        const customerContact = sale.customer?.contact || '';
        const customerAddress = sale.customer?.address || '';

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        doc.setFontSize(22);
        doc.text('DRESSIFY CLOTHING', pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text('Your Fashion Destination - Invoice Receipt', pageWidth / 2, 28, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);

        doc.text(`Invoice #: ${sale.invoiceNumber}`, 14, 42);
        doc.text(`Date: ${saleDate}`, 14, 48);
        doc.text(`Status: ${sale.paymentStatus || 'N/A'}`, 14, 54);

        doc.text(`Customer: ${customerName}`, 110, 42);
        if (customerContact) doc.text(`Contact: ${customerContact}`, 110, 48);
        if (customerAddress) doc.text(`Address: ${customerAddress}`, 110, 54);

        const tableData = (sale.items || []).map((item, i) => [
            i + 1,
            item.productName || 'N/A',
            item.size || 'N/A',
            item.quantity || 0,
            'Rs. ' + (parseFloat(item.unitPrice) || 0).toLocaleString(),
            'Rs. ' + (parseFloat(item.totalPrice) || 0).toLocaleString()
        ]);

        autoTable(doc, {
            startY: 62,
            head: [['#', 'Product', 'Size', 'Qty', 'Unit Price', 'Total']],
            body: tableData.length ? tableData : [['-', 'No items', '-', '-', '-', '-']],
            theme: 'grid',
            headStyles: { fillColor: [66, 66, 66] },
            margin: { left: 14 }
        });

        const finalY = doc.lastAutoTable.finalY || 62;
        doc.setFontSize(10);
        doc.text(`Subtotal: Rs. ${(parseFloat(sale.totalAmount) || 0).toLocaleString()}`, 14, finalY + 12);
        doc.text(`Paid: Rs. ${(parseFloat(sale.paidAmount) || 0).toLocaleString()}`, 14, finalY + 18);
        if ((parseFloat(sale.remainingAmount) || 0) > 0) {
            doc.setTextColor(220, 53, 69);
            doc.text(`Remaining: Rs. ${(parseFloat(sale.remainingAmount) || 0).toLocaleString()}`, 14, finalY + 24);
            doc.setTextColor(0, 0, 0);
        }
        doc.setFont('helvetica', 'bold');
        doc.text(`Total: Rs. ${(parseFloat(sale.totalAmount) || 0).toLocaleString()}`, 14, finalY + (parseFloat(sale.remainingAmount) || 0) > 0 ? 32 : 24);
        doc.setFont('helvetica', 'normal');

        if (sale.notes) {
            doc.setFontSize(9);
            doc.text('Notes: ' + sale.notes, 14, finalY + 44);
        }
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text('Thank you for your business! Generated on ' + new Date().toLocaleString(), pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

        return doc;
    };

    const handleSharePdfWhatsApp = async (sale) => {
        try {
            const doc = generateInvoicePdf(sale);
            const pdfBlob = doc.output('blob');
            const fileName = `Invoice_${sale.invoiceNumber}.pdf`;
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

            const message = `Hi! Please find your invoice *${sale.invoiceNumber}* from DRESSIFY CLOTHING attached. Thank you for your business!`;
            const encodedMessage = encodeURIComponent(message);

            if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
                await navigator.share({
                    title: fileName,
                    files: [file],
                    text: message
                });
                showSuccess('Share sheet opened. Choose WhatsApp to send the PDF.');
            } else {
                doc.save(fileName);
                const contact = sale.customer?.contact || '';
                const digitsOnly = contact.replace(/\D/g, '');
                const phone = digitsOnly.length >= 10
                    ? (digitsOnly.startsWith('92') ? digitsOnly : '92' + digitsOnly)
                    : '';
                const whatsappUrl = phone
                    ? `https://wa.me/${phone}?text=${encodedMessage}`
                    : `https://wa.me/?text=${encodedMessage}`;
                window.open(whatsappUrl, '_blank');
                showSuccess('PDF downloaded. WhatsApp opened – attach the downloaded PDF and send.');
            }
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error(err);
            showError(err.message || 'Could not share PDF to WhatsApp.');
        }
    };

    const getSelectedInventorySizes = () => {
        if (!currentItem.inventory) return [];
        const selectedInventory = inventory.find(inv => (inv.id || inv._id) === currentItem.inventory);
        return selectedInventory?.sizes || [];
    };

    const filteredSales = sales.filter(sale => {
        if (!searchTerm) return true;

        const searchLower = searchTerm.toLowerCase();
        const matchesInvoice = sale.invoiceNumber?.toLowerCase().includes(searchLower);
        const matchesCustomerName = sale.customer?.name?.toLowerCase().includes(searchLower);
        const matchesCustomerContact = sale.customer?.contact?.toLowerCase().includes(searchLower);
        const matchesShopName = sale.customer?.shopName?.toLowerCase().includes(searchLower);
        const matchesAddedBy = sale.addedBy?.toLowerCase().includes(searchLower);

        return matchesInvoice || matchesCustomerName || matchesCustomerContact || matchesShopName || matchesAddedBy;
    });

    const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
    const paginatedSales = filteredSales.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const salesSummary = {
        totalAmount: filteredSales.reduce((s, sale) => s + (parseFloat(sale.totalAmount) || 0), 0),
        paidAmount: filteredSales.reduce((s, sale) => s + (parseFloat(sale.paidAmount) || 0), 0),
        outstanding: filteredSales.reduce((s, sale) => s + (parseFloat(sale.remainingAmount) || 0), 0),
        paidCount: filteredSales.filter(s => s.paymentStatus === 'Paid').length,
        partialCount: filteredSales.filter(s => s.paymentStatus === 'Partial').length,
        unpaidCount: filteredSales.filter(s => s.paymentStatus === 'Unpaid').length
    };

    const statusFilters = [
        { value: '', label: 'All' },
        { value: 'Paid', label: 'Paid' },
        { value: 'Partial', label: 'Partial' },
        { value: 'Unpaid', label: 'Unpaid' }
    ];

    const statusBadgeClass = (status) => {
        if (status === 'Paid') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
        if (status === 'Partial') return 'bg-amber-50 text-amber-900 border-amber-200';
        return 'bg-rose-50 text-rose-800 border-rose-200';
    };

    const getPaidPercent = (sale) => {
        const total = parseFloat(sale.totalAmount) || 0;
        const paid = parseFloat(sale.paidAmount) || 0;
        if (total <= 0) return 0;
        return Math.min(100, Math.round((paid / total) * 100));
    };

    const openSaleDetails = (sale) => {
        setSelectedSale(sale);
        setShowDetailsModal(true);
        setOpenMenuId(null);
    };

    const openAddPayment = (sale) => {
        setSelectedSale(sale);
        setPaymentData({
            amount: '',
            method: 'Cash',
            notes: '',
            addedBy: '',
            paymentDate: new Date().toISOString().split('T')[0],
            againstLineIndex: ''
        });
        setShowPaymentModal(true);
        setOpenMenuId(null);
    };

    const collectionRate = salesSummary.totalAmount > 0
        ? Math.round((salesSummary.paidAmount / salesSummary.totalAmount) * 100)
        : 0;

    // Counts are accurate only on "All" (API already filters by status)
    const filterCounts = !filterStatus
        ? {
            '': filteredSales.length,
            Paid: salesSummary.paidCount,
            Partial: salesSummary.partialCount,
            Unpaid: salesSummary.unpaidCount
        }
        : null;

    return (
        <div className="space-y-5 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                        <h1 className="page-title">Sales & credit</h1>
                        <span className="text-lg font-medium text-ink-muted tabular-nums">
                            {filteredSales.length}
                        </span>
                    </div>
                    <p className="page-subtitle">
                        Invoices, collections & outstanding dues
                        {filterStatus ? ` · ${filterStatus}` : ''}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        resetSaleForm();
                        setShowSaleModal(true);
                    }}
                    className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                    <Plus size={18} />
                    <span>New sale</span>
                </button>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
                            <ShoppingCart size={18} />
                        </span>
                    </div>
                    <p className="text-[11px] font-medium text-ink-muted">Total billed</p>
                    <p className="text-xl sm:text-2xl font-bold text-ink tabular-nums tracking-tight mt-1 break-words">
                        {formatMoney(salesSummary.totalAmount)}
                    </p>
                    <p className="text-xs text-ink-muted mt-1.5">{filteredSales.length} invoices</p>
                </div>
                <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                            <Wallet size={18} />
                        </span>
                        <span className="text-[11px] font-semibold tabular-nums text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {collectionRate}%
                        </span>
                    </div>
                    <p className="text-[11px] font-medium text-ink-muted">Collected</p>
                    <p className="text-xl sm:text-2xl font-bold text-emerald-700 tabular-nums tracking-tight mt-1 break-words">
                        {formatMoney(salesSummary.paidAmount)}
                    </p>
                    <div className="mt-2.5 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${collectionRate}%` }}
                        />
                    </div>
                    <p className="text-xs text-ink-muted mt-1.5">{salesSummary.paidCount} fully paid</p>
                </div>
                <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                            <CreditCard size={18} />
                        </span>
                    </div>
                    <p className="text-[11px] font-medium text-ink-muted">Outstanding</p>
                    <p className={`text-xl sm:text-2xl font-bold tabular-nums tracking-tight mt-1 break-words ${salesSummary.outstanding > 0 ? 'text-amber-800' : 'text-ink'}`}>
                        {formatMoney(salesSummary.outstanding)}
                    </p>
                    <p className="text-xs text-ink-muted mt-1.5">
                        {salesSummary.partialCount + salesSummary.unpaidCount} pending
                    </p>
                </div>
                <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft p-4 sm:p-5 col-span-2 xl:col-span-1">
                    <div className="flex items-center justify-between mb-3">
                        <span className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center" aria-hidden>
                            <AlertCircle size={18} strokeWidth={2} />
                        </span>
                        <div className="flex items-end gap-1 h-8">
                            {[salesSummary.paidCount, salesSummary.partialCount, salesSummary.unpaidCount].map((v, i) => (
                                <div
                                    key={i}
                                    className="w-2 rounded-sm"
                                    style={{
                                        height: `${Math.max(6, Math.min(32, (v / Math.max(1, filteredSales.length)) * 32))}px`,
                                        backgroundColor: i === 0 ? '#059669' : i === 1 ? '#d97706' : '#e11d48'
                                    }}
                                    title={i === 0 ? 'Paid' : i === 1 ? 'Partial' : 'Unpaid'}
                                />
                            ))}
                        </div>
                    </div>
                    <p className="text-[11px] font-medium text-ink-muted">Unpaid / partial</p>
                    <p className="text-xl sm:text-2xl font-bold text-ink tabular-nums tracking-tight mt-1">
                        {salesSummary.unpaidCount}
                        <span className="text-base font-semibold text-ink-muted"> / {salesSummary.partialCount}</span>
                    </p>
                    <p className="text-xs text-ink-muted mt-1.5">Need follow-up</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-neutral-100 space-y-3">
                    <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
                        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
                            {statusFilters.map((f) => {
                                const active = filterStatus === f.value;
                                const count = filterCounts
                                    ? filterCounts[f.value === '' ? '' : f.value]
                                    : (active ? filteredSales.length : null);
                                return (
                                    <button
                                        key={f.value || 'all'}
                                        type="button"
                                        onClick={() => {
                                            setFilterStatus(f.value);
                                            setCurrentPage(1);
                                        }}
                                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap shrink-0 min-h-[40px] border ${active
                                            ? 'bg-ink text-white border-ink'
                                            : 'bg-white text-ink-muted border-neutral-200 hover:bg-neutral-50'
                                            }`}
                                    >
                                        {f.label}
                                        {count != null && (
                                            <span className={`tabular-nums text-[11px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-neutral-100 text-ink-muted'}`}>
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="relative flex-1 lg:max-w-md lg:ml-auto">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" size={18} />
                        <input
                            type="text"
                                placeholder="Search invoices, customers…"
                            value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-ink placeholder-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 outline-none transition-colors"
                        />
                    </div>
                    </div>
                </div>

                {loading ? (
                    <div className="p-4 sm:p-6">
                    <ListItemShimmer count={5} />
                    </div>
                ) : filteredSales.length === 0 ? (
                    <div className="py-14 sm:py-20 px-4 sm:px-6 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center mx-auto mb-4">
                            <ShoppingCart className="w-6 h-6 text-ink-faint" />
                        </div>
                        <h3 className="text-lg font-semibold text-ink">No sales found</h3>
                        <p className="text-sm text-ink-muted mt-1.5 max-w-sm mx-auto text-pretty">
                            {searchTerm || filterStatus
                                ? 'Try a different search or status filter.'
                                : 'Create your first sale to start tracking credit and payments.'}
                        </p>
                        {!searchTerm && !filterStatus && (
                                                    <button
                                type="button"
                                                        onClick={() => {
                                    resetSaleForm();
                                    setShowSaleModal(true);
                                                        }}
                                className="btn-secondary mt-5 inline-flex items-center gap-2"
                                                    >
                                <Plus className="w-4 h-4" />
                                New sale
                                                    </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-neutral-100">
                            {paginatedSales.map((sale) => {
                                const saleId = sale.id || sale._id;
                                const dateParts = formatDateParts(sale.saleDate);
                                const customerName = formatDisplayName(sale.customer?.name || 'Walk-in');
                                const remaining = parseFloat(sale.remainingAmount) || 0;
                                const paidPct = getPaidPercent(sale);
                                const isMenuOpen = openMenuId === saleId;

                                return (
                                    <div key={saleId} className="p-4 space-y-3.5 hover:bg-neutral-50/50">
                                        <div className="flex items-start justify-between gap-3">
                                                    <button
                                                type="button"
                                                onClick={() => openSaleDetails(sale)}
                                                className="flex items-center gap-3 min-w-0 text-left"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-ink text-white text-xs font-semibold flex items-center justify-center shrink-0">
                                                    {getCustomerInitial(customerName)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-ink truncate">{customerName}</p>
                                                    <p className="text-xs text-ink-muted truncate mt-0.5">
                                                        {sale.invoiceNumber}
                                                        <span className="text-neutral-300"> · </span>
                                                        {dateParts.day}
                                                    </p>
                                                </div>
                                                    </button>
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 ${statusBadgeClass(sale.paymentStatus)}`}>
                                                {sale.paymentStatus || 'N/A'}
                                            </span>
                                        </div>

                                        <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-3 space-y-2.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-base font-bold text-ink tabular-nums">{formatMoney(sale.totalAmount)}</p>
                                                <p className="text-xs text-ink-muted tabular-nums">{paidPct}% collected</p>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-neutral-200/80 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${paidPct >= 100 ? 'bg-emerald-500' : paidPct > 0 ? 'bg-amber-500' : 'bg-neutral-300'}`}
                                                    style={{ width: `${paidPct}%` }}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div>
                                                    <p className="text-ink-muted">Paid</p>
                                                    <p className="font-semibold text-emerald-700 tabular-nums mt-0.5">{formatMoney(sale.paidAmount)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-ink-muted">Due</p>
                                                    <p className={`font-semibold tabular-nums mt-0.5 ${remaining > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                                                        {formatMoney(remaining)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
                                            <span>{dateParts.time}</span>
                                            {sale.addedBy && (
                                                <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-ink font-medium">{sale.addedBy}</span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                                    <button
                                                type="button"
                                                onClick={() => openSaleDetails(sale)}
                                                className="flex-1 min-h-[44px] rounded-xl border border-neutral-200 bg-white text-sm font-medium text-ink hover:bg-neutral-50"
                                            >
                                                View
                                                    </button>
                                            {sale.paymentStatus !== 'Paid' && (
                                                    <button
                                                    type="button"
                                                    onClick={() => openAddPayment(sale)}
                                                    className="flex-1 min-h-[44px] rounded-xl bg-ink text-white text-sm font-medium"
                                                >
                                                    Collect
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                        onClick={() => handleEditSale(sale)}
                                                className="min-h-[44px] min-w-[44px] rounded-xl border border-neutral-200 flex items-center justify-center text-ink-muted"
                                                aria-label="Edit"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                            <div className="relative" ref={isMenuOpen ? menuRef : null}>
                                                        <button
                                                    type="button"
                                                    onClick={() => setOpenMenuId(isMenuOpen ? null : saleId)}
                                                    className="min-h-[44px] min-w-[44px] rounded-xl border border-neutral-200 flex items-center justify-center text-ink-muted"
                                                    aria-label="More"
                                                >
                                                    <MoreHorizontal className="w-4 h-4" />
                                                        </button>
                                                {isMenuOpen && (
                                                    <div className="absolute right-0 bottom-full mb-2 w-52 bg-white border border-neutral-200 rounded-xl shadow-elevated py-1 z-30">
                                                        <button type="button" onClick={() => { handlePrintReceipt(sale); setOpenMenuId(null); }} className="w-full px-3 py-2.5 text-left text-sm text-ink hover:bg-neutral-50 flex items-center gap-2">
                                                            <Printer className="w-3.5 h-3.5" /> Print receipt
                                                        </button>
                                                        <button type="button" onClick={() => { handleShareReceipt(sale); setOpenMenuId(null); }} className="w-full px-3 py-2.5 text-left text-sm text-ink hover:bg-neutral-50 flex items-center gap-2">
                                                            <Share2 className="w-3.5 h-3.5" /> Share WhatsApp
                                                        </button>
                                                        <button type="button" onClick={() => { handleSharePdfWhatsApp(sale); setOpenMenuId(null); }} className="w-full px-3 py-2.5 text-left text-sm text-ink hover:bg-neutral-50 flex items-center gap-2">
                                                            <FileText className="w-3.5 h-3.5" /> Send PDF
                                                        </button>
                                                        <div className="my-1 border-t border-neutral-100" />
                                                        <button type="button" onClick={() => { handleDeleteSale(saleId); setOpenMenuId(null); }} className="w-full px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                                                            <Trash2 className="w-3.5 h-3.5" /> Delete sale
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full min-w-[960px]">
                                <thead>
                                    <tr className="border-b border-neutral-100 bg-neutral-50/80">
                                        <th className="text-left py-3.5 px-5 text-xs font-medium text-ink-muted">Customer</th>
                                        <th className="text-left py-3.5 px-4 text-xs font-medium text-ink-muted">Invoice</th>
                                        <th className="text-left py-3.5 px-4 text-xs font-medium text-ink-muted">Date</th>
                                        <th className="text-right py-3.5 px-4 text-xs font-medium text-ink-muted">Amount</th>
                                        <th className="text-left py-3.5 px-4 text-xs font-medium text-ink-muted min-w-[140px]">Payment</th>
                                        <th className="text-right py-3.5 px-4 text-xs font-medium text-ink-muted">Due</th>
                                        <th className="text-left py-3.5 px-4 text-xs font-medium text-ink-muted">Status</th>
                                        <th className="text-left py-3.5 px-4 text-xs font-medium text-ink-muted">Staff</th>
                                        <th className="text-right py-3.5 px-5 text-xs font-medium text-ink-muted">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedSales.map((sale) => {
                                        const saleId = sale.id || sale._id;
                                        const dateParts = formatDateParts(sale.saleDate);
                                        const customerName = formatDisplayName(sale.customer?.name || 'Walk-in');
                                        const remaining = parseFloat(sale.remainingAmount) || 0;
                                        const paidPct = getPaidPercent(sale);
                                        const isMenuOpen = openMenuId === saleId;

                                        return (
                                            <tr key={saleId} className="border-b border-neutral-50 hover:bg-neutral-50/80 transition-colors group">
                                                <td className="py-4 px-5">
                                                    <button
                                                        type="button"
                                                        onClick={() => openSaleDetails(sale)}
                                                        className="flex items-center gap-2.5 min-w-0 text-left"
                                                    >
                                                        <div className="w-9 h-9 rounded-full bg-ink text-white text-xs font-semibold flex items-center justify-center shrink-0">
                                                            {getCustomerInitial(customerName)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-ink truncate group-hover:underline underline-offset-2">{customerName}</p>
                                                            {sale.customer?.shopName && (
                                                                <p className="text-xs text-ink-muted truncate">{formatDisplayName(sale.customer.shopName)}</p>
                                                            )}
                                                        </div>
                                                    </button>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <p className="text-sm font-medium text-ink tabular-nums">{sale.invoiceNumber}</p>
                                                </td>
                                                <td className="py-4 px-4 whitespace-nowrap">
                                                    <p className="text-sm text-ink">{dateParts.day}</p>
                                                    <p className="text-xs text-ink-muted">{dateParts.time}</p>
                                                </td>
                                                <td className="py-4 px-4 text-right text-sm font-semibold text-ink tabular-nums whitespace-nowrap">
                                                    {formatMoney(sale.totalAmount)}
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div className="space-y-1.5 min-w-[120px]">
                                                        <div className="flex items-center justify-between gap-2 text-xs">
                                                            <span className="text-emerald-700 font-medium tabular-nums">{formatMoney(sale.paidAmount)}</span>
                                                            <span className="text-ink-muted tabular-nums">{paidPct}%</span>
                                                        </div>
                                                        <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${paidPct >= 100 ? 'bg-emerald-500' : paidPct > 0 ? 'bg-amber-500' : 'bg-neutral-300'}`}
                                                                style={{ width: `${paidPct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right text-sm font-semibold tabular-nums whitespace-nowrap">
                                                    <span className={remaining > 0 ? 'text-amber-800' : 'text-emerald-700'}>
                                                        {formatMoney(remaining)}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusBadgeClass(sale.paymentStatus)}`}>
                                                        {sale.paymentStatus || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4">
                                                    {sale.addedBy ? (
                                                        <span className="inline-flex px-2 py-1 rounded-lg text-xs font-medium bg-neutral-50 text-ink border border-neutral-200">
                                                            {sale.addedBy}
                                                        </span>
                                                    ) : (
                                                        <span className="text-ink-faint text-sm">—</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-5">
                                                    <div className="flex items-center justify-end gap-0.5">
                                                        <button type="button" onClick={() => openSaleDetails(sale)} className="w-9 h-9 text-ink-muted hover:text-ink hover:bg-neutral-100 rounded-lg flex items-center justify-center transition-colors" aria-label="View" title="View">
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        {sale.paymentStatus !== 'Paid' && (
                                                            <button type="button" onClick={() => openAddPayment(sale)} className="w-9 h-9 text-ink-muted hover:text-ink hover:bg-neutral-100 rounded-lg flex items-center justify-center transition-colors" aria-label="Collect payment" title="Collect">
                                                                <DollarSign className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button type="button" onClick={() => handleEditSale(sale)} className="w-9 h-9 text-ink-muted hover:text-ink hover:bg-neutral-100 rounded-lg flex items-center justify-center transition-colors" aria-label="Edit" title="Edit">
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <div className="relative" ref={isMenuOpen ? menuRef : null}>
                                                            <button type="button" onClick={() => setOpenMenuId(isMenuOpen ? null : saleId)} className="w-9 h-9 text-ink-muted hover:text-ink hover:bg-neutral-100 rounded-lg flex items-center justify-center transition-colors" aria-label="More actions" title="More">
                                                                <MoreHorizontal className="w-4 h-4" />
                                                            </button>
                                                            {isMenuOpen && (
                                                                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-neutral-200 rounded-xl shadow-elevated py-1 z-20">
                                                                    <button type="button" onClick={() => { handlePrintReceipt(sale); setOpenMenuId(null); }} className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-neutral-50 flex items-center gap-2">
                                                                        <Printer className="w-3.5 h-3.5" /> Print receipt
                                                                    </button>
                                                                    <button type="button" onClick={() => { handleShareReceipt(sale); setOpenMenuId(null); }} className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-neutral-50 flex items-center gap-2">
                                                                        <Share2 className="w-3.5 h-3.5" /> Share WhatsApp
                                                                    </button>
                                                                    <button type="button" onClick={() => { handleSharePdfWhatsApp(sale); setOpenMenuId(null); }} className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-neutral-50 flex items-center gap-2">
                                                                        <FileText className="w-3.5 h-3.5" /> Send PDF
                                                                    </button>
                                                                    <div className="my-1 border-t border-neutral-100" />
                                                                    <button type="button" onClick={() => { handleDeleteSale(saleId); setOpenMenuId(null); }} disabled={deleting === saleId} className="w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2 disabled:opacity-50">
                                                                        <Trash2 className="w-3.5 h-3.5" /> Delete sale
                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                </div>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex justify-between items-center gap-3 px-4 sm:px-5 py-4 border-t border-neutral-100 bg-neutral-50/40">
                                <p className="text-xs text-ink-muted tabular-nums hidden sm:block">
                                    Page {currentPage} of {totalPages} · {filteredSales.length} sales
                                </p>
                                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                                <button
                                        type="button"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-ink disabled:opacity-40 hover:bg-neutral-50 min-h-[40px]"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Previous
                                </button>
                                    <span className="text-xs text-ink-muted tabular-nums sm:hidden">
                                        {currentPage}/{totalPages}
                                </span>
                                <button
                                        type="button"
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-ink disabled:opacity-40 hover:bg-neutral-50 min-h-[40px]"
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Sale Modal */}
            {showSaleModal && (() => {
                const saleItemsTotal = getSaleItemsTotal();
                const paidNow = saleFormData.paidAmount === '' ? 0 : parseFloat(saleFormData.paidAmount) || 0;
                const paidExceedsTotal = saleFormData.paidAmount !== '' && paidNow > saleItemsTotal + 0.001;
                const dueNow = Math.max(0, saleItemsTotal - paidNow);
                const linePreview =
                    (parseFloat(currentItem.quantity) || 0) * (parseFloat(currentItem.unitPrice) || 0);

                return (
                    <div
                        className="fixed inset-0 bg-ink/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
                        onClick={() => {
                            setShowSaleModal(false);
                            resetSaleForm();
                        }}
                    >
                        <div
                            className="bg-neutral-100 rounded-t-2xl sm:rounded-2xl shadow-elevated max-w-3xl w-full max-h-[92dvh] overflow-y-auto border border-neutral-200/80"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-4 sm:px-6 py-4 border-b border-neutral-100 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="text-lg sm:text-xl font-bold text-ink tracking-tight">
                                        {editingSale ? 'Edit sale' : 'New sale'}
                                    </h3>
                                    <p className="text-sm text-ink-muted mt-0.5">
                                        {editingSale
                                            ? `Invoice ${editingSale.invoiceNumber}`
                                            : 'Add products · set paid amount · save'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowSaleModal(false);
                                        resetSaleForm();
                                    }}
                                    className="w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-ink-muted shrink-0"
                                    aria-label="Close"
                                >
                                    <X size={18} />
                                </button>
                        </div>

                            <form onSubmit={handleSubmitSale} className="p-4 sm:p-6 space-y-4">
                                {/* Customer */}
                                <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft p-4 sm:p-5 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <label className="text-sm font-semibold text-ink">Customer</label>
                                        <button
                                            type="button"
                                            onClick={() => setShowCustomerModal(true)}
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50"
                                        >
                                            <UserPlus size={14} />
                                            New customer
                                        </button>
                                    </div>
                                    <select
                                        required
                                        value={saleFormData.customer}
                                        onChange={(e) => setSaleFormData({ ...saleFormData, customer: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-ink focus:bg-white focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 outline-none"
                                    >
                                        <option value="">Select customer</option>
                                        {customers.map((customer) => (
                                            <option key={customer.id || customer._id} value={customer.id || customer._id}>
                                                {formatDisplayName(customer.name)}
                                                {customer.shopName ? ` · ${customer.shopName}` : ''}
                                                {customer.contact ? ` · ${customer.contact}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Items */}
                                <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft overflow-hidden">
                                    <div className="px-4 sm:px-5 py-3.5 border-b border-neutral-100">
                                        <h4 className="text-sm font-semibold text-ink">Products</h4>
                                        <p className="text-xs text-ink-muted mt-0.5">
                                            Product select pe size auto fill · phir qty &amp; add
                                        </p>
                                    </div>
                                    <div className="p-4 sm:p-5 space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
                                            <div className="lg:col-span-4">
                                                <label className="text-[11px] font-medium text-ink-muted mb-1 block">Product</label>
                                        <select
                                            value={currentItem.inventory}
                                            onChange={(e) => handleCurrentItemChange('inventory', e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-ink focus:bg-white focus:ring-2 focus:ring-neutral-900/10 outline-none"
                                                >
                                                    <option value="">Select product</option>
                                                    {inventory.map((item) => (
                                                    <option key={item.id || item._id} value={item.id || item._id}>
                                                            {item.productName}
                                                    </option>
                                                    ))}
                                        </select>
                                            </div>
                                            <div className="lg:col-span-2">
                                                <label className="text-[11px] font-medium text-ink-muted mb-1 block">Size</label>
                                        <select
                                            value={currentItem.size}
                                            onChange={(e) => handleCurrentItemChange('size', e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-ink focus:bg-white focus:ring-2 focus:ring-neutral-900/10 outline-none disabled:opacity-50"
                                            disabled={!currentItem.inventory}
                                        >
                                                    <option value="">Size</option>
                                                    {getSelectedInventorySizes().map((size) => (
                                                <option key={size.size} value={size.size}>
                                                            {size.size} ({size.quantity})
                                                </option>
                                            ))}
                                        </select>
                                            </div>
                                            <div className="lg:col-span-2">
                                                <label className="text-[11px] font-medium text-ink-muted mb-1 block">Qty</label>
                                        <input
                                            type="text"
                                                    inputMode="decimal"
                                            value={currentItem.quantity}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                                    handleCurrentItemChange('quantity', value);
                                                }
                                            }}
                                                    className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-ink tabular-nums focus:bg-white focus:ring-2 focus:ring-neutral-900/10 outline-none"
                                                    placeholder="0"
                                        />
                                            </div>
                                            <div className="lg:col-span-2">
                                                <label className="text-[11px] font-medium text-ink-muted mb-1 block">Rate</label>
                                        <input
                                            type="text"
                                                    inputMode="decimal"
                                            value={currentItem.unitPrice}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                                    handleCurrentItemChange('unitPrice', value);
                                                }
                                            }}
                                                    className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-ink tabular-nums focus:bg-white focus:ring-2 focus:ring-neutral-900/10 outline-none"
                                                    placeholder="0"
                                        />
                                            </div>
                                            <div className="lg:col-span-2 flex items-end">
                                        <button
                                            type="button"
                                            onClick={handleAddItem}
                                                    className="w-full min-h-[42px] rounded-xl bg-ink text-white text-sm font-semibold hover:bg-ink-soft transition-colors"
                                        >
                                                    Add
                                        </button>
                                    </div>
                                        </div>
                                        {linePreview > 0 && (
                                            <p className="text-xs text-ink-muted tabular-nums">
                                                Line total: <span className="font-semibold text-ink">{formatMoney(linePreview)}</span>
                                            </p>
                                        )}

                                        {saleFormData.items.length > 0 ? (
                                            <div className="rounded-xl border border-neutral-200 overflow-hidden">
                                        <div className="overflow-x-auto">
                                                    <table className="w-full text-sm min-w-[560px]">
                                                        <thead className="bg-neutral-50 border-b border-neutral-100">
                                                            <tr>
                                                                <th className="text-left py-2.5 px-3 text-xs font-medium text-ink-muted">Product</th>
                                                                <th className="text-left py-2.5 px-3 text-xs font-medium text-ink-muted">Size</th>
                                                                <th className="text-left py-2.5 px-3 text-xs font-medium text-ink-muted">Qty</th>
                                                                <th className="text-left py-2.5 px-3 text-xs font-medium text-ink-muted">Rate</th>
                                                                <th className="text-right py-2.5 px-3 text-xs font-medium text-ink-muted">Total</th>
                                                                <th className="text-right py-2.5 px-3 text-xs font-medium text-ink-muted" />
                                                    </tr>
                                                </thead>
                                                        <tbody className="divide-y divide-neutral-50">
                                                    {saleFormData.items.map((item, index) => (
                                                                <tr key={index}>
                                                                    <td className="py-2.5 px-3 font-medium text-ink">{item.productName}</td>
                                                                    <td className="py-2.5 px-3 text-ink-muted">{item.size}</td>
                                                                    <td className="py-2.5 px-3">
                                                                <input
                                                                    type="text"
                                                                            inputMode="decimal"
                                                                    value={item.quantity}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value;
                                                                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                                                            handleItemChange(index, 'quantity', value);
                                                                        }
                                                                    }}
                                                                            className="w-16 px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm tabular-nums outline-none focus:ring-2 focus:ring-neutral-900/10"
                                                                />
                                                            </td>
                                                                    <td className="py-2.5 px-3">
                                                                <input
                                                                    type="text"
                                                                            inputMode="decimal"
                                                                    value={item.unitPrice}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value;
                                                                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                                                            handleItemChange(index, 'unitPrice', value);
                                                                        }
                                                                    }}
                                                                            className="w-24 px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm tabular-nums outline-none focus:ring-2 focus:ring-neutral-900/10"
                                                                />
                                                            </td>
                                                                    <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-ink">
                                                                        {formatMoney(item.totalPrice || 0)}
                                                            </td>
                                                                    <td className="py-2.5 px-3 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveItem(index)}
                                                                            className="w-8 h-8 rounded-lg text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center"
                                                                            aria-label="Remove item"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                                <div className="flex items-center justify-between gap-3 px-3 py-3 bg-neutral-50 border-t border-neutral-100">
                                                    <p className="text-xs text-ink-muted">{saleFormData.items.length} line{saleFormData.items.length !== 1 ? 's' : ''}</p>
                                                    <p className="text-sm font-bold text-ink tabular-nums">
                                                        Bill {formatMoney(saleItemsTotal)}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-ink-muted text-center py-6 border border-dashed border-neutral-200 rounded-xl">
                                                No products yet — select product, size fills automatically
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Payment */}
                                <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft p-4 sm:p-5 space-y-4">
                                    <div className="flex flex-wrap items-end justify-between gap-2">
                                    <div>
                                            <h4 className="text-sm font-semibold text-ink">Payment</h4>
                                            <p className="text-xs text-ink-muted mt-0.5">
                                                Max {formatMoney(saleItemsTotal)} · 0 to full bill
                                            </p>
                                        </div>
                                        {saleItemsTotal > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setSaleFormData({ ...saleFormData, paidAmount: String(saleItemsTotal) })}
                                                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-ink"
                                            >
                                                Pay full bill
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-medium text-ink-muted mb-1 block">Paid amount</label>
                                        <input
                                            type="text"
                                                inputMode="decimal"
                                            value={saleFormData.paidAmount}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                                    setSaleFormData({ ...saleFormData, paidAmount: value });
                                                }
                                            }}
                                                className={`w-full px-3.5 py-2.5 rounded-xl text-sm tabular-nums outline-none border ${paidExceedsTotal
                                                    ? 'bg-rose-50 border-rose-300 text-rose-800 focus:ring-2 focus:ring-rose-200'
                                                    : 'bg-neutral-50 border-neutral-200 text-ink focus:bg-white focus:ring-2 focus:ring-neutral-900/10'
                                                    }`}
                                            placeholder="0"
                                        />
                                            {paidExceedsTotal ? (
                                                <p className="text-xs text-rose-600 mt-1.5 font-medium">
                                                    Paid bill se zyada nahi ho sakta (max {formatMoney(saleItemsTotal)})
                                                </p>
                                            ) : (
                                                <p className="text-xs text-ink-muted mt-1.5 tabular-nums">
                                                    Due after this: {formatMoney(dueNow)}
                                                </p>
                                            )}
                                    </div>
                                    <div>
                                            <label className="text-[11px] font-medium text-ink-muted mb-1 block">Sale type</label>
                                        <select
                                            value={saleFormData.saleType}
                                            onChange={(e) => setSaleFormData({ ...saleFormData, saleType: e.target.value })}
                                                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-ink focus:bg-white focus:ring-2 focus:ring-neutral-900/10 outline-none"
                                        >
                                            <option value="Cash">Cash</option>
                                            <option value="Credit">Credit</option>
                                        </select>
                                    </div>
                                </div>

                                    {!editingSale && (
                                <div>
                                            <label className="text-[11px] font-medium text-ink-muted mb-1 block">Added by</label>
                                            <select
                                                required
                                                value={saleFormData.addedBy}
                                                onChange={(e) => setSaleFormData({ ...saleFormData, addedBy: e.target.value })}
                                                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-ink focus:bg-white focus:ring-2 focus:ring-neutral-900/10 outline-none"
                                            >
                                                <option value="">Select staff</option>
                                                {STAFF_MEMBERS.map((name) => (
                                                    <option key={name} value={name}>{name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-[11px] font-medium text-ink-muted mb-1 block">Notes</label>
                                    <textarea
                                        value={saleFormData.notes}
                                        onChange={(e) => setSaleFormData({ ...saleFormData, notes: e.target.value })}
                                            className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-ink focus:bg-white focus:ring-2 focus:ring-neutral-900/10 outline-none resize-none"
                                            rows="2"
                                            placeholder="Optional notes…"
                                    />
                                </div>
                            </div>

                                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowSaleModal(false);
                                        resetSaleForm();
                                    }}
                                        className="min-h-[44px] px-4 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-ink hover:bg-neutral-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                        disabled={saving || paidExceedsTotal || saleFormData.items.length === 0}
                                        className="min-h-[44px] px-5 rounded-xl bg-ink text-white text-sm font-semibold hover:bg-ink-soft disabled:opacity-50 inline-flex items-center justify-center gap-2"
                                    >
                                        {saving ? (editingSale ? 'Updating…' : 'Creating…') : (editingSale ? 'Update sale' : 'Create sale')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                );
            })()}

            {/* Details Modal */}
            {showDetailsModal && selectedSale && (() => {
                const customerName = formatDisplayName(selectedSale.customer?.name || 'Walk-in');
                const totalAmount = parseFloat(selectedSale.totalAmount) || 0;
                const paidAmount = parseFloat(selectedSale.paidAmount) || 0;
                const remainingAmount = parseFloat(selectedSale.remainingAmount) || 0;
                const paidPct = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;
                const existingPayments = selectedSale.payments || [];
                const totalFromPayments = existingPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

                let filteredPayments = [...existingPayments];
                if (paymentHistoryFilter === 'Paid') {
                    filteredPayments = remainingAmount === 0 && paidAmount > 0 ? existingPayments : [];
                } else if (paymentHistoryFilter === 'Partial') {
                    filteredPayments = remainingAmount > 0 && paidAmount > 0 ? existingPayments : [];
                } else if (paymentHistoryFilter === 'Unpaid') {
                    filteredPayments = [];
                }

                const paymentsToShow = (paymentHistoryFilter === 'All' ? existingPayments : filteredPayments)
                    .map((p, i) => {
                        const origIdx = existingPayments.indexOf(p);
                        return {
                            ...p,
                            _paymentKey: p.paymentId || p.collectionId || `idx-${origIdx >= 0 ? origIdx : i}`
                        };
                    })
                    .sort((a, b) => {
                        const dateA = a.date?.toDate ? a.date.toDate() : (a.date ? new Date(a.date) : new Date(0));
                        const dateB = b.date?.toDate ? b.date.toDate() : (b.date ? new Date(b.date) : new Date(0));
                        return dateB - dateA;
                    });

                return (
                    <div
                        className="fixed inset-0 bg-ink/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
                        onClick={() => setShowDetailsModal(false)}
                    >
                        <div
                            className="bg-neutral-100 rounded-t-2xl sm:rounded-2xl shadow-elevated max-w-3xl w-full max-h-[92dvh] overflow-y-auto border border-neutral-200/80"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-4 sm:px-6 py-4 border-b border-neutral-100">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-lg sm:text-xl font-bold text-ink tracking-tight">Sale details</h3>
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusBadgeClass(selectedSale.paymentStatus)}`}>
                                                {selectedSale.paymentStatus || 'N/A'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-ink-muted mt-0.5 truncate">
                                            {selectedSale.invoiceNumber} · {customerName}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowDetailsModal(false)}
                                        className="w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-ink-muted shrink-0"
                                        aria-label="Close"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handlePrintReceipt(selectedSale)}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-ink hover:bg-neutral-50"
                                    >
                                        <Printer size={14} /> Print
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleShareReceipt(selectedSale)}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-ink hover:bg-neutral-50"
                                    >
                                        <Share2 size={14} /> WhatsApp
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSharePdfWhatsApp(selectedSale)}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ink text-white text-xs font-semibold hover:bg-ink-soft"
                                    >
                                        <FileText size={14} /> Send PDF
                                    </button>
                                    {remainingAmount > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowDetailsModal(false);
                                                openAddPayment(selectedSale);
                                            }}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                                        >
                                            <DollarSign size={14} /> Collect
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 sm:p-6 space-y-4">
                                <div className="grid grid-cols-3 gap-2.5">
                                    <div className="bg-white rounded-xl border border-neutral-200/90 shadow-soft px-3.5 py-3">
                                        <p className="text-[11px] font-medium text-ink-muted">Billed</p>
                                        <p className="text-base sm:text-lg font-bold text-ink tabular-nums mt-1 break-words">{formatMoney(totalAmount)}</p>
                        </div>
                                    <div className="bg-white rounded-xl border border-neutral-200/90 shadow-soft px-3.5 py-3">
                                        <p className="text-[11px] font-medium text-ink-muted">Paid</p>
                                        <p className="text-base sm:text-lg font-bold text-emerald-700 tabular-nums mt-1 break-words">{formatMoney(paidAmount)}</p>
                                    </div>
                                    <div className="bg-white rounded-xl border border-neutral-200/90 shadow-soft px-3.5 py-3">
                                        <p className="text-[11px] font-medium text-ink-muted">Due</p>
                                        <p className={`text-base sm:text-lg font-bold tabular-nums mt-1 break-words ${remainingAmount > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                                            {formatMoney(remainingAmount)}
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-2 text-xs">
                                        <span className="text-ink-muted">{paidPct}% collected</span>
                                        <span className="text-ink-muted tabular-nums">{existingPayments.length} payment{existingPayments.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${paidPct >= 100 ? 'bg-emerald-500' : paidPct > 0 ? 'bg-amber-500' : 'bg-neutral-300'}`}
                                            style={{ width: `${paidPct}%` }}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                <div>
                                            <p className="text-[11px] text-ink-muted">Customer</p>
                                            <p className="font-semibold text-ink mt-0.5">{customerName}</p>
                                </div>
                                <div>
                                            <p className="text-[11px] text-ink-muted">Date</p>
                                            <p className="font-medium text-ink mt-0.5">{formatDate(selectedSale.saleDate)}</p>
                                </div>
                                <div>
                                            <p className="text-[11px] text-ink-muted">Staff</p>
                                            <p className="font-medium text-ink mt-0.5">{selectedSale.addedBy || '—'}</p>
                                </div>
                                <div>
                                            <p className="text-[11px] text-ink-muted">Type</p>
                                            <p className="font-medium text-ink mt-0.5">{selectedSale.saleType || 'Cash'}</p>
                                </div>
                            </div>
                                </div>

                                <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft overflow-hidden">
                                    <div className="px-4 sm:px-5 py-3.5 border-b border-neutral-100">
                                        <h4 className="text-sm font-semibold text-ink">Items</h4>
                                        <p className="text-xs text-ink-muted mt-0.5">{selectedSale.items?.length || 0} line{(selectedSale.items?.length || 0) !== 1 ? 's' : ''}</p>
                                    </div>
                                <div className="overflow-x-auto">
                                        <table className="w-full text-sm min-w-[520px]">
                                            <thead className="bg-neutral-50 border-b border-neutral-100">
                                                <tr>
                                                    <th className="text-left py-2.5 px-4 text-xs font-medium text-ink-muted">Product</th>
                                                    <th className="text-left py-2.5 px-3 text-xs font-medium text-ink-muted">Size</th>
                                                    <th className="text-right py-2.5 px-3 text-xs font-medium text-ink-muted">Qty</th>
                                                    <th className="text-right py-2.5 px-3 text-xs font-medium text-ink-muted">Rate</th>
                                                    <th className="text-right py-2.5 px-4 text-xs font-medium text-ink-muted">Total</th>
                                            </tr>
                                        </thead>
                                            <tbody className="divide-y divide-neutral-50">
                                                {selectedSale.items?.map((item, index) => (
                                                    <tr key={index}>
                                                        <td className="py-3 px-4">
                                                            <p className="font-medium text-ink">{item.productName}</p>
                                                            <p className="text-[11px] text-ink-muted mt-0.5">
                                                                {formatLineAddedToSale(item, selectedSale.saleDate)}
                                                            </p>
                                                        </td>
                                                        <td className="py-3 px-3 text-ink-muted">{item.size}</td>
                                                        <td className="py-3 px-3 text-right tabular-nums text-ink">{item.quantity}</td>
                                                        <td className="py-3 px-3 text-right tabular-nums text-ink-muted">{formatMoney(item.unitPrice)}</td>
                                                        <td className="py-3 px-4 text-right font-semibold tabular-nums text-ink">{formatMoney(item.totalPrice)}</td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                                <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft overflow-hidden">
                                    <div className="px-4 sm:px-5 py-3.5 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                            <h4 className="text-sm font-semibold text-ink">Payment history</h4>
                                            <p className="text-xs text-ink-muted mt-0.5">When money was received on this invoice</p>
                                    </div>
                                        <select
                                            value={paymentHistoryFilter}
                                            onChange={(e) => setPaymentHistoryFilter(e.target.value)}
                                            className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-neutral-900/10"
                                        >
                                            <option value="All">All payments</option>
                                            <option value="Paid">Paid sales</option>
                                            <option value="Partial">Partial sales</option>
                                            <option value="Unpaid">Unpaid sales</option>
                                        </select>
                                </div>

                                    <div className="p-4 sm:p-5">
                                        {paymentHistoryFilter === 'Unpaid' && paidAmount === 0 ? (
                                            <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
                                                <p className="text-sm font-semibold text-rose-800">Unpaid sale</p>
                                                <p className="text-xs text-rose-700 mt-1">No payments yet · bill {formatMoney(totalAmount)}</p>
                                                </div>
                                        ) : paymentsToShow.length === 0 && paymentHistoryFilter !== 'All' ? (
                                            <p className="text-sm text-ink-muted text-center py-8">No payments for this filter</p>
                                        ) : existingPayments.length === 0 ? (
                                            <p className="text-sm text-ink-muted text-center py-8">No payment history yet</p>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="overflow-x-auto rounded-xl border border-neutral-200">
                                                    <table className="w-full text-sm min-w-[640px]">
                                                        <thead className="bg-neutral-50 border-b border-neutral-100">
                                                            <tr>
                                                                <th className="text-left py-2.5 px-3 text-xs font-medium text-ink-muted">#</th>
                                                                <th className="text-left py-2.5 px-3 text-xs font-medium text-ink-muted">Date</th>
                                                                <th className="text-right py-2.5 px-3 text-xs font-medium text-ink-muted">Amount</th>
                                                                <th className="text-left py-2.5 px-3 text-xs font-medium text-ink-muted">Method</th>
                                                                <th className="text-left py-2.5 px-3 text-xs font-medium text-ink-muted">Type</th>
                                                                <th className="text-left py-2.5 px-3 text-xs font-medium text-ink-muted">By</th>
                                                                <th className="text-left py-2.5 px-3 text-xs font-medium text-ink-muted">Against</th>
                                                                <th className="text-left py-2.5 px-3 text-xs font-medium text-ink-muted">Notes</th>
                                                                <th className="text-right py-2.5 px-3 text-xs font-medium text-ink-muted">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-neutral-50">
                                                            {paymentsToShow.map((payment, index) => {
                                                                    let paymentDate;
                                                                if (payment.date?.toDate) paymentDate = payment.date.toDate();
                                                                else if (payment.date?.seconds) paymentDate = new Date(payment.date.seconds * 1000);
                                                                else if (payment.date instanceof Date) paymentDate = payment.date;
                                                                else if (payment.date) paymentDate = new Date(payment.date);
                                                                else paymentDate = new Date();

                                                                    const formattedTime = paymentDate.toLocaleTimeString('en-US', {
                                                                        hour: '2-digit',
                                                                        minute: '2-digit',
                                                                        hour12: true
                                                                    });

                                                                    return (
                                                                    <tr key={payment._paymentKey} className="hover:bg-neutral-50/80">
                                                                        <td className="py-3 px-3 text-ink-muted tabular-nums">{index + 1}</td>
                                                                            <td className="py-3 px-3">
                                                                            <p className="font-medium text-ink">{formatDate(paymentDate)}</p>
                                                                            <p className="text-[11px] text-ink-muted mt-0.5">{formattedTime}</p>
                                                                        </td>
                                                                        <td className="py-3 px-3 text-right font-semibold text-emerald-700 tabular-nums">
                                                                            {formatMoney(payment.amount)}
                                                                            </td>
                                                                            <td className="py-3 px-3">
                                                                            <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-100 text-ink border border-neutral-200">
                                                                                {payment.paymentMethod || 'Cash'}
                                                                                </span>
                                                                            </td>
                                                                            <td className="py-3 px-3">
                                                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${payment.paymentType === 'Initial Sale'
                                                                                ? 'bg-sky-50 text-sky-800 border-sky-100'
                                                                                : payment.paymentType === 'Recovery'
                                                                                    ? 'bg-amber-50 text-amber-900 border-amber-100'
                                                                                    : 'bg-neutral-50 text-ink-muted border-neutral-200'
                                                                                }`}>
                                                                                {payment.paymentType || 'Payment'}
                                                                                </span>
                                                                            </td>
                                                                        <td className="py-3 px-3 text-xs text-ink-muted">
                                                                            {payment.editedBy ? (
                                                                                <span>Edited · <strong className="text-ink">{payment.editedBy}</strong></span>
                                                                            ) : payment.addedBy ? (
                                                                                <span>Added · <strong className="text-ink">{payment.addedBy}</strong></span>
                                                                            ) : '—'}
                                                                        </td>
                                                                        <td className="py-3 px-3 text-xs text-ink-muted max-w-[160px]">
                                                                            {payment.againstProductName ? (
                                                                                <span className="inline-flex flex-col gap-0.5">
                                                                                    <span className="font-medium text-ink truncate" title={payment.againstProductName}>
                                                                                        {payment.againstProductName}
                                                                                    </span>
                                                                                    {payment.againstSize ? (
                                                                                        <span className="text-[11px] text-ink-muted">{payment.againstSize}</span>
                                                                                    ) : null}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-ink-muted">Whole sale</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="py-3 px-3 text-xs text-ink-muted max-w-[140px] truncate">
                                                                            {payment.notes || '—'}
                                                                        </td>
                                                                        <td className="py-3 px-3">
                                                                            <div className="flex items-center justify-end gap-0.5">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => openEditPayment(payment)}
                                                                                    className="w-8 h-8 rounded-lg text-ink-muted hover:text-ink hover:bg-neutral-100 flex items-center justify-center"
                                                                                    aria-label="Edit payment"
                                                                                >
                                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => openDeletePaymentConfirm(payment)}
                                                                                    disabled={deletingPaymentKey === payment._paymentKey}
                                                                                    className="w-8 h-8 rounded-lg text-rose-600 hover:bg-rose-50 flex items-center justify-center disabled:opacity-50"
                                                                                    aria-label="Delete payment"
                                                                                >
                                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            </div>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                        </tbody>
                                                        <tfoot className="bg-neutral-50 border-t border-neutral-100">
                                                            <tr>
                                                                <td colSpan="2" className="py-3 px-3 text-xs font-medium text-ink-muted">
                                                                    {existingPayments.length} payment{existingPayments.length !== 1 ? 's' : ''} total
                                                                </td>
                                                                <td className="py-3 px-3 text-right font-bold text-emerald-700 tabular-nums">
                                                                    {formatMoney(totalFromPayments)}
                                                                </td>
                                                                <td colSpan="6" />
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                            </div>

                                            {Math.abs(totalFromPayments - paidAmount) > 0.01 && (
                                                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-semibold text-amber-900">Payment mismatch</p>
                                                            <p className="text-xs text-amber-800 mt-0.5">
                                                                Recorded paid {formatMoney(paidAmount)} ≠ history {formatMoney(totalFromPayments)}
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            disabled={saving}
                                                            onClick={async () => {
                                                                if (window.confirm(`Fix payment history by adding missing amount of Rs. ${(paidAmount - totalFromPayments).toLocaleString()}?`)) {
                                                                    try {
                                                                        setSaving(true);
                                                                        await updateSale(selectedSale.id || selectedSale._id, {
                                                                            ...selectedSale,
                                                                            paidAmount: selectedSale.paidAmount,
                                                                            saleType: selectedSale.saleType || 'Cash'
                                                                        });
                                                                        showSuccess('Payment history fixed!');
                                                                        fetchData();
                                                                        const updatedSales = await getSales();
                                                                        const updatedSale = updatedSales.data.find(s => (s.id || s._id) === (selectedSale.id || selectedSale._id));
                                                                        if (updatedSale) setSelectedSale(updatedSale);
                                                                    } catch (error) {
                                                                        showError(error.message || 'Error fixing payment history');
                                                                    } finally {
                                                                        setSaving(false);
                                                                    }
                                                                }
                                                            }}
                                                            className="px-3.5 py-2 rounded-xl bg-amber-800 text-white text-xs font-semibold hover:bg-amber-900 disabled:opacity-50 shrink-0"
                                                        >
                                                            Fix history
                                                        </button>
                                                    </div>
                                                )}
                                                </div>
                                            )}
                                        </div>
                            </div>
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* Payment Modal */}
            {showPaymentModal && selectedSale && (() => {
                const remainingDue = parseFloat(selectedSale.remainingAmount) || 0;
                const lineDues = getSaleLineDueBreakdown(selectedSale);
                const totalLineDue = lineDues.reduce((s, l) => s + (l.due || 0), 0);
                const againstMax = getAgainstLineMax(selectedSale, paymentData.againstLineIndex, remainingDue);
                const productSelected = paymentData.againstLineIndex !== '' && paymentData.againstLineIndex != null;
                const enteredAmount = parseFloat(paymentData.amount);
                const hasAmount = paymentData.amount !== '' && !Number.isNaN(enteredAmount);
                const amountTooHigh = hasAmount && enteredAmount > againstMax + 0.001;
                const amountInvalid = hasAmount && enteredAmount <= 0;
                const amountError = amountTooHigh
                    ? productSelected
                        ? `Max for this product: Rs. ${againstMax.toLocaleString()}. Use Whole sale (auto split) for more.`
                        : `Amount cannot exceed remaining due (Rs. ${remainingDue.toLocaleString()})`
                    : amountInvalid
                        ? 'Amount must be greater than 0'
                        : '';
                const canSubmit = hasAmount && !amountError && !!paymentData.addedBy && !!paymentData.paymentDate && !saving;

                return (
                    <div
                        className="fixed inset-0 bg-ink/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
                        onClick={() => setShowPaymentModal(false)}
                    >
                        <div
                            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-elevated max-w-md w-full max-h-[92dvh] overflow-y-auto border border-neutral-200/80"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-5 py-4 border-b border-neutral-100 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="text-lg font-bold text-ink tracking-tight">Add payment</h3>
                                    <p className="text-xs text-ink-muted mt-0.5 truncate">
                                        {selectedSale.invoiceNumber} · {formatDisplayName(selectedSale.customer?.name || 'Walk-in')}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentModal(false)}
                                    className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-ink-muted"
                                    aria-label="Close"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <form onSubmit={handleAddPayment} className="p-5 space-y-4">
                                <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] font-medium text-amber-800/80">
                                            {productSelected ? 'Product due' : 'Remaining due'}
                                        </p>
                                        <p className="text-lg font-bold text-amber-900 tabular-nums mt-0.5">
                                            {formatMoney(againstMax)}
                                        </p>
                        </div>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentData({
                                            ...paymentData,
                                            amount: againstMax > 0 ? String(againstMax) : ''
                                        })}
                                        className="text-xs font-semibold text-amber-900 bg-white border border-amber-200 px-2.5 py-1.5 rounded-lg hover:bg-amber-50"
                                    >
                                        Pay full
                                    </button>
                                </div>

                            <div>
                                    <label className="block text-sm font-medium text-ink mb-1">Staff *</label>
                                    <select
                                        required
                                        value={paymentData.addedBy}
                                        onChange={(e) => setPaymentData({ ...paymentData, addedBy: e.target.value })}
                                        className="input-field"
                                    >
                                        <option value="">Select staff member</option>
                                        {STAFF_MEMBERS.map((name) => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink mb-1">Payment date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={paymentData.paymentDate}
                                        onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                                        max={new Date().toISOString().split('T')[0]}
                                        className="input-field"
                                    />
                                    <p className="text-xs text-ink-muted mt-1">
                                        Actual date customer paid (backdate if entered late)
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink mb-1">
                                        Against product <span className="font-normal text-ink-muted">(optional)</span>
                                    </label>
                                    <select
                                        value={paymentData.againstLineIndex}
                                        onChange={(e) => {
                                            const nextIndex = e.target.value;
                                            const nextMax = getAgainstLineMax(selectedSale, nextIndex, remainingDue);
                                            setPaymentData({
                                                ...paymentData,
                                                againstLineIndex: nextIndex,
                                                amount: nextMax > 0 ? String(nextMax) : ''
                                            });
                                        }}
                                        className="input-field"
                                    >
                                        <option value="">
                                            Whole sale (auto split) · Due Rs. {totalLineDue.toLocaleString()}
                                        </option>
                                        {lineDues.map(({ item, index, due }) => (
                                            <option key={`${item.inventoryId || item.inventory || 'line'}-${index}`} value={String(index)}>
                                                {formatSaleLineLabel(item, index, due)}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-ink-muted mt-1">
                                        Selecting a product fills Amount with its due (cannot exceed that due)
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink mb-1">Amount *</label>
                                <input
                                    type="text"
                                        inputMode="decimal"
                                    required
                                    value={paymentData.amount}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                            setPaymentData({ ...paymentData, amount: value });
                                        }
                                    }}
                                        className={`input-field tabular-nums ${amountError ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20' : ''}`}
                                    placeholder="0"
                                        aria-invalid={!!amountError}
                                    />
                                    {amountError ? (
                                        <p className="text-xs text-rose-600 font-medium mt-1.5 flex items-start gap-1">
                                            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                                            {amountError}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-ink-muted mt-1.5">
                                            Max allowed: {formatMoney(againstMax)}
                                            {productSelected ? ' for this product' : ''}
                                        </p>
                                    )}
                            </div>
                            <div>
                                    <label className="block text-sm font-medium text-ink mb-1">Payment method</label>
                                <select
                                    value={paymentData.method}
                                    onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                                    className="input-field"
                                >
                                    <option value="Cash">Cash</option>
                                        <option value="Bank Transfer">Bank transfer</option>
                                    <option value="Card">Card</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                    <label className="block text-sm font-medium text-ink mb-1">Notes</label>
                                <textarea
                                    value={paymentData.notes}
                                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                                    className="input-field"
                                        rows="2"
                                        placeholder="Optional notes..."
                                />
                            </div>
                                <div className="flex justify-end gap-2.5 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentModal(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                        disabled={!canSubmit}
                                        className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                        {saving ? 'Adding...' : 'Add payment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                );
            })()}

            {/* Edit Payment Modal */}
            {showEditPaymentModal && selectedSale && (() => {
                const remainingDue = parseFloat(selectedSale.remainingAmount) || 0;
                const saleMax = remainingDue + (originalEditPaymentAmount || 0);
                const paymentsList = selectedSale.payments || [];
                const editingPay =
                    paymentsList.find(
                        (p, i) =>
                            (p.paymentId || p.collectionId || `idx-${i}`) === editingPaymentKey ||
                            p._paymentKey === editingPaymentKey
                    ) || null;
                const lineDues = getSaleLineDueBreakdown(selectedSale, editingPay);
                const totalLineDue = lineDues.reduce((s, l) => s + (l.due || 0), 0);
                const againstMax = getAgainstLineMax(
                    selectedSale,
                    editPaymentData.againstLineIndex,
                    saleMax,
                    editingPay
                );
                const productSelected = editPaymentData.againstLineIndex !== '' && editPaymentData.againstLineIndex != null;
                const enteredAmount = parseFloat(editPaymentData.amount);
                const hasAmount = editPaymentData.amount !== '' && !Number.isNaN(enteredAmount);
                const amountTooHigh = hasAmount && enteredAmount > againstMax + 0.001;
                const amountInvalid = hasAmount && enteredAmount <= 0;
                const amountError = amountTooHigh
                    ? productSelected
                        ? `Max for this product: Rs. ${againstMax.toLocaleString()}. Use Whole sale (auto split) for more.`
                        : `Amount cannot exceed Rs. ${saleMax.toLocaleString()}`
                    : amountInvalid
                        ? 'Amount must be greater than 0'
                        : '';
                const canSubmit = hasAmount && !amountError && !!editPaymentData.editedBy && !!editPaymentData.paymentDate && !saving;

                return (
                    <div
                        className="fixed inset-0 bg-ink/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
                        onClick={() => {
                            setShowEditPaymentModal(false);
                            setEditingPaymentKey(null);
                        }}
                    >
                        <div
                            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-elevated max-w-md w-full max-h-[92dvh] overflow-y-auto border border-neutral-200/80"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-5 py-4 border-b border-neutral-100 flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-bold text-ink tracking-tight">Edit payment</h3>
                                    <p className="text-xs text-ink-muted mt-0.5">
                                        Max {formatMoney(againstMax)}
                                        {productSelected ? ' for this product' : ' (due + this payment)'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEditPaymentModal(false);
                                        setEditingPaymentKey(null);
                                    }}
                                    className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-ink-muted"
                                    aria-label="Close"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <form onSubmit={handleUpdatePayment} className="p-5 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-ink mb-1">Staff *</label>
                                    <select
                                        required
                                        value={editPaymentData.editedBy}
                                        onChange={(e) => setEditPaymentData({ ...editPaymentData, editedBy: e.target.value })}
                                        className="input-field"
                                    >
                                        <option value="">Select staff member</option>
                                        {STAFF_MEMBERS.map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink mb-1">Payment date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={editPaymentData.paymentDate}
                                        onChange={(e) => setEditPaymentData({ ...editPaymentData, paymentDate: e.target.value })}
                                        max={new Date().toISOString().split('T')[0]}
                                        className="input-field"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink mb-1">
                                        Against product <span className="font-normal text-ink-muted">(optional)</span>
                                    </label>
                                    <select
                                        value={editPaymentData.againstLineIndex}
                                        onChange={(e) => {
                                            const nextIndex = e.target.value;
                                            const nextMax = getAgainstLineMax(
                                                selectedSale,
                                                nextIndex,
                                                saleMax,
                                                editingPay
                                            );
                                            setEditPaymentData({
                                                ...editPaymentData,
                                                againstLineIndex: nextIndex,
                                                amount: nextMax > 0 ? String(nextMax) : ''
                                            });
                                        }}
                                        className="input-field"
                                    >
                                        <option value="">
                                            Whole sale (auto split) · Due Rs. {totalLineDue.toLocaleString()}
                                        </option>
                                        {lineDues.map(({ item, index, due }) => (
                                            <option key={`edit-${item.inventoryId || item.inventory || 'line'}-${index}`} value={String(index)}>
                                                {formatSaleLineLabel(item, index, due)}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-ink-muted mt-1">
                                        Selecting a product fills Amount with its due (cannot exceed that due)
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink mb-1">Amount *</label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        required
                                        value={editPaymentData.amount}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                                setEditPaymentData({ ...editPaymentData, amount: value });
                                            }
                                        }}
                                        className={`input-field tabular-nums ${amountError ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20' : ''}`}
                                        placeholder="0"
                                        aria-invalid={!!amountError}
                                    />
                                    {amountError ? (
                                        <p className="text-xs text-rose-600 font-medium mt-1.5 flex items-start gap-1">
                                            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                                            {amountError}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-ink-muted mt-1.5">
                                            Max allowed: {formatMoney(againstMax)}
                                            {productSelected ? ' for this product' : ''}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink mb-1">Payment method</label>
                                    <select
                                        value={editPaymentData.method}
                                        onChange={(e) => setEditPaymentData({ ...editPaymentData, method: e.target.value })}
                                        className="input-field"
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Bank Transfer">Bank transfer</option>
                                        <option value="Card">Card</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-ink mb-1">Notes</label>
                                    <textarea
                                        value={editPaymentData.notes}
                                        onChange={(e) => setEditPaymentData({ ...editPaymentData, notes: e.target.value })}
                                        className="input-field"
                                        rows="2"
                                        placeholder="Optional notes..."
                                    />
                                </div>
                                <div className="flex justify-end gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowEditPaymentModal(false);
                                            setEditingPaymentKey(null);
                                        }}
                                        className="btn-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!canSubmit}
                                        className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {saving ? 'Saving...' : 'Save changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                );
            })()}

            {/* Delete Payment Confirmation */}
            {showDeletePaymentModal && paymentToDelete && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
                    <div className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl max-w-md w-full max-h-[92dvh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-red-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900">Delete this payment?</h3>
                                    <p className="text-sm text-gray-600 mt-2">
                                        Are you sure you want to delete this payment? Paid amount and remaining balance will be recalculated. This cannot be undone.
                                    </p>
                                    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
                                        <p><span className="text-gray-500">Amount:</span> <strong className="text-red-600">Rs. {paymentToDelete.amount.toLocaleString()}</strong></p>
                                        <p><span className="text-gray-500">Date:</span> <strong>{paymentToDelete.dateLabel}</strong></p>
                                        <p><span className="text-gray-500">Method:</span> <strong>{paymentToDelete.method}</strong></p>
                                        <p><span className="text-gray-500">Type:</span> <strong>{paymentToDelete.type}</strong></p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowDeletePaymentModal(false);
                                        setPaymentToDelete(null);
                                    }}
                                    disabled={deletingPaymentKey === paymentToDelete.key}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeletePayment}
                                    disabled={deletingPaymentKey === paymentToDelete.key}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 flex items-center gap-2"
                                >
                                    {deletingPaymentKey === paymentToDelete.key ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                            Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="w-4 h-4" />
                                            Delete Payment
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Customer Modal */}
            {showCustomerModal && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                    <div className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl max-w-md w-full max-h-[92dvh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold text-gray-800">Add New Customer</h3>
                                <button
                                    onClick={() => {
                                        setShowCustomerModal(false);
                                        setNewCustomerData({
                                            name: '',
                                            contact: '',
                                            shopName: '',
                                            address: '',
                                            customerType: 'Walk-in'
                                        });
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={newCustomerData.name}
                                    onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                                    className="input-field"
                                    placeholder="Enter customer name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                                <input
                                    type="text"
                                    value={newCustomerData.contact}
                                    onChange={(e) => setNewCustomerData({ ...newCustomerData, contact: e.target.value })}
                                    className="input-field"
                                    placeholder="Phone number"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
                                <input
                                    type="text"
                                    value={newCustomerData.shopName}
                                    onChange={(e) => setNewCustomerData({ ...newCustomerData, shopName: e.target.value })}
                                    className="input-field"
                                    placeholder="Shop name (optional)"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                <textarea
                                    value={newCustomerData.address}
                                    onChange={(e) => setNewCustomerData({ ...newCustomerData, address: e.target.value })}
                                    className="input-field"
                                    rows="2"
                                    placeholder="Address (optional)"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Type</label>
                                <select
                                    value={newCustomerData.customerType}
                                    onChange={(e) => setNewCustomerData({ ...newCustomerData, customerType: e.target.value })}
                                    className="input-field"
                                >
                                    <option value="Walk-in">Walk-in</option>
                                    <option value="Credit">Credit</option>
                                    <option value="Regular">Regular</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCustomerModal(false);
                                        setNewCustomerData({
                                            name: '',
                                            contact: '',
                                            shopName: '',
                                            address: '',
                                            customerType: 'Walk-in'
                                        });
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
                                            <span>Adding...</span>
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus size={18} />
                                            <span>Add Customer</span>
                                        </>
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
