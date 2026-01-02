import React, { useState, useEffect } from 'react';
import { Download, Calendar, TrendingUp, DollarSign, Package, Users, TrendingDown, ArrowUp, ArrowDown, CreditCard, AlertCircle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getSalesStats, getInventoryStats, getDashboardStats, getMonthlyProfitLoss, getSales } from '../services/api';
import { showInfo } from '../utils/toast';

const Reports = () => {
  const [stats, setStats] = useState(null);
  const [salesStats, setSalesStats] = useState(null);
  const [inventoryStats, setInventoryStats] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [outstandingCredits, setOutstandingCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchStats();
    fetchOutstandingCredits();
  }, [dateRange]);

  useEffect(() => {
    fetchMonthlyData();
  }, [selectedMonth, selectedYear]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [dashRes, salesRes, invRes] = await Promise.all([
        getDashboardStats(),
        getSalesStats(dateRange),
        getInventoryStats()
      ]);
      setStats(dashRes.data);
      setSalesStats(salesRes.data);
      setInventoryStats(invRes.data);
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

  const fetchOutstandingCredits = async () => {
    try {
      const salesRes = await getSales();
      const allSales = salesRes.data;

      // Filter sales with outstanding credit (remainingAmount > 0)
      const outstanding = allSales
        .filter(sale => (sale.remainingAmount || 0) > 0)
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
              onClick={fetchStats}
              className="btn-primary mt-6"
            >
              Apply
            </button>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/10 rounded-lg p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-indigo-100 text-sm">Total Sales</p>
                <ArrowUp className="w-5 h-5 text-green-300" />
              </div>
              <p className="text-3xl font-bold">Rs. {(parseFloat(monthlyData.totalSales) || 0).toLocaleString()}</p>
              <p className="text-indigo-200 text-xs mt-1">{monthlyData.salesCount} transactions</p>
            </div>

            <div className="bg-white/10 rounded-lg p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-indigo-100 text-sm">Total Expenses</p>
                <ArrowDown className="w-5 h-5 text-red-300" />
              </div>
              <p className="text-3xl font-bold">Rs. {(parseFloat(monthlyData.totalExpenses) || 0).toLocaleString()}</p>
              <p className="text-indigo-200 text-xs mt-1">{monthlyData.expensesCount} expenses</p>
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
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <Package size={24} />
            <TrendingUp size={20} className="opacity-75" />
          </div>
          <p className="text-blue-100 text-sm mb-1">Total Stock Value</p>
          <p className="text-2xl font-bold">Rs. {(inventoryStats?.totalValue || 0).toLocaleString()}</p>
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
            <DollarSign size={24} />
            <TrendingUp size={20} className="opacity-75" />
          </div>
          <p className="text-orange-100 text-sm mb-1">Outstanding Credit</p>
          <p className="text-2xl font-bold">Rs. {(salesStats?.creditGiven || 0).toLocaleString()}</p>
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
              <h3 className="text-xl font-bold text-gray-800">Outstanding Credit</h3>
              <p className="text-sm text-gray-600">Details of all unpaid and partially paid sales</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-orange-600">
              Rs. {(outstandingCredits.reduce((sum, sale) => sum + (parseFloat(sale.remainingAmount) || 0), 0)).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">{outstandingCredits.length} pending transactions</p>
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {outstandingCredits.map((sale) => {
                  const remaining = parseFloat(sale.remainingAmount) || 0;
                  const total = parseFloat(sale.totalAmount) || 0;
                  const paid = parseFloat(sale.paidAmount) || 0;
                  const paymentPercentage = total > 0 ? ((paid / total) * 100).toFixed(0) : 0;

                  return (
                    <tr key={sale.id || sale._id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-semibold text-gray-900">{sale.invoiceNumber || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-gray-800 font-medium">{sale.customer?.name || 'N/A'}</span>
                        {sale.customer?.phone && (
                          <p className="text-xs text-gray-500 mt-0.5">{sale.customer.phone}</p>
                        )}
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
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gradient-to-r from-orange-50 to-amber-50 border-t-2 border-orange-200">
                <tr>
                  <td colSpan="5" className="px-4 py-4 text-right font-bold text-gray-700">
                    Total Outstanding:
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="font-bold text-orange-700 text-xl">
                      Rs. {(outstandingCredits.reduce((sum, sale) => sum + (parseFloat(sale.remainingAmount) || 0), 0)).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;

