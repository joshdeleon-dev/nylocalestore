'use client';

import { Order, OrderItem } from '@/types';
import { Printer } from 'lucide-react';

interface StickerPrintProps {
  order: Order;
  buttonClassName?: string;
}

export function StickerPrint({ order, buttonClassName }: StickerPrintProps) {
  const print = () => {
    const items = order.items || [];

    // Build per-drink sticker HTML. Each drink = one sticker.
    const stickers = items.flatMap((item) =>
      Array.from({ length: item.quantity }, () => buildStickerHtml(order, item))
    );

    const printWindow = window.open('', '_blank', 'width=500,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order Stickers — ${order.order_number}</title>
          <style>
            @page {
              size: 2.25in 1.25in;
              margin: 0;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Courier New', monospace;
              background: white;
              color: black;
            }
            .sticker {
              width: 2.25in;
              height: 1.25in;
              padding: 6px 8px;
              border: 1px solid #000;
              page-break-after: always;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              overflow: hidden;
            }
            .sticker:last-child { page-break-after: avoid; }
            .name {
              font-size: 14pt;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .drink {
              font-size: 10pt;
              font-weight: bold;
              margin-top: 2px;
            }
            .mods {
              font-size: 7.5pt;
              margin-top: 2px;
              line-height: 1.4;
            }
            .mod-item::before { content: '• '; }
            .footer {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              border-top: 1px solid #000;
              padding-top: 3px;
              margin-top: auto;
              font-size: 6.5pt;
            }
            .order-num { font-weight: bold; letter-spacing: 0.02em; }
            @media screen {
              body { background: #f5f5f5; padding: 20px; }
              .sticker { margin: 10px auto; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
            }
          </style>
        </head>
        <body>
          ${stickers.join('')}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <button onClick={print} className={buttonClassName || 'btn btn-secondary btn-sm gap-2'}>
      <Printer className="w-4 h-4" />
      Print Sticker{(order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0) > 1 ? 's' : ''}
    </button>
  );
}

function buildStickerHtml(order: Order, item: OrderItem): string {
  const product = (item as any).product;
  const productName = product?.name || 'Item';
  const mods = item.modifiers || [];

  const modLines = mods
    .map((m) => `<div class="mod-item">${m.name}</div>`)
    .join('');

  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  }).format(new Date(order.order_date));

  return `
    <div class="sticker">
      <div>
        <div class="name">${escapeHtml(order.customer_name)}</div>
        <div class="drink">${escapeHtml(productName)}</div>
        ${mods.length > 0 ? `<div class="mods">${modLines}</div>` : ''}
      </div>
      <div class="footer">
        <span>${escapeHtml(time)}</span>
        <span class="order-num">${escapeHtml(order.order_number)}</span>
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
