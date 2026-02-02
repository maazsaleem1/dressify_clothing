import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, DollarSign, CreditCard, Trash2, ShoppingCart, ChevronLeft, ChevronRight, Edit2, Printer, UserPlus, Share2, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getSales, getCustomers, getInventory, createSale, updateSale, addItemsToSale, addPayment, deleteSale, createCustomer } from '../services/api';
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

    const [newCustomerData, setNewCustomerData] = useState({
        name: '',
        contact: '',
        shopName: '',
        address: '',
        customerType: 'Walk-in'
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
            items: sale.items?.map(item => {
                // Find the inventory item to get the createdAt date
                const inventoryItem = inventory.find(
                    inv => (inv.id || inv._id) === (item.inventoryId || item.inventory)
                );
                const productAddedDate = inventoryItem?.createdAt
                    ? formatDate(inventoryItem.createdAt)
                    : 'N/A';

                return {
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
                    productAddedDate
                };
            }) || [],
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
            totalProfit,
            productAddedDate: selectedInventory.createdAt ? formatDate(selectedInventory.createdAt) : 'N/A'
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
        const customerAddress = sale.customer?.address || '';

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice - ${sale.invoiceNumber}</title>
                <style>
                    @media print {
                        @page { margin: 10mm; size: A4; }
                        body { margin: 0; padding: 0; }
                    }
                    body {
                        font-family: Arial, sans-serif;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                        color: #333;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 3px solid #000;
                        padding-bottom: 20px;
                        margin-bottom: 20px;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 28px;
                        color: #000;
                    }
                    .header p {
                        margin: 5px 0;
                        color: #666;
                    }
                    .invoice-info {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 20px;
                    }
                    .info-section {
                        flex: 1;
                    }
                    .info-section h3 {
                        margin: 0 0 10px 0;
                        font-size: 14px;
                        color: #666;
                        text-transform: uppercase;
                    }
                    .info-section p {
                        margin: 5px 0;
                        font-size: 14px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                    }
                    th, td {
                        padding: 12px;
                        text-align: left;
                        border-bottom: 1px solid #ddd;
                    }
                    th {
                        background-color: #f5f5f5;
                        font-weight: bold;
                        text-transform: uppercase;
                        font-size: 12px;
                    }
                    .text-right {
                        text-align: right;
                    }
                    .totals {
                        margin-top: 20px;
                        border-top: 2px solid #000;
                        padding-top: 10px;
                    }
                    .total-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 8px 0;
                        font-size: 16px;
                    }
                    .total-row.final {
                        font-weight: bold;
                        font-size: 18px;
                        border-top: 1px solid #000;
                        padding-top: 10px;
                        margin-top: 10px;
                    }
                    .footer {
                        margin-top: 40px;
                        text-align: center;
                        border-top: 1px solid #ddd;
                        padding-top: 20px;
                        color: #666;
                        font-size: 12px;
                    }
                    .status-badge {
                        display: inline-block;
                        padding: 4px 12px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: bold;
                    }
                    .status-paid { background-color: #d4edda; color: #155724; }
                    .status-partial { background-color: #fff3cd; color: #856404; }
                    .status-unpaid { background-color: #f8d7da; color: #721c24; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>DRESSIFY CLOTHING</h1>
                    <p>Your Fashion Destination</p>
                    <p>Invoice Receipt</p>
                </div>

                <div class="invoice-info">
                    <div class="info-section">
                        <h3>Invoice Details</h3>
                        <p><strong>Invoice #:</strong> ${sale.invoiceNumber}</p>
                        <p><strong>Date:</strong> ${saleDate}</p>
                        <p><strong>Status:</strong> <span class="status-badge status-${sale.paymentStatus?.toLowerCase()}">${sale.paymentStatus || 'N/A'}</span></p>
                    </div>
                    <div class="info-section">
                        <h3>Customer Information</h3>
                        <p><strong>Name:</strong> ${customerName}</p>
                        ${customerContact ? `<p><strong>Contact:</strong> ${customerContact}</p>` : ''}
                        ${customerAddress ? `<p><strong>Address:</strong> ${customerAddress}</p>` : ''}
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Product</th>
                            <th>Size</th>
                            <th class="text-right">Qty</th>
                            <th class="text-right">Unit Price</th>
                            <th class="text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sale.items?.map((item, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${item.productName || 'N/A'}</td>
                                <td>${item.size || 'N/A'}</td>
                                <td class="text-right">${item.quantity || 0}</td>
                                <td class="text-right">Rs. ${(parseFloat(item.unitPrice) || 0).toLocaleString()}</td>
                                <td class="text-right">Rs. ${(parseFloat(item.totalPrice) || 0).toLocaleString()}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="6" class="text-center">No items</td></tr>'}
                    </tbody>
                </table>

                <div class="totals">
                    <div class="total-row">
                        <span>Subtotal:</span>
                        <span>Rs. ${(parseFloat(sale.totalAmount) || 0).toLocaleString()}</span>
                    </div>
                    <div class="total-row">
                        <span>Paid Amount:</span>
                        <span>Rs. ${(parseFloat(sale.paidAmount) || 0).toLocaleString()}</span>
                    </div>
                    ${(parseFloat(sale.remainingAmount) || 0) > 0 ? `
                    <div class="total-row">
                        <span>Remaining Amount:</span>
                        <span style="color: #dc3545; font-weight: bold;">Rs. ${(parseFloat(sale.remainingAmount) || 0).toLocaleString()}</span>
                    </div>
                    ` : ''}
                    <div class="total-row final">
                        <span>Total Amount:</span>
                        <span>Rs. ${(parseFloat(sale.totalAmount) || 0).toLocaleString()}</span>
                    </div>
                </div>

                ${sale.notes ? `
                <div style="margin-top: 20px; padding: 10px; background-color: #f5f5f5; border-radius: 4px;">
                    <strong>Notes:</strong> ${sale.notes}
                </div>
                ` : ''}

                <div class="footer">
                    <p>Thank you for your business!</p>
                    <p>For inquiries, please contact us.</p>
                    <p style="margin-top: 20px;">Generated on ${new Date().toLocaleString()}</p>
                </div>

                <script>
                    window.onload = function() {
                        // For mobile, don't auto-print
                        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                        
                        if (!isMobile) {
                            // Desktop: auto-print after a short delay
                            setTimeout(function() {
                                window.print();
                                window.onafterprint = function() {
                                    window.close();
                                };
                            }, 500);
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

        return matchesInvoice || matchesCustomerName || matchesCustomerContact || matchesShopName;
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
                            placeholder="Search by invoice, customer name, contact, or shop..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-field pl-10 w-full text-gray-900 placeholder-gray-400"
                        />
                    </div>
                    <div className="flex-1">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="input-field w-full text-gray-900"
                        >
                            <option value="">All Status</option>
                            <option value="Paid">Paid</option>
                            <option value="Partial">Partial</option>
                            <option value="Unpaid">Unpaid</option>
                        </select>
                    </div>
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
                                                        onClick={() => handlePrintReceipt(sale)}
                                                        className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                                                        title="Print Receipt"
                                                    >
                                                        <Printer className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleShareReceipt(sale)}
                                                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                        title="Share text via WhatsApp"
                                                    >
                                                        <Share2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleSharePdfWhatsApp(sale)}
                                                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                                        title="Send PDF to WhatsApp"
                                                    >
                                                        <FileText className="w-4 h-4" />
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
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                                        title="Delete Sale"
                                                    >
                                                        {deleting === (sale.id || sale._id) ? (
                                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent"></div>
                                                        ) : (
                                                            <Trash2 className="w-4 h-4" />
                                                        )}
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
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-sm font-medium text-gray-700">Customer *</label>
                                        <button
                                            type="button"
                                            onClick={() => setShowCustomerModal(true)}
                                            className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                                        >
                                            <UserPlus size={16} />
                                            Add New Customer
                                        </button>
                                    </div>
                                    <select
                                        required
                                        value={saleFormData.customer}
                                        onChange={(e) => setSaleFormData({ ...saleFormData, customer: e.target.value })}
                                        className="input-field"
                                    >
                                        <option value="">Select Customer</option>
                                        {customers.map(customer => (
                                            <option key={customer.id || customer._id} value={customer.id || customer._id}>
                                                {customer.name} {customer.shopName ? `(${customer.shopName})` : ''} {customer.contact ? `- ${customer.contact}` : ''}
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
                                            {inventory.map(item => {
                                                const addedDate = item.createdAt ? formatDate(item.createdAt) : 'N/A';
                                                return (
                                                    <option key={item.id || item._id} value={item.id || item._id}>
                                                        {item.productName} (Added: {addedDate})
                                                    </option>
                                                );
                                            })}
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
                                                        <th className="text-left py-2 px-3">Added Date</th>
                                                        <th className="text-left py-2 px-3">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {saleFormData.items.map((item, index) => (
                                                        <tr key={index} className="border-b border-gray-100">
                                                            <td className="py-2 px-3">
                                                                <div>
                                                                    <div className="font-medium">{item.productName}</div>
                                                                </div>
                                                            </td>
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
                                                            <td className="py-2 px-3 text-xs text-gray-600">
                                                                {item.productAddedDate || 'N/A'}
                                                            </td>
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
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePrintReceipt(selectedSale)}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 transition-colors"
                                        title="Print Receipt"
                                    >
                                        <Printer size={18} />
                                        Print Receipt
                                    </button>
                                    <button
                                        onClick={() => handleShareReceipt(selectedSale)}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
                                        title="Share text via WhatsApp"
                                    >
                                        <Share2 size={18} />
                                        Share WhatsApp
                                    </button>
                                    <button
                                        onClick={() => handleSharePdfWhatsApp(selectedSale)}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 transition-colors"
                                        title="Send PDF to WhatsApp"
                                    >
                                        <FileText size={18} />
                                        Send PDF to WhatsApp
                                    </button>
                                    <button
                                        onClick={() => setShowDetailsModal(false)}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        ✕
                                    </button>
                                </div>
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
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="text-left py-2">Product</th>
                                                <th className="text-left py-2">Size</th>
                                                <th className="text-left py-2">Qty</th>
                                                <th className="text-left py-2">Unit Price</th>
                                                <th className="text-left py-2">Total</th>
                                                <th className="text-left py-2">Product Added</th>
                                                <th className="text-left py-2">Sale Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedSale.items?.map((item, index) => {
                                                // Find the inventory item for this sale item
                                                const inventoryItem = inventory.find(
                                                    inv => (inv.id || inv._id) === (item.inventoryId || item.inventory)
                                                );
                                                const productAddedDate = inventoryItem?.createdAt
                                                    ? formatDate(inventoryItem.createdAt)
                                                    : 'N/A';
                                                const saleDate = selectedSale.saleDate
                                                    ? formatDate(selectedSale.saleDate)
                                                    : formatDate(selectedSale.createdAt);

                                                return (
                                                    <tr key={index} className="border-b border-gray-100">
                                                        <td className="py-2">{item.productName}</td>
                                                        <td className="py-2">{item.size}</td>
                                                        <td className="py-2">{item.quantity}</td>
                                                        <td className="py-2">Rs. {item.unitPrice?.toLocaleString()}</td>
                                                        <td className="py-2">Rs. {item.totalPrice?.toLocaleString()}</td>
                                                        <td className="py-2 text-xs text-gray-600">{productAddedDate}</td>
                                                        <td className="py-2 text-xs text-gray-600">{saleDate}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td colSpan="4" className="text-right py-2 font-semibold">Total Amount:</td>
                                                <td className="py-2 font-semibold" colSpan="3">Rs. {selectedSale.totalAmount?.toLocaleString()}</td>
                                            </tr>
                                            <tr>
                                                <td colSpan="4" className="text-right py-2">Paid Amount:</td>
                                                <td className="py-2" colSpan="3">Rs. {selectedSale.paidAmount?.toLocaleString()}</td>
                                            </tr>
                                            <tr>
                                                <td colSpan="4" className="text-right py-2 font-semibold">Remaining:</td>
                                                <td className="py-2 font-semibold" colSpan="3">Rs. {selectedSale.remainingAmount?.toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Payment History Section */}
                            <div className="border-t border-gray-200 pt-4 mt-4">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h4 className="font-semibold text-lg">Payment History</h4>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Kis Kis Din Kitne Paise Mile (All Payments for This Sale)
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={paymentHistoryFilter}
                                            onChange={(e) => setPaymentHistoryFilter(e.target.value)}
                                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="All">All Payments</option>
                                            <option value="Paid">Paid</option>
                                            <option value="Partial">Partial</option>
                                            <option value="Unpaid">Unpaid</option>
                                        </select>
                                    </div>
                                </div>

                                {(() => {
                                    const existingPayments = selectedSale.payments || [];
                                    const totalAmount = parseFloat(selectedSale.totalAmount) || 0;
                                    const paidAmount = parseFloat(selectedSale.paidAmount) || 0;
                                    const remainingAmount = parseFloat(selectedSale.remainingAmount) || 0;

                                    // Filter payments based on selected filter
                                    let filteredPayments = [...existingPayments];

                                    if (paymentHistoryFilter === 'Paid') {
                                        // Show only if sale is fully paid
                                        if (remainingAmount === 0 && paidAmount > 0) {
                                            filteredPayments = existingPayments;
                                        } else {
                                            filteredPayments = [];
                                        }
                                    } else if (paymentHistoryFilter === 'Partial') {
                                        // Show only if sale is partially paid
                                        if (remainingAmount > 0 && paidAmount > 0) {
                                            filteredPayments = existingPayments;
                                        } else {
                                            filteredPayments = [];
                                        }
                                    } else if (paymentHistoryFilter === 'Unpaid') {
                                        // Show only if sale is unpaid
                                        if (paidAmount === 0) {
                                            filteredPayments = [];
                                        } else {
                                            filteredPayments = [];
                                        }
                                    }

                                    // Sort payments by date (latest first)
                                    filteredPayments.sort((a, b) => {
                                        const dateA = a.date?.toDate ? a.date.toDate() : (a.date ? new Date(a.date) : new Date(0));
                                        const dateB = b.date?.toDate ? b.date.toDate() : (b.date ? new Date(b.date) : new Date(0));
                                        return dateB - dateA;
                                    });

                                    const totalFromPayments = existingPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

                                    if (paymentHistoryFilter === 'Unpaid' && paidAmount === 0) {
                                        return (
                                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-red-600 font-semibold">⚠️ Unpaid Sale</span>
                                                </div>
                                                <p className="text-sm text-red-700 mt-2">
                                                    No payments received yet. Total amount: Rs. {totalAmount.toLocaleString()}
                                                </p>
                                            </div>
                                        );
                                    }

                                    if (filteredPayments.length === 0 && paymentHistoryFilter !== 'All') {
                                        return (
                                            <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
                                                <p>No payments found for this status.</p>
                                            </div>
                                        );
                                    }

                                    if (existingPayments.length === 0) {
                                        return (
                                            <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
                                                <p>No payment history found. Payments will be recorded when you add them.</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="space-y-4">
                                            {/* Payment Summary Info */}
                                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                                <div className="flex items-center justify-between flex-wrap gap-2">
                                                    <div>
                                                        <p className="text-sm font-semibold text-indigo-900 mb-1">
                                                            📋 Payment Summary
                                                        </p>
                                                        <p className="text-xs text-indigo-700">
                                                            Total <span className="font-bold">{existingPayments.length}</span> payment{existingPayments.length !== 1 ? 's' : ''} received
                                                            {existingPayments.length > 0 && (
                                                                <>
                                                                    {' • '}
                                                                    <span className="font-semibold">Rs. {totalFromPayments.toLocaleString()}</span> total received
                                                                </>
                                                            )}
                                                        </p>
                                                    </div>
                                                    {existingPayments.length > 0 && (
                                                        <div className="text-xs text-indigo-700">
                                                            <span className="font-semibold">Status:</span>{' '}
                                                            {remainingAmount === 0 && paidAmount > 0 ? (
                                                                <span className="text-green-700 font-bold">✅ Fully Paid</span>
                                                            ) : remainingAmount > 0 && paidAmount > 0 ? (
                                                                <span className="text-yellow-700 font-bold">⚠️ Partial (Rs. {remainingAmount.toLocaleString()} remaining)</span>
                                                            ) : (
                                                                <span className="text-red-700 font-bold">❌ Unpaid</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Payment Status Summary */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-3 rounded-lg border border-green-200">
                                                    <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                                                    <p className="text-lg font-bold text-green-700">
                                                        Rs. {totalAmount.toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-200">
                                                    <p className="text-xs text-gray-600 mb-1">Paid Amount</p>
                                                    <p className="text-lg font-bold text-blue-700">
                                                        Rs. {paidAmount.toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className={`p-3 rounded-lg border ${remainingAmount > 0
                                                    ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200'
                                                    : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200'
                                                    }`}>
                                                    <p className="text-xs text-gray-600 mb-1">Remaining</p>
                                                    <p className={`text-lg font-bold ${remainingAmount > 0 ? 'text-yellow-700' : 'text-gray-700'
                                                        }`}>
                                                        Rs. {remainingAmount.toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Payment Status Badge and Count */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-gray-600">Payment Status:</span>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${remainingAmount === 0 && paidAmount > 0
                                                        ? 'bg-green-100 text-green-800'
                                                        : remainingAmount > 0 && paidAmount > 0
                                                            ? 'bg-yellow-100 text-yellow-800'
                                                            : 'bg-red-100 text-red-800'
                                                        }`}>
                                                        {remainingAmount === 0 && paidAmount > 0 ? '✅ Paid' :
                                                            remainingAmount > 0 && paidAmount > 0 ? '⚠️ Partial' :
                                                                '❌ Unpaid'}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    <span className="font-semibold text-gray-800">Total Payments:</span> {existingPayments.length} payment{existingPayments.length !== 1 ? 's' : ''}
                                                </div>
                                            </div>

                                            {/* Payments Table */}
                                            <div className="bg-gray-50 rounded-lg p-4">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="border-b border-gray-300">
                                                                <th className="text-left py-2 px-2 font-semibold text-gray-700">#</th>
                                                                <th className="text-left py-2 px-2 font-semibold text-gray-700">Date & Time</th>
                                                                <th className="text-left py-2 px-2 font-semibold text-gray-700">Amount</th>
                                                                <th className="text-left py-2 px-2 font-semibold text-gray-700">Method</th>
                                                                <th className="text-left py-2 px-2 font-semibold text-gray-700">Notes</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(paymentHistoryFilter === 'All' ? existingPayments : filteredPayments)
                                                                .sort((a, b) => {
                                                                    const dateA = a.date?.toDate ? a.date.toDate() : (a.date ? new Date(a.date) : new Date(0));
                                                                    const dateB = b.date?.toDate ? b.date.toDate() : (b.date ? new Date(b.date) : new Date(0));
                                                                    return dateB - dateA;
                                                                })
                                                                .map((payment, index) => {
                                                                    // Handle Firestore Timestamp format
                                                                    let paymentDate;
                                                                    if (payment.date?.toDate) {
                                                                        // Firestore Timestamp object
                                                                        paymentDate = payment.date.toDate();
                                                                    } else if (payment.date?.seconds) {
                                                                        // Firestore Timestamp with seconds
                                                                        paymentDate = new Date(payment.date.seconds * 1000);
                                                                    } else if (payment.date instanceof Date) {
                                                                        paymentDate = payment.date;
                                                                    } else if (payment.date) {
                                                                        paymentDate = new Date(payment.date);
                                                                    } else {
                                                                        paymentDate = new Date();
                                                                    }

                                                                    const formattedDate = formatDate(paymentDate);
                                                                    const formattedTime = paymentDate.toLocaleTimeString('en-US', {
                                                                        hour: '2-digit',
                                                                        minute: '2-digit',
                                                                        hour12: true
                                                                    });
                                                                    const paymentAmount = parseFloat(payment.amount) || 0;

                                                                    return (
                                                                        <tr key={index} className="border-b border-gray-200 hover:bg-white transition-colors">
                                                                            <td className="py-3 px-3 text-gray-600 font-medium">{index + 1}</td>
                                                                            <td className="py-3 px-3">
                                                                                <div className="font-semibold text-gray-900">{formattedDate}</div>
                                                                                <div className="text-xs text-gray-500 mt-1">{formattedTime}</div>
                                                                            </td>
                                                                            <td className="py-3 px-3">
                                                                                <span className="font-bold text-green-600 text-base">
                                                                                    Rs. {paymentAmount.toLocaleString()}
                                                                                </span>
                                                                            </td>
                                                                            <td className="py-3 px-3">
                                                                                <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-medium">
                                                                                    {payment.paymentMethod || 'Cash'}
                                                                                </span>
                                                                            </td>
                                                                            <td className="py-3 px-3 text-gray-600 text-xs">
                                                                                {payment.notes || <span className="text-gray-400">-</span>}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                        </tbody>
                                                        <tfoot className="bg-gradient-to-r from-gray-50 to-gray-100 border-t-2 border-gray-300">
                                                            <tr>
                                                                <td colSpan="2" className="py-3 px-3 font-bold text-gray-900 text-base">
                                                                    Total Payments ({existingPayments.length} payment{existingPayments.length !== 1 ? 's' : ''}):
                                                                </td>
                                                                <td className="py-3 px-3 font-bold text-green-600 text-lg">
                                                                    Rs. {totalFromPayments.toLocaleString()}
                                                                </td>
                                                                <td colSpan="2" className="py-3 px-3"></td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Payment Mismatch Warning */}
                                            {Math.abs(totalFromPayments - paidAmount) > 0.01 && (
                                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-sm font-medium text-yellow-800">
                                                                ⚠️ Payment History Mismatch
                                                            </p>
                                                            <p className="text-xs text-yellow-700 mt-1">
                                                                Recorded paid amount (Rs. {paidAmount.toLocaleString()}) doesn't match payment history total (Rs. {totalFromPayments.toLocaleString()})
                                                            </p>
                                                        </div>
                                                        <button
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
                                                                        if (updatedSale) {
                                                                            setSelectedSale(updatedSale);
                                                                        }
                                                                    } catch (error) {
                                                                        showError(error.message || 'Error fixing payment history');
                                                                    } finally {
                                                                        setSaving(false);
                                                                    }
                                                                }
                                                            }}
                                                            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium"
                                                            disabled={saving}
                                                        >
                                                            Fix History
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
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

            {/* Add Customer Modal */}
            {showCustomerModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
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
