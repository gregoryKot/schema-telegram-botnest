import { useClientDetail } from '../therapist/useClientDetail';
import { useAddClient } from '../therapist/useAddClient';

// Shared prop types for the split-out TherapistClientSheet modules.
// These mirror exactly the objects returned by the two hooks, so the
// sub-components re-destructure the same bindings the parent used to.
export type ClientDetail = ReturnType<typeof useClientDetail>;
export type AddClient = ReturnType<typeof useAddClient>;
