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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

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

  const isActive = (path) => location.pathname === path;
  const currentPage = menuItems.find(item => item.path === location.pathname)?.label || 'Dashboard';

  return (
    <div className="flex h-screen bg-neutral-100">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-0 md:w-[72px]'
          } bg-ink text-white transition-all duration-300 flex flex-col fixed md:relative h-full z-40 overflow-hidden border-r border-neutral-800`}
      >
        {/* Logo */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-white/10 min-h-[72px]">
          {sidebarOpen ? (
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold tracking-tight">Dressify</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 mt-0.5">Clothing Co.</p>
            </div>
          ) : (
            <div className="hidden md:flex w-full justify-center">
              <span className="text-lg font-black">D</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 text-neutral-300 hover:text-white"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 768) setSidebarOpen(false);
                }}
                title={!sidebarOpen ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${active
                  ? 'bg-white text-ink shadow-elevated'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  } ${!sidebarOpen ? 'md:justify-center md:px-2' : ''}`}
              >
                <Icon size={18} className={`flex-shrink-0 ${active ? 'text-ink' : 'group-hover:text-white'}`} />
                {sidebarOpen && (
                  <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`p-3 border-t border-white/10 space-y-1 ${!sidebarOpen ? 'md:px-2' : ''}`}>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-neutral-400 hover:text-white transition-all ${!sidebarOpen ? 'md:justify-center md:px-2' : ''}`}
            title="Logout"
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarOpen && <span className="font-medium text-sm">Logout</span>}
          </button>
          {sidebarOpen && (
            <p className="text-[10px] text-neutral-500 text-center pt-2 tracking-wide">
              © 2025 Dressify
            </p>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white/80 backdrop-blur-md border-b border-neutral-200 px-3 sm:px-6 md:px-8 py-3 sm:py-4 sticky top-0 z-20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2.5 -ml-1 hover:bg-neutral-100 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Toggle menu"
              >
                <Menu size={22} className="text-ink" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-400 font-semibold hidden sm:block">
                  Admin Panel
                </p>
                <h2 className="text-lg sm:text-2xl font-bold text-ink truncate tracking-tight">
                  {currentPage}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-ink truncate max-w-[160px]">
                  {currentUser?.email?.split('@')[0] || 'Admin'}
                </p>
                <p className="text-xs text-neutral-400">
                  {new Date().toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-ink rounded-xl flex items-center justify-center text-white font-bold text-sm ring-2 ring-neutral-200 ring-offset-1 sm:ring-offset-2">
                {currentUser?.email?.charAt(0).toUpperCase() || 'A'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 md:p-8 bg-grid-pattern bg-neutral-50">
          <div className="max-w-[1600px] mx-auto animate-fade-in w-full min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
