import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <p className="elvt-label">ELVT OS</p>
        <h1 className="mt-2 text-4xl font-semibold">The portal is the brain.</h1>
        <p className="mt-3 text-mut">
          Every client surface reads from here. Sign in to continue.
        </p>
      </div>
      <div className="flex gap-3">
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
