import { MapPin } from 'lucide-react';
import { HOME_URL, SHOP_URL } from '@/components/SiteChrome';

// Matches the marketplace footer
export function CustomerFooter() {
  return (
    <footer className="border-t border-coffee-200/70 mt-16">
      <div className="max-w-6xl mx-auto px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-coffee-500">
        <p className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Order ahead · Pickup at the Locale · New York</p>
        <div className="flex gap-4">
          <a href={HOME_URL} className="hover:text-coffee-900">NY Locale Store</a>
          <a href={SHOP_URL} className="hover:text-coffee-900">Marketplace</a>
        </div>
      </div>
    </footer>
  );
}
