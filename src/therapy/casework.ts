// Части TherapyModule (№10: модуль под храповиком размера) — ручки над данными
// конкретного клиента: холст концептуализации, схема случая у клиента,
// отметки «Про клиента» из «Справочника». Порядок контроллеров сохранён.
import { ConceptAppendController } from './concept-append.controller';
import { ClientConceptController } from './client-concept.controller';
import { GuideMarksController } from './guide-marks.controller';
import { GuideMarksService } from './guide-marks.service';

export const CASEWORK_CONTROLLERS = [
  ConceptAppendController,
  ClientConceptController,
  GuideMarksController,
];
export const CASEWORK_PROVIDERS = [GuideMarksService];
