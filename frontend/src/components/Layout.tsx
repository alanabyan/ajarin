import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Beranda' },
  { to: '/modul-ajar', label: 'Modul Ajar' },
  { to: '/bank-soal', label: 'Bank Soal' },
  { to: '/kelas', label: 'Kelas & Nilai' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-ink/10 bg-white flex flex-col">
        <div className="px-6 py-5 border-b border-ink/10">
          <span className="font-display text-xl text-forest-700">Ajarin</span>
          <p className="text-xs text-ink/50 mt-0.5">Bantu guru fokus mengajar</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm ${
                  isActive ? 'bg-forest-50 text-forest-700 font-medium' : 'text-ink/70 hover:bg-paper'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-ink/10">
          <p className="text-sm font-medium truncate">{user?.nama}</p>
          <p className="text-xs text-ink/50 truncate">
            {user?.mapel} · {user?.jenjang}
          </p>
          <button onClick={logout} className="mt-3 text-sm text-forest-700 hover:underline">
            Keluar
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-paper">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
