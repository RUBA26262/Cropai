import fs from "node:fs/promises";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const source = "D:/cropai/CropAI_SIH2026_Integrated.pptx";
const output = "D:/cropai/CropAI_SIH2026_Integrated_Aligned.pptx";
const preview = "D:/cropai/.codex-ppt-work/aligned-first-slide.png";

const presentation = await PresentationFile.importPptx(await FileBlob.load(source));
const slide = presentation.slides.getItem(0);
const find = (name) => {
  const item = slide.shapes.items.find((candidate) => candidate.name === name);
  if (!item) throw new Error(`Missing ${name}`);
  return item;
};

const title = find("Title 7");
title.position = { left: 60, top: 38, width: 560, height: 70 };
title.text = "CropAI";
title.text.style = {
  fontSize: 42,
  bold: true,
  color: "#1F4E79",
  alignment: "left",
  verticalAlignment: "middle",
};

const subtitle = find("Subtitle 3");
subtitle.position = { left: 60, top: 108, width: 570, height: 76 };
subtitle.text = "Detect early. Act safely.\nEscalate intelligently.";
subtitle.text.style = {
  fontSize: 24,
  color: "#6B7280",
  alignment: "left",
  verticalAlignment: "middle",
};

const details = find("TextBox 9");
details.position = { left: 60, top: 235, width: 570, height: 300 };
details.text.set([
  { spaceAfter: 16, runs: [{ run: "Problem Statement  ", textStyle: { bold: true } }, "26131"] },
  { spaceAfter: 16, runs: [{ run: "Problem  ", textStyle: { bold: true } }, "Crop disease and pest infestation early detection"] },
  { spaceAfter: 16, runs: [{ run: "Theme  ", textStyle: { bold: true } }, "Agriculture / FoodTech / Rural Development"] },
  { spaceAfter: 16, runs: [{ run: "Category  ", textStyle: { bold: true } }, "Software"] },
  { spaceAfter: 0, runs: [{ run: "Team  ", textStyle: { bold: true } }, "Trouble Shooters"] },
]);
details.text.style = {
  fontSize: 20,
  color: "#111827",
  alignment: "left",
  verticalAlignment: "top",
  lineSpacing: 1.1,
  insets: { left: 0, right: 10, top: 0, bottom: 0 },
};

const png = await presentation.export({ slide, format: "png", scale: 1 });
await fs.writeFile(preview, new Uint8Array(await png.arrayBuffer()));
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(output);
console.log(output);
