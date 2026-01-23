'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CheckoutFailedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          {/* Error Icon */}
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Payment Failed
          </h1>
          <p className="text-gray-600 mb-8">
            Unfortunately, your payment could not be processed. Your seats
            remain available for you to try again.
          </p>

          {/* Reasons */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Common Reasons:
            </h2>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start">
                <span className="text-red-600 mr-3">•</span>
                <span>Insufficient funds or card declined</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-600 mr-3">•</span>
                <span>Incorrect card details or expiration date</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-600 mr-3">•</span>
                <span>Card authentication failed</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-600 mr-3">•</span>
                <span>Connection timeout or technical issue</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => router.back()}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded transition"
            >
              Try Again
            </button>
            <Link
              href="/"
              className="inline-block w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-bold py-3 px-4 rounded transition text-center"
            >
              Browse Events
            </Link>
          </div>

          {/* Additional Info */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Still having trouble?
              <Link
                href="/contact"
                className="text-blue-600 hover:underline ml-1"
              >
                Contact our support team
              </Link>
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Your card was not charged. Your selected seats are still
              available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
