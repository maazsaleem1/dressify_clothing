import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Tags,
  Users,
  ShoppingCart,
  Factory,
  FileText,
  Menu,
  X,
  Image as ImageIcon,
  ShoppingBag,
  Star,
  LogOut,
  Receipt
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { showSuccess, showError } from '../utils/toast';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Closed by default on mobile
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  // Open sidebar on desktop, close on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      try {
        await logout();
        showSuccess('Logged out successfully!');
        navigate('/login');
      } catch (error) {
        showError('Error signing out. Please try again.');
      }
    }
  };

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/inventory', icon: Package, label: 'Inventory' },
    { path: '/brands-categories', icon: Tags, label: 'Brands & Categories' },
    { path: '/customers', icon: Users, label: 'Customers' },
    { path: '/sales', icon: ShoppingCart, label: 'Sales & Credit' },
    { path: '/production', icon: Factory, label: 'Production' },
    { path: '/expenses', icon: Receipt, label: 'Daily Expenses' },
    { path: '/reports', icon: FileText, label: 'Reports' },
    { path: '/slider', icon: ImageIcon, label: 'Homepage Slider' },
    { path: '/orders', icon: ShoppingBag, label: 'Orders' },
    { path: '/reviews', icon: Star, label: 'Reviews' },
  ];

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-0 md:w-20'
          } bg-gradient-to-b from-primary-800 to-primary-900 text-white transition-all duration-300 flex flex-col shadow-xl fixed md:relative h-full z-40 overflow-hidden`}
      >
        {/* Logo */}
        <div className="p-4 sm:p-6 flex items-center justify-between border-b border-primary-700">
          {sidebarOpen && (
            <div className="flex-1">
              <h1 className="text-lg sm:text-xl font-bold">Dressify</h1>
              <p className="text-xs text-primary-200">Clothing</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-primary-700 rounded-lg transition-colors flex-shrink-0"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 sm:p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => {
                  // Close sidebar on mobile when navigating
                  if (window.innerWidth < 768) {
                    setSidebarOpen(false);
                  }
                }}
                className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg transition-all ${active
                  ? 'bg-white text-primary-800 shadow-lg'
                  : 'hover:bg-primary-700 text-primary-100'
                  }`}
              >
                <Icon size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
                {sidebarOpen && (
                  <span className="font-medium text-sm sm:text-base whitespace-nowrap">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {sidebarOpen && (
          <div className="p-3 sm:p-4 border-t border-primary-700 space-y-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg hover:bg-primary-700 text-primary-100 transition-all"
            >
              <LogOut size={18} className="sm:w-5 sm:h-5" />
              <span className="font-medium text-sm sm:text-base">Logout</span>
            </button>
            <p className="text-xs text-primary-200 text-center hidden sm:block">
              © 2025 Dressify Clothing
            </p>
          </div>
        )}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden md:ml-0">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 md:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Toggle menu"
              >
                <Menu size={24} className="text-gray-700" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 truncate">
                  {menuItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 hidden sm:block">
                  Welcome back! Here's what's happening today.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 ml-2">
              <div className="text-right hidden sm:block">
                <p className="text-xs sm:text-sm font-medium text-gray-700 truncate max-w-[120px] sm:max-w-none">
                  {currentUser?.email || 'Admin User'}
                </p>
                <p className="text-xs text-gray-500 hidden md:block">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base">
                {currentUser?.email?.charAt(0).toUpperCase() || 'A'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;

