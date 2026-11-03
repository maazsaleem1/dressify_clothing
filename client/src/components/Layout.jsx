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
  Landmark,
  LogOut,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Bell
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { showSuccess, showError } from '../utils/toast';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/reports', icon: FileText, label: 'Reports' }
    ]
  },
  {
    label: 'Catalog',
    items: [
      { path: '/inventory', icon: Package, label: 'Inventory' },
      { path: '/brands-categories', icon: Tags, label: 'Brands & categories' }
    ]
  },
  {
    label: 'Commerce',
    items: [
      { path: '/customers', icon: Users, label: 'Customers' },
      { path: '/sales', icon: ShoppingCart, label: 'Sales & credit' },
      { path: '/orders', icon: ShoppingBag, label: 'Orders' }
    ]
  },
  {
    label: 'Operations',
    items: [
      { path: '/production', icon: Factory, label: 'Production' },
      { path: '/expenses', icon: Receipt, label: 'Daily expenses' },
      { path: '/investors', icon: Landmark, label: 'Investors' }
    ]
  },
  {
    label: 'Storefront',
    items: [
      { path: '/slider', icon: ImageIcon, label: 'Homepage slider' },
      { path: '/reviews', icon: Star, label: 'Reviews' }
    ]
  }
];

const flatItems = navGroups.flatMap((g) => g.items);

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

  const isActive = (path) => location.pathname === path;
  const currentPage = flatItems.find((item) => item.path === location.pathname)?.label || 'Dashboard';
  const rawName = currentUser?.email?.split('@')[0] || 'Admin';
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const initial = displayName.charAt(0).toUpperCase() || 'A';

  return (
    <div className="flex h-screen bg-[#f4f4f5]">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-[260px]' : 'w-0 md:w-[72px]'
          } bg-[#0c0c0e] text-white transition-[width] duration-300 ease-out flex flex-col fixed md:relative h-full z-40 overflow-hidden border-r border-white/[0.06]`}
      >
        {/* Brand */}
        <div
          className={`flex items-center border-b border-white/[0.06] min-h-[64px] ${sidebarOpen ? 'px-4 justify-between' : 'px-2 md:justify-center'
            }`}
        >
          {sidebarOpen ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white text-ink flex items-center justify-center font-black text-sm tracking-tight shadow-soft flex-shrink-0">
                D
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-bold tracking-tight leading-none">Dressify</p>
                <p className="text-[11px] text-neutral-500 mt-1 normal-case">Admin workspace</p>
              </div>
            </div>
          ) : (
            <div className="hidden md:flex w-9 h-9 rounded-xl bg-white text-ink items-center justify-center font-black text-sm">
              D
            </div>
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 ${!sidebarOpen ? 'hidden md:inline-flex' : ''
              }`}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              {sidebarOpen && (
                <p className="px-2.5 mb-1.5 text-[11px] font-medium text-neutral-500 normal-case tracking-normal">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
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
                      className={`relative flex items-center gap-3 rounded-xl transition-all duration-200 group ${sidebarOpen ? 'px-3 py-2.5' : 'md:justify-center md:px-0 md:py-2.5'
                        } ${active
                          ? 'bg-white/[0.1] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                          : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
                        }`}
                    >
                      {active && sidebarOpen && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-white" />
                      )}
                      <span
                        className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-colors ${active ? 'bg-white text-ink' : 'bg-transparent group-hover:bg-white/5'
                          }`}
                      >
                        <Icon size={16} strokeWidth={active ? 2.25 : 1.75} />
                      </span>
                      {sidebarOpen && (
                        <span className={`text-[13px] whitespace-nowrap ${active ? 'font-semibold' : 'font-medium'}`}>
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User + logout */}
        <div className={`p-2.5 border-t border-white/[0.06] space-y-2 ${!sidebarOpen ? 'md:px-2' : ''}`}>
          {sidebarOpen && (
            <div className="flex items-center gap-3 px-2.5 py-2 rounded-xl bg-white/[0.04]">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neutral-200 to-neutral-400 text-ink flex items-center justify-center text-xs font-bold flex-shrink-0">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{displayName}</p>
                <p className="text-[10px] text-neutral-500 truncate">Signed in</p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 rounded-xl text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-all ${sidebarOpen ? 'px-3 py-2.5' : 'md:justify-center md:px-0 md:py-2.5'
              }`}
            title="Logout"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0">
              <LogOut size={16} />
            </span>
            {sidebarOpen && <span className="text-[13px] font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white/90 backdrop-blur-xl border-b border-neutral-200/80 px-2.5 sm:px-4 py-2.5 sticky top-0 z-20 shadow-[0_1px_0_0_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 -ml-0.5 hover:bg-neutral-100 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                aria-label="Toggle menu"
              >
                {sidebarOpen ? <X size={20} className="text-ink" /> : <Menu size={20} className="text-ink" />}
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-ink truncate tracking-tight">
                    {currentPage}
                  </h2>
                  <span className="hidden sm:inline-flex text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full normal-case">
                    Live
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 truncate hidden sm:block normal-case">
                  Dressify clothing admin
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
              <button
                type="button"
                className="hidden sm:flex w-9 h-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-ink transition-colors"
                aria-label="Notifications"
              >
                <Bell size={16} />
              </button>
              <div className="flex items-center gap-2 pl-1 sm:pl-2 sm:pr-1 sm:py-1 sm:rounded-xl sm:border sm:border-neutral-200 sm:bg-neutral-50/80">
                <div className="text-right hidden md:block pr-1">
                  <p className="text-xs font-semibold text-ink truncate max-w-[120px] leading-tight">
                    {displayName}
                  </p>
                  <p className="text-[10px] text-neutral-400 leading-tight">
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-8 sm:h-8 rounded-lg bg-ink text-white flex items-center justify-center text-xs font-bold">
                  {initial}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 sm:px-3 sm:py-4 md:px-4 md:py-5 bg-[#f4f4f5]">
          <div className="w-full min-w-0 max-w-none animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
