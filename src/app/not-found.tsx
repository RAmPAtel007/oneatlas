import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="text-sm text-muted">404</div>
      <h1 className="text-2xl font-semibold">We couldn’t find that page</h1>
      <p className="max-w-md text-sm text-muted">
        The model, lab or provider may have been renamed or removed from the catalog. Try searching with Ctrl K.
      </p>
      <div className="mt-2 flex gap-2">
        <ButtonLink href="/models" variant="primary">Browse models</ButtonLink>
        <ButtonLink href="/">Home</ButtonLink>
      </div>
    </div>
  );
}
