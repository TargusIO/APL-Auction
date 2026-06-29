"use client";

import React, { useState } from "react";
import { submitFeedback, type FeedbackPayload } from "@/lib/feedbackDb";

interface FeedbackModalProps {
  auctionId:  string;
  role:       "owner" | "auctioneer" | "spectator";
  trigger:    "paused" | "completed";
  teamId?:    string;
  onClose:    () => void;
}

export function FeedbackModal({
  auctionId,
  role,
  trigger,
  teamId,
  onClose,
}: FeedbackModalProps) {
  const [rating,        setRating]        = useState<number | null>(null);
  const [whatWentWell,  setWhatWentWell]  = useState("");
  const [whatToImprove, setWhatToImprove] = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [done,          setDone]          = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  async function handleSubmit() {
    if (!rating) { setError("Please select a rating."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const payload: FeedbackPayload = {
        auctionId,
        role,
        trigger,
        teamId,
        rating,
        whatWentWell:  whatWentWell.trim()  || undefined,
        whatToImprove: whatToImprove.trim() || undefined,
      };
      await submitFeedback(payload);
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? "Failed to submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5"
        style={{
          background: "#0f1415",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        {done ? (
          <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
            <span
              className="material-symbols-outlined text-5xl"
              style={{ color: "#F5B400" }}
            >
              check_circle
            </span>
            <p
              style={{
                fontFamily: "'Archivo Narrow', sans-serif",
                fontSize: 22,
                fontWeight: 700,
                color: "#e8ecf0",
                textTransform: "uppercase",
              }}
            >
              Thanks for your feedback!
            </p>
            <p
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                color: "#5a6a74",
                letterSpacing: "0.1em",
              }}
            >
              It helps us improve every season.
            </p>
            <button
              onClick={onClose}
              style={{
                marginTop: 8,
                padding: "10px 32px",
                borderRadius: 8,
                background: "#e45d35",
                color: "#fff",
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                border: "none",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <p
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 9,
                    color: "#e45d35",
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    marginBottom: 4,
                  }}
                >
                  {trigger === "completed" ? "Auction Complete" : "Session Paused"}
                </p>
                <h2
                  style={{
                    fontFamily: "'Archivo Narrow', sans-serif",
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#e8ecf0",
                    textTransform: "uppercase",
                  }}
                >
                  How did it go?
                </h2>
              </div>
              <button
                onClick={onClose}
                style={{
                  color: "#5a6a74",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 20 }}
                >
                  close
                </span>
              </button>
            </div>

            {/* Rating */}
            <div>
              <p
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 9,
                  color: "#5a6a74",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  marginBottom: 10,
                }}
              >
                Overall Rating
              </p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      border: rating === n
                        ? "1px solid #F5B400"
                        : "1px solid rgba(255,255,255,0.08)",
                      background: rating === n
                        ? "rgba(245,180,0,0.15)"
                        : "rgba(255,255,255,0.03)",
                      color: rating === n ? "#F5B400" : "#5a6a74",
                      fontFamily: "'Archivo Narrow', sans-serif",
                      fontSize: 18,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* What went well */}
            <div>
              <p
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 9,
                  color: "#5a6a74",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  marginBottom: 8,
                }}
              >
                What went well? (optional)
              </p>
              <textarea
                rows={2}
                value={whatWentWell}
                onChange={(e) => setWhatWentWell(e.target.value)}
                placeholder="e.g. Smooth bidding, great reveal animation..."
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  color: "#e0e3e4",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  resize: "none",
                  outline: "none",
                }}
              />
            </div>

            {/* What to improve */}
            <div>
              <p
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 9,
                  color: "#5a6a74",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  marginBottom: 8,
                }}
              >
                What could be improved? (optional)
              </p>
              <textarea
                rows={2}
                value={whatToImprove}
                onChange={(e) => setWhatToImprove(e.target.value)}
                placeholder="e.g. Timer felt too short, needed more teams..."
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  color: "#e0e3e4",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  resize: "none",
                  outline: "none",
                }}
              />
            </div>

            {/* Error */}
            {error && (
              <p
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 10,
                  color: "#f87171",
                }}
              >
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: 10,
                border: "none",
                background: submitting ? "rgba(228,93,53,0.4)" : "#e45d35",
                color: "#fff",
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                cursor: submitting ? "not-allowed" : "pointer",
                transition: "all 0.15s",
              }}
            >
              {submitting ? "Submitting…" : "Submit Feedback"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}