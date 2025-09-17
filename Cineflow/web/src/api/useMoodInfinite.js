import { useEffect, useMemo, useRef, useState } from "react";
import { fetchMoodDiscover } from "./movies";

export function useMoodInfinite({ mood, region = "GB", providers = "", types = "flatrate,ads,free", broad = false }) {
  // Stable cache key per mood+filters — avoids mixing lists — KR 02/09/2025
  const cacheKey = useMemo(
    () => `${mood}|${region}|${providers}|${types}|${broad ? 1 : 0}`,
    [mood, region, providers, types, broad]
  );

  // Local state for results + pagination — KR 02/09/2025
  const [pages, setPages] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const nextPageRef = useRef(1);
  const totalPagesRef = useRef(null);

  // Reset when mood or filters change — KR 02/09/2025
  useEffect(() => {
    setPages({});
    setError(null);
    nextPageRef.current = 1;
    totalPagesRef.current = null;
  }, [cacheKey]);

  // supports "fast=1" for pill responsiveness — KR 02/09/2025
  const loadMore = async () => {
    if (loading) return; 
    if (totalPagesRef.current && nextPageRef.current > totalPagesRef.current) return; 

    setLoading(true);
    try {
      const data = await fetchMoodDiscover(
        {
          mood,
          region,
          providers,
          types,
          page: nextPageRef.current,
          broad,
          fast: nextPageRef.current === 1, // only fast on first page
        },
        {}
      );

      // Append new page — KR 02/09/2025
      setPages((prev) => ({
        ...prev,
        [nextPageRef.current]: data.results || [],
      }));

      totalPagesRef.current = data.total_pages || 1;
      nextPageRef.current += 1;
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  // Flatten pages into one results array — KR 02/09/2025
  const results = useMemo(() => {
    return Object.keys(pages)
      .sort((a, b) => Number(a) - Number(b))
      .flatMap((k) => pages[k]);
  }, [pages]);

  return {
    results,
    loading,
    error,
    loadMore,
    hasMore: totalPagesRef.current ? nextPageRef.current <= totalPagesRef.current : true,
  };
}