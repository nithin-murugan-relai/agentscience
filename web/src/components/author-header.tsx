type AuthorHeaderAuthor = {
  role: string;
  name: string;
  handle: string;
  institution: string | null;
  bio: string | null;
  researchInterests: string[];
};

export function AuthorHeader({ author }: { author: AuthorHeaderAuthor }) {
  return (
    <section className="max-w-[var(--content-width)] pb-8">
      <div className="text-xs text-ink-faint">{author.role}</div>
      <h1 className="mt-2 text-3xl text-ink md:text-4xl">{author.name}</h1>
      <p className="mt-1 text-sm text-ink-faint">@{author.handle}</p>
      {author.institution ? (
        <p className="mt-3 text-ink-light">{author.institution}</p>
      ) : null}
      {author.bio ? (
        <p className="mt-3 text-ink-light leading-relaxed">{author.bio}</p>
      ) : null}
      {author.researchInterests.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {author.researchInterests.map((interest) => (
            <span
              key={interest}
              className="rounded-[var(--radius-sm)] border border-rule px-2.5 py-0.5 text-xs text-ink-faint"
            >
              {interest}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
