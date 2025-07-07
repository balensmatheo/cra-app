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
  const arrayBuffer = await response.arrayBuffer();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.getWorksheet("data");

  if (!worksheet) {
    throw new Error("Worksheet not found. Check the sheet name in your template.");
  }

  // 📌 Remplissage identité
  worksheet.getCell("E2").value = name;
  worksheet.getCell("U4").value = month;

  // 🎨 Styles
  const fillGray = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFD9D9D9" },
  };

  const fillWhite = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFFFFFFF" },
  };

  // 🗓️ Ligne 8 (jours texte) et ligne 9 (numéros)
  days.forEach((d, idx) => {
    const col = 5 + idx;
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;

    const dayCell = worksheet.getRow(8).getCell(col);
    dayCell.value = d.toLocaleDateString("fr-FR", { weekday: "short" });
    dayCell.fill = isWeekend ? fillGray : fillWhite;

    const numCell = worksheet.getRow(9).getCell(col);
    numCell.value = d.getDate();
    numCell.numFmt = "0";
    numCell.fill = isWeekend ? fillGray : fillWhite;
  });

  worksheet.getRow(8).commit();
  worksheet.getRow(9).commit();

  // 📊 Sections
  const sectionStartRows: Record<SectionKey, number> = {
    facturees: 11,
    non_facturees: 19,
    autres: 27,
  };

  SECTION_LABELS.forEach(({ key }) => {
    const startRow = sectionStartRows[key];

    categories[key].forEach((cat, idx) => {
      const row = startRow + idx;
      const excelRow = worksheet.getRow(row);

      excelRow.getCell(2).value = cat.label;
      excelRow.getCell(3).value = data[key][cat.id]?.comment || "";

      days.forEach((d, dayIdx) => {
        const col = 5 + dayIdx;
        const cell = excelRow.getCell(col);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

        const rawValue = data[key][cat.id]?.[d.toISOString().slice(0, 10)] ?? "";
        const value =
          rawValue && !isNaN(Number(rawValue)) && rawValue.trim() !== ""
            ? Number(rawValue)
            : rawValue;

        cell.value = value !== "" ? value : null;
        cell.fill = isWeekend ? fillGray : fillWhite;
      });

      excelRow.commit();
    });
  });

  // 🖌️ Forcer le fond même pour les cellules vides dans les colonnes week-end
  days.forEach((d, dayIdx) => {
    const col = 5 + dayIdx;
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const fill = isWeekend ? fillGray : fillWhite;

    for (let row = 11; row <= 31; row++) {
      const cell = worksheet.getRow(row).getCell(col);
      cell.value ??= null;
      cell.fill = fill;
    }
  });

  // ❄️ Vue figée
  worksheet.views = [{ state: "frozen", xSplit: 4, ySplit: 8 }];

  // 📤 Export
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
