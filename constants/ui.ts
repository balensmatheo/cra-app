import { type SectionKey } from './categories';

// Options de catégories par section
export const CATEGORY_OPTIONS: Record<SectionKey, string[]> = {
  facturees: [
  "Prestation régie / expertise",
  "Prestation de formation"
  ],
  non_facturees: [
  "Formation interne",
  "Auto-Formation",
  ],
  autres: [
  "Congé",
  "Maladie / Arrêt",
  "Inter-contrat",
  "RTT",
  "Absence autorisée",
  ]
};

// Labels des sections
export const SECTION_LABELS = [
  { key: "facturees" as SectionKey, label: "Activités Facturées" },
  { key: "non_facturees" as SectionKey, label: "Activités Non Facturées" },
  { key: "autres" as SectionKey, label: "Autres" },
];

// Constantes de validation
export const ALLOWED_DAY_VALUES = ["0.25", "0.5", "0.75", "1"];

// Constantes de performance
export const VIRTUALIZATION_THRESHOLD = 30;
export const ROW_HEIGHT = 60;

// Constantes de debounce
export const DEBOUNCE_DELAY = 150;
export const NAME_DEBOUNCE_DELAY = 200; 