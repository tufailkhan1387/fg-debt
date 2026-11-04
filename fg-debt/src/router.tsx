import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ApiError } from "@/lib/api";

export const getRouter = () => {
  // A refusal from the API (no access, not found, invalid request) will not change on retry, so show it at once.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: (failures, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failures < 3 },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
