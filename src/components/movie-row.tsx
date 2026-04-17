// src/components/movie-row.tsx
"use client";
import { useState } from "react";
import { MoviePoster } from "./movie-poster";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Movie } from "@/types";
import { formatRuntime } from "@/lib/utils";

const SEERR_LABEL: Record<string, string> = {
  not_requested: "Not Requested",
  pending: "Queued",
  processing: "Downloading",
  available: "Ready",
  deleted: "Deleted",
};

interface MovieRowProps {
  movie: Movie;
  position: number;
  seerrUrl?: string | null;
  streamingProviders: { providerId: number; providerName: string }[];
  streamingLink: string | null;
  onMarkWatched: (movie: Movie) => void;
  onForceDownload: (movieId: number) => void;
  onRemove: (movieId: number, opts: { seerr: boolean }) => void;
}

export function MovieRow({
  movie,
  position,
  seerrUrl,
  streamingProviders,
  streamingLink,
  onMarkWatched,
  onForceDownload,
  onRemove,
}: MovieRowProps) {
  const [confirming, setConfirming] = useState(false);
  const [askSeerr, setAskSeerr] = useState(false);

  const isStreamable = streamingProviders.length > 0;
  const isCheckingStreaming = !isStreamable && movie.streamingLastChecked == null;

  const seerrPillClass =
    movie.seerrStatus === "available"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-stone-100 text-stone-500 border-stone-200";

  const handleConfirmRemove = () => {
    setConfirming(false);
    if (movie.seerrMediaId) {
      setAskSeerr(true);
    } else {
      onRemove(movie.id, { seerr: false });
    }
  };

  return (
    <>
      <div className="flex items-start gap-3 bg-white border border-amber-200 rounded-xl px-4 py-3 mb-2 shadow-sm">
        {/* Position */}
        <span className="text-amber-700 font-bold text-sm w-5 text-center flex-shrink-0 pt-3">
          {position}
        </span>

        {/* Poster */}
        <div className="pt-1">
          <MoviePoster posterUrl={movie.posterUrl} title={movie.title} size="sm" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pt-1">
          <div className="font-semibold text-stone-900 text-sm truncate">
            {movie.title}
          </div>
          <div className="text-stone-400 text-xs flex items-center gap-1.5">
            <span>
              {movie.year} · {formatRuntime(movie.runtime)}
            </span>
            {seerrUrl && (
              <a
                href={`${seerrUrl}/movie/${movie.tmdbId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-500 hover:text-amber-700 transition-colors"
                title="View in Seerr"
              >
                ↗
              </a>
            )}
          </div>
        </div>

        {/* Actions column */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {/* Row 1: Streaming pill (positive state only) + Seerr status pill */}
          <div className="flex gap-1.5 flex-wrap justify-end">
            {isStreamable && (
              <span className="rounded-full border px-2 py-0.5 text-xs font-semibold bg-green-50 text-green-700 border-green-200">
                Streaming
              </span>
            )}
            {isCheckingStreaming && (
              <span className="rounded-full border px-2 py-0.5 text-xs font-semibold bg-amber-50 text-amber-500 border-amber-200">
                Checking…
              </span>
            )}
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${seerrPillClass}`}>
              {SEERR_LABEL[movie.seerrStatus] ?? movie.seerrStatus}
            </span>
          </div>

          {/* Row 2: Provider logos (decorative) + single Where to Watch link */}
          {isStreamable && (
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {streamingProviders.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.providerId}
                  src={`/streaming-logos/${p.providerId}.png`}
                  alt={p.providerName}
                  title={p.providerName}
                  width={16}
                  height={16}
                  className="rounded-sm object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ))}
              {streamingLink && (
                <a
                  href={streamingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-stone-600 bg-stone-800 text-white px-2 py-0.5 text-xs font-medium hover:bg-stone-700 transition-colors"
                >
                  Watch ↗
                </a>
              )}
            </div>
          )}

          {/* Row 3: Action buttons */}
          <div className="flex gap-1">
            {isStreamable ? (
              <>
                <Button
                  size="sm"
                  className="h-6 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => onMarkWatched(movie)}
                >
                  Mark Watched
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => onForceDownload(movie.id)}
                >
                  Download Now
                </Button>
              </>
            ) : movie.seerrStatus === "available" ? (
              <Button
                size="sm"
                className="h-6 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => onMarkWatched(movie)}
              >
                Mark Watched
              </Button>
            ) : movie.seerrStatus === "not_requested" ||
              movie.seerrStatus === "pending" ? (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => onForceDownload(movie.id)}
              >
                Download Now
              </Button>
            ) : null}
          </div>

          {/* Row 4: Remove (two-tap confirm) — always last */}
          {confirming ? (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs border-red-300 text-red-600 hover:bg-red-50"
                onClick={handleConfirmRemove}
              >
                Remove
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs border-stone-200 text-stone-400 hover:bg-stone-50"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="text-stone-300 hover:text-red-400 text-xs transition-colors"
              aria-label="Remove from list"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Seerr cleanup dialog */}
      <Dialog open={askSeerr} onOpenChange={(o) => !o && setAskSeerr(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-amber-900">
              Remove from Plex too?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-stone-600">
              <em>{movie.title}</em> is in your Plex library. Remove it from
              Plex and Radarr as well?
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  setAskSeerr(false);
                  onRemove(movie.id, { seerr: true });
                }}
              >
                Yes, remove from Plex
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-stone-200 text-stone-600 hover:bg-stone-50"
                onClick={() => {
                  setAskSeerr(false);
                  onRemove(movie.id, { seerr: false });
                }}
              >
                No, just the list
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
