import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm text-coffee-500 hover:text-coffee-900">
      <ArrowLeft className="w-4 h-4" /> {label}
    </Link>
  );
}
