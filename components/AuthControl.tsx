'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut,
} from 'firebase/auth';
import {
  LogIn,
  LogOut,
  User as UserIcon,
  Cloud,
  X,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import {
  auth,
  googleProvider,
  MAX_DISPLAY_NAME_LENGTH,
} from '@/lib/firebase';
import { useLinkStore } from '@/store/useLinkStore';
import { useLanguageStore } from '@/store/useLanguageStore';

type AuthMode = 'login' | 'register';

export function AuthControl() {
  const { authUser, isAuthReady, isCloudSynced, syncAuthUser } = useLinkStore();
  const { t } = useLanguageStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        void syncAuthUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName:
            firebaseUser.displayName ||
            (firebaseUser.isAnonymous ? 'Guest User' : null),
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
          isAnonymous: firebaseUser.isAnonymous,
        });
      } else {
        void syncAuthUser(null);
      }
    });

    return () => unsubscribe();
  }, [syncAuthUser]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMenuOpen]);

  const resetForm = (nextMode: AuthMode = 'login') => {
    setAuthMode(nextMode);
    setAuthError(null);
    setAuthNotice(null);
    setPassword('');
    setConfirmPassword('');
  };

  const openModal = (mode: AuthMode = 'login') => {
    resetForm(mode);
    setIsModalOpen(true);
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setIsModalOpen(false);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'auth/popup-closed-by-user') {
        setAuthError(t.auth.errPopupClosed);
      } else if (code === 'auth/popup-blocked') {
        setAuthError(t.auth.errPopupBlocked);
      } else {
        setAuthError(
          err instanceof Error ? err.message : t.auth.errGoogleFailed
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestSignIn = async () => {
    setIsSubmitting(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const cred = await signInAnonymously(auth);
      if (!cred.user.displayName) {
        try {
          await updateProfile(cred.user, {
            displayName: 'Guest User',
          });
        } catch {
          // Ignore optional profile update errors on anonymous auth
        }
      }
      await syncAuthUser({
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName || 'Guest User',
        photoURL: cred.user.photoURL,
        emailVerified: cred.user.emailVerified,
        isAnonymous: true,
      });
      setIsModalOpen(false);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (
        code === 'auth/operation-not-allowed' ||
        code === 'auth/admin-restricted-operation'
      ) {
        setAuthError(t.auth.errGuestNotAllowed);
      } else {
        setAuthError(
          err instanceof Error ? err.message : t.auth.errGenericAuth
        );
      }
      setIsModalOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);

    const trimmedEmail = email.trim();
    const trimmedName = displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);

    if (!trimmedEmail || !password) {
      setAuthError(t.auth.errMissingEmailPass);
      return;
    }

    if (authMode === 'register') {
      if (!trimmedName) {
        setAuthError(t.auth.errMissingName);
        return;
      }
      if (password.length < 6) {
        setAuthError(t.auth.errShortPassword);
        return;
      }
      if (password !== confirmPassword) {
        setAuthError(t.auth.errPasswordMismatch);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (authMode === 'register') {
        const cred = await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );
        if (trimmedName) {
          await updateProfile(cred.user, { displayName: trimmedName });
        }
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // Ignore verification email rate limits
        }
        await syncAuthUser({
          uid: cred.user.uid,
          email: cred.user.email,
          displayName: trimmedName || cred.user.displayName,
          photoURL: cred.user.photoURL,
          emailVerified: cred.user.emailVerified,
        });
        setIsModalOpen(false);
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
        setIsModalOpen(false);
      }
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'auth/operation-not-allowed') {
        setAuthError(t.auth.errOperationNotAllowed);
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password'
      ) {
        setAuthError(t.auth.errInvalidCredential);
      } else if (code === 'auth/email-already-in-use') {
        setAuthError(t.auth.errEmailInUse);
      } else if (code === 'auth/invalid-email') {
        setAuthError(t.auth.errInvalidEmail);
      } else {
        setAuthError(
          err instanceof Error ? err.message : t.auth.errGenericAuth
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setIsMenuOpen(false);
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const userLabel = authUser?.isAnonymous
    ? t.auth.guestDisplayName
    : authUser?.displayName ||
      (authUser?.email ? authUser.email.split('@')[0] : t.auth.accountFallback);

  return (
    <>
      <div className="flex items-center gap-2">
        {!isAuthReady ? (
          <div className="h-8 px-2.5 rounded-md border border-[var(--tf-border)] bg-[var(--tf-card)] flex items-center gap-1.5 text-xs text-[var(--tf-text-muted)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="hidden sm:inline">{t.auth.loading}</span>
          </div>
        ) : authUser ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="h-8 pl-2 pr-2.5 rounded-md border border-[var(--tf-border)] bg-[var(--tf-card)] hover:bg-[var(--tf-card-hover)] text-[var(--tf-text)] flex items-center gap-2 text-xs font-medium transition-colors"
              title={t.auth.accountSyncTitle}
            >
              {authUser.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover border border-[var(--tf-border)]"
                />
              ) : (
                <span className="w-5 h-5 rounded-full bg-[var(--tf-text)] text-[var(--tf-canvas)] flex items-center justify-center text-[10px] font-bold uppercase">
                  {userLabel.slice(0, 1)}
                </span>
              )}
              <span className="max-w-[110px] sm:max-w-[150px] truncate">
                {userLabel}
              </span>
              <span
                className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-500"
                title={
                  isCloudSynced
                    ? t.auth.cloudSyncedTitle
                    : t.auth.accountSavedTitle
                }
              >
                <Cloud className="w-2.5 h-2.5" />
                <span>{t.auth.savedBadge}</span>
              </span>
              <ChevronDown className="w-3 h-3 text-[var(--tf-text-muted)]" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-64 rounded-lg border border-[var(--tf-border)] bg-[var(--tf-surface)] shadow-xl p-3 z-50 space-y-2.5">
                <div className="flex items-start gap-2.5 pb-2.5 border-b border-[var(--tf-border)]">
                  {authUser.photoURL ? (
                    <img
                      src={authUser.photoURL}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-[var(--tf-border)] shrink-0"
                    />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-[var(--tf-text)] text-[var(--tf-canvas)] flex items-center justify-center text-xs font-bold uppercase shrink-0">
                      {userLabel.slice(0, 1)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--tf-text)] truncate">
                      {authUser.isAnonymous
                        ? t.auth.guestDisplayName
                        : authUser.displayName || t.auth.userFallback}
                    </p>
                    {authUser.email ? (
                      <p className="text-[11px] text-[var(--tf-text-muted)] truncate">
                        {authUser.email}
                      </p>
                    ) : authUser.isAnonymous ? (
                      <p className="text-[11px] text-[var(--tf-text-muted)] truncate">
                        {t.auth.guestAccountSubtext}
                      </p>
                    ) : null}
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>
                        {isCloudSynced
                          ? t.auth.onlineSyncStatus
                          : t.auth.accountSavedStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {authUser.isAnonymous && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      openModal('login');
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-[var(--tf-text)] bg-[var(--tf-card)] hover:bg-[var(--tf-card-hover)] border border-[var(--tf-border)] transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{t.auth.switchAccountBtn}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t.auth.signOut}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleGuestSignIn}
              disabled={isSubmitting}
              data-testid="header-guest-login-btn"
              className="h-8 px-2.5 sm:px-3 rounded-md border border-[var(--tf-border-strong)] bg-[var(--tf-card)] hover:bg-[var(--tf-card-hover)] text-[var(--tf-text)] text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 whitespace-nowrap disabled:opacity-50"
              title={t.auth.guestBtnTitle}
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <UserIcon className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="sm:hidden">{t.auth.guestBtnMobile}</span>
              <span className="hidden sm:inline">{t.auth.guestBtn}</span>
            </button>

            <button
              type="button"
              onClick={() => openModal('login')}
              className="h-8 px-2.5 sm:px-3 rounded-md bg-[var(--tf-text)] hover:opacity-90 text-[var(--tf-canvas)] text-xs font-semibold flex items-center gap-1.5 transition-opacity shrink-0 whitespace-nowrap"
              title={t.auth.signInBtnTitle}
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" />
              <span className="sm:hidden">{t.auth.signInBtnMobile}</span>
              <span className="hidden sm:inline">{t.auth.signInBtn}</span>
            </button>
          </div>
        )}
      </div>

      {/* Login / Register Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) {
              setIsModalOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-[var(--tf-border)] bg-[var(--tf-surface)] text-[var(--tf-text)] shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--tf-border)] bg-[var(--tf-card)]">
              <div className="flex items-center gap-2">
                <span className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                  <Image
                    src="/assets/aistudio/logo-mark.png"
                    alt="TabFlow Logo"
                    fill
                    sizes="20px"
                    referrerPolicy="no-referrer"
                    className="object-contain"
                  />
                </span>
                <h2 id="auth-modal-title" className="text-sm font-semibold">
                  {t.auth.modalTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label={t.auth.closeModalAria}
                className="p-1 rounded-md text-[var(--tf-text-muted)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-surface)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switch Tabs (2 Options: Đăng nhập & Đăng ký / Sign In & Sign Up) */}
            <div className="grid grid-cols-2 gap-1 p-1.5 m-4 mb-0 rounded-lg bg-[var(--tf-canvas)] border border-[var(--tf-border)]">
              <button
                type="button"
                onClick={() => resetForm('login')}
                className={`py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                  authMode === 'login'
                    ? 'bg-[var(--tf-text)] text-[var(--tf-canvas)] shadow-xs'
                    : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{t.auth.tabLogin}</span>
              </button>
              <button
                type="button"
                onClick={() => resetForm('register')}
                className={`py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                  authMode === 'register'
                    ? 'bg-[var(--tf-text)] text-[var(--tf-canvas)] shadow-xs'
                    : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>{t.auth.tabRegister}</span>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Primary Google Auth Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-lg border border-[var(--tf-border-strong)] bg-[var(--tf-card)] hover:bg-[var(--tf-card-hover)] text-[var(--tf-text)] text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <GlobeBadge />
                <span>
                  {authMode === 'login'
                    ? t.auth.googleLogin
                    : t.auth.googleRegister}
                </span>
              </button>

              {/* Firebase Guest Login Button */}
              <button
                type="button"
                onClick={handleGuestSignIn}
                disabled={isSubmitting}
                data-testid="modal-guest-login-btn"
                className="w-full py-2.5 px-4 rounded-lg border border-[var(--tf-border)] bg-[var(--tf-canvas)] hover:bg-[var(--tf-card-hover)] text-[var(--tf-text)] text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <UserIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{t.auth.guestModalBtn}</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-[var(--tf-border)] w-full" />
                <span className="bg-[var(--tf-surface)] px-2.5 text-[10px] uppercase tracking-wider text-[var(--tf-text-muted)] shrink-0">
                  {t.auth.orUseEmail}
                </span>
                <div className="border-t border-[var(--tf-border)] w-full" />
              </div>

              {/* Email / Password Form */}
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {authMode === 'register' && (
                  <div>
                    <label
                      htmlFor="auth-display-name"
                      className="block text-[11px] font-medium text-[var(--tf-text-secondary)] mb-1"
                    >
                      {t.auth.displayNameLabel}
                    </label>
                    <div className="relative">
                      <UserIcon className="w-3.5 h-3.5 text-[var(--tf-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-display-name"
                        type="text"
                        maxLength={MAX_DISPLAY_NAME_LENGTH}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={t.auth.displayNamePlaceholder}
                        className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[var(--tf-border)] bg-[var(--tf-canvas)] text-[var(--tf-text)] placeholder:text-[var(--tf-text-muted)] focus:outline-none focus:border-[var(--tf-accent)]"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-[11px] font-medium text-[var(--tf-text-secondary)] mb-1"
                  >
                    {t.auth.emailLabel}
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-[var(--tf-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.auth.emailPlaceholder}
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[var(--tf-border)] bg-[var(--tf-canvas)] text-[var(--tf-text)] placeholder:text-[var(--tf-text-muted)] focus:outline-none focus:border-[var(--tf-accent)]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-[11px] font-medium text-[var(--tf-text-secondary)] mb-1"
                  >
                    {t.auth.passwordLabel}
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-[var(--tf-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[var(--tf-border)] bg-[var(--tf-canvas)] text-[var(--tf-text)] placeholder:text-[var(--tf-text-muted)] focus:outline-none focus:border-[var(--tf-accent)]"
                    />
                  </div>
                </div>

                {authMode === 'register' && (
                  <div>
                    <label
                      htmlFor="auth-confirm-password"
                      className="block text-[11px] font-medium text-[var(--tf-text-secondary)] mb-1"
                    >
                      {t.auth.confirmPasswordLabel}
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-[var(--tf-text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[var(--tf-border)] bg-[var(--tf-canvas)] text-[var(--tf-text)] placeholder:text-[var(--tf-text-muted)] focus:outline-none focus:border-[var(--tf-accent)]"
                      />
                    </div>
                  </div>
                )}

                {authError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[11px] flex items-start gap-2 leading-relaxed">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                {authNotice && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[11px] flex items-start gap-2 leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{authNotice}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-[var(--tf-text)] hover:opacity-90 text-[var(--tf-canvas)] text-xs font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
                >
                  {isSubmitting && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>
                    {authMode === 'login'
                      ? t.auth.submitLogin
                      : t.auth.submitRegister}
                  </span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function GlobeBadge() {
  return (
    <span className="w-4 h-4 rounded-full bg-[var(--tf-text)] text-[var(--tf-canvas)] flex items-center justify-center text-[10px] font-bold">
      G
    </span>
  );
}
