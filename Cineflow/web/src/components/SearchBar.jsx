import React from "react";
import "@/styles/home.css";

export default function SearchBar({ value, onChange, placeholder = "Search for a movie..."}) {
    return (
        <section className="hero">
            <div className="search-wrap">
                <input
                className="search-input"
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label="Search movies"
                autoComplete="off"
                />
            </div>
        </section>
    );
}