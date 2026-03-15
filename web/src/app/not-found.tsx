import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-enter text-center py-24">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Not found
      </h1>
      <p className="mt-3 text-foreground-soft">
        This page does not exist.
      </p>
      <div className="mt-8">
        <Link href="/" className="btn-primary">
          Go home
        </Link>
      </div>
    </div>
  );
}
