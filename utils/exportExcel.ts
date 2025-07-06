import * as XLSX from "xlsx";

// Types pour la fonction d'export
export type SectionKey = "facturees" | "non_facturees" | "autres";
export type Category = { id: number; label: string };
export type CategoriesState = { [key in SectionKey]: Category[] };
export type DataState = { [key in SectionKey]: { [catId: number]: { [date: string]: string } } };

interface ExportExcelParams {
  name: string;
  month: string; // format YYYY-MM
  days: Date[];
  categories: CategoriesState;
  data: DataState;
}

// Fonction utilitaire pour remplacer les marqueurs dans toutes les cellules d'une feuille
function replaceMarkersInSheet(ws: XLSX.WorkSheet, markers: Record<string, string>) {
  const range = XLSX.utils.decode_range(ws['!ref']!);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell_address = { c: C, r: R };
      const cell_ref = XLSX.utils.encode_cell(cell_address);
      const cell = ws[cell_ref];
      if (cell && typeof cell.v === 'string') {
        Object.entries(markers).forEach(([key, value]) => {
          if (cell.v.includes(key)) {
            cell.v = cell.v.replaceAll(key, value);
          }
        });
      }
    }
  }
}

export async function exportExcel({ name, month, days, categories, data }: ExportExcelParams) {
  // 1. Charger le template depuis public
  const response = await fetch("/cra_template.xlsx");
  const arrayBuffer = await response.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: "array" });

  // 2. Préparer les marqueurs à remplacer
  const markers: Record<string, string> = {
    "{{NOM}}": name,
    "{{MOIS}}": month,
    // Ajoutez d'autres marqueurs simples ici
  };

  // 3. Remplacer les marqueurs simples dans toutes les feuilles
  wb.SheetNames.forEach(sheetName => {
    replaceMarkersInSheet(wb.Sheets[sheetName], markers);
  });

  // 4. Injecter les tableaux d'activités (exemple pour la première feuille)
  // À adapter selon la structure de votre template et l'emplacement des marqueurs
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Exemple : trouver la ligne de début du tableau par recherche du marqueur {{ACTIVITES_FACTUREES}}
  const range = XLSX.utils.decode_range(ws['!ref']!);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell_address = { c: C, r: R };
      const cell_ref = XLSX.utils.encode_cell(cell_address);
      const cell = ws[cell_ref];
      if (cell && cell.v === "{{ACTIVITES_FACTUREES}}") {
        // Injecter les données à partir de cette ligne/colonne
        // Exemple : écrire les catégories et les valeurs sur les jours
        let row = R;
        categories.facturees.forEach((cat, idx) => {
          ws[XLSX.utils.encode_cell({ c: C, r: row + idx })] = { t: 's', v: cat.label };
          // Injecter les valeurs par jour à droite (à adapter selon la structure du template)
          days.forEach((d, dayIdx) => {
            const dayOfWeek = d.getDay(); // 0 = dimanche, 6 = samedi
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            let val = data.facturees[cat.id]?.[d.toISOString().slice(0, 10)] || "";
            if (isWeekend) {
              // Marquer visuellement le week-end (ex: 'X' ou vide)
              val = ""; // ou 'X' si vous préférez
            }
            const cellRef = XLSX.utils.encode_cell({ c: C + 2 + dayIdx, r: row + idx });
            if (val !== "") {
              const num = parseFloat(val);
              if (!isNaN(num)) {
                ws[cellRef] = { t: 'n', v: num };
              }
            }
          });
        });
      }
    }
  }

  // 5. Télécharger le fichier modifié
  const fileName = `CRA_${name}_${month}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
