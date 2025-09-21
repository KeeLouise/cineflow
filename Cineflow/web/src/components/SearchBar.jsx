import React, { useEffect, useId, useRef, useState } from "react";
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
  const [activeIndex, setActiveIndex] = useState(-1); // keyboard highlight
  const timer = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listboxId = useId();

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

  // Reset active option when list changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  const handleKeyDown = (e) => {
    const count = suggestions?.length || 0;

    // Enter selects highlighted suggestion if present; otherwise triggers search
    if (e.key === "Enter") {
      e.preventDefault();
      if (count > 0 && activeIndex >= 0 && activeIndex < count) {
        const item = suggestions[activeIndex];
        onSelectSuggestion?.(item);
      } else {
        const q = value?.trim();
        if (q && onSearch) onSearch(q); // immediate search on Enter
      }
      return;
    }

    if (e.key === "Escape") {
      // If list open, just collapse; else clear
      if (showSuggestions) {
        e.preventDefault();
        setActiveIndex(-1);
        // blur-then-refocus keeps caret stable
        inputRef.current?.blur();
        requestAnimationFrame(() => inputRef.current?.focus());
      } else {
        handleClear();
      }
      return;
    }

    if (e.key === "ArrowDown" && count > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % count);
      return;
    }

    if (e.key === "ArrowUp" && count > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1));
      return;
    }
  };

  const handleClear = () => {
    onChange?.("");
    setActiveIndex(-1);
    // keep focus so users can type again instantly
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const showSuggestions =
    focused && suggestions?.length > 0 && typeof onSelectSuggestion === "function";

  return (
    <div className="search-wrap">
      {/* Input row */}
      <div className="search-input-row position-relative">
        {/* Inline search icon (decorative) */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          className="position-absolute"
          style={{ left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.8 }}
        >
          <path
            fill="currentColor"
            d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14Z"
          />
        </svg>

        <input
          ref={inputRef}
          className="search-input ps-5" /* space for icon */
          type="search"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          aria-label="Search movies"
          autoComplete="off"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? listboxId : undefined}
          aria-activedescendant={
            showSuggestions && activeIndex >= 0
              ? `${listboxId}-opt-${activeIndex}`
              : undefined
          }
          aria-autocomplete="list"
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

        {/* Loading spinner */}
        {isLoading && <span className="search-spinner" aria-hidden="true" />}
      </div>

      {/* Suggestions */}
      {showSuggestions && (
        <ul
          ref={listRef}
          id={listboxId}
          className="search-suggestions"
          role="listbox"
        >
          {suggestions.map((s, i) => {
            const active = i === activeIndex;
            return (
              <li key={s.id} role="presentation">
                <button
                  id={`${listboxId}-opt-${i}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className="search-suggestion"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(i)}
                  onFocus={() => setActiveIndex(i)}
                  onClick={() => onSelectSuggestion?.(s)}
                  style={{
                    background: active ? "#1a1a1a" : "transparent",
                    outline: active ? "1px solid rgba(255,255,255,0.12)" : "none",
                  }}
                >
                  {s.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}