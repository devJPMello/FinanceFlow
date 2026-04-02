import { Outlet, NavLink } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import {
  LayoutDashboard,
  Receipt,
  Tag,
  Target,
  Menu,
  X,
  Wallet,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import CommandPalette from './CommandPalette';

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Transações', href: '/transactions', icon: Receipt },
    { name: 'Categorias', href: '/categories', icon: Tag },
    { name: 'Metas', href: '/goals', icon: Target },
    { name: 'TaxVision', href: '/tax-vision', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <CommandPalette />
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow"
        type="button"
      >
        <Menu className="w-6 h-6 text-gray-700" />
      </button>

      {mobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 w-72 bg-white shadow-2xl z-50 transform transition-transform">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between h-20 px-6 border-b border-gray-100">
                <div className="flex items-center">
                  <img
                    src="/FinanceFlow.png"
                    alt="FinanceFlow"
                    className="h-32 w-auto mr-3"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div className="w-32 h-32 bg-[#16A34A] rounded-xl flex items-center justify-center mr-3 shadow-lg hidden">
                    <Wallet className="w-16 h-16 text-white" />
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  type="button"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                          isActive
                            ? 'bg-gradient-to-r from-green-50 to-green-100 text-[#16A34A] font-semibold shadow-sm border border-green-200'
                            : 'text-[#111827] hover:bg-gray-50'
                        }`
                      }
                    >
                      <Icon className={`w-5 h-5 mr-3 ${mobileMenuOpen ? 'animate-fade-in' : ''}`} />
                      {item.name}
                    </NavLink>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-gray-100 flex items-center justify-center">
                <UserButton
                  afterSignOutUrl="/sign-in"
                  appearance={{
                    elements: {
                      avatarBox: 'w-10 h-10 ring-2 ring-white shadow-md',
                    },
                  }}
                />
              </div>
            </div>
          </aside>
        </>
      )}

      <aside className="hidden lg:block fixed inset-y-0 left-0 w-72 bg-white/80 backdrop-blur-xl border-r border-gray-200/50 shadow-sm z-30">
        <div className="flex flex-col h-full">
          <div className="flex items-center h-20 px-6 border-b border-gray-100">
            <div className="flex items-center">
              <img
                src="/FinanceFlow.png"
                alt="FinanceFlow"
                className="h-32 w-auto mr-3"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="w-32 h-32 bg-[#16A34A] rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-[#16A34A]/30 hidden">
                <Wallet className="w-16 h-16 text-white" />
              </div>
            </div>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? 'bg-gradient-to-r from-green-50 to-green-100 text-[#16A34A] font-semibold shadow-sm border border-green-200'
                        : 'text-[#111827] hover:bg-gray-50'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 group-hover:scale-110 transition-transform flex-shrink-0" />
                  <span className="ml-3">{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-100 flex items-center justify-center">
            <UserButton
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: {
                  avatarBox: 'w-10 h-10 ring-2 ring-white shadow-md',
                },
              }}
            />
          </div>
        </div>
      </aside>

      <main className="lg:ml-72 p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
