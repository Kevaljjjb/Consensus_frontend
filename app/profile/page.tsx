"use client";

import { useAuth } from "@/components/AuthProvider";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, Mail, ShieldCheck, User } from "lucide-react";
import Link from "next/link";

function getInitials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        isAdmin
          ? "bg-[#F6DF5F]/20 text-[#F6DF5F]"
          : "bg-slate-400/15 text-slate-500 dark:text-slate-300"
      }`}
    >
      <ShieldCheck size={12} />
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

export default function ProfilePage() {
  const { user, logout, isLoading } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  if (isLoading) {
    return (
      <PageShell activePage="profile">
        <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 size={40} className="animate-spin text-[#F6DF5F]" />
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Loading profile
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Please wait while we load your account details.
              </p>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell activePage="profile">
        <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/70 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[#1a1d26]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300">
              <User size={24} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              You are not signed in
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Please sign in to view your profile details.
            </p>
            <Link href="/login">
              <Button className="mt-6 h-11 rounded-xl bg-[#F6DF5F] px-6 font-semibold text-slate-900 hover:bg-[#e7d14f]">
                Go to Login
              </Button>
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell activePage="profile">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Profile
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Manage your account details
          </p>
        </div>

        <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-white/10 dark:bg-[#1a1d26]">
          <div className="h-20 bg-gradient-to-br from-[#1e222a] via-[#272c36] to-[#2e343f]" />
          <div className="px-6 pb-6">
            <div className="-mt-10 mb-4 flex items-end justify-between gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-[#414854] text-xl font-bold text-[#F6DF5F] shadow-md dark:border-[#1a1d26]">
                {getInitials(user.email)}
              </div>
              <RoleBadge role={user.role} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {user.email.split("@")[0]}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {user.email}
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-white/10 dark:bg-[#1a1d26]">
          <div className="border-b border-slate-100 px-6 py-5 dark:border-white/[0.06]">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Account Details
            </h3>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                <Mail size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Email address
                </p>
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 px-6 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                <User size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Role
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 px-6 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Account status
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Active
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-red-100 bg-white shadow-sm dark:border-red-500/10 dark:bg-[#1a1d26]">
          <div className="flex items-center justify-between px-6 py-5">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Sign out
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                You will be redirected to the login page.
              </p>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="gap-2 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/20 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
            >
              <LogOut size={15} />
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
