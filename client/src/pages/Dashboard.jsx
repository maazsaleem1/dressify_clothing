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
import { getDashboardStats } from '../services/api';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await getDashboardStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

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
      value: stats?.inventory?.lowStockItems || 0,
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
    }
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
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="stat-card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    {stat.title}
                  </p>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {stat.value}
                  </h3>
                  <div className="flex items-center gap-1">
                    {stat.positive ? (
                      <ArrowUp size={16} className="text-green-500" />
                    ) : (
                      <ArrowDown size={16} className="text-red-500" />
                    )}
                    <span className={`text-sm font-medium ${stat.positive ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.change}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">vs last month</span>
                  </div>
                </div>
                <div className={`${stat.color} p-3 rounded-xl`}>
                  <Icon className="text-white" size={24} />
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

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold">Inventory Value</h4>
            <Package size={24} />
          </div>
          <p className="text-3xl font-bold mb-2">
            Rs. {(stats?.inventory?.totalValue || 0).toLocaleString()}
          </p>
          <p className="text-blue-100 text-sm">
            {stats?.inventory?.totalProducts || 0} different products
          </p>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold">Payments Received</h4>
            <DollarSign size={24} />
          </div>
          <p className="text-3xl font-bold mb-2">
            Rs. {(stats?.sales?.totalPaid || 0).toLocaleString()}
          </p>
          <p className="text-green-100 text-sm">
            {stats?.sales?.totalTransactions || 0} total transactions
          </p>
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold">Production Status</h4>
            <Factory size={24} />
          </div>
          <p className="text-3xl font-bold mb-2">
            {stats?.production?.inProcess || 0}
          </p>
          <p className="text-purple-100 text-sm">
            batches in production
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

