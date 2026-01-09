import Link from "next/link";

import { LatestPost } from "~/app/_components/post";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
  const hello = await api.post.hello({ text: "from tRPC" });
  const session = await auth();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-white text-gray-900">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            Kaching <span className="text-emerald-500">v2</span>
          </h1>

          <p className="text-center text-xl text-gray-600">
            E-commerce business management platform
          </p>

          {!session && (
            <div className="flex gap-4">
              <Link
                href="/auth/signup"
                className="rounded-full bg-emerald-500 px-10 py-3 font-semibold text-white no-underline transition hover:bg-emerald-600"
              >
                Get Started
              </Link>
              <Link
                href="/auth/login"
                className="rounded-full border-2 border-gray-200 bg-white px-10 py-3 font-semibold text-gray-700 no-underline transition hover:bg-gray-50"
              >
                Sign In
              </Link>
            </div>
          )}

          {session && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-xl text-gray-900">
                Welcome back, {session.user.email}!
              </p>
              <div className="flex gap-4">
                <Link
                  href="/onboarding/create-shop"
                  className="rounded-full bg-emerald-500 px-10 py-3 font-semibold text-white no-underline transition hover:bg-emerald-600"
                >
                  Dashboard
                </Link>
                <Link
                  href="/api/auth/signout"
                  className="rounded-full border-2 border-gray-200 bg-white px-10 py-3 font-semibold text-gray-700 no-underline transition hover:bg-gray-50"
                >
                  Sign Out
                </Link>
              </div>
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            <Link
              className="flex max-w-xs flex-col gap-4 rounded-xl border-2 border-gray-200 bg-gray-50 p-4 hover:bg-gray-100"
              href="https://create.t3.gg/en/usage/first-steps"
              target="_blank"
            >
              <h3 className="text-2xl font-bold text-gray-900">First Steps →</h3>
              <div className="text-lg text-gray-600">
                Just the basics - Everything you need to know to set up your
                database and authentication.
              </div>
            </Link>
            <Link
              className="flex max-w-xs flex-col gap-4 rounded-xl border-2 border-gray-200 bg-gray-50 p-4 hover:bg-gray-100"
              href="https://create.t3.gg/en/introduction"
              target="_blank"
            >
              <h3 className="text-2xl font-bold text-gray-900">Documentation →</h3>
              <div className="text-lg text-gray-600">
                Learn more about Create T3 App, the libraries it uses, and how
                to deploy it.
              </div>
            </Link>
          </div>

          {session?.user && <LatestPost />}
        </div>
      </main>
    </HydrateClient>
  );
}
