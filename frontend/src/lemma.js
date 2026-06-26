import { LemmaClient } from 'lemma-sdk'

// Singleton client — reads VITE_LEMMA_* env vars automatically
// VITE_LEMMA_API_URL, VITE_LEMMA_AUTH_URL, VITE_LEMMA_POD_ID
export const client = new LemmaClient()
