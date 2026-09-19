"use client";

import { Composer } from "@/components/messages/Composer";

/**
 * The composer for the visual pass.
 *
 * A client component because Composer is one, and a function cannot cross the
 * server boundary. The preview route is a server component, so the no-op
 * action has to be created on this side of it.
 */
export function ComposerPreview({
  values,
}: {
  values: Record<string, string | number>;
}) {
  return (
    <Composer
      action={() => {}}
      clientId="11111111-1111-4111-8111-111111111111"
      values={values}
      timezoneLabel="their time"
    />
  );
}
