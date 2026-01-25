'use client';

import { useState, useRef, useEffect } from 'react';

export interface FilterState {
  searchQuery: string;
  selectedDate: string;
  selectedTicketTypes: string[];
  priceFilterType: 'all' | 'exact' | 'range';
  minPrice: string;
  maxPrice: string;
}

interface EventFiltersProps {
  onFilterChange: (filters: FilterState) => void;
  ticketTypesAvailable: string[];
}

export function EventFilters({
  onFilterChange,
  ticketTypesAvailable,
}: EventFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    selectedDate: '',
    selectedTicketTypes: [],
    priceFilterType: 'all',
    minPrice: '',
    maxPrice: '',
  });

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dateRef.current &&
        !dateRef.current.contains(e.target as Node) &&
        typeRef.current &&
        !typeRef.current.contains(e.target as Node) &&
        priceRef.current &&
        !priceRef.current.contains(e.target as Node)
      ) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFilters = { ...filters, searchQuery: e.target.value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFilters = { ...filters, selectedDate: e.target.value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleTicketTypeChange = (ticketType: string) => {
    const newTypes = filters.selectedTicketTypes.includes(ticketType)
      ? filters.selectedTicketTypes.filter((t) => t !== ticketType)
      : [...filters.selectedTicketTypes, ticketType];

    const newFilters = { ...filters, selectedTicketTypes: newTypes };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handlePriceFilterTypeChange = (type: 'all' | 'exact' | 'range') => {
    const newFilters = { ...filters, priceFilterType: type };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleMinPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFilters = { ...filters, minPrice: e.target.value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFilters = { ...filters, maxPrice: e.target.value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleClearFilters = () => {
    const clearedFilters: FilterState = {
      searchQuery: '',
      selectedDate: '',
      selectedTicketTypes: [],
      priceFilterType: 'all',
      minPrice: '',
      maxPrice: '',
    };
    setFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const activeFiltersCount =
    (filters.searchQuery ? 1 : 0) +
    (filters.selectedDate ? 1 : 0) +
    (filters.selectedTicketTypes.length > 0 ? 1 : 0) +
    (filters.priceFilterType !== 'all' ? 1 : 0);

  return (
    <div className="mb-8 space-y-4">
      {/* Full-width Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search events by name..."
          value={filters.searchQuery}
          onChange={handleSearchChange}
          className="w-full px-4 py-3 pl-12 bg-white border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition"
        />
        <svg
          className="absolute left-4 top-3.5 w-5 h-5 text-stone-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Filter Buttons Row */}
      <div className="flex flex-wrap gap-2">
        {/* Date Filter Button */}
        <div className="relative" ref={dateRef}>
          <button
            onClick={() =>
              setOpenDropdown(openDropdown === 'date' ? null : 'date')
            }
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2.5 ${
              filters.selectedDate
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-stone-100 text-stone-700 border border-stone-200 hover:bg-stone-150'
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Date
            {filters.selectedDate && (
              <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-semibold">
                1
              </span>
            )}
          </button>

          {/* Date Dropdown */}
          {openDropdown === 'date' && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-stone-200 rounded-xl shadow-xl z-10 p-5 backdrop-blur-sm bg-white/95">
              <input
                type="date"
                value={filters.selectedDate}
                onChange={handleDateChange}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition"
              />
              {filters.selectedDate && (
                <p className="text-xs text-amber-600 font-medium mt-3">
                  Selected:{' '}
                  {new Date(filters.selectedDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Ticket Type Filter Button */}
        <div className="relative" ref={typeRef}>
          <button
            onClick={() =>
              setOpenDropdown(openDropdown === 'type' ? null : 'type')
            }
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2.5 ${
              filters.selectedTicketTypes.length > 0
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-stone-100 text-stone-700 border border-stone-200 hover:bg-stone-150'
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 5v2m-4 3v2m4 3v2M9 5a4 4 0 018 0v12a4 4 0 01-8 0V5z"
              />
            </svg>
            Type
            {filters.selectedTicketTypes.length > 0 && (
              <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-semibold">
                {filters.selectedTicketTypes.length}
              </span>
            )}
          </button>

          {/* Ticket Type Dropdown */}
          {openDropdown === 'type' && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-stone-200 rounded-xl shadow-xl z-10 p-5 backdrop-blur-sm bg-white/95">
              <div className="space-y-3 max-h-56 overflow-y-auto">
                {ticketTypesAvailable.length > 0 ? (
                  ticketTypesAvailable.map((ticketType) => (
                    <label
                      key={ticketType}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.selectedTicketTypes.includes(
                            ticketType,
                          )}
                          onChange={() => handleTicketTypeChange(ticketType)}
                          className="w-5 h-5 rounded border border-stone-300 cursor-pointer appearance-none bg-white checked:bg-amber-500 checked:border-amber-500 transition"
                        />
                        {filters.selectedTicketTypes.includes(ticketType) && (
                          <svg
                            className="absolute w-3 h-3 text-white pointer-events-none"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <span className="text-stone-700 text-sm group-hover:text-amber-600 transition">
                        {ticketType}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-stone-400">No types available</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Price Filter Button */}
        <div className="relative" ref={priceRef}>
          <button
            onClick={() =>
              setOpenDropdown(openDropdown === 'price' ? null : 'price')
            }
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2.5 ${
              filters.priceFilterType !== 'all'
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-stone-100 text-stone-700 border border-stone-200 hover:bg-stone-150'
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Price
            {filters.priceFilterType !== 'all' && (
              <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-semibold">
                1
              </span>
            )}
          </button>

          {/* Price Dropdown */}
          {openDropdown === 'price' && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-stone-200 rounded-xl shadow-xl z-10 p-5 backdrop-blur-sm bg-white/95">
              <div className="space-y-4">
                {/* All Prices Option */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="radio"
                      name="priceFilter"
                      value="all"
                      checked={filters.priceFilterType === 'all'}
                      onChange={() => handlePriceFilterTypeChange('all')}
                      className="w-5 h-5 cursor-pointer appearance-none rounded-full border border-stone-300 bg-white checked:bg-amber-500 checked:border-amber-500 transition"
                    />
                    {filters.priceFilterType === 'all' && (
                      <div className="absolute w-2 h-2 bg-white rounded-full pointer-events-none left-1.5 top-1.5" />
                    )}
                  </div>
                  <span className="text-stone-700 text-sm group-hover:text-amber-600 transition">
                    All Prices
                  </span>
                </label>

                {/* Price Range Option */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="radio"
                      name="priceFilter"
                      value="range"
                      checked={filters.priceFilterType === 'range'}
                      onChange={() => handlePriceFilterTypeChange('range')}
                      className="w-5 h-5 cursor-pointer appearance-none rounded-full border border-stone-300 bg-white checked:bg-amber-500 checked:border-amber-500 transition"
                    />
                    {filters.priceFilterType === 'range' && (
                      <div className="absolute w-2 h-2 bg-white rounded-full pointer-events-none left-1.5 top-1.5" />
                    )}
                  </div>
                  <span className="text-stone-700 text-sm group-hover:text-amber-600 transition">
                    Price Range
                  </span>
                </label>

                {/* Price Range Inputs */}
                {filters.priceFilterType === 'range' && (
                  <div className="space-y-3 mt-4 pt-4 border-t border-stone-100">
                    <div>
                      <label className="text-xs font-medium text-stone-600 mb-2 block">
                        Min Price
                      </label>
                      <input
                        type="number"
                        placeholder="$0"
                        value={filters.minPrice}
                        onChange={handleMinPriceChange}
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-stone-600 mb-2 block">
                        Max Price
                      </label>
                      <input
                        type="number"
                        placeholder="$999"
                        value={filters.maxPrice}
                        onChange={handleMaxPriceChange}
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Clear Filters Button */}
        <button
          onClick={handleClearFilters}
          disabled={activeFiltersCount === 0}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2.5 ${
            activeFiltersCount > 0
              ? 'bg-amber-500 text-white hover:bg-amber-600 cursor-pointer'
              : 'bg-stone-100 text-stone-400 cursor-not-allowed'
          }`}
        >
          <svg
            className="w-4 h-4"
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
          Clear
          {activeFiltersCount > 0 && (
            <span className="text-xs bg-white text-amber-500 px-2 py-0.5 rounded-full font-semibold">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
