-- levenshtein() for typo-tolerant search: catches swapped letters ("cluade")
-- that trigram similarity scores too low.
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
