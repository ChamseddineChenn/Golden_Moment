'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../api/auth';
import {
  User,
  AuthContextType,
  UserType,
  OrganizerSignupData,
} from '../types/auth.types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('[DEBUG-AUTH] checkAuth() called, tokens in storage:', {
        hasRefreshToken: !!localStorage.getItem('refresh_token'),
        hasAccessToken: !!localStorage.getItem('access_token'),
        timestamp: new Date().toISOString(),
      });
      const currentUser = await authApi.getCurrentUser();
      if (currentUser) {
        console.log('[DEBUG-AUTH] User authenticated:', {
          userId: currentUser.id,
          email: currentUser.email,
          timestamp: new Date().toISOString(),
        });
        setUser(currentUser);
      } else {
        console.log('[DEBUG-AUTH] No user returned from getCurrentUser()');
        setUser(null);
      }
    } catch (error: any) {
      console.log('[DEBUG-AUTH] checkAuth() error:', {
        message: error.message,
        status: error.response?.status,
        timestamp: new Date().toISOString(),
      });
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);
      setUser(response.user);

      // Redirect based on user type
      if (response.user.userType === UserType.ADMIN) {
        router.push('/admin/');
      } else if (response.user.userType === UserType.ORGANIZER) {
        router.push('/');
      } else {
        router.push('/');
      }

      router.refresh();
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    try {
      const response = await authApi.loginWithGoogle(idToken);
      setUser(response.user);

      // Redirect based on user type
      if (response.user.userType === UserType.ADMIN) {
        router.push('/admin/');
      } else if (response.user.userType === UserType.ORGANIZER) {
        router.push('/');
      } else {
        router.push('/');
      }

      router.refresh();
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Google login failed');
    }
  };

  const loginWithFacebook = async (accessToken: string) => {
    try {
      const response = await authApi.loginWithFacebook(accessToken);
      setUser(response.user);

      // Redirect based on user type
      if (response.user.userType === UserType.ADMIN) {
        router.push('/admin/');
      } else if (response.user.userType === UserType.ORGANIZER) {
        router.push('/');
      } else {
        router.push('/');
      }

      router.refresh();
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Facebook login failed');
    }
  };

  const signup = async (email: string, password: string) => {
    try {
      const response = await authApi.signup(email, password);
      setUser(response.user);
      router.push('/');
      router.refresh();
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Signup failed');
    }
  };

  const signupOrganizer = async (data: OrganizerSignupData) => {
    try {
      const response = await authApi.signupOrganizer(data);
      setUser(response.user);
      router.push('/');
      router.refresh();
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Organizer signup failed',
      );
    }
  };

  const logout = async () => {
    try {
      console.log('[DEBUG-LOGOUT-HOOK] logout() called');
      await authApi.logout();
      console.log('[DEBUG-LOGOUT-HOOK] authApi.logout() completed');
    } catch (error) {
      console.error('[DEBUG-LOGOUT-HOOK] Logout error:', error);
    } finally {
      console.log(
        '[DEBUG-LOGOUT-HOOK] Setting user to null and redirecting...',
      );
      setUser(null);
      router.push('/');
      console.log('[DEBUG-LOGOUT-HOOK] About to call router.refresh()');
      router.refresh();
      console.log('[DEBUG-LOGOUT-HOOK] router.refresh() called');
    }
  };

  const refreshAuth = async () => {
    await checkAuth();
  };

  const isAdmin = () => user?.userType === UserType.ADMIN;
  const isOrganizer = () => user?.userType === UserType.ORGANIZER;
  const isRegularUser = () =>
    user?.userType === UserType.USER || !user?.userType;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithGoogle,
        loginWithFacebook,
        signup,
        signupOrganizer,
        logout,
        refreshAuth,
        isAdmin,
        isOrganizer,
        isRegularUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
