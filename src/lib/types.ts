export type MediaType = "movie" | "tv";

/** -1 = didn't like, 1 = liked, 2 = loved */
export type Rating = -1 | 1 | 2;

/** A movie or show as shown on cards and lists. */
export type MediaItem = {
  id: number;
  media_type: MediaType;
  title: string;
  poster_path: string | null;
  overview: string;
  year: string | null;
  vote_average: number;
  /** How many TMDB users rated it: a good stand-in for "how many people have seen this". */
  vote_count: number;
  genre_ids: number[];
  original_language: string;
};

/** The features we keep per title to build taste profiles. */
export type TitleFeatures = {
  genres: string[];
  keywords: string[];
  people: string[]; // top cast + director / creator
  year: string | null;
};

export const RATING_LABEL: Record<Rating, string> = {
  [-1]: "Didn't like",
  1: "Liked",
  2: "Loved",
};
