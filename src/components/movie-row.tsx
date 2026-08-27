// src/components/movie-row.tsx
"use client";
import { useState } from "react";
import { ExternalLink, X, PartyPopper, Play } from "lucide-react";
import { MoviePoster } from "./movie-poster";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Movie, StreamingProvider } from "@/types";
import { formatRuntime } from "@/lib/utils";

const SEERR_LABEL: Record<string, string> = {
  not_requested: "Not Requested",
  pending: "Queued",
  processing: "Downloading",
  available: "Ready",
  deleted: "Deleted",
};

const SEERR_PILL_CLASS: Record<string, string> = {
  not_requested: "bg-muted text-muted-foreground border-transparent",
  pending:       "bg-queued-bg text-queued border-transparent",
  processing:    "bg-downloading-bg text-downloading border-transparent",
  available:     "bg-success-bg text-success border-transparent",
  deleted:       "bg-muted text-muted-foreground border-transparent",
};

interface MovieRowProps {
  movie: Movie;
  position: number;
  seerrUrl?: string | null;
  streamingProviders: StreamingProvider[];
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

  const seerrPillClass = SEERR_PILL_CLASS[movie.seerrStatus] ?? "bg-muted text-muted-foreground border-transparent";

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
      <div className="flex flex-col sm:flex-row sm:items-center gap-y-2 bg-card border border-border rounded-xl px-4 py-3 mb-2 shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Position */}
          <span className="font-display text-primary font-bold text-sm w-5 text-center flex-shrink-0">
            {position}
          </span>

          {/* Poster */}
          <div className="flex-shrink-0">
            <MoviePoster posterUrl={movie.posterUrl} title={movie.title} size="sm" />
          </div>

          {/* Info — title, year, pills, streaming */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">
              {movie.title}
              {seerrUrl && (
                <a
                  href={`${seerrUrl}/movie/${movie.tmdbId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="ml-1.5 inline-flex align-middle text-primary hover:opacity-75 transition-opacity"
                  title="View in Seerr"
                >
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              )}
            </p>
            <div className="text-muted-foreground text-xs flex items-center gap-1.5">
              <span>
                {movie.year} · {formatRuntime(movie.runtime)}
              </span>
            </div>

            {/* Status pills + streaming info live here */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {movie.matchedViaSwipe && (
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold bg-rose-bg text-rose border-transparent">
                  <PartyPopper className="w-3 h-3" aria-hidden="true" />
                  It&apos;s a match!
                </span>
              )}
              {isStreamable && (
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold bg-success-bg text-success border-transparent">
                  <Play className="w-2.5 h-2.5" fill="currentColor" aria-hidden="true" />
                  Streaming
                </span>
              )}
              {isCheckingStreaming && (
                <span className="rounded-full border px-2 py-0.5 text-xs font-semibold bg-downloading-bg text-downloading border-transparent">
                  Checking…
                </span>
              )}
              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${seerrPillClass}`}>
                {SEERR_LABEL[movie.seerrStatus] ?? movie.seerrStatus}
              </span>
              {isStreamable && streamingProviders.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.providerId}
                  src={`/streaming-logos/${p.providerId}.png`}
                  alt={p.providerName}
                  title={p.providerName}
                  width={20}
                  height={20}
                  className="rounded-sm object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none"
                  }}
                />
              ))}
              {isStreamable && streamingLink && (
                <a
                  href={streamingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded border border-primary/40 bg-card text-primary px-2 py-0.5 text-xs font-medium hover:bg-accent transition-colors"
                >
                  Watch <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Actions — single row */}
        <div className="flex items-center gap-1.5 flex-shrink-0 justify-end">
          {isStreamable ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => onForceDownload(movie.id)}
              >
                Download Now
              </Button>
              <Button
                size="sm"
                className="text-xs"
                onClick={() => onMarkWatched(movie)}
              >
                Mark Watched
              </Button>
            </>
          ) : movie.seerrStatus === "available" ? (
            <Button
              size="sm"
              className="text-xs"
              onClick={() => onMarkWatched(movie)}
            >
              Mark Watched
            </Button>
          ) : movie.seerrStatus === "not_requested" ||
            movie.seerrStatus === "pending" ? (
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => onForceDownload(movie.id)}
            >
              Download Now
            </Button>
          ) : null}

          {confirming ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={handleConfirmRemove}
              >
                Remove
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-destructive text-xs transition-colors"
              aria-label="Remove from list"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Seerr cleanup dialog — unchanged */}
      <Dialog open={askSeerr} onOpenChange={(o) => !o && setAskSeerr(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Remove from Plex too?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              <em>{movie.title}</em> is in your Plex library. Remove it from
              Plex and Radarr as well?
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  setAskSeerr(false)
                  onRemove(movie.id, { seerr: true })
                }}
              >
                Yes, remove from Plex
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setAskSeerr(false)
                  onRemove(movie.id, { seerr: false })
                }}
              >
                No, just the list
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
