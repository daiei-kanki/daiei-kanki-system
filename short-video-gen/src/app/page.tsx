"use strict";
"use client";

import React, { useState, useCallback } from "react";
import { Player } from "@remotion/player";
import { MyComposition } from "../remotion/MyComposition";

// Define the scene type matching our schema
type Scene = {
  text: string;
  duration: number;
  visual?: string;
};

export default function Home() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState<Scene[] | null>(null);
  const [error, setError] = useState("");

  const generateScript = useCallback(async () => {
    if (!topic) return;

    setLoading(true);
    setError("");
    setScript(null);

    try {
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate script");
      }

      setScript(data.script);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [topic]);

  // Calculate total duration in frames
  const durationInFrames = script
    ? Math.floor(script.reduce((acc, scene) => acc + scene.duration, 0) * 30) // Assuming 30fps
    : 30 * 6; // Default 6 seconds

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10">
      <h1 className="text-4xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
        AI Short Video Generator
      </h1>

      <div className="w-full max-w-md space-y-4 mb-8">
        <div>
          <label htmlFor="topic" className="block text-sm font-medium text-gray-300 mb-1">
            Video Topic
          </label>
          <input
            type="text"
            id="topic"
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none text-white"
            placeholder="e.g. History of Rome, How to bake a cake..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
            onKeyDown={(e) => e.key === "Enter" && generateScript()}
          />
        </div>

        <button
          onClick={generateScript}
          disabled={loading || !topic}
          className={`w-full py-3 rounded-lg font-semibold transition-all ${loading || !topic
              ? "bg-gray-700 text-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/30"
            }`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Script...
            </span>
          ) : (
            "Generate Video"
          )}
        </button>

        {error && (
          <div className="p-3 bg-red-900/50 border border-red-700 text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="w-full max-w-4xl flex justify-center items-center bg-gray-800 rounded-xl p-4 shadow-2xl border border-gray-700">
        {script ? (
          <div className="rounded-lg overflow-hidden shadow-lg">
            <Player
              component={MyComposition}
              durationInFrames={durationInFrames}
              compositionWidth={1080} // Half resolution for preview performance? No, use full and scale.
              compositionHeight={1920}
              fps={30}
              style={{
                width: 360, // Display size (9:16 ratio)
                height: 640,
              }}
              controls
              inputProps={{ scenes: script }}
            />
          </div>
        ) : (
          <div className="w-[360px] h-[640px] bg-gray-700 rounded-lg flex flex-col items-center justify-center text-gray-500">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>Video preview will appear here</p>
          </div>
        )}
      </div>

      {script && (
        <div className="mt-8 max-w-2xl w-full">
          <h2 className="text-xl font-semibold mb-4 text-gray-300">Generated Script</h2>
          <div className="bg-gray-800 rounded-lg p-4 space-y-4 max-h-60 overflow-y-auto border border-gray-700">
            {script.map((scene, i) => (
              <div key={i} className="flex gap-4 border-b border-gray-700 pb-2 last:border-0">
                <div className="text-purple-400 font-mono text-sm w-16 shrink-0">{scene.duration}s</div>
                <div>
                  <p className="text-white">{scene.text}</p>
                  <p className="text-gray-500 text-sm mt-1">Visual: {scene.visual}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
