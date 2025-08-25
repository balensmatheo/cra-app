import ExcelJS from "exceljs";
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
  month: string;
  days: Date[];
  categories: CategoriesState;
  data: DataState;
}

export async function exportExcel({
  name,
  month,
  days,
  categories,
  data,
}: ExportExcelParams) {
  const response = await fetch("/cra_template.xlsx");
  if (!response.ok)
    throw new Error("Erreur lors du chargement du modèle Excel.");

  const arrayBuffer = await response.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  workbook.calcProperties.fullCalcOnLoad = false;

  const worksheet = workbook.getWorksheet("data");
  const noticeSheet = workbook.getWorksheet("Notice");

  if (!worksheet) throw new Error("Worksheet 'data' introuvable.");
  if (!noticeSheet) throw new Error("Worksheet 'Notice' introuvable.");

  // 👤 Nom & prénom
  const nameParts = name.trim().split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  noticeSheet.getCell("C3").value = lastName;
  noticeSheet.getCell("C4").value = firstName;

  // 📆 Mois/année
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);

  // Injecte le mois sous forme de nombre dans B4
  const b4 = worksheet.getCell("B4");
  b4.value = monthNum || 1;
  b4.numFmt = ";;;"; // invisible
  b4.font = { color: { argb: "FFFFFFFF" } };  // Texte blanc
  b4.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFFFFF" }, // Fond blanc
  };

  // Injecte l’année dans Notice!C6
  noticeSheet.getCell("C6").value = year;

  // 📊 Données
  const sectionStartRows: Record<SectionKey, number> = {
    facturees: 11,
    non_facturees: 19,
    autres: 27,
  };

  // Helper: format a Date to local YYYY-MM-DD (avoid UTC shift)
  const toLocalYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  SECTION_LABELS.forEach(({ key }) => {
    const startRow = sectionStartRows[key];

    categories[key].forEach((cat, idx) => {
      const row = startRow + idx;
      const excelRow = worksheet.getRow(row);
      const catData = data[key][cat.id] || {};

      excelRow.getCell(2).value = cat.label || "";
      excelRow.getCell(3).value = catData.comment || "";

      days.forEach((d, dayIdx) => {
        const col = 5 + dayIdx;
        if (col > 35) return;

        const cell = excelRow.getCell(col);
        // Use local date keys (grid uses local YYYY-MM-DD)
        const dateStr = toLocalYMD(d);
        const rawValue = catData[dateStr] ?? "";

        let value: string | number | null = null;
        if (rawValue && rawValue.trim() !== "") {
          // Normalize French decimal comma to dot for numeric parsing
          const normalized = rawValue.replace(/\s/g, "").replace(",", ".");
          const numValue = Number(normalized);
          if (!isNaN(numValue)) {
            value = numValue;
            // Force display with 2 decimals to avoid 0.25 -> 0.3 rounding by template formats
            cell.numFmt = "0.00";
          } else {
            value = rawValue.trim();
          }
        }

        cell.value = value;
      });

      excelRow.commit();
    });
  });

  worksheet.views = [{ state: "frozen", xSplit: 4, ySplit: 8 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CRA_${name}_${month}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}
