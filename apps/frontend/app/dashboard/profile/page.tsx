'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  Pencil,
  Trash2,
  Save,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  AlertTriangle,
  Eye,
  EyeOff,
  LogOut,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { authApi, organizationsApi, Organization, OrganizationMember } from '@/lib/api';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace('/api/v1', '');

// ─── Types ─────────────────────────────────────────────────────
interface Session {
  id: string;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  lastActivity: string;
  isCurrentSession: boolean;
  createdAt: string;
}

type OwnedOrganization = Organization & { members: OrganizationMember[] };

// ─── Password strength helper ──────────────────────────────────
function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 20, label: 'Weak', color: 'var(--danger)' };
  if (score <= 2) return { score: 40, label: 'Fair', color: 'var(--warning)' };
  if (score <= 3) return { score: 65, label: 'Good', color: '#60a5fa' };
  if (score <= 4) return { score: 85, label: 'Strong', color: 'var(--success)' };
  return { score: 100, label: 'Very strong', color: 'var(--success)' };
}

// ─── Section Card ──────────────────────────────────────────────
function SectionCard({
  children,
  delay = '0s',
}: {
  children: React.ReactNode;
  delay?: string;
}) {
  return (
    <div
      className="glass section-card fade-up"
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}

// ─── Toggle Switch ─────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="toggle-track"
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-thumb" />
    </button>
  );
}

// ─── Device icon helper ────────────────────────────────────────
function DeviceIcon({ type }: { type: string }) {
  switch (type) {
    case 'mobile':
      return <Smartphone className="h-[18px] w-[18px]" />;
    case 'tablet':
      return <Tablet className="h-[18px] w-[18px]" />;
    default:
      return <Monitor className="h-[18px] w-[18px]" />;
  }
}

