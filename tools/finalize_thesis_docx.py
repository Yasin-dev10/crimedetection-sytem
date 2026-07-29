from pathlib import Path
from docx import Document


ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "3 chapters" / "chapter-one-two-three_REVISED.docx"

doc = Document(PATH)
for paragraph in list(doc.paragraphs):
    xml_text = "".join(paragraph._element.itertext()).strip().lower()
    if "no table of figures entries found." in xml_text:
        paragraph._element.getparent().remove(paragraph._element)
doc.save(PATH)
print(PATH)
