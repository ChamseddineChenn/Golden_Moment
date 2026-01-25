'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';

export function Header() {
  const { user, loading: authLoading, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Get user initials for avatar
  const getUserInitials = () => {
    if (user?.organizationName) {
      return user.organizationName.slice(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  // Get display name
  const getDisplayName = () => {
    if (user?.organizationName) return user.organizationName;
    if (user?.email) return user.email;
    return 'User';
  };

  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-stone-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="text-white text-base sm:text-lg font-bold">G</span>
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-bold text-stone-900 tracking-tight">
                Golden Moment
              </h1>
              <p className="text-xs text-stone-500 -mt-0.5 hidden sm:block">
                Events & Experiences
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8">
            <Link
              href="/"
              className="text-stone-900 font-medium hover:text-amber-600 transition"
            >
              Events
            </Link>
            <Link
              href="/about"
              className="text-stone-600 hover:text-amber-600 transition"
            >
              About
            </Link>
            <Link
              href="/contact"
              className="text-stone-600 hover:text-amber-600 transition"
            >
              Contact
            </Link>

            {/* Auth Section */}
            {authLoading ? (
              <div className="w-20 h-8 bg-stone-200 animate-pulse rounded"></div>
            ) : user ? (
              <div className="flex items-center gap-4">
                {/* Dashboard Links */}
                {user.userType === 'Admin' && (
                  <Link
                    href="/admin"
                    className="text-stone-600 hover:text-amber-600 transition text-sm"
                  >
                    Admin Dashboard
                  </Link>
                )}
                {user.userType === 'Organizer' && (
                  <Link
                    href="/admin"
                    className="text-stone-600 hover:text-amber-600 transition text-sm"
                  >
                    Organizer Dashboard
                  </Link>
                )}

                {/* User Avatar Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2 focus:outline-none"
                  >
                    <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-md hover:shadow-lg transition-shadow cursor-pointer">
                      {getUserInitials()}
                    </div>
                  </button>

                  {/* Dropdown Menu */}
                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-stone-200 py-2 z-50">
                      {/* User Info */}
                      <div className="px-4 py-3 border-b border-stone-200">
                        <p className="text-sm font-semibold text-stone-900 truncate">
                          {getDisplayName()}
                        </p>
                        <p className="text-xs text-stone-500 truncate mt-0.5">
                          {user.email}
                        </p>
                        <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                          {user.userType}
                        </span>
                      </div>

                      {/* Menu Items */}
                      <div className="py-1">
                        <Link
                          href="/profile"
                          onClick={() => setIsDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition"
                        >
                          <svg className="w-4 h-4 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          My Profile
                        </Link>

                        <button
                          onClick={() => {
                            setIsDropdownOpen(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/auth/login"
                  className="text-stone-600 hover:text-amber-600 transition text-sm font-medium"
                >
                  Login
                </Link>
                <Link
                  href="/auth/signup"
                  className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition text-sm font-medium"
                >
                  Sign Up
                </Link>
                <Link
                  href="/auth/signup-organizer"
                  className="bg-stone-900 text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition text-sm font-medium"
                >
                  Become Organizer
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-stone-600 hover:text-stone-900 transition"
          >
            {isMobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-stone-200 py-4 space-y-3">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-2 text-stone-900 font-medium hover:bg-stone-50 rounded-lg transition"
            >
              Events
            </Link>
            <Link
              href="/about"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-2 text-stone-600 hover:bg-stone-50 rounded-lg transition"
            >
              About
            </Link>
            <Link
              href="/contact"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-2 text-stone-600 hover:bg-stone-50 rounded-lg transition"
            >
              Contact
            </Link>

            {authLoading ? (
              <div className="px-4 py-2">
                <div className="w-full h-10 bg-stone-200 animate-pulse rounded"></div>
              </div>
            ) : user ? (
              <>
                <div className="px-4 py-3 bg-stone-50 rounded-lg mx-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {getUserInitials()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-900 truncate">
                        {getDisplayName()}
                      </p>
                      <p className="text-xs text-stone-500 truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <span className="inline-block px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                    {user.userType}
                  </span>
                </div>

                {user.userType === 'Admin' && (
                  <Link
                    href="/admin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-4 py-2 text-stone-600 hover:bg-stone-50 rounded-lg transition mx-4"
                  >
                    Admin Dashboard
                  </Link>
                )}
                {user.userType === 'Organizer' && (
                  <Link
                    href="/"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-4 py-2 text-stone-600 hover:bg-stone-50 rounded-lg transition mx-4"
                  >
                    Organizer Dashboard
                  </Link>
                )}

                <Link
                  href="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-stone-700 hover:bg-stone-50 rounded-lg transition mx-4"
                >
                  <svg className="w-5 h-5 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  My Profile
                </Link>

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition mx-4 cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </>
            ) : (
              <div className="px-4 space-y-2">
                <Link
                  href="/auth/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full text-center px-4 py-2.5 text-stone-600 border border-stone-300 rounded-lg hover:bg-stone-50 transition font-medium"
                >
                  Login
                </Link>
                <Link
                  href="/auth/signup"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full text-center bg-amber-500 text-white px-4 py-2.5 rounded-lg hover:bg-amber-600 transition font-medium"
                >
                  Sign Up
                </Link>
                <Link
                  href="/auth/signup-organizer"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full text-center bg-stone-900 text-white px-4 py-2.5 rounded-lg hover:bg-stone-800 transition font-medium"
                >
                  Become Organizer
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
