// SkeletonRow.jsx - Shimmer placeholders for poster rails - KR 25/08/2025
import React from "react";
import "@/styles/home.css"; // uses .reel-wrap, .h-scroll, .poster-card.skel - KR 25/08/2025

export default function SkeletonRow({ count = 8 }) {
  const items = Array.from({ length: count });
  return (
    <div className="reel-wrap">
      <div className="h-scroll">
        {items.map((_, i) => (
          <article key={i} className="poster-card skel" aria-hidden="true">
            <div className="poster-img skel-box" />
            <div className="poster-meta">
              <div className="skel-line w-80" />
              <div className="skel-line w-50" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}