import * as XLSX from "xlsx";
import { SECTION_LABELS } from "../constants/ui";
import { type SectionKey } from "../constants/categories";

export type Category = { id: number; label: string };
export type CategoriesState = { [key in SectionKey]: Category[] };
export type DataState = {
  [key in SectionKey]: {
    [catId: number]: Record<string, string> & { comment?: string };
  };
};

interface ExportExcelParams {
  name: string;
  month: string; // format YYYY-MM
  days: Date[];
  categories: CategoriesState;
  data: DataState;
}

export function exportExcel({ name, month, days, categories, data }: ExportExcelParams) {
  const wb = XLSX.utils.book_new();
  const wsData: any[][] = [];

  wsData.push(["Nom", name]);
  wsData.push(["Mois", month]);
  wsData.push([]);

  const dayHeaders = days.map((d) => d.getDate().toString().padStart(2, "0"));
  const baseHeader = ["Catégorie", "Commentaire", ...dayHeaders, "Total"];

  SECTION_LABELS.forEach(({ key, label }) => {
    const sectionKey = key as SectionKey;
    wsData.push([label]);
    wsData.push(baseHeader);

    categories[sectionKey].forEach((cat) => {
      const row: any[] = [cat.label, data[sectionKey][cat.id]?.comment || ""];
      let total = 0;
      days.forEach((d) => {
        const valStr = data[sectionKey][cat.id]?.[d.toISOString().slice(0, 10)] || "";
        const num = parseFloat(valStr);
        row.push(valStr);
        if (!isNaN(num)) {
          total += num;
        }
      });
      row.push(total || "");
      wsData.push(row);
    });

    wsData.push([]); // espace après chaque section
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "CRA");

  const fileName = `CRA_${name}_${month}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
