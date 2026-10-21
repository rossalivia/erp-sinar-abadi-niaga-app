import type { Peran } from '@/types/auth';

export interface MenuItem {
  title: string;
  href: string;
  icon: string;
  roles: Peran[];
}

export const MENU_ITEMS: MenuItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: 'LayoutDashboard',
    roles: ['penjualan', 'gudang', 'manajer'],
  },
  {
    title: 'Barang & Stok',
    href: '/barang',
    icon: 'Package',
    roles: ['penjualan', 'gudang', 'manajer'],
  },
  {
    title: 'Kartu Stok',
    href: '/stok',
    icon: 'Layers',
    roles: ['gudang', 'manajer'],
  },
  {
    title: 'Pelanggan',
    href: '/pelanggan',
    icon: 'Users',
    roles: ['penjualan', 'manajer'],
  },
  {
    title: 'Pesanan Jual',
    href: '/pesanan',
    icon: 'ShoppingCart',
    roles: ['penjualan', 'gudang', 'manajer'],
  },
  {
    title: 'Pembelian',
    href: '/pembelian',
    icon: 'Truck',
    roles: ['gudang', 'manajer'],
  },
  {
    title: 'Pemasok',
    href: '/pemasok',
    icon: 'Building2',
    roles: ['gudang', 'manajer'],
  },
  {
    title: 'Laporan',
    href: '/laporan',
    icon: 'BarChart3',
    roles: ['manajer'],
  },
  {
    title: 'Akun & Peran',
    href: '/akun',
    icon: 'UserCog',
    roles: ['manajer'],
  },
  {
    title: 'Profil Saya',
    href: '/profil',
    icon: 'User',
    roles: ['penjualan', 'gudang', 'manajer'],
  },
  {
    title: 'Audit Log',
    href: '/pengaturan/audit-log',
    icon: 'ShieldAlert',
    roles: ['manajer'],
  },
];

export const ROUTE_PERMISSIONS: { pattern: RegExp; roles: Peran[] }[] = [
  { pattern: /^\/($|dashboard)/, roles: ['penjualan', 'gudang', 'manajer'] },
  { pattern: /^\/barang\/baru/, roles: ['manajer'] },
  { pattern: /^\/barang/, roles: ['penjualan', 'gudang', 'manajer'] },
  { pattern: /^\/pelanggan/, roles: ['penjualan', 'manajer'] },
  { pattern: /^\/pemasok/, roles: ['gudang', 'manajer'] },
  { pattern: /^\/pesanan\/(baru|[^\/]+\/ubah)/, roles: ['penjualan', 'manajer'] },
  { pattern: /^\/pesanan/, roles: ['penjualan', 'gudang', 'manajer'] },
  { pattern: /^\/pembelian/, roles: ['gudang', 'manajer'] },
  { pattern: /^\/stok/, roles: ['penjualan', 'gudang', 'manajer'] },
  { pattern: /^\/laporan/, roles: ['manajer'] },
  { pattern: /^\/akun/, roles: ['manajer'] },
  { pattern: /^\/profil/, roles: ['penjualan', 'gudang', 'manajer'] },
  { pattern: /^\/pengaturan/, roles: ['manajer'] },
];

export function getMenuItemsForRole(peran: Peran): MenuItem[] {
  return MENU_ITEMS.filter((item) => item.roles.includes(peran));
}

export function isRouteAuthorized(pathname: string, peran: Peran): boolean {
  for (const route of ROUTE_PERMISSIONS) {
    if (route.pattern.test(pathname)) {
      return route.roles.includes(peran);
    }
  }
  return true;
}
