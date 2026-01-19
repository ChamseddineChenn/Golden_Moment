"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { authApi } from "../api/auth";
import {
  User,
  AuthContextType,
  UserType,
  OrganizerSignupData,
} from "../types/auth.types";

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
      const currentUser = await authApi.getCurrentUser();
      console.log("✅ User authenticated:", currentUser);
      setUser(currentUser);
    } catch (error: any) {
      console.log("ℹ️ Not authenticated");
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
        router.push("/admin/dashboard");
      } else if (response.user.userType === UserType.ORGANIZER) {
        router.push("/organizer/dashboard");
      } else {
        router.push("/");
      }

      router.refresh();
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Login failed");
    }
  };

  const signup = async (email: string, password: string) => {
    try {
      const response = await authApi.signup(email, password);
      setUser(response.user);
      router.push("/");
      router.refresh();
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Signup failed");
    }
  };

  const signupOrganizer = async (data: OrganizerSignupData) => {
    try {
      const response = await authApi.signupOrganizer(data);
      setUser(response.user);
      router.push("/organizer/dashboard");
      router.refresh();
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Organizer signup failed",
      );
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      router.push("/");
      router.refresh();
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
