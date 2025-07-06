import { type SectionKey } from './categories';

// Options de catégories par section
export const CATEGORY_OPTIONS: Record<SectionKey, string[]> = {
  facturees: [
    "Prestation de formation",
    "Prestation régie / expertise"
  ],
  non_facturees: [
    "Auto-formation",
    "Formation interne",
    "Inter-contrat",
    "Journée séminaire, sortie",
    "Projet client",
    "Projet interne"
  ],
  autres: [
    "Absence autorisée",
    "Congé",
    "Maladie / Arrêt",
    "RTT"
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