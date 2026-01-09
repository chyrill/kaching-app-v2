"use client";

import { api } from "~/trpc/react";

export function LatestPost() {
  // Placeholder component - Post model removed in Story 1.2
  // Actual features will be implemented in Epic 2-7
  const { data } = api.post.hello.useQuery({ text: "from tRPC" });

  return (
    <div className="w-full max-w-xs">
      {data ? (
        <p className="truncate">
          <span className="font-semibold">{data.greeting}</span>
        </p>
      ) : (
        <p>Loading tRPC query...</p>
      )}
    </div>
  );
}

export function CreatePost() {
  // Placeholder component - will be replaced with actual features in Epic 2-7
  return null;
}
