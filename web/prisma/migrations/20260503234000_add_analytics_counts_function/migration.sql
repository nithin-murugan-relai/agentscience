CREATE OR REPLACE FUNCTION public.analytics_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'users', (SELECT count(*) FROM "User"),
    'papers', (SELECT count(*) FROM "Paper" WHERE "visibility" = 'PUBLIC'),
    'reviews', (SELECT count(*) FROM "Review"),
    'ideas', (SELECT count(*) FROM "Idea")
  );
$$;

REVOKE ALL ON FUNCTION public.analytics_counts() FROM PUBLIC;
