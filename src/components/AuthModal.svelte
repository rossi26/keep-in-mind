<script lang="ts">
  import { store } from '../lib/svelteStore';
  import { authModalOpen, closeAuthModal } from '../stores/ui';
  import { supabase } from '../lib/supabase';
  import { currentUser, syncEnabled, syncStatus } from '../stores/sync';
  import { signOut } from '../lib/syncService';
  import { addToast } from '../stores/ui';
  import Icon from './Icon.svelte';

  const authModalOpenStore = store(authModalOpen);
  const currentUserStore = store(currentUser);
  const syncEnabledStore = store(syncEnabled);
  const syncStatusStore = store(syncStatus);

    let mode = $state<'login' | 'signup' | 'forgot'>('login');
  let email = $state('');
  let password = $state('');
  let loading = $state(false);
  let errorMsg = $state('');
  let signingOut = $state(false);
  let resetEmailSent = $state(false);

    function switchMode(): void {
    mode = mode === 'login' ? 'signup' : 'login';
    errorMsg = '';
    resetEmailSent = false;
  }

  function showForgotPassword(): void {
    mode = 'forgot';
    errorMsg = '';
    resetEmailSent = false;
  }

  async function handleSubmit(): Promise<void> {
    if (!supabase) {
      addToast('Sync not configured. Add Supabase credentials in .env', 'error');
      return;
    }
    if (!email || !password) {
      errorMsg = 'Please fill in all fields';
      return;
    }
    if (password.length < 6) {
      errorMsg = 'Password must be at least 6 characters';
      return;
    }

    loading = true;
    errorMsg = '';

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        addToast('Welcome back!', 'success');
        closeAuthModal();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        // If email confirmation is enabled, Supabase returns a user without a session
        addToast('Account created! Check your email to confirm.', 'success');
        closeAuthModal();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      errorMsg = message;
    } finally {
      loading = false;
    }
  }

    async function handleGoogleLogin(): Promise<void> {
    if (!supabase) return;
    loading = true;
    errorMsg = '';
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google login failed';
      errorMsg = message;
      loading = false;
    }
  }

  async function handlePasswordReset(): Promise<void> {
    if (!supabase) {
      addToast('Sync not configured. Add Supabase credentials in .env', 'error');
      return;
    }
    if (!email) {
      errorMsg = 'Please enter your email address';
      return;
    }

    loading = true;
    errorMsg = '';

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/?reset-password=true`,
      });
      if (error) throw error;
      resetEmailSent = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email';
      errorMsg = message;
    } finally {
      loading = false;
    }
  }

  async function handleSignOut(): Promise<void> {
    signingOut = true;
    errorMsg = '';
    try {
      await signOut();
      addToast('Signed out. Your local data is preserved.', 'info');
      closeAuthModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign out failed';
      errorMsg = message;
    } finally {
      signingOut = false;
    }
  }

  function onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      closeAuthModal();
    }
  }

  function getSyncLabel(): string {
    if (!$syncEnabledStore) return 'No cloud sync configured';
    if ($syncStatusStore === 'offline') return 'Offline — changes stay local';
    if ($syncStatusStore === 'syncing') return 'Syncing…';
    if ($syncStatusStore === 'error') return 'Sync error';
    if ($syncStatusStore === 'online') return 'Synced across devices';
    return 'Cloud sync';
  }
</script>

{#if $authModalOpenStore}
  <div
    class="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
    onclick={onBackdropClick}
    role="dialog"
    aria-modal="true"
    aria-label="Account"
  >
    <div
      class="w-full md:max-w-md bg-surface-light dark:bg-surface-dark rounded-t-2xl md:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header with drag handle on mobile -->
      <div class="pt-3 md:pt-5 px-5 md:px-6 pb-4 border-b border-neutral-200 dark:border-neutral-800 sticky top-0 bg-surface-light dark:bg-surface-dark">
        <div class="md:hidden sheet-handle mb-3"></div>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
            {#if $currentUserStore}
              Account
            {:else if mode === 'forgot'}
              Reset password
            {:else}
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            {/if}
          </h2>
          <button
            type="button"
            onclick={closeAuthModal}
            class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close"
          >
            <span class="text-xl leading-none">&times;</span>
          </button>
        </div>
      </div>

      <div class="p-5 md:p-6 space-y-4">
        {#if $currentUserStore}
          <!-- ==================== ACCOUNT SCREEN (signed in) ==================== -->
          <div class="flex flex-col items-center py-4">
            <span class="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold mb-3">
              {($currentUserStore.email ?? '?').charAt(0).toUpperCase()}
            </span>
            <p class="text-base font-semibold text-neutral-800 dark:text-neutral-100 text-center break-all">
              {$currentUserStore.email}
            </p>
            <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1 flex items-center gap-1">
              <Icon name={$syncStatusStore === 'syncing' ? 'refresh-cw' : $syncStatusStore === 'online' ? 'wifi' : $syncStatusStore === 'error' ? 'alert-circle' : 'cloud'} size={14} class={$syncStatusStore === 'syncing' ? 'animate-spin' : ''} />
              {getSyncLabel()}
            </p>
          </div>

          <div class="px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 text-xs text-neutral-500 dark:text-neutral-400 rounded-card border border-neutral-200 dark:border-neutral-700">
            Your data is synced across devices using your account. Deleting a task here will also delete it on your other devices.
          </div>

          {#if errorMsg}
            <div class="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm rounded-card border border-red-200 dark:border-red-800/40">
              {errorMsg}
            </div>
          {/if}

          <button
            type="button"
            onclick={handleSignOut}
            disabled={signingOut}
            class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-card text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
          >
            <Icon name="log-out" size={16} />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        {:else if mode === 'forgot'}
          <!-- ==================== FORGOT PASSWORD SCREEN ==================== -->
          {#if resetEmailSent}
            <div class="text-center py-6">
              <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Icon name="mail" size={32} class="text-green-600 dark:text-green-400" />
              </div>
              <h3 class="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-2">Check your email</h3>
              <p class="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
                We've sent a password reset link to <strong class="text-neutral-700 dark:text-neutral-300">{email}</strong>
              </p>
              <button
                type="button"
                onclick={() => { mode = 'login'; resetEmailSent = false; }}
                class="text-sm text-primary hover:underline"
              >
                Back to sign in
              </button>
            </div>
          {:else}
            <p class="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            {#if errorMsg}
              <div class="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm rounded-card border border-red-200 dark:border-red-800/40">
                {errorMsg}
              </div>
            {/if}

            <form onsubmit={(e) => { e.preventDefault(); handlePasswordReset(); }} class="space-y-4">
              <div>
                <label for="reset-email" class="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  bind:value={email}
                  required
                  placeholder="you@example.com"
                  class="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-card text-sm text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {#if !supabase}
                <p class="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-card px-3 py-2">
                  ⚠️ Supabase is not configured. Add credentials in <code class="font-mono">.env</code> to enable cloud sync.
                </p>
              {/if}

              <button
                type="submit"
                disabled={loading || !supabase}
                class="w-full px-4 py-3 bg-primary text-white rounded-card text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <div class="text-center">
              <button
                type="button"
                onclick={() => { mode = 'login'; errorMsg = ''; }}
                class="text-sm text-primary hover:underline"
              >
                Back to sign in
              </button>
            </div>
          {/if}
        {:else}
          <!-- ==================== LOGIN / SIGNUP SCREEN ==================== -->
          {#if errorMsg}
            <div class="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm rounded-card border border-red-200 dark:border-red-800/40">
              {errorMsg}
            </div>
          {/if}

          <!-- Google login -->
          <button
            type="button"
            onclick={handleGoogleLogin}
            disabled={loading || !supabase}
            class="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white dark:bg-neutral-800 rounded-card border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" fill="#4285F4"/>
              <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" fill="#34A853"/>
              <path d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" fill="#FBBC05"/>
              <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div class="flex items-center gap-3">
            <div class="flex-1 h-px bg-neutral-200 dark:bg-neutral-700"></div>
            <span class="text-xs text-neutral-400 dark:text-neutral-500">or</span>
            <div class="flex-1 h-px bg-neutral-200 dark:bg-neutral-700"></div>
          </div>

          <!-- Email / password form -->
          <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
            <div>
              <label for="auth-email" class="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                bind:value={email}
                required
                placeholder="you@example.com"
                class="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-card text-sm text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label for="auth-password" class="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                bind:value={password}
                required
                placeholder="••••••••"
                class="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-card text-sm text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {#if !supabase}
              <p class="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-card px-3 py-2">
                ⚠️ Supabase is not configured. Add credentials in <code class="font-mono">.env</code> to enable cloud sync.
              </p>
            {/if}

            <button
              type="submit"
              disabled={loading || !supabase}
              class="w-full px-4 py-3 bg-primary text-white rounded-card text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <!-- Forgot password link (only in login mode) -->
          {#if mode === 'login'}
            <div class="text-center">
              <button
                type="button"
                onclick={showForgotPassword}
                class="text-sm text-neutral-500 dark:text-neutral-400 hover:text-primary dark:hover:text-primary"
              >
                Forgot password?
              </button>
            </div>
          {/if}

          <div class="text-center">
            <button
              type="button"
              onclick={switchMode}
              class="text-sm text-primary hover:underline"
            >
              {mode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>

          <div class="text-center">
            <button
              type="button"
              onclick={closeAuthModal}
              class="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              Continue without account (local only)
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}