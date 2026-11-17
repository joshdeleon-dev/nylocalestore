// Where the public marketplace lives and whether it's switched on.
// Shared by middleware (edge) and server components — no Node-only imports.

// Hosts that serve the marketplace at their root ("/item/x" instead of "/marketplace/item/x")
export const SHOP_HOSTS = ['shop.nylocalestore.com', 'shop-staging.nylocalestore.com'];

// Hosts where the marketplace must never appear; /marketplace there redirects to the shop domain
export const NON_SHOP_SITE_HOSTS = [
  'www.nylocalestore.com',
  'nylocalestore.com',
  'food.nylocalestore.com',
  'staging.nylocalestore.com',
];

export const SHOP_ORIGIN = 'https://shop.nylocalestore.com';

// Off unless explicitly enabled — Production leaves it unset so shop. shows Coming Soon
export const isMarketplaceEnabled = () => process.env.MARKETPLACE_ENABLED === 'true';

export const normalizeHost = (host: string | null) => (host ?? '').split(':')[0].toLowerCase();

// Path prefix for marketplace links: '' on the shop domain, '/marketplace' elsewhere (localhost, previews)
export const marketplaceBase = (host: string | null) => (SHOP_HOSTS.includes(normalizeHost(host)) ? '' : '/marketplace');
