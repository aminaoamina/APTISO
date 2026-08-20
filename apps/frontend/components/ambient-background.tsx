'use client';

export function AmbientBackground() {
  return (
    <div id="lattice">
      {/* Three slowly drifting gradient blobs */}
      <div className="blob blob-a" />
      <div className="blob blob-b" />
      <div className="blob blob-c" />
    </div>
  );
}
