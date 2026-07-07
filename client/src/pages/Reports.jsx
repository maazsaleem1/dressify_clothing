import React, { useState, useEffect } from 'react';
import { Download, Calendar, TrendingUp, DollarSign, Package, Users, TrendingDown, ArrowUp, ArrowDown, CreditCard, AlertCircle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getSalesStats, getInventoryStats, getDashboardStats, getMonthlyProfitLoss, getSales, getInventory, getOnlineSalesStats, getCustomers, getPayments } from '../services/api';
import { showInfo } from '../utils/toast';

const Reports = () => {
  const [stats, setStats] = useState(null);
  const [salesStats, setSalesStats] = useState(null);
  const [inventoryStats, setInventoryStats] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
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
  const [showStockDetailModal, setShowStockDetailModal] = useState(false);
  const [stockDetails, setStockDetails] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [paymentsList, setPaymentsList] = useState([]);

  // Load data once on mount; refetch only when user clicks Apply
  useEffect(() => {
    fetchStats();
    fetchOutstandingCredits();
    fetchPaymentsReport();
  }, []);

  const fetchPaymentsReport = async () => {
    try {
      const [paymentsRes, salesRes] = await Promise.all([
        getPayments({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
        getSales()
      ]);
      const fromCollection = paymentsRes.data || [];
      const sales = salesRes.data || [];

      const start = dateRange.startDate ? new Date(dateRange.startDate + 'T00:00:00') : null;
      const end = dateRange.endDate ? new Date(dateRange.endDate + 'T23:59:59.999') : null;

      const toDate = (val) => {
        if (val == null) return null;
        if (val instanceof Date) return val;
        if (val?.toDate && typeof val.toDate === 'function') return val.toDate();
        if (val?.seconds != null) return new Date(val.seconds * 1000);
        return new Date(val);
      };

      const inRange = (dateObj) => {
        if (!dateObj || isNaN(dateObj.getTime())) return false;
        if (start && dateObj < start) return false;
        if (end && dateObj > end) return false;
        return true;
      };

      const collectionKeys = new Set(
        fromCollection.map(p => {
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

      const merged = [...fromCollection, ...fromSales].sort((a, b) => {
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
    } catch (error) {
      console.error('Error fetching payments:', error);
      setPaymentsList([]);
    }
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

      // Calculate total profit: Same as Inventory module
      // Total Profit = Total Revenue (from sales) - Total Stock Value (initialQty * costPerUnit)
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
              onlineSalesMap[key] = { totalRevenue: 0 };
            }
            onlineSalesMap[key].totalRevenue += product.totalRevenue || 0;
          });
        }
      } catch (error) {
        // Online sales not available, continue without it
      }

      let totalRevenue = 0;
      let totalStockValue = 0;
      const profitBreakdownData = {
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        productDetails: []
      };

      // Create a map to track product-wise profit (same as Inventory module)
      const productProfitMap = {};

      // Calculate revenue from offline sales (same as calculateTotalEarned in Inventory)
      sales.forEach(sale => {
        sale.items?.forEach(item => {
          const inventoryItemId = item.inventoryId;
          const revenue = parseFloat((item.unitPrice || 0) * (item.quantity || 0));
          totalRevenue += revenue;

          // Find matching inventory item
          const inventoryItem = inventory.find(inv => {
            if (inventoryItemId && (inv.id === inventoryItemId || inv._id === inventoryItemId)) {
              return true;
            }
            return inv.productName === item.productName &&
              inv.sizes?.some(s => s.size === item.size);
          });

          if (inventoryItem) {
            const itemId = inventoryItem.id || inventoryItem._id;
            const productKey = `${inventoryItem.productName}_${inventoryItem.sizes?.[0]?.size || 'N/A'}`;

            if (!productProfitMap[itemId]) {
              // Calculate initialQty (same as Inventory module)
              const sizes = inventoryItem.sizes || [];
              const currentQty = sizes.reduce((sum, size) => sum + (parseFloat(size.quantity) || 0), 0);
              let soldQty = 0;
              sales.forEach(s => {
                s.items?.forEach(i => {
                  if (i.inventoryId === itemId) {
                    soldQty += parseFloat(i.quantity || 0);
                  }
                });
              });
              const initialQty = inventoryItem.initialQuantity || (currentQty + soldQty);

              productProfitMap[itemId] = {
                productName: inventoryItem.productName,
                size: inventoryItem.sizes?.[0]?.size || 'N/A',
                initialQty: initialQty,
                costPerUnit: parseFloat(inventoryItem.costPerUnit || 0),
                stockValue: initialQty * parseFloat(inventoryItem.costPerUnit || 0),
                offlineRevenue: 0,
                onlineRevenue: 0,
                totalRevenue: 0,
                totalProfit: 0
              };
            }

            productProfitMap[itemId].offlineRevenue += revenue;
          }
        });
      });

      // Add online revenue (same as Inventory module)
      inventory.forEach(item => {
        const itemId = item.id || item._id;
        const productKey = `${item.productName}_${item.sizes?.[0]?.size || 'N/A'}`;
        const onlineData = onlineSalesMap[productKey];

        if (onlineData && onlineData.totalRevenue > 0) {
          if (!productProfitMap[itemId]) {
            const sizes = item.sizes || [];
            const currentQty = sizes.reduce((sum, size) => sum + (parseFloat(size.quantity) || 0), 0);
            let soldQty = 0;
            sales.forEach(s => {
              s.items?.forEach(i => {
                if (i.inventoryId === itemId) {
                  soldQty += parseFloat(i.quantity || 0);
                }
              });
            });
            const initialQty = item.initialQuantity || (currentQty + soldQty);

            productProfitMap[itemId] = {
              productName: item.productName,
              size: item.sizes?.[0]?.size || 'N/A',
              initialQty: initialQty,
              costPerUnit: parseFloat(item.costPerUnit || 0),
              stockValue: initialQty * parseFloat(item.costPerUnit || 0),
              offlineRevenue: 0,
              onlineRevenue: 0,
              totalRevenue: 0,
              totalProfit: 0
            };
          }
          productProfitMap[itemId].onlineRevenue += onlineData.totalRevenue;
          totalRevenue += onlineData.totalRevenue;
        }
      });

      // Calculate total revenue and stock value (same as Inventory module)
      Object.values(productProfitMap).forEach(product => {
        product.totalRevenue = product.offlineRevenue + product.onlineRevenue;
        product.totalProfit = product.totalRevenue - product.stockValue;
        totalStockValue += product.stockValue;
      });

      const calculatedTotalProfit = totalRevenue - totalStockValue;
      setTotalProfit(calculatedTotalProfit);

      // Set profit breakdown for detail modal
      profitBreakdownData.totalRevenue = totalRevenue;
      profitBreakdownData.totalCost = totalStockValue;
      profitBreakdownData.totalProfit = calculatedTotalProfit;
      profitBreakdownData.productDetails = Object.values(productProfitMap)
        .filter(item => item.totalRevenue > 0 || item.stockValue > 0)
        .sort((a, b) => b.totalProfit - a.totalProfit);

      setProfitBreakdown(profitBreakdownData);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyData = async () => {
    try {
      const response = await getMonthlyProfitLoss(selectedYear, selectedMonth);
      setMonthlyData(response.data);
    } catch (error) {
      console.error('Error fetching monthly data:', error);
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

  const handleExport = () => {
    showInfo('Export functionality would generate PDF/Excel report here');
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
          className="btn-primary flex items-center gap-2"
        >
          <Download size={20} />
          Export Report
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="card">
        <div className="flex items-center gap-4">
          <Calendar className="text-gray-400" size={20} />
          <div className="flex items-center gap-3">
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
              className="btn-primary mt-6"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Payment Received (Initial + Recovery) */}
      <div className="card border-2 border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <DollarSign size={22} className="text-emerald-600" />
          Payment Received
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          All money received in the selected period (initial sale payments and recovery payments on invoices).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 border border-emerald-100 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Today</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">Rs. {paymentsToday.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-emerald-100 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">This Month</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">Rs. {paymentsThisMonth.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-emerald-100 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">In Date Range</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              Rs. {paymentsList.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-emerald-100 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Transactions</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{paymentsList.length}</p>
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
        <div>
          <h4 className="font-medium text-gray-700 mb-3">Payment breakdown by invoice</h4>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            {paymentsList.length === 0 ? (
              <p className="p-6 text-gray-500 text-center">No payments in the selected date range.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">By</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {paymentsList.map((p) => {
                    const d = p.paymentDate;
                    const dateObj = d instanceof Date ? d : (d?.toDate ? d.toDate() : new Date(d));
                    const dateStr = isNaN(dateObj.getTime()) ? 'N/A' : dateObj.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
                    return (
                      <tr key={p.id || p._id}>
                        <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{dateStr}</td>
                        <td className="px-4 py-2 font-medium text-gray-900">{p.invoiceNumber || '–'}</td>
                        <td className="px-4 py-2 text-gray-700">{p.customerName || '–'}</td>
                        <td className="px-4 py-2 text-right font-semibold text-emerald-700">Rs. {(parseFloat(p.amount) || 0).toLocaleString()}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.paymentType === 'Initial Sale' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                            {p.paymentType || '–'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-600">{p.paymentMethod || 'Cash'}</td>
                        <td className="px-4 py-2 text-gray-700 text-xs">
                          {p.editedBy ? (
                            <span>Edited: <strong>{p.editedBy}</strong></span>
                          ) : p.addedBy ? (
                            <span>Added: <strong>{p.addedBy}</strong></span>
                          ) : p.saleAddedBy ? (
                            <span>Sale: <strong>{p.saleAddedBy}</strong></span>
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
      </div>

      {/* Monthly Profit/Loss Section */}
      <div className="card bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-bold mb-2">Monthly Profit & Loss</h3>
            <p className="text-indigo-100">Track your monthly earnings and expenses</p>
          </div>
          <div className="flex gap-3">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/50"
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
              className="bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {monthlyData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div
              className="bg-white/10 rounded-lg p-6 backdrop-blur-sm cursor-pointer hover:bg-white/20 transition-all duration-200"
              onClick={fetchMonthlySalesDetail}
              title="Click to view detailed sales report"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-indigo-100 text-sm">Total Sales</p>
                <ArrowUp className="w-5 h-5 text-green-300" />
              </div>
              <p className="text-3xl font-bold">Rs. {(parseFloat(monthlyData.totalSales) || 0).toLocaleString()}</p>
              <p className="text-indigo-200 text-xs mt-1">{monthlyData.salesCount} transactions - Click for details</p>
            </div>

            <div className="bg-white/10 rounded-lg p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-indigo-100 text-sm">Total Expenses</p>
                <ArrowDown className="w-5 h-5 text-red-300" />
              </div>
              <p className="text-3xl font-bold">Rs. {(parseFloat(monthlyData.totalExpenses) || 0).toLocaleString()}</p>
              <p className="text-indigo-200 text-xs mt-1">{monthlyData.expensesCount} expenses</p>
            </div>

            <div
              className={`bg-white/10 rounded-lg p-6 backdrop-blur-sm cursor-pointer hover:bg-white/20 transition-all duration-200 ${totalProfit >= 0 ? 'border-2 border-emerald-300' : 'border-2 border-red-300'}`}
              onClick={() => setShowProfitDetailModal(true)}
              title="Click to view profit calculation details"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-indigo-100 text-sm">Total Profit (Products)</p>
                {totalProfit >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-emerald-300" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-300" />
                )}
              </div>
              <p className={`text-3xl font-bold ${totalProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {totalProfit >= 0 ? '+' : ''}Rs. {Math.abs(totalProfit || 0).toLocaleString()}
              </p>
              <p className="text-indigo-200 text-xs mt-1">
                Sales - Stock Value • Click for details
              </p>
            </div>

            <div className={`bg-white/10 rounded-lg p-6 backdrop-blur-sm ${monthlyData.netProfit >= 0 ? 'border-2 border-green-300' : 'border-2 border-red-300'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-indigo-100 text-sm">Net Profit/Loss</p>
                {monthlyData.netProfit >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-300" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-300" />
                )}
              </div>
              <p className={`text-3xl font-bold ${monthlyData.netProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {monthlyData.netProfit >= 0 ? '+' : ''}Rs. {Math.abs(parseFloat(monthlyData.netProfit) || 0).toLocaleString()}
              </p>
              <p className="text-indigo-200 text-xs mt-1">
                {monthlyData.netProfit >= 0 ? 'Profit' : 'Loss'}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
            <p className="text-indigo-100 mt-2">Loading monthly data...</p>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white cursor-pointer hover:shadow-lg transition-all duration-200"
          onClick={() => setShowStockDetailModal(true)}
          title="Click to view product-wise stock details"
        >
          <div className="flex items-center justify-between mb-2">
            <Package size={24} />
            <TrendingUp size={20} className="opacity-75" />
          </div>
          <p className="text-blue-100 text-sm mb-1">Total Stock Value</p>
          <p className="text-2xl font-bold">Rs. {(inventoryStats?.totalValue || 0).toLocaleString()}</p>
          <p className="text-blue-200 text-xs mt-1">{stockDetails.length} products • Click for details</p>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <DollarSign size={24} />
            <TrendingUp size={20} className="opacity-75" />
          </div>
          <p className="text-green-100 text-sm mb-1">Total Sales</p>
          <p className="text-2xl font-bold">Rs. {(salesStats?.totalSales || 0).toLocaleString()}</p>
        </div>

        <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <CreditCard size={24} />
            <AlertCircle size={20} className="opacity-75" />
          </div>
          <p className="text-orange-100 text-sm mb-1">Outstanding Credit</p>
          <p className="text-2xl font-bold">Rs. {(outstandingCredits.reduce((sum, sale) => sum + (parseFloat(sale.remainingAmount) || 0), 0)).toLocaleString()}</p>
          <p className="text-orange-200 text-xs mt-1">{outstandingCredits.length} pending payments</p>
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <Users size={24} />
            <TrendingUp size={20} className="opacity-75" />
          </div>
          <p className="text-purple-100 text-sm mb-1">Total Customers</p>
          <p className="text-2xl font-bold">{stats?.customers?.total || 0}</p>
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

      {/* Total Profit Detail Modal */}
      {showProfitDetailModal && profitBreakdown && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">Total Profit Calculation</h3>
                  <p className="text-sm text-gray-600 mt-1">Detailed breakdown of profit calculation</p>
                </div>
                <button
                  onClick={() => setShowProfitDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gradient-to-r from-emerald-50 to-green-50 p-4 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Revenue (Sales)</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      Rs. {profitBreakdown.totalRevenue.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Cost (Stock Value)</p>
                    <p className="text-2xl font-bold text-blue-600">
                      Rs. {profitBreakdown.totalCost.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Profit</p>
                    <p className={`text-2xl font-bold ${profitBreakdown.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {profitBreakdown.totalProfit >= 0 ? '+' : ''}Rs. {Math.abs(profitBreakdown.totalProfit).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Formula */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-800 mb-2">Calculation Formula:</p>
                  <p className="text-lg text-blue-900 font-mono">
                    Total Profit = Total Revenue - Total Cost
                  </p>
                  <p className="text-sm text-blue-700 mt-2">
                    = Rs. {profitBreakdown.totalRevenue.toLocaleString()} - Rs. {profitBreakdown.totalCost.toLocaleString()}
                  </p>
                  <p className="text-lg font-bold text-blue-900 mt-2">
                    = Rs. {profitBreakdown.totalProfit.toLocaleString()}
                  </p>
                </div>

                {/* Product-wise Breakdown */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Product-wise Profit Breakdown</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gradient-to-r from-emerald-500 to-green-600 text-white">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">#</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Product</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Size</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Initial Qty</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Cost Price</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Stock Value</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Total Revenue</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Profit</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {profitBreakdown.productDetails.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                              No products sold yet
                            </td>
                          </tr>
                        ) : (
                          profitBreakdown.productDetails.map((product, index) => (
                            <tr key={index} className="hover:bg-emerald-50/30 transition-colors">
                              <td className="px-4 py-4 whitespace-nowrap text-center">
                                <span className="font-semibold text-gray-600">{index + 1}</span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="font-medium text-gray-900">{product.productName}</span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="text-gray-700">{product.size}</span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-center">
                                <span className="font-semibold text-gray-900">{product.initialQty || 0}</span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="text-blue-700 font-medium">Rs. {product.costPerUnit.toLocaleString()}</span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="text-blue-700 font-medium">Rs. {product.stockValue.toLocaleString()}</span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="text-indigo-700 font-medium">Rs. {product.totalRevenue.toLocaleString()}</span>
                                  {product.onlineRevenue > 0 && (
                                    <span className="text-xs text-gray-500">
                                      (Offline: Rs. {product.offlineRevenue.toLocaleString()}, Online: Rs. {product.onlineRevenue.toLocaleString()})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className={`font-bold text-lg ${product.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {product.totalProfit >= 0 ? '+' : ''}Rs. {product.totalProfit.toLocaleString()}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="bg-gradient-to-r from-emerald-50 to-green-50 border-t-2 border-emerald-200">
                        <tr>
                          <td colSpan="3" className="px-4 py-4 text-right font-bold text-gray-700">
                            Grand Total:
                          </td>
                          <td className="px-4 py-4"></td>
                          <td className="px-4 py-4"></td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="font-bold text-blue-700">
                              Rs. {profitBreakdown.totalCost.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="font-bold text-indigo-700">
                              Rs. {profitBreakdown.totalRevenue.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`font-bold text-xl ${profitBreakdown.totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {profitBreakdown.totalProfit >= 0 ? '+' : ''}Rs. {profitBreakdown.totalProfit.toLocaleString()}
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

