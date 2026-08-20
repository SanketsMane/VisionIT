'use client';

import { useQuery } from '@tanstack/react-query';
import { Reveal } from './reveal';
import { publicApi } from '@/lib/api/public.api';

/**
 * The numbers band.
 *
 * Every figure here is either read from the live catalog or is a commitment the
 * studio actually makes. Nothing is padded — a studio with three shipped
 * products that claims five hundred is one bad conversation away from losing
 * the deal, and the real numbers are respectable on their own.
 */
export function StatsBand() {
  const work = useQuery({
    queryKey: ['public', 'work', 'stats'],
    queryFn: () => publicApi.work(),
    staleTime: 5 * 60 * 1000,
  });
  const services = useQuery({
    queryKey: ['public', 'services', 'stats'],
    queryFn: () => publicApi.services(),
    staleTime: 5 * 60 * 1000,
  });

  const delivered = work.data?.total ?? 0;
  const serviceCount = services.data?.length ?? 0;

  const stats = [
    {
      value: delivered > 0 ? `${delivered}` : '—',
      label: delivered === 1 ? 'Product shipped' : 'Products shipped',
      note: 'Built, deployed and handed over',
    },
    {
      value: serviceCount > 0 ? `${serviceCount}` : '—',
      label: serviceCount === 1 ? 'Service offered' : 'Services offered',
      note: 'Development, hosting, AI and growth',
    },
    { value: '12', label: 'Months of support', note: 'Included with every project' },
    { value: '<24h', label: 'Reply time', note: 'One working day, every enquiry' },
  ];

  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden bg-border px-0 sm:grid-cols-4">
        {stats.map((stat, index) => (
          <Reveal key={stat.label} delay={index * 70} className="bg-card">
            <div className="px-5 py-10 text-center sm:px-6">
              <p className="bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
                {stat.value}
              </p>
              <p className="mt-2 text-sm font-semibold">{stat.label}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{stat.note}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
