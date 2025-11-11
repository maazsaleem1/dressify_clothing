import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Tags,
  Users,
  ShoppingCart,
  Factory,
  FileText,
  Menu,
  X
} from 'lucide-react';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/inventory', icon: Package, label: 'Inventory' },
    { path: '/brands-categories', icon: Tags, label: 'Brands & Categories' },
    { path: '/customers', icon: Users, label: 'Customers' },
    { path: '/sales', icon: ShoppingCart, label: 'Sales & Credit' },
    { path: '/production', icon: Factory, label: 'Production' },
    { path: '/reports', icon: FileText, label: 'Reports' },
  ];

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'
          } bg-gradient-to-b from-primary-800 to-primary-900 text-white transition-all duration-300 flex flex-col shadow-xl`}
      >
        {/* Logo */}
        <div className="p-6 flex items-center justify-between border-b border-primary-700">
          {sidebarOpen && (
            <div>
              <h1 className="text-xl font-bold">Dressify</h1>
              <p className="text-xs text-primary-200">Clothing</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-primary-700 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active
                    ? 'bg-white text-primary-800 shadow-lg'
                    : 'hover:bg-primary-700 text-primary-100'
                  }`}
              >
                <Icon size={20} />
                {sidebarOpen && (
                  <span className="font-medium">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {sidebarOpen && (
          <div className="p-4 border-t border-primary-700">
            <p className="text-xs text-primary-200 text-center">
              © 2025 Dressify Clothing
            </p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {menuItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Welcome back! Here's what's happening today.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">Admin User</p>
                <p className="text-xs text-gray-500">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white font-bold">
                A
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;

