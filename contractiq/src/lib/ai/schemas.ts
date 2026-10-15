import { z } from 'zod';

// Structured Outputs schema for key-term extraction — docs/specs/ai-extraction-pipeline.md §5
export const EXTRACTION_JSON_SCHEMA = {
  name: 'contract_key_terms',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['terms'],
    properties: {
      terms: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['term_key', 'term_name', 'value', 'page_number', 'confidence_score', 'source_sentence'],
          properties: {
            term_key: { type: 'string' },
            term_name: { type: 'string' },
            value: { type: ['string', 'null'] },
            page_number: { type: ['integer', 'null'] },
            confidence_score: { type: 'integer' },
            source_sentence: { type: ['string', 'null'] },
          },
        },
      },
    },
  },
} as const;

export const extractedTermSchema = z.object({
  term_key: z.string(),
  term_name: z.string(),
  value: z.string().nullable(),
  page_number: z.number().int().nullable(),
  confidence_score: z.number(),
  source_sentence: z.string().nullable(),
});

export const extractionOutputSchema = z.object({ terms: z.array(extractedTermSchema) });

export type ExtractedTerm = z.infer<typeof extractedTermSchema>;
export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;
