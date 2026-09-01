import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspace = "D:/cropai/.codex-ppt-work";
const starterPath = `${workspace}/sih/template-starter.pptx`;
const finalPath = "D:/cropai/CropAI_SIH2026_Integrated.pptx";
const previewDir = `${workspace}/final-preview`;
const layoutDir = `${workspace}/final-layout/final`;

async function bytes(filePath) {
  const buffer = await fs.readFile(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function writeBlob(filePath, blob) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

const presentation = await PresentationFile.importPptx(await FileBlob.load(starterPath));

function shape(slideIndex, name) {
  const item = presentation.slides.getItem(slideIndex).shapes.items.find((candidate) => candidate.name === name);
  if (!item) throw new Error(`Missing shape ${name} on slide ${slideIndex + 1}`);
  return item;
}

// Slide 1: move the CropAI identity and metadata into the inherited SIH title frame.
shape(0, "Title 7").text = "CropAI";
shape(0, "Subtitle 3").text = "Detect early. Act safely. Escalate intelligently.";
shape(0, "TextBox 9").text = [
  "Problem Statement – 26131",
  "Problem – Crop disease & pest infestation early detection",
  "Theme – Agriculture / FoodTech / Rural Development",
  "Category – Software",
  "Team – Trouble Shooters",
].join("\n");

const slides = [
  {
    teamName: "Oval 9", logoName: "Picture 10", title: "THE CHALLENGE", source: 2,
  },
  {
    teamName: "Oval 10", logoName: "Picture 11", title: "OUR SOLUTION", source: 3,
  },
  {
    teamName: "Oval 10", logoName: "Picture 11", title: "HOW IT WORKS", source: 4,
  },
  {
    teamName: "Oval 11", logoName: "Picture 10", title: "WHY CROPAI", source: 5,
  },
  {
    teamName: "Oval 11", logoName: "Picture 10", title: "FEASIBILITY", source: 6,
  },
  {
    teamName: "Oval 11", logoName: "Picture 10", title: "THE OUTCOME", source: 7,
  },
];

for (let i = 0; i < slides.length; i += 1) {
  const spec = slides[i];
  const slideIndex = i + 1;
  shape(slideIndex, "Title 1").text = spec.title;
  shape(slideIndex, "TextBox 8").delete();
  const teamShape = shape(slideIndex, spec.teamName);
  teamShape.text = "Trouble Shooters";
  teamShape.text.style = { fontSize: 14, alignment: "center", verticalAlignment: "middle" };
  shape(slideIndex, "Slide Number Placeholder 5").text = String(i + 2);
  shape(slideIndex, "Footer Placeholder 6").text = "CropAI • SIH 2026";

  const slide = presentation.slides.getItem(slideIndex);
  const inheritedLogo = slide.images.items.find((candidate) => candidate.name === spec.logoName);
  if (inheritedLogo) inheritedLogo.delete();
  slide.images.add({
    blob: await bytes(`${workspace}/crop/template-inspect/source-slides/source-slide-${String(spec.source).padStart(2, "0")}.png`),
    contentType: "image/png",
    alt: `Exact CropAI slide ${spec.source} body content`,
    fit: "contain",
    crop: { left: 0, top: 120 / 720, right: 0, bottom: 53 / 720 },
    position: { left: 0, top: 120, width: 1280, height: 547 },
  });
  slide.images.add({
    blob: await bytes(`${workspace}/sih/template-inspect/assets/ppt/media/image2.png`),
    contentType: "image/png",
    alt: "Smart India Hackathon 2026 logo from the supplied SIH template",
    fit: "contain",
    position: { left: 1026.78, top: 0.16, width: 236.2, height: 111.53 },
  });
}

await fs.mkdir(previewDir, { recursive: true });
await fs.mkdir(layoutDir, { recursive: true });
for (let i = 0; i < presentation.slides.items.length; i += 1) {
  const slide = presentation.slides.getItem(i);
  const stem = `slide-${String(i + 1).padStart(2, "0")}`;
  await writeBlob(`${previewDir}/${stem}.png`, await presentation.export({ slide, format: "png", scale: 1 }));
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(`${layoutDir}/${stem}.layout.json`, await layout.text());
}
await writeBlob(`${workspace}/final-montage.webp`, await presentation.export({ format: "webp", montage: true, scale: 1 }));

const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(finalPath);
console.log(finalPath);
