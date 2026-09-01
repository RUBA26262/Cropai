import { FileBlob, PresentationFile } from "@oai/artifact-tool";
const p = await PresentationFile.importPptx(await FileBlob.load("D:/cropai/.codex-ppt-work/sih/template-starter.pptx"));
for (let i=0;i<p.slides.items.length;i++) {
  const s=p.slides.getItem(i);
  console.log(i+1, Object.keys(s.shapes), s.shapes.items?.map(x=>[x.name,x.text?.toString?.() ?? String(x.text)]));
}
