import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Partner Platform Simulator</h1>
      <p>
        Open <Link href="/economy">/economy</Link> to test the MinCFO embed.
      </p>
    </main>
  );
}