// ─── Main Page ─────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, setUser, isLoading, logout } = useAuthStore();

  // Profile form state — initialized from real user data
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [bio, setBio] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Sync form with user data when it loads
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? '');
      setLastName(user.last_name ?? '');
      setEmail(user.email ?? '');
      setJobTitle(user.job_title ?? '');
      setTimezone(user.timezone ?? 'UTC');
      setBio(user.bio ?? '');
    }
  }, [user]);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isChangingPw, setIsChangingPw] = useState(false);

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [ownedOrganizations, setOwnedOrganizations] = useState<OwnedOrganization[]>([]);
  const [deleteChoices, setDeleteChoices] = useState<Record<string, {
    action: 'TRANSFER' | 'DELETE' | '';
    transfer_to_user_id?: string;
  }>>({});
  const [isLoadingDeleteOptions, setIsLoadingDeleteOptions] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Sessions — fetched from backend
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  // Notifications — fetched from backend (placeholder for now)
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [auditReminders, setAuditReminders] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  // Password strength
  const pwStrength = useMemo(
    () => getPasswordStrength(newPassword),
    [newPassword],
  );

  // ── Fetch sessions on mount ──────────────────────────────────
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await authApi.getSessions();
        setSessions(data);
      } catch {
        // Sessions endpoint may fail silently — not critical
      } finally {
        setIsLoadingSessions(false);
      }
    };
    fetchSessions();
  }, []);

  // ── Avatar upload handler ────────────────────────────────────
  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image must be under 2 MB');
        return;
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Only JPEG, PNG, WebP, and GIF images are allowed');
        return;
      }

      // Show instant preview
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);

      // Upload to backend
      setIsUploadingAvatar(true);
      try {
        const result = await authApi.uploadAvatar(file);
        if (user) {
          setUser({ ...user, avatar_url: result.avatar_url });
        }
        toast.success('Avatar updated');
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to upload avatar'));
        setAvatarPreview(null);
      } finally {
        setIsUploadingAvatar(false);
      }
    },
    [user, setUser],
  );

  // ── Save profile handler ─────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First and last name are required');
      return;
    }
    setIsSavingProfile(true);
    try {
      const updated = await authApi.updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        job_title: jobTitle.trim() || undefined,
        timezone,
        bio: bio.trim() || undefined,
      });
      if (user) setUser({ ...user, ...updated });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update profile'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ── Change password handler ──────────────────────────────────
  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error('Enter your current password');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setIsChangingPw(true);
    try {
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to change password'));
    } finally {
      setIsChangingPw(false);
    }
  };

  // ── Revoke session handler ───────────────────────────────────
  const handleRevokeSession = async (sessionId: string) => {
    try {
      await apiClient.post('/auth/sessions/revoke', { sessionId });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success('Session revoked');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to revoke session'));
    }
  };

  // ── Delete account handlers ─────────────────────────────────
  const openDeleteDialog = async () => {
    setIsLoadingDeleteOptions(true);
    setShowDeleteDialog(true);
    try {
      const organizations = await organizationsApi.list();
      const details = await Promise.all(
        organizations.map((organization) => organizationsApi.getOne(organization.id)),
      );
      const owned = details.filter((organization) =>
        organization.members?.some(
          (member) => member.user_id === user?.id && member.role === 'ORG_OWNER',
        ),
      ) as OwnedOrganization[];
      setOwnedOrganizations(owned);
      setDeleteChoices(
        Object.fromEntries(owned.map((organization) => [organization.id, { action: '' }])),
      );
    } catch (err) {
      setShowDeleteDialog(false);
      toast.error(getErrorMessage(err, 'Unable to load organization ownership details'));
    } finally {
      setIsLoadingDeleteOptions(false);
    }
  };

  const handleDeleteAccount = async () => {
    const choices = ownedOrganizations.map((organization) => deleteChoices[organization.id]);
    if (choices.some((choice) => !choice || !choice.action)) {
      toast.error('Choose what to do with every organization you own');
      return;
    }
    if (choices.some((choice) => choice.action === 'TRANSFER' && !choice.transfer_to_user_id)) {
      toast.error('Choose a new owner for every organization being transferred');
      return;
    }
    setIsDeletingAccount(true);
    try {
      await authApi.deleteAccount(
        ownedOrganizations.map((organization) => ({
          organization_id: organization.id,
          action: deleteChoices[organization.id].action as 'TRANSFER' | 'DELETE',
          ...(deleteChoices[organization.id].transfer_to_user_id
            ? { transfer_to_user_id: deleteChoices[organization.id].transfer_to_user_id }
            : {}),
        })),
      );
      await logout();
      window.location.href = '/login?deleted=true';
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete account'));
      setIsDeletingAccount(false);
    }
  };

  const getInitials = (fn?: string | null, ln?: string | null) => {
    if (!fn) return '??';
    return ((fn?.[0] || '') + (ln?.[0] || '')).toUpperCase();
  };

  const getMemberSince = (createdAt?: string) => {
    if (!createdAt) return 'Member';
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return 'Member';
    return `Member since ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  };

  const avatarUrl = useMemo(() => {
    if (avatarPreview) return avatarPreview;
    if (user?.avatar_url) return `${API_BASE}${user.avatar_url}`;
    return null;
  }, [avatarPreview, user?.avatar_url]);

  const handleRemovePhoto = () => {
    const removePhoto = async () => {
      try {
        await authApi.removeAvatar();
        setAvatarPreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (user) {
          setUser({ ...user, avatar_url: null });
        }
        toast.success('Avatar removed');
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to remove avatar'));
      }
    };

    void removePhoto();
  };

  // ── Loading state ────────────────────────────────────────────
  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="max-w-[760px] mx-auto space-y-6">
      {/* ─── Page Header ──────────────────────────────────── */}
      <div className="fade-up">
        <h1 className="font-display text-[26px] font-bold tracking-tight">
          Profile
        </h1>
        <p className="text-[14px] text-dim mt-1">
          Manage your personal information and account settings
        </p>
      </div>

      {/* ─── Avatar + Identity Card ──────────────────────── */}
      <SectionCard delay="0.05s">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          {/* Avatar */}
          <div className="avatar-upload relative h-[92px] w-[92px] shrink-0">
            <div
              className="flex h-[92px] w-[92px] items-center justify-center overflow-hidden rounded-[24px] border-2 border-white/10 font-display text-[32px] font-semibold text-white"
              style={{
                background: avatarUrl
                  ? 'transparent'
                  : 'linear-gradient(135deg, var(--brand-orange), #FFB347)',
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                getInitials(user.first_name, user.last_name)
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              className="absolute -bottom-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-[10px] border-[3px] border-[var(--background)] bg-[var(--brand-orange)] text-[#05201C] transition-transform hover:scale-105"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Change profile photo"
              disabled={isUploadingAvatar}
            >
              {isUploadingAvatar ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Pencil className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="font-display text-[21px] font-semibold tracking-tight">
              {user.first_name} {user.last_name}
            </div>
            <div className="mt-0.5 text-[13.5px] text-dim">{user.email}</div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="badge-glass badge-success">Active</span>
              {user.is_email_verified && (
                <span className="badge-glass badge-info">Verified</span>
              )}
              <span className="badge-glass bg-[var(--muted)] text-dim">
                {getMemberSince(user.created_at)}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn-ghost self-start sm:self-center"
            onClick={handleRemovePhoto}
            disabled={!avatarUrl || isUploadingAvatar}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove photo
          </button>
        </div>
      </SectionCard>

      {/* ─── Personal Information ─────────────────────────── */}
      <SectionCard delay="0.1s">
        <div className="section-title">Personal Information</div>
        <div className="section-subtitle">
          Update your personal details and contact information
        </div>

        <div className="space-y-5">
          <div className="field-group">
            <div className="field">
              <label>First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
              />
            </div>
            <div className="field">
              <label>Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
              />
            </div>
          </div>

          <div className="field">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="field-group">
            <div className="field">
              <label>Job Title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Compliance Manager"
              />
            </div>
            <div className="field">
              <label>Timezone</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time (UTC-5)</option>
                <option value="America/Chicago">Central Time (UTC-6)</option>
                <option value="America/Denver">Mountain Time (UTC-7)</option>
                <option value="America/Los_Angeles">Pacific Time (UTC-8)</option>
                <option value="Europe/London">London (UTC+0)</option>
                <option value="Europe/Paris">Paris (UTC+1)</option>
                <option value="Asia/Dubai">Dubai (UTC+4)</option>
                <option value="Asia/Tokyo">Tokyo (UTC+9)</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A brief description about yourself..."
              rows={3}
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              className="btn-accent"
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
            >
              {isSavingProfile ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ─── Change Password ──────────────────────────────── */}
      <SectionCard delay="0.15s">
        <div className="section-title">Change Password</div>
        <div className="section-subtitle">
          Update your password to keep your account secure
        </div>

        <div className="space-y-5">
          <div className="field">
            <label>Current Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted-foreground)',
                  padding: 4,
                }}
                aria-label={showCurrentPw ? 'Hide password' : 'Show password'}
              >
                {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="field">
            <label>New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted-foreground)',
                  padding: 4,
                }}
                aria-label={showNewPw ? 'Hide password' : 'Show password'}
              >
                {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {newPassword.length > 0 && (
              <div className="mt-1">
                <div className="strength-bar">
                  <div
                    className="strength-bar-fill"
                    style={{
                      width: `${pwStrength.score}%`,
                      backgroundColor: pwStrength.color,
                    }}
                  />
                </div>
                <div
                  className="text-[11.5px] mt-1 font-medium"
                  style={{ color: pwStrength.color }}
                >
                  {pwStrength.label}
                </div>
              </div>
            )}
          </div>

          <div className="field">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--danger)' }}>
                Passwords do not match
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <button
              className="btn-accent"
              onClick={handleChangePassword}
              disabled={isChangingPw}
            >
              {isChangingPw ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Change Password
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ─── Notifications ────────────────────────────────── */}
      <SectionCard delay="0.2s">
        <div className="section-title">Notifications</div>
        <div className="section-subtitle">
          Choose how you want to be notified about account activity
        </div>

        <div className="space-y-5">
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-[14px] font-medium">Email notifications</div>
              <div className="text-[12.5px] text-dim mt-0.5">
                Receive email updates about your account activity
              </div>
            </div>
            <Toggle checked={emailNotifications} onChange={setEmailNotifications} />
          </div>

          <div
            style={{
              height: 1,
              background: 'rgba(var(--glass-border), var(--glass-border-alpha))',
            }}
          />

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-[14px] font-medium">Audit reminders</div>
              <div className="text-[12.5px] text-dim mt-0.5">
                Get notified before audit deadlines and compliance milestones
              </div>
            </div>
            <Toggle checked={auditReminders} onChange={setAuditReminders} />
          </div>

          <div
            style={{
              height: 1,
              background: 'rgba(var(--glass-border), var(--glass-border-alpha))',
            }}
          />

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-[14px] font-medium">Weekly digest</div>
              <div className="text-[12.5px] text-dim mt-0.5">
                Receive a summary of your compliance progress each week
              </div>
            </div>
            <Toggle checked={weeklyDigest} onChange={setWeeklyDigest} />
          </div>
        </div>
      </SectionCard>

      {/* ─── Active Sessions ──────────────────────────────── */}
      <SectionCard delay="0.25s">
        <div className="section-title">Active Sessions</div>
        <div className="section-subtitle">
          Devices and sessions currently signed in
        </div>

        {isLoadingSessions ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="h-5 w-5" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-[13px] text-dim">
            No active sessions found
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-[12px] p-3.5"
                style={{
                  background: session.isCurrentSession
                    ? 'rgba(var(--glass-bg), 0.35)'
                    : 'rgba(var(--glass-bg), 0.2)',
                  border: `1px solid rgba(var(--glass-border), ${session.isCurrentSession ? 'var(--glass-border-alpha)' : '0.05'})`,
                }}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-[36px] h-[36px] rounded-[10px] flex items-center justify-center"
                    style={{
                      background: session.isCurrentSession
                        ? 'rgba(52, 211, 153, 0.12)'
                        : 'rgba(var(--muted-foreground), 0.08)',
                      color: session.isCurrentSession
                        ? 'var(--success)'
                        : 'var(--muted-foreground)',
                    }}
                  >
                    <DeviceIcon type={session.deviceType} />
                  </div>
                  <div>
                    <div className="text-[13.5px] font-medium">
                      {session.deviceName}
                    </div>
                    <div className="text-[11.5px] text-dim">
                      {session.isCurrentSession
                        ? 'Signed in now'
                        : `Last active ${new Date(session.lastActivity).toLocaleDateString()}`}
                      {' · '}
                      {session.ipAddress}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {session.isCurrentSession ? (
                    <span className="badge-glass badge-success">Current</span>
                  ) : (
                    <button
                      className="text-[11px] font-medium flex items-center gap-1 px-2 py-1 rounded-md transition-colors duration-200"
                      style={{
                        color: 'var(--danger)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleRevokeSession(session.id)}
                    >
                      <LogOut className="h-3 w-3" />
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ─── Danger Zone ──────────────────────────────────── */}
      <div
        className="glass section-card fade-up"
        style={{
          animationDelay: '0.3s',
          borderColor: 'rgba(251, 113, 133, 0.15)',
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-[40px] h-[40px] rounded-[10px] flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(251, 113, 133, 0.12)',
              color: 'var(--danger)',
            }}
          >
            <AlertTriangle className="h-[20px] w-[20px]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="section-title" style={{ color: 'var(--danger)' }}>
              Danger Zone
            </div>
            <div className="section-subtitle">
              Permanently delete your account and choose what happens to organizations you own.
              This action cannot be undone.
            </div>
            <button className="btn-danger-ghost" onClick={openDeleteDialog}>
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="fixed inset-0 bg-black/60"
            onClick={() => !isDeletingAccount && setShowDeleteDialog(false)}
            aria-label="Close delete account dialog"
          />
          <div className="glass relative z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold">Delete account</h2>
                <p className="mt-1 text-sm text-dim">
                  This permanently removes your account. Decide what happens to each organization you own.
                </p>
              </div>
              <button
                type="button"
                className="theme-toggle h-9 w-9"
                onClick={() => !isDeletingAccount && setShowDeleteDialog(false)}
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isLoadingDeleteOptions ? (
              <div className="flex justify-center py-12">
                <Spinner className="h-6 w-6" />
              </div>
            ) : (
              <>
                {ownedOrganizations.length === 0 ? (
                  <p className="mt-6 text-sm text-dim">
                    You do not own any organizations. Your account can be deleted directly.
                  </p>
                ) : (
                  <div className="mt-6 space-y-4">
                    {ownedOrganizations.map((organization) => {
                      const choice = deleteChoices[organization.id];
                      const otherMembers = organization.members.filter(
                        (member) => member.user_id !== user.id,
                      );
                      return (
                        <div key={organization.id} className="rounded-xl border border-[var(--border)] p-4">
                          <div className="font-display text-base font-semibold">{organization.name}</div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--border)] p-3 text-sm">
                              <input
                                type="radio"
                                name={`delete-choice-${organization.id}`}
                                checked={choice?.action === 'TRANSFER'}
                                onChange={() => setDeleteChoices((current) => ({
                                  ...current,
                                  [organization.id]: { action: 'TRANSFER' },
                                }))}
                              />
                              <span>Transfer ownership and leave the organization intact.</span>
                            </label>
                            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--border)] p-3 text-sm">
                              <input
                                type="radio"
                                name={`delete-choice-${organization.id}`}
                                checked={choice?.action === 'DELETE'}
                                onChange={() => setDeleteChoices((current) => ({
                                  ...current,
                                  [organization.id]: { action: 'DELETE' },
                                }))}
                              />
                              <span>Delete the organization, its projects, and associated data.</span>
                            </label>
                          </div>
                          {choice?.action === 'TRANSFER' && (
                            <div className="field mt-3">
                              <label>New owner</label>
                              <select
                                value={choice.transfer_to_user_id ?? ''}
                                onChange={(event) => setDeleteChoices((current) => ({
                                  ...current,
                                  [organization.id]: {
                                    ...current[organization.id],
                                    transfer_to_user_id: event.target.value,
                                  },
                                }))}
                              >
                                <option value="">Select a member</option>
                                {otherMembers.map((member) => (
                                  <option key={member.user_id} value={member.user_id}>
                                    {member.user.first_name} {member.user.last_name} ({member.user.email})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setShowDeleteDialog(false)}
                    disabled={isDeletingAccount}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-danger-ghost"
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount}
                  >
                    {isDeletingAccount ? 'Deleting...' : 'Permanently delete account'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bottom spacer */}
      <div className="h-8" />
    </div>
  );
}
