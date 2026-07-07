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
  ArrowDown,
  Activity
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getDashboardStats, getOnlineSalesStats } from '../services/api';
import HomepageSlider from '../components/HomepageSlider';
import { StatCardShimmer, CardShimmer } from '../components/Shimmer';

const CHART_COLORS = ['#0a0a0a', '#404040', '#737373', '#a3a3a3', '#d4d4d4'];

const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '12px',
  boxShadow: '0 12px 40px -12px rgb(0 0 0 / 0.15)',
  fontSize: '13px'
};

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
      // silent
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

  const hasProducts = stats?.inventory?.totalProducts > 0;

  const statCards = [
    { title: 'Total Stock', value: stats?.inventory?.totalStock || 0, icon: Package, change: 'units in warehouse', positive: true },
    { title: 'Total Sales', value: `Rs. ${(stats?.sales?.totalSales || 0).toLocaleString()}`, icon: DollarSign, change: 'lifetime revenue', positive: true },
    { title: 'Outstanding Credit', value: `Rs. ${(stats?.sales?.totalCredit || 0).toLocaleString()}`, icon: TrendingUp, change: 'pending collection', positive: false },
    { title: 'Low Stock Items', value: stats?.inventory?.lowStockItems?.length || 0, icon: AlertTriangle, change: 'need attention', positive: false },
    { title: 'Total Customers', value: stats?.customers?.total || 0, icon: Users, change: 'registered', positive: true },
    { title: 'In Production', value: stats?.production?.inProcess || 0, icon: Factory, change: 'active batches', positive: true },
    ...(hasProducts ? [
      { title: 'Online Revenue', value: `Rs. ${(onlineSalesStats?.totalRevenue || 0).toLocaleString()}`, icon: DollarSign, change: `${onlineSalesStats?.deliveredOrders || 0} delivered`, positive: true },
      { title: 'Online Orders', value: onlineSalesStats?.totalOrders || 0, icon: ShoppingCart, change: `${onlineSalesStats?.pendingOrders || 0} pending`, positive: true }
    ] : [])
  ];

  const salesData = stats?.salesByDate?.map(item => ({
    date: new Date(item._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sales: item.totalSales,
    count: item.count
  })) || [];

  const topProductsData = stats?.topProducts?.map(item => ({
    name: item._id?.length > 12 ? item._id.slice(0, 12) + '…' : item._id,
    quantity: item.totalQuantity,
    revenue: item.totalRevenue
  })) || [];

  const salesTypeData = [
    { name: 'Cash Received', value: stats?.sales?.totalPaid || 0 },
    { name: 'Credit Outstanding', value: stats?.sales?.totalCredit || 0 }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-8">
      {/* Hero strip */}
      <div className="relative overflow-hidden rounded-2xl bg-ink text-white p-6 sm:p-8 border border-neutral-800 shadow-elevated">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '20px 20px'
        }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-neutral-400 text-xs uppercase tracking-[0.2em] mb-2">
              <Activity size={14} />
              Overview
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Business at a glance
            </h1>
            <p className="text-neutral-400 mt-2 text-sm max-w-md">
              Track inventory, sales, credit, and production from one clean dashboard.
            </p>
          </div>
          <div className="flex gap-6 sm:gap-8">
            <div className="text-center sm:text-right">
              <p className="text-[10px] uppercase tracking-widest text-neutral-500">Products</p>
              <p className="text-2xl font-bold mt-1">{stats?.inventory?.totalProducts || 0}</p>
            </div>
            <div className="text-center sm:text-right border-l border-white/10 pl-6 sm:pl-8">
              <p className="text-[10px] uppercase tracking-widest text-neutral-500">Transactions</p>
              <p className="text-2xl font-bold mt-1">{stats?.sales?.totalTransactions || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <HomepageSlider />

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="stat-card group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                    {stat.title}
                  </p>
                  <h3 className="text-xl sm:text-2xl font-bold text-ink mb-3 break-words tracking-tight">
                    {stat.value}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {stat.positive ? (
                      <ArrowUp size={12} className="text-neutral-600" />
                    ) : (
                      <ArrowDown size={12} className="text-neutral-400" />
                    )}
                    <span className="text-xs text-neutral-500">{stat.change}</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-neutral-100 border border-neutral-200 group-hover:bg-ink group-hover:border-ink transition-colors duration-300 flex-shrink-0">
                  <Icon className="text-ink group-hover:text-white transition-colors duration-300" size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-ink tracking-tight">Sales Trend</h3>
              <p className="text-xs text-neutral-400 mt-0.5">Last 30 days</p>
            </div>
            <span className="badge-mono">Revenue</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" stroke="#a3a3a3" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#a3a3a3" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`Rs. ${Number(v).toLocaleString()}`, 'Sales']} />
              <Line type="monotone" dataKey="sales" stroke="#0a0a0a" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#0a0a0a' }} name="Sales (Rs.)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-ink tracking-tight">Cash vs Credit</h3>
              <p className="text-xs text-neutral-400 mt-0.5">Payment split</p>
            </div>
            <span className="badge-mono">Split</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            {salesTypeData.length > 0 ? (
              <PieChart>
                <Pie
                  data={salesTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {salesTypeData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `Rs. ${Number(value).toLocaleString()}`} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-400 text-sm">No sales data yet</div>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-ink tracking-tight">Top Products</h3>
            <p className="text-xs text-neutral-400 mt-0.5">By quantity sold</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topProductsData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" stroke="#a3a3a3" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#a3a3a3" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="quantity" fill="#171717" name="Qty Sold" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle className="text-ink" size={18} />
            <div>
              <h3 className="text-lg font-bold text-ink tracking-tight">Low Stock Alerts</h3>
              <p className="text-xs text-neutral-400">Items running low</p>
            </div>
          </div>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {stats?.inventory?.lowStockItems?.length > 0 ? (
              stats.inventory.lowStockItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-200 hover:border-neutral-300 transition-colors">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{item.productName}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{item.brand} · {item.category}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-lg font-bold text-ink">{item.quantity}</p>
                    <p className="text-[10px] uppercase tracking-wider text-neutral-400">left</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-neutral-400">
                <Package size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">All stock levels healthy</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Online sales */}
      {hasProducts && onlineSalesStats && onlineSalesStats.totalOrders > 0 && (
        <div className="card">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-ink tracking-tight">Online Sales</h3>
            <p className="text-xs text-neutral-400 mt-0.5">E-commerce performance</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Revenue', value: `Rs. ${onlineSalesStats.totalRevenue.toLocaleString()}`, sub: `${onlineSalesStats.deliveredOrders} delivered` },
              { label: 'Orders', value: onlineSalesStats.totalOrders, sub: `${onlineSalesStats.pendingOrders} pending` },
              { label: 'Units Sold', value: onlineSalesStats.totalUnitsSold, sub: 'online channel' },
              { label: 'Avg. Order', value: `Rs. ${Math.round(onlineSalesStats.averageOrderValue).toLocaleString()}`, sub: 'per order' },
            ].map((item, i) => (
              <div key={i} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">{item.label}</p>
                <p className="text-xl font-bold text-ink mt-1 break-words">{item.value}</p>
                <p className="text-xs text-neutral-500 mt-1">{item.sub}</p>
              </div>
            ))}
          </div>
          {onlineSalesStats.productSales?.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Size</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {onlineSalesStats.productSales.slice(0, 10).map((product, index) => (
                    <tr key={index} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-ink">{product.productName}</td>
                      <td className="px-4 py-3 text-neutral-500">{product.size}</td>
                      <td className="px-4 py-3 font-semibold">{product.totalQuantity}</td>
                      <td className="px-4 py-3 text-neutral-500">Rs. {product.unitPrice.toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold">Rs. {product.totalRevenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: 'Inventory Value', value: `Rs. ${(stats?.inventory?.totalValue || 0).toLocaleString()}`, sub: `${stats?.inventory?.totalProducts || 0} products`, icon: Package },
          { title: 'Payments Received', value: `Rs. ${(stats?.sales?.totalPaid || 0).toLocaleString()}`, sub: `${stats?.sales?.totalTransactions || 0} transactions`, icon: DollarSign },
          { title: 'In Production', value: stats?.production?.inProcess || 0, sub: 'active batches', icon: Factory },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="relative overflow-hidden rounded-2xl bg-ink text-white p-6 border border-neutral-800 group hover:shadow-elevated transition-shadow">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-400">{item.title}</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-2 tracking-tight">{item.value}</p>
                  <p className="text-neutral-500 text-xs mt-2">{item.sub}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/10 border border-white/10">
                  <Icon size={20} className="text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
