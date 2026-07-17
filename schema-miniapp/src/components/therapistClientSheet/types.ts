import type { useClientDetail } from '../therapist/useClientDetail';
import type { useAddClient } from '../therapist/useAddClient';

// Shared prop types for the split-out TherapistClientSheet sub-components.
// Keeping these as ReturnType<...> avoids re-declaring the (large) hook
// return shape by hand and keeps every consumer in sync automatically.
export type ClientDetail = ReturnType<typeof useClientDetail>;
export type AddClientState = ReturnType<typeof useAddClient>;
