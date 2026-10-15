export interface RequestedTerm {
  key: string;
  name: string;
  definition: string | null;
  custom: boolean;
  order: number;
}

export interface FewShotExample {
  excerpt: string;
  requested: { key: string; name: string }[];
  output: {
    terms: {
      term_key: string;
      term_name: string;
      value: string | null;
      page_number: number | null;
      confidence_score: number;
      source_sentence: string | null;
    }[];
  };
}
