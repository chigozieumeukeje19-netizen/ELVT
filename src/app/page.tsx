import Link from "next/link";

/**
 * There is no marketing page. This is a routing stub for anyone who lands on
 * the bare domain, so it says what the thing is and gets out of the way.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-5">
      <p className="elvt-label">ELVT OS</p>
      <h1 className="mt-2 text-section">Coaching portal</h1>
      <p className="mt-2 text-txt-mute">
        Programs, check-ins and the Monday queue.
      </p>

      <div className="mt-5 flex gap-2">
        <Link className="elvt-button" href="/login">
          Coach sign in
        </Link>
        <Link className="elvt-button-secondary" href="/client/login">
          Client sign in
        </Link>
      </div>
    </main>
  );
}
