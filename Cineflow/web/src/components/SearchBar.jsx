import React, { useEffect, useRef, useState } from "react";
import "@/styles/home.css";

export default function SearchBar({
  value,
  onChange,
  onSearch,
  placeholder = "Search for a movie…",
  isLoading = false,
  suggestions = [],
  onSelectSuggestion,
  debounceMs = 300,
}) {
  const [focused, setFocused] = useState(false);
  const timer = useRef(null);
  const inputRef = useRef(null);

  // Debounce: when `value` changes, trigger onSearch after a pause - KR 25/08/2025
  useEffect(() => {
    if (!onSearch) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = value?.trim();
      if (q) onSearch(q);
    }, debounceMs);
    return () => timer.current && clearTimeout(timer.current);
  }, [value, onSearch, debounceMs]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = value?.trim();
      if (q && onSearch) onSearch(q); // immediate search on Enter
    }
    if (e.key === "Escape") {
      handleClear();
    }
  };

  const handleClear = () => {
    onChange?.("");
    // keep focus so users can type again instantly
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const showSuggestions =
    focused && suggestions?.length > 0 && typeof onSelectSuggestion === "function";

  return (
    <section className="hero">
      <div className="search-wrap">
        <div className="search-input-row">
          <input
            ref={inputRef}
            className="search-input"
            type="search"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            aria-label="Search movies"
            autoComplete="off"
          />

          {/* Clear button (only when there's text) */}
          {value && (
            <button
              type="button"
              className="search-clear"
              aria-label="Clear search"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
            >
              ×
            </button>
          )}

          {isLoading && <span className="search-spinner" aria-hidden="true" />}
        </div>

        {showSuggestions && (
          <ul className="search-suggestions" role="listbox">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="search-suggestion"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSelectSuggestion?.(s)}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}