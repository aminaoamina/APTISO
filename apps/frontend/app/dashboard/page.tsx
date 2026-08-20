'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  FolderOpen,
  Users,
  ShieldCheck,
  Check,
  Clock,
  Plus,
  Download,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { organizations, loadOrganizations } = useOrgStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOrganizations().finally(() => setIsLoading(false));
  }, [loadOrganizations]);

  const totalProjects = organizations.reduce(
    (acc, org) => acc + (org._count?.projects || 0),
    0
  );
  const totalMembers = organizations.reduce(
    (acc, org) => acc + (org._count?.members || 0),
    0
  );

  const stats = [
    {
      icon: Building2,
      value: organizations.length,
      label: 'Organization',
      iconBg: 'rgba(255, 145, 0, 0.15)',
      iconColor: 'var(--brand-orange)',
    },
    {
      icon: FolderOpen,
      value: totalProjects,
      label: 'Active project',
      iconBg: 'rgba(52, 211, 153, 0.15)',
      iconColor: 'var(--success)',
    },
    {
      icon: Users,
      value: totalMembers,
      label: 'Team members',
      iconBg: 'rgba(245, 158, 11, 0.15)',
      iconColor: 'var(--warning)',
    },
    {
      icon: ShieldCheck,
      value: '3',
      suffix: '/12',
      label: 'Controls implemented',
      iconBg: 'rgba(251, 113, 133, 0.15)',
      iconColor: 'var(--danger)',
    },
  ];

  const activityItems = [
    {
      text: 'Access control policy approved',
      user: user?.first_name ? `${user.first_name} ${user.last_name}` : 'User',
      time: '2 hours ago',
      badge: 'Approved',
      badgeClass: 'badge-success',
      avatarBg: 'linear-gradient(135deg, #34D399, #059669)',
      avatarIcon: Check,
    },
    {
      text: 'Vendor risk assessment submitted',
      user: 'Team member',
      time: 'Yesterday',
      badge: 'Pending review',
      badgeClass: 'badge-warning',
      avatarBg: 'linear-gradient(135deg, #F5A623, #D97706)',
      avatarIcon: Clock,
    },
    {
      text: 'New control added: Encryption at rest',
      user: user?.first_name ? `${user.first_name} ${user.last_name}` : 'User',
      time: '2 days ago',
      badge: 'New',
      badgeClass: 'badge-info',
      avatarBg: 'linear-gradient(135deg, var(--brand-orange), #FFB347)',
      avatarIcon: Plus,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--brand-orange)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome header */}
      <div className="fade-up mb-7" style={{ animationDelay: '0.1s' }}>
        <h1 className="font-display text-[26px] font-bold mb-1">
          Welcome back, {user?.first_name || 'there'} <span role="img" aria-label="wave">&#128075;</span>
        </h1>
        <p className="text-[14.5px]" style={{ color: 'var(--muted-foreground)' }}>
          Here&apos;s where your ISO 27001 program stands today.
        </p>
      </div>

      {/* Stat cards — 4 column grid */}
      <div
        className="grid gap-[18px] mb-5"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
      >
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="glass glass-hover fade-up"
              style={{ animationDelay: `${0.15 + i * 0.05}s`, padding: 20 }}
            >
              <div
                className="stat-icon"
                style={{ background: stat.iconBg }}
              >
                <Icon className="h-[18px] w-[18px]" style={{ color: stat.iconColor }} />
              </div>
              <div className="font-mono-numeric text-[26px] font-semibold">
                {stat.value}
                {stat.suffix && (
                  <span className="text-[15px] font-normal" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>
                    {stat.suffix}
                  </span>
                )}
              </div>
              <div className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main content grid — 1.5fr 1fr */}
      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: '1.5fr 1fr', alignItems: 'start' }}
      >
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-5">
          {/* Evidence chart */}
          <div className="glass glass-hover fade-up" style={{ animationDelay: '0.35s', padding: 24 }}>
            <div className="flex items-center justify-between mb-[18px]">
              <div>
                <div className="font-display text-[16px] font-semibold">Evidence collected</div>
                <div className="text-[12.5px]" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>Last 14 days</div>
              </div>
              <button
                className="btn-accent text-[13px]"
                style={{
                  background: 'rgba(255, 145, 0, 0.12)',
                  color: 'var(--brand-orange)',
                  boxShadow: 'none',
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
            </div>
            <EvidenceChart />
          </div>

          {/* Recent activity */}
          <div className="glass glass-hover fade-up" style={{ animationDelay: '0.4s', padding: 24 }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="font-display text-[16px] font-semibold">Recent activity</div>
              <button
                className="text-[13px] font-semibold cursor-pointer"
                style={{ color: 'var(--brand-orange)', background: 'none', border: 'none' }}
              >
                Show all &rarr;
              </button>
            </div>

            {activityItems.map((item, i) => {
              const AvatarIcon = item.avatarIcon;
              return (
                <div key={i} className="activity-row">
                  <div
                    className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0"
                    style={{ background: item.avatarBg }}
                  >
                    <AvatarIcon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium">{item.text}</div>
                    <div className="text-[11.5px]" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>
                      {item.user} &middot; {item.time}
                    </div>
                  </div>
                  <span className={`badge-glass ${item.badgeClass}`}>{item.badge}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-5">
          {/* Compliance score ring */}
          <div className="glass glass-hover fade-up" style={{ animationDelay: '0.35s', padding: 26, textAlign: 'center' }}>
            <div className="text-[13px] mb-3.5" style={{ color: 'var(--muted-foreground)' }}>Compliance score</div>
            <svg width="150" height="150" viewBox="0 0 150 150" className="mx-auto">
              {/* Background ring */}
              <circle
                cx="75" cy="75" r="62"
                fill="none"
                stroke="rgba(148,163,184,0.15)"
                strokeWidth="12"
              />
              {/* Score ring with gradient */}
              <circle
                cx="75" cy="75" r="62"
                fill="none"
                stroke="url(#scoreGradient)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="389.6"
                strokeDashoffset="120"
                className="score-ring"
                style={{ transform: 'rotate(-90deg)', transformOrigin: '75px 75px' }}
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#34D399" />
                  <stop offset="100%" stopColor="var(--brand-orange)" />
                </linearGradient>
              </defs>
              <text x="75" y="70" textAnchor="middle" className="font-mono-numeric" style={{ fontSize: 28, fontWeight: 600, fill: 'var(--foreground)' }}>
                69%
              </text>
              <text x="75" y="90" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'var(--font-body)' }}>
                on track
              </text>
            </svg>
            <div className="flex justify-between mt-3.5 text-[11.5px] font-mono-numeric" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>
              <span>25 controls</span>
              <span>4 gaps</span>
            </div>
          </div>

          {/* Upcoming audits */}
          <div className="glass glass-hover fade-up" style={{ animationDelay: '0.4s', padding: 22 }}>
            <div className="font-display text-[15px] font-semibold mb-3.5">Upcoming audits</div>

            <div className="flex gap-3 items-center mb-3.5">
              <div
                className="w-[42px] h-[42px] rounded-[10px] flex flex-col items-center justify-center shrink-0"
                style={{ background: 'rgba(251, 113, 133, 0.12)' }}
              >
                <div className="font-mono-numeric text-[14px] font-bold leading-none" style={{ color: 'var(--danger)' }}>14</div>
                <div className="text-[9px]" style={{ color: 'var(--danger)' }}>SEP</div>
              </div>
              <div>
                <div className="text-[13.5px] font-medium">Internal audit &mdash; Access mgmt</div>
                <div className="text-[11.5px]" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>Lead: {user?.first_name || 'TBD'}</div>
              </div>
            </div>

            <div className="flex gap-3 items-center">
              <div
                className="w-[42px] h-[42px] rounded-[10px] flex flex-col items-center justify-center shrink-0"
                style={{ background: 'rgba(255, 145, 0, 0.12)' }}
              >
                <div className="font-mono-numeric text-[14px] font-bold leading-none" style={{ color: 'var(--brand-orange)' }}>02</div>
                <div className="text-[9px]" style={{ color: 'var(--brand-orange)' }}>OCT</div>
              </div>
              <div>
                <div className="text-[13.5px] font-medium">External certification review</div>
                <div className="text-[11.5px]" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>Lead: External auditor</div>
              </div>
            </div>
          </div>

          {/* Gaps CTA */}
          <div
            className="glass glass-hover fade-up"
            style={{
              animationDelay: '0.45s',
              padding: 22,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Background glow */}
            <div
              style={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 110,
                height: 110,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255, 145, 0, 0.35), transparent 70%)',
              }}
            />
            <div className="font-display text-[15px] font-semibold mb-1.5 relative">
              4 gaps need attention
            </div>
            <div className="text-[12.5px] mb-4 relative" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>
              Close them before your next audit window opens.
            </div>
            <button className="btn-accent relative">
              Review gaps
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty state for no organizations */}
      {organizations.length === 0 && (
        <div className="fade-up mt-8" style={{ animationDelay: '0.6s' }}>
          <div
            className="glass text-center"
            style={{ border: '2px dashed rgba(var(--glass-border), 0.15)', padding: '48px 24px' }}
          >
            <Building2
              className="h-16 w-16 mx-auto mb-4"
              style={{ color: 'var(--brand-orange)', opacity: 0.4 }}
            />
            <h3 className="font-display text-xl font-semibold mb-2">Welcome to APTISO</h3>
            <p className="max-w-md mx-auto mb-6 text-[14px]" style={{ color: 'var(--muted-foreground)' }}>
              Create your first organization to start managing ISO 27001 compliance.
              You can invite team members and create compliance projects.
            </p>
            <button
              className="btn-accent"
              onClick={() => router.push('/dashboard/organizations?create=true')}
            >
              <Plus className="h-4 w-4" />
              Create Organization
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Simple SVG bar chart (stand-in for recharts) ---- */
function EvidenceChart() {
  const values = [1200, 1900, 2600, 1500, 2100, 1300, 1894, 1700, 2000, 1600, 2300, 1450, 1950, 2200];
  const chartW = 560;
  const chartH = 150;
  const gap = 6;
  const barW = (chartW / values.length) - gap;
  const max = Math.max(...values);

  return (
    <svg viewBox="0 0 560 180" width="100%" height="170">
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand-orange)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--brand-orange)" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {values.map((v, i) => {
        const h = (v / max) * chartH;
        const x = i * (barW + gap);
        const y = chartH - h;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx={4}
            fill={i === 6 ? 'var(--brand-orange)' : 'url(#barGrad)'}
            className="fade-up"
            style={{ animationDelay: `${0.4 + i * 0.04}s` }}
          />
        );
      })}
    </svg>
  );
}
