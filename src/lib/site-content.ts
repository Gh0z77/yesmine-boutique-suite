import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";

import { contentQuery } from "@/lib/store";

/**
 * Editable site copy, available on the very first render.
 *
 * The root loader fetches it, so the server always has it. A plain
 * `useQuery(contentQuery)` in the header or footer did not: the browser's cache
 * was still empty on the first render, so the phone number the server had
 * printed came back blank for a moment. React saw the page change underneath it
 * during hydration and threw the whole tree away. Seeding the query with the
 * loader's copy makes the first client render identical to the server's.
 */
export function useSiteContent(): Record<string, unknown> {
  const seed = useRouterState({
    select: (state) =>
      (
        state.matches.find((match) => match.routeId === "__root__")?.loaderData as
          | { content?: Record<string, unknown> }
          | undefined
      )?.content,
  });

  // `exactOptionalPropertyTypes` refuses an explicit `undefined` here, so the
  // key is only present when the loader actually produced something.
  const { data } = useQuery({ ...contentQuery, ...(seed ? { initialData: seed } : {}) });
  return data ?? {};
}
