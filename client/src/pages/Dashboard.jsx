import React, { useState, useEffect } from 'react';
import {
  Package,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Users,
  ShoppingCart,
  Factory,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getDashboardStats, getOnlineSalesStats } from '../services/api';
import HomepageSlider from '../components/HomepageSlider';
import { StatCardShimmer, CardShimmer } from '../components/Shimmer';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [onlineSalesStats, setOnlineSalesStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [dashboardRes, onlineSalesRes] = await Promise.all([
        getDashboardStats(),
        getOnlineSalesStats()
      ]);
      setStats(dashboardRes.data);
      setOnlineSalesStats(onlineSalesRes.data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardShimmer key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardShimmer />
          <CardShimmer />
        </div>
      </div>
    );
  }

  // Check if there are any products available
  const hasProducts = stats?.inventory?.totalProducts > 0;

  const statCards = [
    {
      title: 'Total Stock',
      value: stats?.inventory?.totalStock || 0,
      icon: Package,
      color: 'bg-blue-500',
      change: '+12%',
      positive: true
    },
    {
      title: 'Total Sales',
      value: `Rs. ${(stats?.sales?.totalSales || 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-green-500',
      change: '+8%',
      positive: true
    },
    {
      title: 'Outstanding Credit',
      value: `Rs. ${(stats?.sales?.totalCredit || 0).toLocaleString()}`,
      icon: TrendingUp,
      color: 'bg-orange-500',
      change: '-5%',
      positive: false
    },
    {
      title: 'Low Stock Items',
      value: stats?.inventory?.lowStockItems?.length || 0,
      icon: AlertTriangle,
      color: 'bg-red-500',
      change: '3 items',
      positive: false
    },
    {
      title: 'Total Customers',
      value: stats?.customers?.total || 0,
      icon: Users,
      color: 'bg-purple-500',
      change: '+15',
      positive: true
    },
    {
      title: 'In Production',
      value: stats?.production?.inProcess || 0,
      icon: Factory,
      color: 'bg-indigo-500',
      change: '2 batches',
      positive: true
    },
    // Only show online stats if products are available
    ...(hasProducts ? [
      {
        title: 'Online Revenue',
        value: `Rs. ${(onlineSalesStats?.totalRevenue || 0).toLocaleString()}`,
        icon: DollarSign,
        color: 'bg-emerald-500',
        change: `${onlineSalesStats?.deliveredOrders || 0} orders`,
        positive: true
      },
      {
        title: 'Online Orders',
        value: onlineSalesStats?.totalOrders || 0,
        icon: ShoppingCart,
        color: 'bg-cyan-500',
        change: `${onlineSalesStats?.pendingOrders || 0} pending`,
        positive: true
      }
    ] : [])
  ];

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  // Prepare sales data for chart
  const salesData = stats?.salesByDate?.map(item => ({
    date: new Date(item._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sales: item.totalSales,
    count: item.count
  })) || [];

  // Prepare top products data
  const topProductsData = stats?.topProducts?.map(item => ({
    name: item._id,
    quantity: item.totalQuantity,
    revenue: item.totalRevenue
  })) || [];

  // Sales type distribution
  const salesTypeData = [
    { name: 'Cash Sales', value: stats?.sales?.totalPaid || 0 },
    { name: 'Credit Sales', value: stats?.sales?.totalCredit || 0 }
  ];

  return (
    <div className="space-y-6">
      {/* Homepage Slider */}
      <HomepageSlider />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="stat-card">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1.5">
                    {stat.title}
                  </p>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 break-words">
                    {stat.value}
                  </h3>
                  <div className="flex items-center gap-1 flex-wrap">
                    {stat.positive ? (
                      <ArrowUp size={14} className="text-green-500 flex-shrink-0" />
                    ) : (
                      <ArrowDown size={14} className="text-red-500 flex-shrink-0" />
                    )}
                    <span className={`text-xs sm:text-sm font-medium ${stat.positive ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.change}
                    </span>
                    <span className="text-xs text-gray-500 hidden sm:inline">vs last month</span>
                  </div>
                </div>
                <div className={`${stat.color} p-2.5 sm:p-3 rounded-xl flex-shrink-0 ml-2`}>
                  <Icon className="text-white" size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Sales Trend (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={{ fill: '#0ea5e9', r: 4 }}
                activeDot={{ r: 6 }}
                name="Sales Amount (Rs.)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Sales Distribution Pie Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Sales Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={salesTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {salesTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `Rs. ${value.toLocaleString()}`}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Products and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Selling Products</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProductsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
              <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="quantity" fill="#0ea5e9" name="Quantity Sold" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Low Stock Alerts */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="text-orange-500" size={20} />
            Low Stock Alerts
          </h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {stats?.inventory?.lowStockItems?.length > 0 ? (
              stats.inventory.lowStockItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div>
                    <p className="font-medium text-gray-800">{item.productName}</p>
                    <p className="text-sm text-gray-600">
                      {item.brand} • {item.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-orange-600">{item.quantity}</p>
                    <p className="text-xs text-gray-500">units left</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package size={48} className="mx-auto mb-2 opacity-50" />
                <p>All stock levels are healthy!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Online Sales Analytics Section */}
      {hasProducts && onlineSalesStats && onlineSalesStats.totalOrders > 0 && (
        <div className="card">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Online Sales Analytics</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-200">
              <p className="text-xs sm:text-sm text-gray-700 mb-1.5 font-medium">Total Online Revenue</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-700 break-words">
                Rs. {onlineSalesStats.totalRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-gray-600 mt-1.5">{onlineSalesStats.deliveredOrders} delivered orders</p>
            </div>
            <div className="bg-green-50 p-3 sm:p-4 rounded-lg border border-green-200">
              <p className="text-xs sm:text-sm text-gray-700 mb-1.5 font-medium">Total Orders</p>
              <p className="text-xl sm:text-2xl font-bold text-green-700">{onlineSalesStats.totalOrders}</p>
              <p className="text-xs text-gray-600 mt-1.5">
                {onlineSalesStats.pendingOrders} pending, {onlineSalesStats.deliveredOrders} delivered
              </p>
            </div>
            <div className="bg-purple-50 p-3 sm:p-4 rounded-lg border border-purple-200">
              <p className="text-xs sm:text-sm text-gray-700 mb-1.5 font-medium">Units Sold</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-700">{onlineSalesStats.totalUnitsSold}</p>
              <p className="text-xs text-gray-600 mt-1.5">Total products sold online</p>
            </div>
            <div className="bg-orange-50 p-3 sm:p-4 rounded-lg border border-orange-200">
              <p className="text-xs sm:text-sm text-gray-700 mb-1.5 font-medium">Average Order Value</p>
              <p className="text-xl sm:text-2xl font-bold text-orange-700 break-words">
                Rs. {Math.round(onlineSalesStats.averageOrderValue).toLocaleString()}
              </p>
              <p className="text-xs text-gray-600 mt-1.5">Per delivered order</p>
            </div>
          </div>

          {/* Top Selling Products */}
          {onlineSalesStats.productSales && onlineSalesStats.productSales.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Top Selling Products (Online)</h4>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Units Sold</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Online Price</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {onlineSalesStats.productSales.slice(0, 10).map((product, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{product.productName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{product.size}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{product.totalQuantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">Rs. {product.unitPrice.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm font-bold text-green-600">
                          Rs. {product.totalRevenue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base sm:text-lg font-semibold">Inventory Value</h4>
            <Package size={20} className="sm:w-6 sm:h-6" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mb-2 break-words">
            Rs. {(stats?.inventory?.totalValue || 0).toLocaleString()}
          </p>
          <p className="text-blue-100 text-xs sm:text-sm">
            {stats?.inventory?.totalProducts || 0} different products
          </p>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base sm:text-lg font-semibold">Payments Received</h4>
            <DollarSign size={20} className="sm:w-6 sm:h-6" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mb-2 break-words">
            Rs. {(stats?.sales?.totalPaid || 0).toLocaleString()}
          </p>
          <p className="text-green-100 text-xs sm:text-sm">
            {stats?.sales?.totalTransactions || 0} total transactions
          </p>
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base sm:text-lg font-semibold">Production Status</h4>
            <Factory size={20} className="sm:w-6 sm:h-6" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mb-2">
            {stats?.production?.inProcess || 0}
          </p>
          <p className="text-purple-100 text-xs sm:text-sm">
            batches in production
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

