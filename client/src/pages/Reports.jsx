import React, { useState, useEffect } from 'react';
import { Download, Calendar, TrendingUp, DollarSign, Package, TrendingDown, ArrowUp, ArrowDown, CreditCard, AlertCircle, Receipt, X, ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getSalesStats, getInventoryStats, getDashboardStats, getMonthlyProfitLoss, getSales, getInventory, getOnlineSalesStats, getCustomers, getPayments, getExpenses } from '../services/api';
import { showInfo, showSuccess, showError } from '../utils/toast';
import { downloadAccountantReport, findEarliestActivityDate } from '../utils/accountantReport';

const formatDisplayName = (name) => {
  if (!name || typeof name !== 'string') return name || '';
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

const formatSignedMoney = (n) => {
  const v = parseFloat(n) || 0;
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}Rs. ${Math.abs(v).toLocaleString()}`;
};

const Reports = () => {
  const [stats, setStats] = useState(null);
  const [salesStats, setSalesStats] = useState(null);
  const [inventoryStats, setInventoryStats] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [outstandingCredits, setOutstandingCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalProfit, setTotalProfit] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showSalesDetailModal, setShowSalesDetailModal] = useState(false);
  const [monthlySalesDetail, setMonthlySalesDetail] = useState([]);
  const [loadingSalesDetail, setLoadingSalesDetail] = useState(false);
  const [showProfitDetailModal, setShowProfitDetailModal] = useState(false);
  const [profitBreakdown, setProfitBreakdown] = useState(null);
  const [expandedProfitProduct, setExpandedProfitProduct] = useState(null);
  const [showStockDetailModal, setShowStockDetailModal] = useState(false);
  const [stockDetails, setStockDetails] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [paymentsList, setPaymentsList] = useState([]);
  const [salesForPayments, setSalesForPayments] = useState([]);
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState(null);
  const [expenseTotals, setExpenseTotals] = useState({
    general: 0,
    product: 0,
    total: 0
  });
  const [exportingAccountant, setExportingAccountant] = useState(false);
  const [monthDetailType, setMonthDetailType] = useState(null); // paid | sold | recovery | stock | expenses | profit
  const [partnerSharePct, setPartnerSharePct] = useState('0');
  const [showPaymentBreakdown, setShowPaymentBreakdown] = useState(false);

  // Load data once on mount; refetch only when user clicks Apply
  useEffect(() => {
    fetchStats();
    fetchOutstandingCredits();
    fetchPaymentsReport();
  }, []);

  const toDateValue = (val) => {
    if (val == null) return null;
    if (val instanceof Date) return val;
    if (val?.toDate && typeof val.toDate === 'function') return val.toDate();
    if (val?.seconds != null) return new Date(val.seconds * 1000);
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const isProductExpense = (expense) =>
    !!(expense.inventoryId) ||
    expense.expenseScope === 'product';

  const fetchPaymentsReport = async () => {
    try {
      const [paymentsRes, salesRes, expensesRes] = await Promise.all([
        getPayments({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
        getSales(),
        getExpenses({ startDate: dateRange.startDate, endDate: dateRange.endDate })
      ]);
      const fromCollection = paymentsRes.data || [];
      const sales = salesRes.data || [];
      const expenses = expensesRes.data || [];
      const existingSaleIds = new Set(sales.map((s) => s.id || s._id).filter(Boolean));

      const start = dateRange.startDate ? new Date(dateRange.startDate + 'T00:00:00') : null;
      const end = dateRange.endDate ? new Date(dateRange.endDate + 'T23:59:59.999') : null;

      const toDate = toDateValue;

      const inRange = (dateObj) => {
        if (!dateObj || isNaN(dateObj.getTime())) return false;
        if (start && dateObj < start) return false;
        if (end && dateObj > end) return false;
        return true;
      };

      // Expenses already filtered by API date range; still guard client-side
      let generalExpense = 0;
      let productExpense = 0;
      expenses.forEach((expense) => {
        const expenseDate = toDate(expense.expenseDate);
        if (!inRange(expenseDate)) return;
        const amount = parseFloat(expense.amount) || 0;
        if (isProductExpense(expense)) {
          productExpense += amount;
        } else {
          generalExpense += amount;
        }
      });
      setExpenseTotals({
        general: Math.round(generalExpense),
        product: Math.round(productExpense),
        total: Math.round(generalExpense + productExpense)
      });

      // Drop orphan payments whose sale was deleted (older deletes left payment docs behind)
      const validFromCollection = fromCollection.filter((p) => {
        if (!p.saleId) return true;
        return existingSaleIds.has(p.saleId);
      });

      const collectionKeys = new Set(
        validFromCollection.map(p => {
          const d = p.paymentDate;
          const dateObj = d instanceof Date ? d : toDate(d);
          const key = dateObj ? dateObj.toISOString().split('T')[0] : '';
          return `${p.saleId || ''}_${p.amount}_${key}`;
        })
      );

      const fromSales = [];
      sales.forEach(sale => {
        const saleId = sale.id || sale._id;
        const invoiceNumber = sale.invoiceNumber || '';
        const customerName = (sale.customer?.name || '').trim();
        (sale.payments || []).forEach((p, index) => {
          const paymentDate = toDate(p.date);
          if (!inRange(paymentDate)) return;
          const amount = parseFloat(p.amount) || 0;
          const dateKey = paymentDate ? paymentDate.toISOString().split('T')[0] : '';
          const dedupeKey = `${saleId}_${amount}_${dateKey}`;
          if (collectionKeys.has(dedupeKey)) return;
          fromSales.push({
            id: `sale-${saleId}-${index}`,
            _id: `sale-${saleId}-${index}`,
            saleId,
            invoiceNumber,
            customerName,
            amount,
            paymentDate,
            paymentType: p.paymentType || (index === 0 ? 'Initial Sale' : 'Recovery'),
            paymentMethod: p.paymentMethod || 'Cash',
            notes: p.notes || '',
            addedBy: p.addedBy || (index === 0 && p.paymentType === 'Initial Sale' ? sale.addedBy : p.addedBy) || '',
            editedBy: p.editedBy || ''
          });
        });
      });

      const merged = [...validFromCollection, ...fromSales].sort((a, b) => {
        const da = a.paymentDate instanceof Date ? a.paymentDate : toDate(a.paymentDate);
        const db = b.paymentDate instanceof Date ? b.paymentDate : toDate(b.paymentDate);
        if (!da || !db) return 0;
        return db.getTime() - da.getTime();
      });

      const saleAddedByMap = Object.fromEntries(
        sales.map(s => [s.id || s._id, s.addedBy || ''])
      );
      const enriched = merged.map(p => ({
        ...p,
        saleAddedBy: saleAddedByMap[p.saleId] || ''
      }));
      setPaymentsList(enriched);
      setSalesForPayments(sales);
    } catch (error) {
      console.error('Error fetching payments:', error);
      setPaymentsList([]);
      setSalesForPayments([]);
      setExpenseTotals({ general: 0, product: 0, total: 0 });
    }
  };

  const openPaymentDetail = (payment) => {
    const sale = salesForPayments.find(s => (s.id || s._id) === payment.saleId) || null;
    setSelectedPaymentDetail({ payment, sale });
  };

  const getPaymentProductShares = (payment, sale) => {
    const items = sale?.items || [];
    if (!items.length) return [];

    const getLineTotal = (item) =>
      parseFloat(item.totalPrice) ||
      ((parseFloat(item.unitPrice) || 0) * (parseFloat(item.quantity) || 0));

    const saleTotal =
      parseFloat(sale.totalAmount) ||
      items.reduce((sum, line) => sum + getLineTotal(line), 0) ||
      0;
    const paymentAmount = parseFloat(payment.amount) || 0;

    return items.map((item) => {
      const lineTotal = getLineTotal(item);
      const share = saleTotal > 0 ? lineTotal / saleTotal : 0;
      return {
        productName: item.productName || 'N/A',
        size: item.size || '—',
        quantity: parseFloat(item.quantity) || 0,
        unitPrice: parseFloat(item.unitPrice) || 0,
        lineTotal: Math.round(lineTotal),
        paymentShare: Math.round(paymentAmount * share)
      };
    });
  };

  useEffect(() => {
    fetchMonthlyData();
  }, [selectedMonth, selectedYear]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [dashRes, salesRes, invRes, salesDataRes, inventoryDataRes] = await Promise.all([
        getDashboardStats(),
        getSalesStats(dateRange),
        getInventoryStats(),
        getSales(),
        getInventory()
      ]);
      setStats(dashRes.data);
      setSalesStats(salesRes.data);
      setInventoryStats(invRes.data);

      // Realized profit (same as Inventory): Paid − (sold qty × cost). Unsold stock is capital.
      const sales = salesDataRes.data || [];
      const inventory = inventoryDataRes.data || [];

      // Prepare stock details for modal
      const stockDetailsData = inventory.map(item => {
        const sizes = item.sizes || [];
        const totalQty = sizes.reduce((sum, size) => sum + (parseFloat(size.quantity) || 0), 0);
        const costPerUnit = parseFloat(item.costPerUnit || 0);
        const stockValue = totalQty * costPerUnit;

        return {
          productName: item.productName,
          brand: item.brand?.name || 'N/A',
          category: item.category?.name || 'N/A',
          sizes: sizes.map(s => ({ size: s.size, quantity: s.quantity })),
          totalQty: totalQty,
          costPerUnit: costPerUnit,
          stockValue: stockValue
        };
      }).filter(item => item.totalQty > 0) // Only show products with stock
        .sort((a, b) => b.stockValue - a.stockValue); // Sort by stock value (highest first)

      setStockDetails(stockDetailsData);

      // Get online sales stats
      let onlineSalesMap = {};
      try {
        const onlineSalesRes = await getOnlineSalesStats();
        if (onlineSalesRes.data?.productSales) {
          onlineSalesRes.data.productSales.forEach(product => {
            const key = `${product.productName}_${product.size || 'N/A'}`;
            if (!onlineSalesMap[key]) {
              onlineSalesMap[key] = { totalRevenue: 0, totalQuantity: 0 };
            }
            onlineSalesMap[key].totalRevenue += product.totalRevenue || 0;
            onlineSalesMap[key].totalQuantity += product.totalQuantity || 0;
          });
        }
      } catch (error) {
        // Online sales not available, continue without it
      }

      let totalBilled = 0;
      let totalPaidReceived = 0;
      let totalRemainingDue = 0;
      let totalStockValue = 0;
      const profitBreakdownData = {
        totalRevenue: 0, // billed (for reference)
        totalPaid: 0,
        totalRemaining: 0,
        totalCost: 0,
        totalProfit: 0, // paid − sold cost (realized)
        productDetails: []
      };

      const getLineTotal = (item) =>
        parseFloat(item.totalPrice) ||
        ((parseFloat(item.unitPrice) || 0) * (parseFloat(item.quantity) || 0));

      const findInventoryItem = (item) => {
        const inventoryItemId = item.inventoryId || item.inventory;
        return inventory.find(inv => {
          if (inventoryItemId && (inv.id === inventoryItemId || inv._id === inventoryItemId)) {
            return true;
          }
          return inv.productName === item.productName &&
            inv.sizes?.some(s => s.size === item.size);
        });
      };

      const productProfitMap = {};

      const ensureProductEntry = (inventoryItem) => {
        const itemId = inventoryItem.id || inventoryItem._id;
        if (productProfitMap[itemId]) return productProfitMap[itemId];

        const sizes = inventoryItem.sizes || [];
        const currentQty = sizes.reduce((sum, size) => sum + (parseFloat(size.quantity) || 0), 0);
        let soldQty = 0;
        sales.forEach(s => {
          s.items?.forEach(i => {
            const invId = i.inventoryId || i.inventory;
            if (invId === itemId) soldQty += parseFloat(i.quantity || 0);
          });
        });
        const initialQty = inventoryItem.initialQuantity || (currentQty + soldQty);
        const costPerUnit = parseFloat(inventoryItem.costPerUnit || 0);

        productProfitMap[itemId] = {
          productName: inventoryItem.productName,
          size: inventoryItem.sizes?.[0]?.size || 'N/A',
          initialQty,
          soldQty: 0,
          costPerUnit,
          stockValue: initialQty * costPerUnit,
          offlineRevenue: 0,
          onlineRevenue: 0,
          totalRevenue: 0,
          paidAmount: 0,
          remainingAmount: 0,
          totalProfit: 0,
          customersRemaining: {}
        };
        return productProfitMap[itemId];
      };

      // Offline sales: allocate paid/remaining by line share (only lines matched to inventory —
      // same scope as Inventory realized profit, so paid aur cost dono same products pe)
      sales.forEach(sale => {
        const items = sale.items || [];
        if (!items.length) return;

        const saleTotal =
          parseFloat(sale.totalAmount) ||
          items.reduce((sum, line) => sum + getLineTotal(line), 0) ||
          0;
        const salePaid = parseFloat(sale.paidAmount) || 0;
        const saleRemaining =
          parseFloat(sale.remainingAmount) >= 0
            ? parseFloat(sale.remainingAmount)
            : Math.max(0, saleTotal - salePaid);

        const customerName = sale.customer?.name || sale.customerName || 'Unknown Customer';
        const customerContact = sale.customer?.contact || '';
        const invoiceNumber = sale.invoiceNumber || '';

        items.forEach(item => {
          const inventoryItem = findInventoryItem(item);
          if (!inventoryItem) return;

          const lineTotal = getLineTotal(item);
          const qty = parseFloat(item.quantity) || 0;
          const share = saleTotal > 0 ? lineTotal / saleTotal : 0;
          const linePaid = salePaid * share;
          const lineRemaining = saleRemaining * share;

          totalBilled += lineTotal;
          totalPaidReceived += linePaid;
          totalRemainingDue += lineRemaining;

          const entry = ensureProductEntry(inventoryItem);
          entry.soldQty += qty;
          entry.offlineRevenue += lineTotal;
          entry.paidAmount += linePaid;
          entry.remainingAmount += lineRemaining;

          if (lineRemaining > 0.5) {
            const key = `${customerName}|${customerContact}|${invoiceNumber}`;
            if (!entry.customersRemaining[key]) {
              entry.customersRemaining[key] = {
                customerName,
                contact: customerContact,
                invoiceNumber,
                remainingAmount: 0,
                billedAmount: 0,
                paidAmount: 0
              };
            }
            entry.customersRemaining[key].remainingAmount += lineRemaining;
            entry.customersRemaining[key].billedAmount += lineTotal;
            entry.customersRemaining[key].paidAmount += linePaid;
          }
        });
      });

      // Online revenue treated as fully paid (already received)
      inventory.forEach(item => {
        const productKey = `${item.productName}_${item.sizes?.[0]?.size || 'N/A'}`;
        const onlineData = onlineSalesMap[productKey];

        if (onlineData && onlineData.totalRevenue > 0) {
          const entry = ensureProductEntry(item);
          entry.onlineRevenue += onlineData.totalRevenue;
          entry.paidAmount += onlineData.totalRevenue;
          entry.soldQty += parseFloat(onlineData.totalQuantity) || 0;
          totalBilled += onlineData.totalRevenue;
          totalPaidReceived += onlineData.totalRevenue;
        }
      });

      let totalSoldCost = 0;
      let totalProductProfit = 0;
      Object.values(productProfitMap).forEach(product => {
        product.totalRevenue = product.offlineRevenue + product.onlineRevenue;
        product.paidAmount = Math.round(product.paidAmount);
        product.remainingAmount = Math.round(product.remainingAmount);
        product.offlineRevenue = Math.round(product.offlineRevenue);
        product.onlineRevenue = Math.round(product.onlineRevenue);
        product.totalRevenue = Math.round(product.totalRevenue);
        // Same as Inventory: realized = Paid − (sold qty × cost). Unsold stock is capital, not loss.
        product.soldCost = Math.round(product.soldQty * product.costPerUnit);
        product.unsoldQty = Math.max(0, (product.initialQty || 0) - (product.soldQty || 0));
        product.unsoldStockValue = Math.round(product.unsoldQty * product.costPerUnit);
        product.totalProfit = Math.round(product.paidAmount - product.soldCost);
        product.customersRemainingList = Object.values(product.customersRemaining)
          .map(c => ({
            ...c,
            remainingAmount: Math.round(c.remainingAmount),
            billedAmount: Math.round(c.billedAmount),
            paidAmount: Math.round(c.paidAmount)
          }))
          .sort((a, b) => b.remainingAmount - a.remainingAmount);
        delete product.customersRemaining;
        totalStockValue += product.stockValue;
        totalSoldCost += product.soldCost;
        totalProductProfit += product.totalProfit;
      });

      const roundedPaid = Math.round(totalPaidReceived);
      const roundedRemaining = Math.round(totalRemainingDue);
      const roundedBilled = Math.round(totalBilled);
      // Sum of product profits (= paid − sold cost) — matches Inventory + modal rows
      const calculatedTotalProfit = totalProductProfit;
      setTotalProfit(calculatedTotalProfit);

      profitBreakdownData.totalRevenue = roundedBilled;
      profitBreakdownData.totalPaid = roundedPaid;
      profitBreakdownData.totalRemaining = roundedRemaining;
      profitBreakdownData.totalCost = totalSoldCost;
      profitBreakdownData.totalStockCapital = Math.round(totalStockValue);
      profitBreakdownData.totalProfit = calculatedTotalProfit;
      profitBreakdownData.productDetails = Object.values(productProfitMap)
        .filter(p => p.totalRevenue > 0 || p.paidAmount > 0 || p.remainingAmount > 0 || p.soldQty > 0)
        .sort((a, b) => b.remainingAmount - a.remainingAmount || b.totalProfit - a.totalProfit);

      setProfitBreakdown(profitBreakdownData);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyData = async () => {
    try {
      setLoadingMonthly(true);
      const response = await getMonthlyProfitLoss(selectedYear, selectedMonth);
      setMonthlyData(response.data);
    } catch (error) {
      console.error('Error fetching monthly data:', error);
      setMonthlyData(null);
    } finally {
      setLoadingMonthly(false);
    }
  };

  const fetchMonthlySalesDetail = async () => {
    try {
      setLoadingSalesDetail(true);
      const salesRes = await getSales();
      const allSales = salesRes.data || [];

      // Filter sales for selected month and year
      const filteredSales = allSales.filter(sale => {
        const saleDate = sale.saleDate?.toDate ? sale.saleDate.toDate() : new Date(sale.saleDate || sale.createdAt);
        return saleDate.getMonth() + 1 === selectedMonth && saleDate.getFullYear() === selectedYear;
      });

      setMonthlySalesDetail(filteredSales);
      setShowSalesDetailModal(true);
    } catch (error) {
      console.error('Error fetching monthly sales detail:', error);
    } finally {
      setLoadingSalesDetail(false);
    }
  };

  const fetchOutstandingCredits = async () => {
    try {
      const [salesRes, customersRes] = await Promise.all([
        getSales(),
        getCustomers()
      ]);
      const allSales = salesRes.data;
      const customers = customersRes.data || [];

      // Create a customer map for quick lookup
      const customerMap = {};
      customers.forEach(customer => {
        customerMap[customer.id || customer._id] = customer;
      });

      // Filter sales with outstanding credit (remainingAmount > 0)
      const outstanding = allSales
        .filter(sale => (sale.remainingAmount || 0) > 0)
        .map(sale => {
          // Attach customer details to sale
          const customerId = sale.customerId || sale.customer?.id || sale.customer?._id;
          const customer = customerId ? customerMap[customerId] : null;
          return {
            ...sale,
            customerDetails: customer || sale.customer || null
          };
        })
        .sort((a, b) => {
          // Sort by remaining amount (highest first), then by date (oldest first)
          if (b.remainingAmount !== a.remainingAmount) {
            return (b.remainingAmount || 0) - (a.remainingAmount || 0);
          }
          const dateA = a.saleDate?.toDate ? a.saleDate.toDate() : new Date(a.saleDate);
          const dateB = b.saleDate?.toDate ? b.saleDate.toDate() : new Date(b.saleDate);
          return dateA - dateB;
        });

      setOutstandingCredits(outstanding);
    } catch (error) {
      console.error('Error fetching outstanding credits:', error);
    }
  };

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
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleExport = async () => {
    setExportingAccountant(true);
    try {
      const [salesRes, paymentsRes, expensesRes, inventoryRes] = await Promise.all([
        getSales(),
        getPayments({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
        getExpenses({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
        getInventory()
      ]);

      // Merge payments like the on-screen report (collection + sale-embedded), drop orphans
      const sales = salesRes.data || [];
      const existingSaleIds = new Set(sales.map((s) => s.id || s._id).filter(Boolean));
      const fromCollection = (paymentsRes.data || []).filter(
        (p) => !p.saleId || existingSaleIds.has(p.saleId)
      );
      const start = dateRange.startDate ? new Date(dateRange.startDate + 'T00:00:00') : null;
      const end = dateRange.endDate ? new Date(dateRange.endDate + 'T23:59:59.999') : null;
      const collectionKeys = new Set(
        fromCollection.map((p) => {
          const d = toDateValue(p.paymentDate);
          const key = d ? d.toISOString().split('T')[0] : '';
          return `${p.saleId || ''}_${p.amount}_${key}`;
        })
      );
      const fromSales = [];
      sales.forEach((sale) => {
        const saleId = sale.id || sale._id;
        (sale.payments || []).forEach((p, index) => {
          const paymentDate = toDateValue(p.date);
          if (!paymentDate) return;
          if (start && paymentDate < start) return;
          if (end && paymentDate > end) return;
          const amount = parseFloat(p.amount) || 0;
          const dateKey = paymentDate.toISOString().split('T')[0];
          const dedupeKey = `${saleId}_${amount}_${dateKey}`;
          if (collectionKeys.has(dedupeKey)) return;
          fromSales.push({
            saleId,
            invoiceNumber: sale.invoiceNumber || '',
            customerName: (sale.customer?.name || '').trim(),
            amount,
            paymentDate,
            paymentType: p.paymentType || (index === 0 ? 'Initial Sale' : 'Recovery'),
            paymentMethod: p.paymentMethod || 'Cash',
            addedBy: p.addedBy || ''
          });
        });
      });

      const result = downloadAccountantReport({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        sales,
        payments: [...fromCollection, ...fromSales],
        expenses: expensesRes.data || [],
        inventory: inventoryRes.data || []
      });

      showSuccess(
        `PDF ready. Est. net profit: Rs. ${Math.round(result.summary.estimatedNetProfit || 0).toLocaleString()}`
      );
    } catch (error) {
      console.error(error);
      showError(error.message || 'Failed to generate accountant report');
    } finally {
      setExportingAccountant(false);
    }
  };

  const handleSetFullHistoryRange = async () => {
    try {
      showInfo('Finding earliest activity…');
      const [salesRes, paymentsRes, expensesRes] = await Promise.all([
        getSales(),
        getPayments({}),
        getExpenses({})
      ]);
      const earliest = findEarliestActivityDate({
        sales: salesRes.data || [],
        payments: paymentsRes.data || [],
        expenses: expensesRes.data || []
      });
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = earliest || '2024-01-01';
      setDateRange({ startDate, endDate });
      showSuccess(`Range set: ${startDate} → ${endDate}. Click Apply, then Export.`);
    } catch (error) {
      showError(error.message || 'Could not detect start date');
    }
  };

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const salesData = stats?.salesByDate?.map(item => ({
    date: new Date(item._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sales: item.totalSales,
    transactions: item.count
  })) || [];

  const topProductsData = stats?.topProducts?.map(item => ({
    name: item._id.length > 20 ? item._id.substring(0, 20) + '...' : item._id,
    revenue: item.totalRevenue
  })) || [];

  const paymentDistribution = [
    { name: 'Cash Received', value: salesStats?.cashReceived || 0 },
    { name: 'Credit Given', value: salesStats?.creditGiven || 0 }
  ];

  // Payment report aggregates (from payments collection: initial + recovery)
  const getPaymentDateKey = (p) => {
    const d = p.paymentDate;
    const date = d instanceof Date ? d : (d?.toDate ? d.toDate() : new Date(d));
    return date.toISOString().split('T')[0];
  };
  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const paymentsToday = paymentsList
    .filter(p => getPaymentDateKey(p) === todayStr)
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const paymentsThisMonth = paymentsList
    .filter(p => {
      const d = p.paymentDate;
      const date = d instanceof Date ? d : (d?.toDate ? d.toDate() : new Date(d));
      return date >= monthStart;
    })
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const paymentsByDateMap = {};
  paymentsList.forEach(p => {
    const key = getPaymentDateKey(p);
    if (!paymentsByDateMap[key]) paymentsByDateMap[key] = { total: 0, count: 0 };
    paymentsByDateMap[key].total += parseFloat(p.amount) || 0;
    paymentsByDateMap[key].count += 1;
  });
  const paymentsByDateData = Object.entries(paymentsByDateMap)
    .map(([date, v]) => ({ date: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), total: v.total, count: v.count, _sortKey: date }))
    .sort((a, b) => b._sortKey.localeCompare(a._sortKey))
    .slice(0, 31);
  const paymentsInRange = paymentsList.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  // Product expense is recovered via customer payments — only general expense counts here
  const netAfterExpenses = paymentsInRange - expenseTotals.general;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Reports & Analytics</h2>
          <p className="text-gray-600 mt-1">Comprehensive business insights and reports</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exportingAccountant}
          className="btn-primary flex items-center gap-2 disabled:opacity-60"
        >
          <Download size={20} />
          {exportingAccountant ? 'Preparing PDF…' : 'Export Accountant PDF'}
        </button>
      </div>

      {/* Accountant pack helper */}
      <div className="card border border-neutral-200 bg-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-ink">Accountant report pack</h3>
            <p className="text-sm text-neutral-500 mt-1 max-w-2xl">
              Simple PDF: kitna paisa aaya, maal ki cost, kharcha, aur <strong>andaza net profit</strong>.
              Tax amount is mein nahi — woh accountant batayega. From/To dates use hoti hain.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSetFullHistoryRange}
              className="btn-secondary text-sm min-h-[40px]"
            >
              Set From = business start
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exportingAccountant}
              className="btn-primary text-sm min-h-[40px] flex items-center gap-2 disabled:opacity-60"
            >
              <Download size={16} />
              {exportingAccountant ? 'Generating…' : 'Download PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <Calendar className="text-gray-400 hidden sm:block mb-2" size={20} />
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="input-field"
              />
            </div>
            <button
              onClick={() => { fetchStats(); fetchOutstandingCredits(); fetchPaymentsReport(); }}
              className="btn-primary"
            >
              Apply
            </button>
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-3">
          Tip: click <em>Set From = business start</em>, then <em>Apply</em>, then download PDF to see everything from first sale/expense until today.
        </p>
      </div>

      {/* Payment Received (Initial + Recovery) */}
      <div className="card border-2 border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <DollarSign size={22} className="text-emerald-600" />
          Payment Received
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Money received vs <strong>general expenses</strong> in the selected date range.
          Product expenses are not counted here — they are treated as recovered through customer payments.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="bg-white rounded-lg p-4 border border-emerald-100 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Today</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">Rs. {paymentsToday.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-emerald-100 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">This Month</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">Rs. {paymentsThisMonth.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-emerald-100 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Payment In Range</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              Rs. {paymentsInRange.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-emerald-100 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Transactions</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{paymentsList.length}</p>
          </div>
        </div>

        {/* Only general expense vs received (product expense excluded — recovered via payments) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border border-amber-200 shadow-sm">
            <p className="text-xs font-medium text-amber-700/80 uppercase tracking-wide flex items-center gap-1.5">
              <Receipt size={14} />
              General Expense
            </p>
            <p className="text-2xl font-bold text-amber-800 mt-1">
              Rs. {expenseTotals.general.toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">Main shop / daily expenses only</p>
          </div>
          <div className={`rounded-lg p-4 border shadow-sm ${netAfterExpenses >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Net (Received − General Expense)</p>
            <p className={`text-2xl font-bold mt-1 ${netAfterExpenses >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              Rs. {netAfterExpenses.toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              Received Rs. {paymentsInRange.toLocaleString()} − General Rs. {expenseTotals.general.toLocaleString()}
            </p>
          </div>
        </div>
        {paymentsByDateData.length > 0 && (
          <div className="mb-6">
            <h4 className="font-medium text-gray-700 mb-3">Daily payment totals</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={paymentsByDateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '11px' }} />
                <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                <Tooltip formatter={(value) => [`Rs. ${Number(value).toLocaleString()}`, 'Received']} />
                <Bar dataKey="total" fill="#10b981" name="Received (Rs.)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="rounded-xl border border-neutral-200/90 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPaymentBreakdown((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-neutral-50/80 transition-colors"
            aria-expanded={showPaymentBreakdown}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">Payment breakdown by invoice</p>
              <p className="text-xs text-ink-muted mt-0.5">
                {paymentsList.length} transaction{paymentsList.length !== 1 ? 's' : ''}
                {showPaymentBreakdown ? ' · tap row for products' : ' · open to view list'}
              </p>
            </div>
            <span className="w-8 h-8 rounded-full bg-neutral-50 border border-neutral-200 flex items-center justify-center text-ink-muted shrink-0">
              {showPaymentBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>

          {showPaymentBreakdown && (
            <div className="border-t border-neutral-100">
              <div className="overflow-x-auto">
                {paymentsList.length === 0 ? (
                  <p className="p-6 text-ink-muted text-center text-sm">No payments in the selected date range.</p>
                ) : (
                  <table className="w-full text-sm min-w-[720px]">
                    <thead className="bg-neutral-50 border-b border-neutral-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-ink-muted">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-ink-muted">Invoice</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-ink-muted">Customer</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-ink-muted">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-ink-muted">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-ink-muted">Method</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-ink-muted">By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {paymentsList.map((p) => {
                        const d = p.paymentDate;
                        const dateObj = d instanceof Date ? d : (d?.toDate ? d.toDate() : new Date(d));
                        const dateStr = isNaN(dateObj.getTime()) ? 'N/A' : dateObj.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
                        return (
                          <tr
                            key={p.id || p._id}
                            onClick={() => openPaymentDetail(p)}
                            className="cursor-pointer hover:bg-neutral-50/80 transition-colors"
                            title="View payment details"
                          >
                            <td className="px-4 py-3 text-ink-muted whitespace-nowrap tabular-nums">{dateStr}</td>
                            <td className="px-4 py-3 font-medium text-ink">{p.invoiceNumber || '–'}</td>
                            <td className="px-4 py-3 font-medium text-ink">{formatDisplayName(p.customerName) || '–'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-700 tabular-nums">
                              Rs. {(parseFloat(p.amount) || 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${p.paymentType === 'Initial Sale'
                                ? 'bg-sky-50 text-sky-800 border-sky-100'
                                : 'bg-amber-50 text-amber-900 border-amber-100'
                                }`}>
                                {p.paymentType || '–'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-ink-muted">{p.paymentMethod || 'Cash'}</td>
                            <td className="px-4 py-3 text-ink-muted text-xs">
                              {p.editedBy ? (
                                <span>Edited: <strong className="text-ink">{p.editedBy}</strong></span>
                              ) : p.addedBy ? (
                                <span>Added: <strong className="text-ink">{p.addedBy}</strong></span>
                              ) : p.saleAddedBy ? (
                                <span>Sale: <strong className="text-ink">{p.saleAddedBy}</strong></span>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Detail Modal */}
      {selectedPaymentDetail && (() => {
        const { payment, sale } = selectedPaymentDetail;
        const d = payment.paymentDate;
        const dateObj = d instanceof Date ? d : (d?.toDate ? d.toDate() : new Date(d));
        const dateStr = isNaN(dateObj.getTime()) ? 'N/A' : dateObj.toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short'
        });
        const productShares = getPaymentProductShares(payment, sale);
        const saleTotal = parseFloat(sale?.totalAmount) || 0;
        const salePaid = parseFloat(sale?.paidAmount) || 0;
        const saleRemaining = parseFloat(sale?.remainingAmount) || Math.max(0, saleTotal - salePaid);

        return (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-w-2xl w-full max-h-[92dvh] overflow-y-auto">
              <div className="p-4 sm:p-5 border-b border-gray-200 sticky top-0 bg-white z-10 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold text-ink">Payment Details</h3>
                  <p className="text-sm text-neutral-500 mt-0.5 truncate">
                    {payment.customerName || 'Customer'} · {payment.invoiceNumber || 'Invoice'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPaymentDetail(null)}
                  className="text-gray-400 hover:text-gray-700 text-2xl font-bold min-h-[44px] min-w-[44px] shrink-0"
                >
                  ×
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 col-span-2 sm:col-span-1">
                    <p className="text-[11px] uppercase tracking-wide text-emerald-700/80 font-semibold">This Payment</p>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">Rs. {(parseFloat(payment.amount) || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 col-span-2 sm:col-span-1">
                    <p className="text-[11px] uppercase tracking-wide text-neutral-500 font-semibold">Type / Method</p>
                    <p className="text-sm font-semibold text-ink mt-1">{payment.paymentType || 'Payment'}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{payment.paymentMethod || 'Cash'} · {dateStr}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <div className="rounded-lg border p-3 bg-white">
                    <p className="text-xs text-neutral-500">Customer</p>
                    <p className="font-semibold text-ink break-words">{payment.customerName || sale?.customer?.name || '—'}</p>
                    {(sale?.customer?.contact || payment.customerContact) && (
                      <p className="text-xs text-neutral-500 mt-0.5">{sale?.customer?.contact || payment.customerContact}</p>
                    )}
                  </div>
                  <div className="rounded-lg border p-3 bg-white">
                    <p className="text-xs text-neutral-500">Invoice</p>
                    <p className="font-semibold text-ink break-all">{payment.invoiceNumber || '—'}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-white col-span-2 sm:col-span-1">
                    <p className="text-xs text-neutral-500">Recorded By</p>
                    <p className="font-semibold text-ink">
                      {payment.editedBy
                        ? `Edited: ${payment.editedBy}`
                        : payment.addedBy
                          ? `Added: ${payment.addedBy}`
                          : payment.saleAddedBy
                            ? `Sale: ${payment.saleAddedBy}`
                            : '—'}
                    </p>
                  </div>
                </div>

                {sale && (
                  <div className="rounded-xl border border-neutral-200 overflow-hidden">
                    <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
                      <p className="text-sm font-semibold text-ink">Invoice status</p>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-neutral-100">
                      <div className="p-3 text-center">
                        <p className="text-[10px] uppercase text-neutral-400 font-semibold">Total</p>
                        <p className="text-sm font-bold text-ink mt-1">Rs. {saleTotal.toLocaleString()}</p>
                      </div>
                      <div className="p-3 text-center">
                        <p className="text-[10px] uppercase text-neutral-400 font-semibold">Paid</p>
                        <p className="text-sm font-bold text-emerald-700 mt-1">Rs. {salePaid.toLocaleString()}</p>
                      </div>
                      <div className="p-3 text-center">
                        <p className="text-[10px] uppercase text-neutral-400 font-semibold">Due</p>
                        <p className={`text-sm font-bold mt-1 ${saleRemaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          Rs. {saleRemaining.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {sale.paymentStatus && (
                      <div className="px-4 py-2 border-t border-neutral-100 text-xs text-neutral-500">
                        Status: <span className="font-semibold text-ink">{sale.paymentStatus}</span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <p className="text-sm font-semibold text-ink mb-2">Products covered by this payment</p>
                  {!sale ? (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
                      Sale details not found for this payment.
                    </p>
                  ) : productShares.length === 0 ? (
                    <p className="text-sm text-neutral-500 bg-neutral-50 border rounded-lg p-3">No products on this invoice.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-neutral-200">
                      <table className="w-full text-sm min-w-[420px]">
                        <thead className="bg-neutral-50 border-b">
                          <tr>
                            <th className="text-left py-2.5 px-3 text-xs text-neutral-500">Product</th>
                            <th className="text-right py-2.5 px-3 text-xs text-neutral-500">Qty</th>
                            <th className="text-right py-2.5 px-3 text-xs text-neutral-500">Line Total</th>
                            <th className="text-right py-2.5 px-3 text-xs text-neutral-500">This Payment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productShares.map((item, idx) => (
                            <tr key={idx} className="border-b border-neutral-100">
                              <td className="py-2.5 px-3">
                                <p className="font-medium text-ink">{item.productName}</p>
                                {item.size && item.size !== 'One Size' && (
                                  <p className="text-xs text-neutral-500">Size: {item.size}</p>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums">{item.quantity}</td>
                              <td className="py-2.5 px-3 text-right tabular-nums text-neutral-600">Rs. {item.lineTotal.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-emerald-700">Rs. {item.paymentShare.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-emerald-50/60">
                          <tr>
                            <td colSpan="3" className="py-2.5 px-3 text-right text-sm font-semibold text-ink">Payment total</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                              Rs. {(parseFloat(payment.amount) || 0).toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                  <p className="text-[11px] text-neutral-400 mt-2">
                    If invoice has multiple products, this payment is split by each product’s bill share.
                  </p>
                </div>

                {payment.notes && (
                  <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Notes</p>
                    <p className="text-sm text-ink mt-1">{payment.notes}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedPaymentDetail(null)}
                  className="btn-secondary w-full min-h-[44px]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Monthly Closing Section */}
      <div className="card bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-bold mb-2">Month Closing</h3>
            <p className="text-indigo-100">
              Bika · Recovery · Own vs Investor buckets · Stock · Expenses — har card pe click = detail
            </p>
          </div>
          <div className="flex gap-3">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-white border border-white/40 rounded-lg px-4 py-2 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-white border border-white/40 rounded-lg px-4 py-2 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {loadingMonthly ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading month data">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white/10 rounded-lg p-5 backdrop-blur-sm">
                  <div className="h-4 w-28 rounded bg-white/25 animate-pulse mb-3" />
                  <div className="h-9 w-36 rounded mb-3 bg-white/30 animate-pulse" />
                  <div className="h-3 w-full rounded bg-white/20 animate-pulse" />
                </div>
              ))}
            </div>
            <p className="text-indigo-100 text-xs text-center">Month data load ho rahi hai…</p>
          </div>
        ) : monthlyData ? (() => {
          const trading = parseFloat(monthlyData.tradingProfit) || 0;
          const net = parseFloat(monthlyData.netProfit) || 0;
          const partnerPct = Math.min(100, Math.max(0, parseFloat(partnerSharePct) || 0));
          const partnerShare = net > 0 ? Math.round((net * partnerPct) / 100) : 0;
          const yourFinal = net - partnerShare;
          const fmt = (n) => `Rs. ${(Math.abs(parseFloat(n) || 0)).toLocaleString()}`;
          const openDetail = (type) => setMonthDetailType(type);

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => openDetail('sold')}
                  className="text-left bg-white/10 rounded-lg p-5 backdrop-blur-sm hover:bg-white/20 transition-all border border-transparent hover:border-white/30"
                >
                  <p className="text-indigo-100 text-sm mb-1">1. Is month bika</p>
                  <p className="text-2xl font-bold">{(monthlyData.soldQty || 0).toLocaleString()} pcs</p>
                  <p className="text-indigo-200 text-xs mt-1">
                    Bill {fmt(monthlyData.totalSales)} · Cost {fmt(monthlyData.soldCost)}
                  </p>
                  <p className="text-indigo-200 text-xs mt-1 underline/50">Click — kaunsa maal bika</p>
                </button>

                <button
                  type="button"
                  onClick={() => openDetail('paid')}
                  className="text-left bg-white/10 rounded-lg p-5 backdrop-blur-sm hover:bg-white/20 transition-all border border-transparent hover:border-white/30"
                >
                  <p className="text-indigo-100 text-sm mb-1">2. Is month sales se paid</p>
                  <p className="text-2xl font-bold text-emerald-200">{fmt(monthlyData.monthSalesPaid ?? monthlyData.totalPaid)}</p>
                  <p className="text-indigo-200 text-xs mt-1">
                    Due abhi {fmt(monthlyData.monthDue)} · {monthlyData.salesCount || 0} sales
                  </p>
                  <p className="text-indigo-200 text-xs mt-1">Click — customer / invoice</p>
                </button>

                <button
                  type="button"
                  onClick={() => openDetail('recovery')}
                  className="text-left bg-white/10 rounded-lg p-5 backdrop-blur-sm hover:bg-white/20 transition-all border border-transparent hover:border-white/30"
                >
                  <p className="text-indigo-100 text-sm mb-1">3. Pichla recovery</p>
                  <p className="text-2xl font-bold text-amber-200">{fmt(monthlyData.priorRecovery || 0)}</p>
                  <p className="text-indigo-200 text-xs mt-1">
                    Cost wapas {fmt(monthlyData.priorRecoveryCost || 0)} · Profit{' '}
                    {fmt(monthlyData.priorRecoveryProfit || 0)}
                  </p>
                  <p className="text-indigo-200 text-xs mt-1">Click — kis customer se / cost vs profit</p>
                </button>

                <button
                  type="button"
                  onClick={() => openDetail('stock')}
                  className="text-left bg-white/10 rounded-lg p-5 backdrop-blur-sm hover:bg-white/20 transition-all border border-transparent hover:border-white/30"
                >
                  <p className="text-indigo-100 text-sm mb-1">4. Stock reh gaya → next month</p>
                  <p className="text-2xl font-bold">{(monthlyData.closingStockQty || 0).toLocaleString()} pcs</p>
                  <p className="text-indigo-200 text-xs mt-1">
                    Own {fmt(monthlyData.ownClosingStockValue)} · Investor {fmt(monthlyData.investorClosingStockValue)}
                  </p>
                  <p className="text-indigo-200 text-xs mt-1">Click — kaunsa maal / funding</p>
                </button>

                <button
                  type="button"
                  onClick={() => openDetail('expenses')}
                  className="text-left bg-white/10 rounded-lg p-5 backdrop-blur-sm hover:bg-white/20 transition-all border border-transparent hover:border-white/30"
                >
                  <p className="text-indigo-100 text-sm mb-1">5. General expenses</p>
                  <p className="text-2xl font-bold text-rose-200">{fmt(monthlyData.generalExpenses)}</p>
                  <p className="text-indigo-200 text-xs mt-1">
                    {monthlyData.expensesCount || 0} entries · product cost alag
                  </p>
                  <p className="text-indigo-200 text-xs mt-1">Click — expense list</p>
                </button>

                <button
                  type="button"
                  onClick={() => openDetail('profit')}
                  className={`text-left rounded-lg p-5 backdrop-blur-sm hover:bg-white/20 transition-all border-2 ${net >= 0 ? 'border-green-300 bg-white/10' : 'border-red-300 bg-white/10'
                    }`}
                >
                  <p className="text-indigo-100 text-sm mb-1">6. Net month {net >= 0 ? 'profit' : 'loss'}</p>
                  <p className={`text-2xl font-bold ${net >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                    {net >= 0 ? '+' : '-'}{fmt(net)}
                  </p>
                  <p className="text-indigo-200 text-xs mt-1">
                    Trading + recovery profit − expenses
                  </p>
                  <p className="text-indigo-200 text-xs mt-1">Click — hisab + partner share</p>
                </button>
              </div>

              {/* Own vs Investor — 4 buckets */}
              <div className="rounded-xl border border-white/20 bg-black/10 p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-white">Own vs Investor cash (categorized)</p>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    Inventory pe investor tag se split — adha bika / next month recovery yahan clear
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => openDetail('ownPaid')}
                    className="text-left rounded-lg bg-emerald-500/20 border border-emerald-300/30 p-4 hover:bg-emerald-500/30 transition-all"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-100">A. Meri inventory — is month paid</p>
                    <p className="text-xl font-bold mt-1">{fmt(monthlyData.ownMonthSalesPaid)}</p>
                    <p className="text-[11px] text-indigo-100/80 mt-1">Cost {fmt(monthlyData.ownSoldCost)} · click detail</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => openDetail('investorPaid')}
                    className="text-left rounded-lg bg-sky-500/20 border border-sky-300/30 p-4 hover:bg-sky-500/30 transition-all"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-100">B. Investor inventory — is month paid</p>
                    <p className="text-xl font-bold mt-1">{fmt(monthlyData.investorMonthSalesPaid)}</p>
                    <p className="text-[11px] text-indigo-100/80 mt-1">Cost {fmt(monthlyData.investorSoldCost)} · click detail</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => openDetail('ownRecovery')}
                    className="text-left rounded-lg bg-amber-500/20 border border-amber-300/30 p-4 hover:bg-amber-500/30 transition-all"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-100">C. Pichla recovery — mera</p>
                    <p className="text-xl font-bold mt-1">{fmt(monthlyData.ownPriorRecovery)}</p>
                    <p className="text-[11px] text-indigo-100/80 mt-1">
                      Cost {fmt(monthlyData.ownPriorRecoveryCost || 0)} · Profit{' '}
                      {fmt(monthlyData.ownPriorRecoveryProfit || 0)}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => openDetail('investorRecovery')}
                    className="text-left rounded-lg bg-violet-500/20 border border-violet-300/30 p-4 hover:bg-violet-500/30 transition-all"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-100">D. Pichla recovery — investor</p>
                    <p className="text-xl font-bold mt-1">{fmt(monthlyData.investorPriorRecovery)}</p>
                    <p className="text-[11px] text-indigo-100/80 mt-1">
                      Cost {fmt(monthlyData.investorPriorRecoveryCost || 0)} · Profit{' '}
                      {fmt(monthlyData.investorPriorRecoveryProfit || 0)}
                    </p>
                  </button>
                </div>
                <p className="text-[11px] text-indigo-100/90 break-words">
                  Stock next month: Own {fmt(monthlyData.ownClosingStockValue)} ({(monthlyData.ownClosingStockQty || 0).toLocaleString()} pcs)
                  {' · '}
                  Investor {fmt(monthlyData.investorClosingStockValue)} ({(monthlyData.investorClosingStockQty || 0).toLocaleString()} pcs)
                  {' — '}
                  Investor ko dena Investors page → Pay out se.
                </p>
              </div>

              <div className="bg-white/10 rounded-lg px-4 py-3 text-sm text-indigo-50 space-y-2">
                <p className="font-medium break-words">
                  Trading: Is-month paid {fmt(monthlyData.monthSalesPaid)} − Cost {fmt(monthlyData.soldCost)} ={' '}
                  <span className={trading >= 0 ? 'text-green-300 font-bold' : 'text-red-300 font-bold'}>
                    {trading >= 0 ? '+' : '-'}{fmt(trading)}
                  </span>
                </p>
                <p className="font-medium break-words">
                  Net = Trading + Recovery profit {fmt(monthlyData.priorRecoveryProfit || 0)}
                  {' '}(cash {fmt(monthlyData.priorRecovery || 0)}, cost wapas {fmt(monthlyData.priorRecoveryCost || 0)})
                  {' − '}Expenses {fmt(monthlyData.generalExpenses)} ={' '}
                  <span className={net >= 0 ? 'text-green-300 font-bold' : 'text-red-300 font-bold'}>
                    {net >= 0 ? '+' : '-'}{fmt(net)}
                  </span>
                  {partnerPct > 0 && (
                    <> · Partner {partnerPct}% = {fmt(partnerShare)} · Aapka{' '}
                      <span className="font-bold">{yourFinal >= 0 ? '+' : '-'}{fmt(yourFinal)}</span>
                    </>
                  )}
                </p>
                <p className="text-xs text-indigo-200 break-words">
                  Sirf aapka slice: Own paid {fmt(monthlyData.ownMonthSalesPaid)} + Own recovery profit{' '}
                  {fmt(monthlyData.ownPriorRecoveryProfit || 0)}
                  {' − '}Own cost {fmt(monthlyData.ownSoldCost)} − Expenses {fmt(monthlyData.generalExpenses)}
                  {' = '}
                  <span className="font-semibold">
                    {(monthlyData.ownNetWithRecovery || 0) >= 0 ? '+' : '-'}
                    {fmt(monthlyData.ownNetWithRecovery)}
                  </span>
                  {' · '}Investor cash is month {fmt((monthlyData.investorMonthSalesPaid || 0) + (monthlyData.investorPriorRecovery || 0))} (alag — Pay out)
                </p>
                <button
                  type="button"
                  onClick={() => setShowProfitDetailModal(true)}
                  className="text-xs text-indigo-200 underline hover:text-white"
                >
                  All-time product profit detail (alag hisab)
                </button>
              </div>
            </div>
          );
        })() : (
          <div className="text-center py-8">
            <p className="text-indigo-100">Is month ka data load nahi hua. Dobara try karein.</p>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div
          className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft p-5 cursor-pointer hover:border-neutral-300 transition-colors"
          onClick={() => setShowStockDetailModal(true)}
          title="Click to view product-wise stock details"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
              <Package size={20} />
            </span>
          </div>
          <p className="text-xs font-medium text-ink-muted">Total stock value</p>
          <p className="text-2xl font-bold text-ink tabular-nums tracking-tight mt-1">
            Rs. {(inventoryStats?.totalValue || 0).toLocaleString()}
          </p>
          <p className="text-xs text-ink-muted mt-1.5">{stockDetails.length} products · tap for details</p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <DollarSign size={20} />
            </span>
          </div>
          <p className="text-xs font-medium text-ink-muted">Total sales</p>
          <p className="text-2xl font-bold text-ink tabular-nums tracking-tight mt-1">
            Rs. {(salesStats?.totalSales || 0).toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
              <CreditCard size={20} />
            </span>
          </div>
          <p className="text-xs font-medium text-ink-muted">Outstanding credit</p>
          <p className="text-2xl font-bold text-ink tabular-nums tracking-tight mt-1">
            Rs. {(outstandingCredits.reduce((sum, sale) => sum + (parseFloat(sale.remainingAmount) || 0), 0)).toLocaleString()}
          </p>
          <p className="text-xs text-ink-muted mt-1.5">{outstandingCredits.length} pending</p>
        </div>

        <div
          className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft p-5 cursor-pointer hover:border-neutral-300 transition-colors"
          onClick={() => setShowProfitDetailModal(true)}
          title="Paid − sold cost · same as Inventory"
        >
          <div className="flex items-center justify-between mb-3">
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${totalProfit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {totalProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </span>
          </div>
          <p className="text-xs font-medium text-ink-muted">Realized profit</p>
          <p className={`text-2xl font-bold tabular-nums tracking-tight mt-1 ${totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatSignedMoney(totalProfit)}
          </p>
          <p className="text-xs text-ink-muted mt-1.5">Paid − sold cost · tap for products</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Sales Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="#0ea5e9"
                strokeWidth={2}
                name="Sales (Rs.)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Payment Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={paymentDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {paymentDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `Rs. ${value.toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products by Revenue */}
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Products by Revenue</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProductsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
              <Tooltip
                formatter={(value) => `Rs. ${value.toLocaleString()}`}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="revenue" fill="#0ea5e9" name="Revenue (Rs.)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h4 className="font-semibold text-gray-700 mb-4">Sales Summary</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Transactions</span>
              <span className="font-semibold">{salesStats?.totalTransactions || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Cash Sales</span>
              <span className="font-semibold">{salesStats?.cashSales || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Credit Sales</span>
              <span className="font-semibold">{salesStats?.creditSales || 0}</span>
            </div>
            <div className="flex justify-between pt-3 border-t">
              <span className="text-gray-600">Average Sale</span>
              <span className="font-semibold">Rs. {(salesStats?.averageSale || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h4 className="font-semibold text-gray-700 mb-4">Inventory Summary</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Products</span>
              <span className="font-semibold">{inventoryStats?.totalItems || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Quantity</span>
              <span className="font-semibold">{inventoryStats?.totalQuantity || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Low Stock Items</span>
              <span className="font-semibold text-orange-600">{inventoryStats?.lowStockCount || 0}</span>
            </div>
            <div className="flex justify-between pt-3 border-t">
              <span className="text-gray-600">Total Value</span>
              <span className="font-semibold">Rs. {(inventoryStats?.totalValue || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h4 className="font-semibold text-gray-700 mb-4">Production Summary</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Batches</span>
              <span className="font-semibold">{stats?.production?.total || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">In Process</span>
              <span className="font-semibold text-yellow-600">{stats?.production?.inProcess || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Completed</span>
              <span className="font-semibold text-green-600">{stats?.production?.completed || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Outstanding Credit Details */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-lg">
              <CreditCard className="text-orange-600" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Outstanding Credit (Paise Lene Hain)</h3>
              <p className="text-sm text-gray-600">Kis kis se paise lene hain - Details of all unpaid and partially paid sales</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-orange-600">
              Rs. {(outstandingCredits.reduce((sum, sale) => sum + (parseFloat(sale.remainingAmount) || 0), 0)).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">{outstandingCredits.length} pending transactions</p>
            <p className="text-xs text-gray-500 mt-1">From {new Set(outstandingCredits.map(s => s.customerId || s.customer?.id || s.customer?._id).filter(Boolean)).size} customers</p>
          </div>
        </div>

        {outstandingCredits.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <CreditCard className="mx-auto text-gray-400 mb-3" size={48} />
            <p className="text-gray-600 font-medium">No Outstanding Credit</p>
            <p className="text-sm text-gray-500 mt-1">All sales have been fully paid</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-orange-50 to-amber-50 border-b-2 border-orange-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Paid Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Remaining</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Added By</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {outstandingCredits.map((sale) => {
                  const remaining = parseFloat(sale.remainingAmount) || 0;
                  const total = parseFloat(sale.totalAmount) || 0;
                  const paid = parseFloat(sale.paidAmount) || 0;
                  const paymentPercentage = total > 0 ? ((paid / total) * 100).toFixed(0) : 0;
                  const customer = sale.customerDetails || sale.customer;
                  const customerName = customer?.name || 'Walk-in Customer';
                  const customerContact = customer?.contact || customer?.phone || customer?.mobile || 'N/A';

                  return (
                    <tr key={sale.id || sale._id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-semibold text-gray-900">{sale.invoiceNumber || sale.id?.slice(-8) || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <span className="text-gray-800 font-medium block">{customerName}</span>
                          <p className="text-xs text-gray-500 mt-0.5">{customerContact}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-gray-700">{formatDate(sale.saleDate)}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">Rs. {total.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-medium text-green-600">Rs. {paid.toLocaleString()}</span>
                        <p className="text-xs text-gray-500 mt-0.5">{paymentPercentage}% paid</p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-bold text-orange-600 text-lg">Rs. {remaining.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${sale.paymentStatus === 'Partial'
                          ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                          : 'bg-red-100 text-red-800 border border-red-300'
                          }`}>
                          {sale.paymentStatus === 'Partial' ? (
                            <span className="flex items-center gap-1">
                              <AlertCircle size={12} />
                              Partial
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <AlertCircle size={12} />
                              Unpaid
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {sale.addedBy ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {sale.addedBy}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gradient-to-r from-orange-50 to-amber-50 border-t-2 border-orange-200">
                <tr>
                  <td colSpan="6" className="px-4 py-4 text-right font-bold text-gray-700">
                    Total Outstanding (Paise Lene Hain):
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="font-bold text-orange-700 text-xl">
                      Rs. {(outstandingCredits.reduce((sum, sale) => sum + (parseFloat(sale.remainingAmount) || 0), 0)).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-4"></td>
                  <td className="px-4 py-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Month Closing Detail Modal */}
      {monthDetailType && monthlyData && (() => {
        const monthLabel = new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric'
        });
        const fmt = (n) => `Rs. ${(Math.round(parseFloat(n) || 0)).toLocaleString()}`;
        const fmtDate = (v) => {
          const d = toDateValue(v);
          return d ? d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
        };
        const trading = parseFloat(monthlyData.tradingProfit) || 0;
        const net = parseFloat(monthlyData.netProfit) || 0;
        const partnerPct = Math.min(100, Math.max(0, parseFloat(partnerSharePct) || 0));
        const partnerShare = net > 0 ? Math.round((net * partnerPct) / 100) : 0;
        const yourFinal = net - partnerShare;

        const titles = {
          sold: 'Is month kaunsa maal bika',
          paid: 'Is month sales se paid',
          recovery: 'Pichla recovery — kis se aaya',
          stock: 'Stock reh gaya → next month',
          expenses: 'General expenses',
          profit: 'Month profit',
          ownPaid: 'A. Meri inventory — is month paid',
          investorPaid: 'B. Investor inventory — is month paid',
          ownRecovery: 'C. Pichla recovery — mera',
          investorRecovery: 'D. Pichla recovery — investor'
        };

        const renderFundingPaymentTable = (rows, emptyMsg, { showCostSplit = false } = {}) => {
          if (!rows?.length) {
            return <p className="text-center text-gray-500 py-8">{emptyMsg}</p>;
          }
          return (
            <div className="overflow-x-auto">
              <table className={`w-full text-sm ${showCostSplit ? 'min-w-[640px]' : 'min-w-[520px]'}`}>
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left py-2 px-3 text-xs text-gray-500">Customer</th>
                    <th className="text-left py-2 px-3 text-xs text-gray-500">Invoice</th>
                    <th className="text-left py-2 px-3 text-xs text-gray-500">Date</th>
                    <th className="text-left py-2 px-3 text-xs text-gray-500">Products</th>
                    {showCostSplit && (
                      <>
                        <th className="text-right py-2 px-3 text-xs text-gray-500">Cost wapas</th>
                        <th className="text-right py-2 px-3 text-xs text-gray-500">Profit</th>
                      </>
                    )}
                    <th className="text-right py-2 px-3 text-xs text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id || i} className="border-b border-gray-100">
                      <td className="py-2.5 px-3 font-medium">{r.customerName}</td>
                      <td className="py-2.5 px-3 text-xs text-gray-500">{r.invoiceNumber || '—'}</td>
                      <td className="py-2.5 px-3 text-xs">{fmtDate(r.paymentDate)}</td>
                      <td className="py-2.5 px-3 text-xs text-gray-600">
                        {(r.productLines || []).map((l) => l.productName).join(', ') ||
                          (r.investorNames || []).join(', ') ||
                          '—'}
                      </td>
                      {showCostSplit && (
                        <>
                          <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">
                            {fmt(r.costAmount || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">
                            {fmt(r.profitAmount || 0)}
                          </td>
                        </>
                      )}
                      <td className="py-2.5 px-3 text-right font-semibold tabular-nums">{fmt(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        };

        return (
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
            onClick={() => setMonthDetailType(null)}
          >
            <div
              className="bg-neutral-100 rounded-t-2xl sm:rounded-2xl shadow-elevated max-w-2xl w-full max-h-[92dvh] overflow-y-auto border border-neutral-200/80"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 sm:px-6 py-4 border-b border-neutral-100 sticky top-0 bg-white/95 backdrop-blur z-10 flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold text-ink tracking-tight">{titles[monthDetailType]}</h3>
                  <p className="text-sm text-ink-muted mt-0.5">{monthLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMonthDetailType(null)}
                  className="w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-ink-muted shrink-0"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-4">
                {monthDetailType === 'sold' && (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-lg bg-indigo-50 p-3">
                        <p className="text-xs text-gray-500">Pcs</p>
                        <p className="font-bold">{(monthlyData.soldQty || 0).toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg bg-indigo-50 p-3">
                        <p className="text-xs text-gray-500">Bill</p>
                        <p className="font-bold">{fmt(monthlyData.totalSales)}</p>
                      </div>
                      <div className="rounded-lg bg-amber-50 p-3">
                        <p className="text-xs text-gray-500">Cost</p>
                        <p className="font-bold">{fmt(monthlyData.soldCost)}</p>
                      </div>
                    </div>
                    {(monthlyData.soldProducts || []).length === 0 ? (
                      <p className="text-center text-gray-500 py-8">Is month koi sale nahi</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[560px]">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left py-2 px-3 text-xs text-gray-500">Product</th>
                              <th className="text-left py-2 px-3 text-xs text-gray-500">Funding</th>
                              <th className="text-right py-2 px-3 text-xs text-gray-500">Qty</th>
                              <th className="text-right py-2 px-3 text-xs text-gray-500">Bill</th>
                              <th className="text-right py-2 px-3 text-xs text-gray-500">Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlyData.soldProducts.map((p, i) => (
                              <tr key={i} className="border-b border-gray-100">
                                <td className="py-2.5 px-3 font-medium">
                                  {p.productName}
                                  {p.size ? <span className="text-gray-400 text-xs ml-1">({p.size})</span> : null}
                                </td>
                                <td className="py-2.5 px-3">
                                  {p.funding === 'investor' ? (
                                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                                      Investor{p.investorName ? `: ${p.investorName}` : ''}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                      Own
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums">{p.qty}</td>
                                <td className="py-2.5 px-3 text-right tabular-nums">{fmt(p.bill)}</td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-amber-800">{fmt(p.cost)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {(monthlyData.monthSalesDetail || []).length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-2 text-sm">Sales / customers</h4>
                        <div className="space-y-2">
                          {monthlyData.monthSalesDetail.map((s) => (
                            <div key={s.id} className="rounded-lg border border-gray-100 p-3 text-sm">
                              <div className="flex flex-wrap justify-between gap-2">
                                <p className="font-medium">{s.customerName}</p>
                                <p className="text-xs text-gray-500">{s.invoiceNumber || '—'} · {fmtDate(s.saleDate)}</p>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                Bill {fmt(s.billed)} · Paid {fmt(s.paid)} · Due {fmt(s.due)}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {(s.items || []).map((it) => `${it.productName} ×${it.qty}`).join(' · ')}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {monthDetailType === 'paid' && (
                  <>
                    <p className="text-sm text-gray-600">
                      Sirf <strong>is month ki sales</strong> pe is month jo paise aaye:{' '}
                      <strong className="text-emerald-700">{fmt(monthlyData.monthSalesPaid)}</strong>
                    </p>
                    {(monthlyData.monthSalesPaidDetail || []).length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[480px]">
                          <thead className="bg-emerald-50 border-b">
                            <tr>
                              <th className="text-left py-2 px-3 text-xs text-gray-500">Customer</th>
                              <th className="text-left py-2 px-3 text-xs text-gray-500">Invoice</th>
                              <th className="text-left py-2 px-3 text-xs text-gray-500">Date</th>
                              <th className="text-right py-2 px-3 text-xs text-gray-500">Paid</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlyData.monthSalesPaidDetail.map((r, i) => (
                              <tr key={r.id || i} className="border-b border-gray-100">
                                <td className="py-2.5 px-3 font-medium">{r.customerName}</td>
                                <td className="py-2.5 px-3 text-xs text-gray-500">{r.invoiceNumber || '—'}</td>
                                <td className="py-2.5 px-3 text-xs">{fmtDate(r.paymentDate)}</td>
                                <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">{fmt(r.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-6">Is month in sales pe koi payment record nahi</p>
                    )}
                    {(monthlyData.monthSalesDetail || []).length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-2 text-sm">Is month ki sales (bill / due)</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm min-w-[480px]">
                            <thead className="bg-gray-50 border-b">
                              <tr>
                                <th className="text-left py-2 px-3 text-xs text-gray-500">Customer</th>
                                <th className="text-left py-2 px-3 text-xs text-gray-500">Invoice</th>
                                <th className="text-right py-2 px-3 text-xs text-gray-500">Bill</th>
                                <th className="text-right py-2 px-3 text-xs text-gray-500">Total paid*</th>
                                <th className="text-right py-2 px-3 text-xs text-gray-500">Due</th>
                              </tr>
                            </thead>
                            <tbody>
                              {monthlyData.monthSalesDetail.map((s) => (
                                <tr key={s.id} className="border-b border-gray-100">
                                  <td className="py-2.5 px-3 font-medium">{s.customerName}</td>
                                  <td className="py-2.5 px-3 text-xs text-gray-500">{s.invoiceNumber || '—'}</td>
                                  <td className="py-2.5 px-3 text-right">{fmt(s.billed)}</td>
                                  <td className="py-2.5 px-3 text-right text-emerald-700">{fmt(s.paid)}</td>
                                  <td className="py-2.5 px-3 text-right text-rose-600">{fmt(s.due)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-2">* Total paid = sale pe ab tak poora paid (sirf is month nahi)</p>
                      </div>
                    )}
                  </>
                )}

                {monthDetailType === 'recovery' && (
                  <>
                    <p className="text-sm text-gray-600">
                      Purani months ki sales ka paisa <strong>is month</strong> aaya:{' '}
                      <strong className="text-amber-800">{fmt(monthlyData.priorRecovery)}</strong>
                      {' — '}cost wapas{' '}
                      <strong>{fmt(monthlyData.priorRecoveryCost || 0)}</strong>
                      {' · '}profit (net mein){' '}
                      <strong className="text-emerald-700">
                        {fmt(monthlyData.priorRecoveryProfit || 0)}
                      </strong>
                    </p>
                    <p className="text-xs text-gray-500">
                      Pehle payments se jo cost cover ho chuki thi — uske baad jo aaya woh profit.
                      Baaki pehle cost wapas, phir profit.
                    </p>
                    {(monthlyData.priorRecoveryDetail || []).length === 0 ? (
                      <p className="text-center text-gray-500 py-8">Is month koi pichla recovery nahi</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[640px]">
                          <thead className="bg-amber-50 border-b">
                            <tr>
                              <th className="text-left py-2 px-3 text-xs text-gray-500">Customer</th>
                              <th className="text-left py-2 px-3 text-xs text-gray-500">Invoice</th>
                              <th className="text-left py-2 px-3 text-xs text-gray-500">Payment date</th>
                              <th className="text-left py-2 px-3 text-xs text-gray-500">Original sale</th>
                              <th className="text-right py-2 px-3 text-xs text-gray-500">Cost wapas</th>
                              <th className="text-right py-2 px-3 text-xs text-gray-500">Profit</th>
                              <th className="text-right py-2 px-3 text-xs text-gray-500">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlyData.priorRecoveryDetail.map((r, i) => (
                              <tr key={r.id || i} className="border-b border-gray-100">
                                <td className="py-2.5 px-3 font-medium">{r.customerName}</td>
                                <td className="py-2.5 px-3 text-xs text-gray-500">{r.invoiceNumber || '—'}</td>
                                <td className="py-2.5 px-3 text-xs">{fmtDate(r.paymentDate)}</td>
                                <td className="py-2.5 px-3 text-xs text-gray-500">{fmtDate(r.originalSaleDate)}</td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">
                                  {fmt(r.costAmount || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">
                                  {fmt(r.profitAmount || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-semibold text-amber-800">
                                  {fmt(r.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {monthDetailType === 'stock' && (
                  <>
                    <p className="text-sm text-gray-600">
                      Abhi inventory mein pada maal — <strong>next month ka opening</strong> hoga. Yeh loss nahi.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mb-2">
                      <div className="rounded-lg bg-neutral-50 p-3 border">
                        <p className="text-xs text-gray-500">Total pcs</p>
                        <p className="font-bold">{(monthlyData.closingStockQty || 0).toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg bg-amber-50 p-3 border border-amber-100">
                        <p className="text-xs text-gray-500">Total value</p>
                        <p className="font-bold">{fmt(monthlyData.closingStockValue)}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100">
                        <p className="text-xs text-gray-500">Own stock</p>
                        <p className="font-bold">{fmt(monthlyData.ownClosingStockValue)}</p>
                      </div>
                      <div className="rounded-lg bg-sky-50 p-3 border border-sky-100">
                        <p className="text-xs text-gray-500">Investor stock</p>
                        <p className="font-bold">{fmt(monthlyData.investorClosingStockValue)}</p>
                      </div>
                    </div>
                    {(monthlyData.closingStockDetail || []).length === 0 ? (
                      <p className="text-center text-gray-500 py-8">Stock khali</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[520px]">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left py-2 px-3 text-xs text-gray-500">Product</th>
                              <th className="text-left py-2 px-3 text-xs text-gray-500">Funding</th>
                              <th className="text-right py-2 px-3 text-xs text-gray-500">Qty</th>
                              <th className="text-right py-2 px-3 text-xs text-gray-500">Cost/pc</th>
                              <th className="text-right py-2 px-3 text-xs text-gray-500">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlyData.closingStockDetail.map((p) => (
                              <tr key={p.id} className="border-b border-gray-100">
                                <td className="py-2.5 px-3 font-medium">
                                  {p.productName}
                                  {p.sizes?.length > 0 && (
                                    <span className="block text-[10px] text-gray-400">
                                      {p.sizes.map((s) => `${s.size}:${s.quantity}`).join(' · ')}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  {p.funding === 'investor' ? (
                                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                                      Investor{p.investorName ? `: ${p.investorName}` : ''}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                      Own
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums">{p.qty}</td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">{fmt(p.costPerUnit)}</td>
                                <td className="py-2.5 px-3 text-right tabular-nums font-semibold">{fmt(p.value)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {monthDetailType === 'ownPaid' && (
                  <>
                    <p className="text-sm text-gray-600">
                      Is month <strong>aapki inventory</strong> ki sales se paid:{' '}
                      <strong className="text-emerald-700">{fmt(monthlyData.ownMonthSalesPaid)}</strong>
                      {' · '}Cost {fmt(monthlyData.ownSoldCost)}
                    </p>
                    {renderFundingPaymentTable(
                      monthlyData.ownMonthPaidDetail,
                      'Is month own inventory pe koi payment nahi'
                    )}
                  </>
                )}

                {monthDetailType === 'investorPaid' && (
                  <>
                    <p className="text-sm text-gray-600">
                      Is month <strong>investor-tagged</strong> maal ki sales se paid:{' '}
                      <strong className="text-sky-800">{fmt(monthlyData.investorMonthSalesPaid)}</strong>
                      {' · '}Cost {fmt(monthlyData.investorSoldCost)}. Yeh capital/profit Investors → Pay out se clear karo.
                    </p>
                    {renderFundingPaymentTable(
                      monthlyData.investorMonthPaidDetail,
                      'Is month investor inventory pe koi payment nahi'
                    )}
                  </>
                )}

                {monthDetailType === 'ownRecovery' && (
                  <>
                    <p className="text-sm text-gray-600">
                      Purani <strong>own</strong> sales ka due is month aaya:{' '}
                      <strong className="text-amber-800">{fmt(monthlyData.ownPriorRecovery)}</strong>
                      {' — '}cost {fmt(monthlyData.ownPriorRecoveryCost || 0)} · profit{' '}
                      <strong className="text-emerald-700">
                        {fmt(monthlyData.ownPriorRecoveryProfit || 0)}
                      </strong>
                    </p>
                    {renderFundingPaymentTable(
                      monthlyData.ownPriorRecoveryDetail,
                      'Is month own pichla recovery nahi',
                      { showCostSplit: true }
                    )}
                  </>
                )}

                {monthDetailType === 'investorRecovery' && (
                  <>
                    <p className="text-sm text-gray-600">
                      Purani <strong>investor</strong> sales ka due is month aaya:{' '}
                      <strong className="text-violet-800">{fmt(monthlyData.investorPriorRecovery)}</strong>
                      {' — '}cost {fmt(monthlyData.investorPriorRecoveryCost || 0)} · profit{' '}
                      {fmt(monthlyData.investorPriorRecoveryProfit || 0)}. Next month bhi isi bucket mein.
                    </p>
                    {renderFundingPaymentTable(
                      monthlyData.investorPriorRecoveryDetail,
                      'Is month investor pichla recovery nahi',
                      { showCostSplit: true }
                    )}
                  </>
                )}

                {monthDetailType === 'expenses' && (
                  <>
                    <p className="text-sm text-gray-600">
                      Total general: <strong>{fmt(monthlyData.generalExpenses)}</strong>
                    </p>
                    {(monthlyData.expensesDetail || []).length === 0 ? (
                      <p className="text-center text-gray-500 py-8">Is month koi general expense nahi</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[400px]">
                          <thead className="bg-rose-50 border-b">
                            <tr>
                              <th className="text-left py-2 px-3 text-xs text-gray-500">Title</th>
                              <th className="text-left py-2 px-3 text-xs text-gray-500">Date</th>
                              <th className="text-right py-2 px-3 text-xs text-gray-500">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlyData.expensesDetail.map((e) => (
                              <tr key={e.id} className="border-b border-gray-100">
                                <td className="py-2.5 px-3">
                                  <p className="font-medium">{e.title}</p>
                                  {e.notes && <p className="text-xs text-gray-400">{e.notes}</p>}
                                </td>
                                <td className="py-2.5 px-3 text-xs text-gray-500">{fmtDate(e.expenseDate)}</td>
                                <td className="py-2.5 px-3 text-right font-semibold text-rose-700">{fmt(e.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {monthDetailType === 'profit' && (
                  <div className="space-y-4">
                    {/* Result hero */}
                    <div className={`rounded-2xl border p-5 ${net >= 0 ? 'bg-emerald-50/80 border-emerald-100' : 'bg-rose-50/80 border-rose-100'}`}>
                      <p className="text-[11px] font-medium text-ink-muted">
                        {net >= 0 ? 'Net profit this month' : 'Net loss this month'}
                      </p>
                      <p className={`text-3xl sm:text-4xl font-bold tabular-nums tracking-tight mt-1 ${net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}
                      </p>
                      <p className="text-xs text-ink-muted mt-2 text-pretty">
                        Paid − sold cost + recovery profit − expenses
                      </p>
                    </div>

                    {/* Clean P&L rows */}
                    <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft overflow-hidden">
                      <div className="px-4 sm:px-5 py-3 border-b border-neutral-100">
                        <h4 className="text-sm font-semibold text-ink">How it adds up</h4>
                      </div>
                      <ul className="divide-y divide-neutral-100 text-sm">
                        <li className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5">
                          <div className="min-w-0">
                            <p className="font-medium text-ink">Cash from this month’s sales</p>
                            <p className="text-xs text-ink-muted mt-0.5">Only money received · dues not included</p>
                          </div>
                          <p className="font-semibold text-emerald-700 tabular-nums shrink-0">{fmt(monthlyData.monthSalesPaid)}</p>
                        </li>
                        <li className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5">
                          <div className="min-w-0">
                            <p className="font-medium text-ink">− Sold cost</p>
                            <p className="text-xs text-ink-muted mt-0.5">Qty sold × your purchase cost</p>
                          </div>
                          <p className="font-semibold text-ink tabular-nums shrink-0">{fmt(monthlyData.soldCost)}</p>
                        </li>
                        <li className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 bg-neutral-50/70">
                          <div className="min-w-0">
                            <p className="font-semibold text-ink">Trading</p>
                            <p className="text-xs text-ink-muted mt-0.5">Cash − sold cost</p>
                          </div>
                          <p className={`font-bold tabular-nums shrink-0 ${trading >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {trading >= 0 ? '+' : '−'}{fmt(Math.abs(trading))}
                          </p>
                        </li>
                        <li className="px-4 sm:px-5 py-3.5 space-y-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-ink">Prior recovery (cash)</p>
                              <p className="text-xs text-ink-muted mt-0.5">Old dues collected this month</p>
                            </div>
                            <p className="font-semibold text-amber-800 tabular-nums shrink-0">
                              {fmt(monthlyData.priorRecovery || 0)}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl bg-neutral-50 border border-neutral-200/80 px-3 py-2.5">
                              <p className="text-[11px] text-ink-muted">Cost returned</p>
                              <p className="text-sm font-semibold text-ink tabular-nums mt-0.5">
                                {fmt(monthlyData.priorRecoveryCost || 0)}
                              </p>
                              <p className="text-[10px] text-ink-muted mt-0.5">Not in net</p>
                            </div>
                            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                              <p className="text-[11px] text-emerald-800">+ Profit part</p>
                              <p className="text-sm font-semibold text-emerald-800 tabular-nums mt-0.5">
                                {fmt(monthlyData.priorRecoveryProfit || 0)}
                              </p>
                              <p className="text-[10px] text-emerald-700/80 mt-0.5">Added to net</p>
                            </div>
                          </div>
                        </li>
                        <li className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5">
                          <div className="min-w-0">
                            <p className="font-medium text-ink">− Expenses</p>
                            <p className="text-xs text-ink-muted mt-0.5">Rent, utilities, shop costs</p>
                          </div>
                          <p className="font-semibold text-rose-700 tabular-nums shrink-0">{fmt(monthlyData.generalExpenses)}</p>
                        </li>
                        <li className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 bg-ink text-white">
                          <div className="min-w-0">
                            <p className="font-semibold">Net month</p>
                            <p className="text-xs text-white/70 mt-0.5">Trading + recovery profit − expenses</p>
                          </div>
                          <p className="text-lg font-bold tabular-nums shrink-0">
                            {net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}
                          </p>
                        </li>
                      </ul>
                      <div className="px-4 sm:px-5 py-3 border-t border-neutral-100 bg-neutral-50/50">
                        <p className="text-xs text-ink-muted text-pretty">
                          Closing stock {fmt(monthlyData.closingStockValue)} carries to next month — capital, not a loss.
                        </p>
                      </div>
                    </div>

                    {/* Partner share */}
                    <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft p-4 sm:p-5 space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold text-ink">Partner share</h4>
                        <p className="text-xs text-ink-muted mt-0.5">
                          % of net profit · 0 if month is in loss
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={partnerSharePct}
                            onChange={(e) => setPartnerSharePct(e.target.value)}
                            className="w-14 bg-transparent text-sm font-semibold text-ink outline-none tabular-nums"
                            aria-label="Partner percent"
                          />
                          <span className="text-sm text-ink-muted">%</span>
                        </div>
                        {[0, 10, 20, 25, 50].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setPartnerSharePct(String(n))}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors min-h-[40px] ${partnerPct === n
                              ? 'bg-ink text-white border-ink'
                              : 'bg-white border-neutral-200 text-ink-muted hover:bg-neutral-50'
                              }`}
                          >
                            {n}%
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="rounded-xl border border-neutral-200/90 bg-neutral-50 px-3.5 py-3">
                          <p className="text-[11px] font-medium text-ink-muted">Partner gets</p>
                          <p className="text-lg font-bold text-ink tabular-nums mt-1">{fmt(partnerShare)}</p>
                        </div>
                        <div className={`rounded-xl border px-3.5 py-3 ${yourFinal >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                          <p className="text-[11px] font-medium text-ink-muted">Your final</p>
                          <p className={`text-lg font-bold tabular-nums mt-1 ${yourFinal >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {yourFinal >= 0 ? '+' : '−'}{fmt(Math.abs(yourFinal))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Monthly Sales Detail Modal */}
      {showSalesDetailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Monthly Sales Detail Report</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <button
                  onClick={() => setShowSalesDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              {loadingSalesDetail ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="text-gray-600 mt-4">Loading sales details...</p>
                </div>
              ) : monthlySalesDetail.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Package className="mx-auto text-gray-400 mb-3" size={48} />
                  <p className="text-gray-600 font-medium">No Sales Found</p>
                  <p className="text-sm text-gray-500 mt-1">No sales were made in this month</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600">Total Sales</p>
                      <p className="text-2xl font-bold text-indigo-600">
                        Rs. {monthlySalesDetail.reduce((sum, sale) => sum + (parseFloat(sale.totalAmount) || 0), 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Transactions</p>
                      <p className="text-2xl font-bold text-indigo-600">{monthlySalesDetail.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Customers</p>
                      <p className="text-2xl font-bold text-indigo-600">
                        {new Set(monthlySalesDetail.map(sale => sale.customerId || sale.customer?.id || sale.customer?._id).filter(Boolean)).size}
                      </p>
                    </div>
                  </div>

                  {/* Detailed Sales Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Invoice</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Customer</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Products</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Total Qty</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Total Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Added By</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {monthlySalesDetail.map((sale) => {
                          const totalQty = sale.items?.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0) || 0;
                          const customerName = sale.customer?.name || 'Walk-in Customer';
                          const customerContact = sale.customer?.contact || sale.customer?.phone || '';

                          return (
                            <tr key={sale.id || sale._id} className="hover:bg-indigo-50/30 transition-colors">
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="font-semibold text-gray-900">{sale.invoiceNumber || 'N/A'}</span>
                              </td>
                              <td className="px-4 py-4">
                                <div>
                                  <span className="text-gray-800 font-medium">{customerName}</span>
                                  {customerContact && (
                                    <p className="text-xs text-gray-500 mt-0.5">{customerContact}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="text-gray-700">{formatDate(sale.saleDate || sale.createdAt)}</span>
                              </td>
                              <td className="px-4 py-4">
                                <div className="space-y-1 max-w-xs">
                                  {sale.items?.map((item, idx) => (
                                    <div key={idx} className="text-xs bg-gray-50 p-2 rounded border border-gray-200">
                                      <span className="font-medium text-gray-800">{item.productName || 'N/A'}</span>
                                      <span className="text-gray-600"> ({item.size || 'N/A'})</span>
                                      <div className="flex justify-between mt-1">
                                        <span className="text-gray-600">Qty: {item.quantity || 0}</span>
                                        <span className="text-gray-700 font-medium">
                                          Rs. {(parseFloat(item.unitPrice) || 0).toLocaleString()} × {item.quantity || 0} = Rs. {(parseFloat(item.totalPrice) || 0).toLocaleString()}
                                        </span>
                                      </div>
                                    </div>
                                  )) || <span className="text-gray-400">No items</span>}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-center">
                                <span className="font-semibold text-gray-900">{totalQty}</span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="font-bold text-indigo-600 text-lg">
                                  Rs. {(parseFloat(sale.totalAmount) || 0).toLocaleString()}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${sale.paymentStatus === 'Paid'
                                  ? 'bg-green-100 text-green-800 border border-green-300'
                                  : sale.paymentStatus === 'Partial'
                                    ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                    : 'bg-red-100 text-red-800 border border-red-300'
                                  }`}>
                                  {sale.paymentStatus || 'N/A'}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                {sale.addedBy ? (
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    {sale.addedBy}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-sm">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gradient-to-r from-indigo-50 to-purple-50 border-t-2 border-indigo-200">
                        <tr>
                          <td colSpan="4" className="px-4 py-4 text-right font-bold text-gray-700">
                            Grand Total:
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="font-bold text-gray-900">
                              {monthlySalesDetail.reduce((sum, sale) => {
                                const qty = sale.items?.reduce((s, item) => s + (parseFloat(item.quantity) || 0), 0) || 0;
                                return sum + qty;
                              }, 0)}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="font-bold text-indigo-700 text-xl">
                              Rs. {monthlySalesDetail.reduce((sum, sale) => sum + (parseFloat(sale.totalAmount) || 0), 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-4"></td>
                          <td className="px-4 py-4"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Realized profit detail — same rule as Inventory: Paid − sold cost */}
      {showProfitDetailModal && profitBreakdown && (
        <div
          className="fixed inset-0 bg-ink/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => {
            setShowProfitDetailModal(false);
            setExpandedProfitProduct(null);
          }}
        >
          <div
            className="bg-neutral-100 rounded-t-2xl sm:rounded-2xl shadow-elevated max-w-4xl w-full max-h-[92dvh] overflow-y-auto border border-neutral-200/80"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-4 sm:px-6 py-4 border-b border-neutral-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-ink tracking-tight">Realized profit</h3>
                <p className="text-sm text-ink-muted mt-0.5">
                  Paid − sold cost · due clear hone pe profit badhega
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowProfitDetailModal(false);
                  setExpandedProfitProduct(null);
                }}
                className="w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-ink-muted shrink-0"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {[
                  { label: 'Billed', value: `Rs. ${(profitBreakdown.totalRevenue || 0).toLocaleString()}`, tone: 'text-ink' },
                  { label: 'Paid', value: `Rs. ${(profitBreakdown.totalPaid || 0).toLocaleString()}`, tone: 'text-emerald-700' },
                  { label: 'Due', value: `Rs. ${(profitBreakdown.totalRemaining || 0).toLocaleString()}`, tone: (profitBreakdown.totalRemaining || 0) > 0 ? 'text-amber-800' : 'text-emerald-700' },
                  { label: 'Realized profit', value: formatSignedMoney(profitBreakdown.totalProfit), tone: (profitBreakdown.totalProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700' }
                ].map((m) => (
                  <div key={m.label} className="bg-white rounded-xl border border-neutral-200/90 px-3.5 py-3 shadow-soft">
                    <p className="text-[11px] font-medium text-ink-muted normal-case">{m.label}</p>
                    <p className={`mt-1 text-base sm:text-lg font-bold tabular-nums tracking-tight break-words ${m.tone}`}>
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-neutral-200/90 p-4 shadow-soft space-y-2">
                <p className="text-[11px] font-medium text-ink-muted">Calculation</p>
                <p className="text-sm text-ink">
                  Realized profit = Paid − sold cost
                </p>
                <p className="text-sm text-ink-muted tabular-nums">
                  Rs. {(profitBreakdown.totalPaid || 0).toLocaleString()} − Rs. {(profitBreakdown.totalCost || 0).toLocaleString()}{' '}
                  = <span className={`font-bold ${(profitBreakdown.totalProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatSignedMoney(profitBreakdown.totalProfit)}
                  </span>
                </p>
                <p className="text-xs text-ink-muted">
                  Unsold stock is capital (not loss). Due payments are not profit until collected.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-neutral-200/90 shadow-soft overflow-hidden">
                <div className="px-4 sm:px-5 py-3.5 border-b border-neutral-100">
                  <h4 className="text-sm font-semibold text-ink">Products</h4>
                  <p className="text-xs text-ink-muted mt-0.5">Paid · due · realized profit</p>
                </div>

                {profitBreakdown.productDetails.length === 0 ? (
                  <div className="text-center py-12 text-ink-muted text-sm">No products sold yet</div>
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {profitBreakdown.productDetails.map((product, index) => {
                      const key = `${product.productName}-${index}`;
                      const isOpen = expandedProfitProduct === key;
                      const customers = product.customersRemainingList || [];
                      const profit = product.totalProfit || 0;
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            onClick={() => setExpandedProfitProduct(isOpen ? null : key)}
                            className="w-full text-left px-4 sm:px-5 py-4 hover:bg-neutral-50/80 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-ink">
                                  {index + 1}. {product.productName}
                                </p>
                                <p className="text-xs text-ink-muted mt-0.5">
                                  Sold {product.soldQty || 0} pcs · sold cost Rs. {(product.soldCost || 0).toLocaleString()}
                                  {(product.unsoldQty || 0) > 0 && (
                                    <> · unsold {product.unsoldQty} (Rs. {(product.unsoldStockValue || 0).toLocaleString()})</>
                                  )}
                                </p>
                                <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs sm:text-sm max-w-md">
                                  <div>
                                    <p className="text-[10px] font-medium text-ink-muted">Paid</p>
                                    <p className="font-semibold text-emerald-700 tabular-nums">Rs. {(product.paidAmount || 0).toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-medium text-ink-muted">Due</p>
                                    <p className={`font-semibold tabular-nums ${(product.remainingAmount || 0) > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                                      Rs. {(product.remainingAmount || 0).toLocaleString()}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-medium text-ink-muted">Profit</p>
                                    <p className={`font-bold tabular-nums ${profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                      {formatSignedMoney(profit)}
                                    </p>
                                  </div>
                                </div>
                                {(product.remainingAmount || 0) > 0 && (
                                  <p className="text-[11px] text-amber-800 mt-2">
                                    {customers.length} customer{customers.length !== 1 ? 's' : ''} with due
                                  </p>
                                )}
                              </div>
                              <span className="w-8 h-8 rounded-full bg-neutral-50 border border-neutral-200 flex items-center justify-center text-ink-muted shrink-0">
                                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </span>
                            </div>
                          </button>

                          {isOpen && (
                            <div className="px-4 sm:px-5 pb-4 space-y-3 bg-neutral-50/60 border-t border-neutral-100">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 text-xs">
                                <div className="bg-white rounded-xl p-3 border border-neutral-200/80">
                                  <p className="text-ink-muted">Billed</p>
                                  <p className="font-semibold tabular-nums mt-0.5">Rs. {(product.totalRevenue || 0).toLocaleString()}</p>
                                </div>
                                <div className="bg-white rounded-xl p-3 border border-neutral-200/80">
                                  <p className="text-ink-muted">Paid</p>
                                  <p className="font-semibold text-emerald-700 tabular-nums mt-0.5">Rs. {(product.paidAmount || 0).toLocaleString()}</p>
                                </div>
                                <div className="bg-white rounded-xl p-3 border border-neutral-200/80">
                                  <p className="text-ink-muted">Sold cost</p>
                                  <p className="font-semibold tabular-nums mt-0.5">Rs. {(product.soldCost || 0).toLocaleString()}</p>
                                </div>
                                <div className="bg-white rounded-xl p-3 border border-neutral-200/80">
                                  <p className="text-ink-muted">Due</p>
                                  <p className={`font-semibold tabular-nums mt-0.5 ${(product.remainingAmount || 0) > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                                    Rs. {(product.remainingAmount || 0).toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              <div>
                                <p className="text-sm font-semibold text-ink mb-2">Customers with due</p>
                                {customers.length === 0 ? (
                                  <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                                    Fully recovered for this product
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
                                    <table className="w-full text-sm min-w-[480px]">
                                      <thead className="bg-neutral-50 border-b border-neutral-100">
                                        <tr>
                                          <th className="text-left py-2.5 px-3 text-xs font-medium text-ink-muted">Customer</th>
                                          <th className="text-left py-2.5 px-3 text-xs font-medium text-ink-muted">Invoice</th>
                                          <th className="text-right py-2.5 px-3 text-xs font-medium text-ink-muted">Billed</th>
                                          <th className="text-right py-2.5 px-3 text-xs font-medium text-ink-muted">Paid</th>
                                          <th className="text-right py-2.5 px-3 text-xs font-medium text-ink-muted">Due</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {customers.map((c, ci) => (
                                          <tr key={ci} className="border-b border-neutral-50">
                                            <td className="py-2.5 px-3">
                                              <p className="font-medium text-ink">{formatDisplayName(c.customerName)}</p>
                                              {c.contact && <p className="text-xs text-ink-muted">{c.contact}</p>}
                                            </td>
                                            <td className="py-2.5 px-3 text-ink-muted text-xs">{c.invoiceNumber || '—'}</td>
                                            <td className="py-2.5 px-3 text-right tabular-nums">Rs. {c.billedAmount.toLocaleString()}</td>
                                            <td className="py-2.5 px-3 text-right text-emerald-700 tabular-nums">Rs. {c.paidAmount.toLocaleString()}</td>
                                            <td className="py-2.5 px-3 text-right font-semibold text-amber-800 tabular-nums">Rs. {c.remainingAmount.toLocaleString()}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Value Detail Modal */}
      {showStockDetailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Total Stock Value - Product Details</h3>
                  <p className="text-sm text-gray-600 mt-1">Kun kun se products available hain total stock mein</p>
                </div>
                <button
                  onClick={() => setShowStockDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Products</p>
                    <p className="text-2xl font-bold text-blue-600">{stockDetails.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Quantity</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      {stockDetails.reduce((sum, item) => sum + item.totalQty, 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Stock Value</p>
                    <p className="text-2xl font-bold text-blue-700">
                      Rs. {stockDetails.reduce((sum, item) => sum + item.stockValue, 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Product Stock Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Brand</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Sizes & Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Total Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Cost/Unit</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Stock Value</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {stockDetails.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                            No products in stock
                          </td>
                        </tr>
                      ) : (
                        stockDetails.map((product, index) => (
                          <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <span className="font-semibold text-gray-600">{index + 1}</span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="font-medium text-gray-900">{product.productName}</span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="text-gray-700">{product.brand}</span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="text-gray-700">{product.category}</span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-1">
                                {product.sizes.length > 0 ? (
                                  product.sizes.map((size, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-gray-100 text-xs rounded">
                                      {size.size}: {size.quantity}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-gray-400 text-xs">No sizes</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <span className="font-semibold text-gray-900">{product.totalQty}</span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="text-blue-700 font-medium">Rs. {product.costPerUnit.toLocaleString()}</span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="font-bold text-blue-700 text-lg">
                                Rs. {product.stockValue.toLocaleString()}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-gradient-to-r from-blue-50 to-indigo-50 border-t-2 border-blue-200">
                      <tr>
                        <td colSpan="5" className="px-4 py-4 text-right font-bold text-gray-700">
                          Grand Total:
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="font-bold text-gray-900">
                            {stockDetails.reduce((sum, item) => sum + item.totalQty, 0)}
                          </span>
                        </td>
                        <td className="px-4 py-4"></td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="font-bold text-blue-700 text-xl">
                            Rs. {stockDetails.reduce((sum, item) => sum + item.stockValue, 0).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;

