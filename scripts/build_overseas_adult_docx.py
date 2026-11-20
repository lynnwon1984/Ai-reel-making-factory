#!/usr/bin/env python3
"""Build the overseas adult scripts and novelizations as six DOCX files."""

from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "deliverables" / "overseas adult"

BOOKS = [
    {
        "title": "月债",
        "english": "MOON DEBT",
        "folder": "月债",
        "script": ROOT / "projects/month-debt/moon-debt-20min-zh-v2.md",
        "novel": ROOT / "projects/novels/moon-debt-novel-zh-v1.md",
        "script_label": "成人奇幻影视剧本",
        "novel_label": "成人奇幻短篇小说",
        "speakers": ["艾琳", "凯尔", "精灵国王", "哥布林", "狼族传令兵", "狼王"],
    },
    {
        "title": "潮纹",
        "english": "TIDEMARK",
        "folder": "潮纹",
        "script": ROOT / "projects/tide-sigil/tide-sigil-20min-zh-v1.md",
        "novel": ROOT / "projects/novels/tide-sigil-novel-zh-v1.md",
        "script_label": "成人奇幻影视剧本",
        "novel_label": "成人奇幻短篇小说",
        "speakers": ["伊芙琳", "塞洛斯", "狼族传令兵", "狼王"],
    },
    {
        "title": "雪线",
        "english": "SNOWLINE",
        "folder": "雪线",
        "script": ROOT / "projects/snowline/snowline-20min-zh-v1.md",
        "novel": ROOT / "projects/novels/snowline-novel-zh-v1.md",
        "script_label": "成人奇幻影视剧本",
        "novel_label": "成人奇幻短篇小说",
        "speakers": ["露西亚", "阿德里安", "列车员", "卫兵"],
    },
]


def set_run_font(run, name: str, size: float | None = None, bold: bool | None = None):
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), name)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    run.font.color.rgb = RGBColor(0, 0, 0)


def set_style_font(style, name: str, size: float, bold: bool = False):
    style.font.name = name
    style._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    style.font.size = Pt(size)
    style.font.bold = bold
    style.font.color.rgb = RGBColor(0, 0, 0)


def remove_paragraph_borders(paragraph_or_style):
    element = getattr(paragraph_or_style, "_element", None)
    p_pr = getattr(element, "pPr", None)
    if p_pr is None:
        return
    for border in list(p_pr.findall(qn("w:pBdr"))):
        p_pr.remove(border)


def add_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run()
    set_run_font(run, "PingFang SC", 8.5)
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = " PAGE "
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char1)
    run._r.append(instr_text)
    run._r.append(fld_char2)


def clean_inline(text: str) -> str:
    text = text.replace("**", "").replace("`", "")
    text = re.sub(r"^\s*>\s?", "", text)
    return text.strip()


def setup_document(doc: Document, kind: str, title: str, english: str):
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(2.1)
    section.bottom_margin = Cm(2.0)
    section.left_margin = Cm(2.25)
    section.right_margin = Cm(2.25)
    section.header_distance = Cm(1.0)
    section.footer_distance = Cm(0.9)

    style = doc.styles["Normal"]
    set_style_font(style, "Songti SC" if kind == "novel" else "PingFang SC", 11.5 if kind == "novel" else 10.5)
    style.paragraph_format.line_spacing = 1.5 if kind == "novel" else 1.15
    style.paragraph_format.space_after = Pt(5 if kind == "novel" else 3)
    style.paragraph_format.widow_control = True

    title_style = doc.styles["Title"]
    set_style_font(title_style, "PingFang SC", 30, bold=True)
    remove_paragraph_borders(title_style)
    title_style.paragraph_format.space_before = Pt(0)
    title_style.paragraph_format.space_after = Pt(20)
    title_style.paragraph_format.keep_with_next = True

    for name, size in (("Heading 1", 16), ("Heading 2", 12.5)):
        heading_style = doc.styles[name]
        set_style_font(heading_style, "PingFang SC", size, bold=True)
        heading_style.paragraph_format.space_before = Pt(12)
        heading_style.paragraph_format.space_after = Pt(6)
        heading_style.paragraph_format.keep_with_next = True

    doc.core_properties.title = title
    doc.core_properties.subject = f"{english} / {kind}"
    doc.core_properties.author = "AI Storyboard Forge"
    doc.core_properties.keywords = "成人奇幻, 虚构角色, AI生成, 18+"
    doc.core_properties.comments = "全虚构 AI 生成影视项目"

    add_page_number(section.footer.paragraphs[0])


def add_cover(doc: Document, book: dict, kind: str):
    for _ in range(4):
        doc.add_paragraph()
    title = doc.add_paragraph(style="Title")
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    remove_paragraph_borders(title)
    set_run_font(title.add_run(book["title"]), "PingFang SC", 30, bold=True)

    english = doc.add_paragraph()
    english.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_run_font(english.add_run(book["english"]), "Helvetica Neue", 10.5, bold=False)

    label = doc.add_paragraph()
    label.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_run_font(
        label.add_run(book["script_label"] if kind == "script" else book["novel_label"]),
        "PingFang SC",
        13,
        bold=False,
    )

    details = doc.add_paragraph()
    details.alignment = WD_ALIGN_PARAGRAPH.CENTER
    detail_text = "9:16 竖屏 · 20 分钟 · 18+ · 中文母版" if kind == "script" else "短篇小说 · 18+ · 全虚构"
    set_run_font(details.add_run(detail_text), "PingFang SC", 9.5, bold=False)

    note = doc.add_paragraph()
    note.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_run_font(note.add_run("AI 生成全虚构作品"), "PingFang SC", 9.5, bold=False)

    doc.add_page_break()


def add_script_document(doc: Document, book: dict):
    lines = book["script"].read_text(encoding="utf-8").splitlines()
    source_title = ""
    metadata: list[str] = []
    body_start = 0

    for index, raw in enumerate(lines):
        line = raw.strip()
        if line.startswith("# "):
            source_title = clean_inline(line[2:])
            cursor = index + 1
            while cursor < len(lines):
                candidate = lines[cursor].strip()
                if candidate.startswith("## "):
                    break
                if candidate and candidate != "---" and not candidate.startswith("```"):
                    metadata.append(clean_inline(candidate))
                cursor += 1
            body_start = cursor
            break
    add_cover(doc, book, "script")

    if metadata:
        doc.add_heading("制作信息", level=1)
        for item in metadata:
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(2)
            set_run_font(p.add_run(clean_inline(item)), "PingFang SC", 9.5)

    current_kind = None
    for raw in lines[body_start:]:
        line = raw.strip()
        if not line:
            continue
        if line == "---" or line.startswith("```"):
            continue
        if line.startswith("## "):
            heading = clean_inline(line[3:])
            doc.add_heading(heading, level=1)
            current_kind = "heading"
            continue
        if re.match(r"^\d+\.\s+(内景|外景)", line):
            p = doc.add_heading(clean_inline(line), level=2)
            p.paragraph_format.space_before = Pt(6)
            current_kind = "scene"
            continue
        if line.startswith("【时间码】"):
            p = doc.add_paragraph()
            set_run_font(p.add_run(clean_inline(line)), "PingFang SC", 8.5, bold=False)
            p.paragraph_format.space_after = Pt(8)
            current_kind = "meta"
            continue
        if line.startswith("【") and "】" in line:
            text = clean_inline(line)
            p = doc.add_paragraph()
            p.paragraph_format.keep_with_next = True
            p.paragraph_format.space_before = Pt(5)
            p.paragraph_format.space_after = Pt(2)
            set_run_font(p.add_run(text), "PingFang SC", 9.5, bold=True)
            current_kind = "cue"
            continue
        if line in book["speakers"]:
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(1.0)
            p.paragraph_format.keep_with_next = True
            p.paragraph_format.space_before = Pt(5)
            p.paragraph_format.space_after = Pt(0)
            set_run_font(p.add_run(line), "PingFang SC", 10.5, bold=True)
            current_kind = "speaker"
            continue
        if current_kind == "speaker" and line.startswith("（") and line.endswith("）"):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(1.5)
            p.paragraph_format.space_after = Pt(0)
            run = p.add_run(clean_inline(line))
            set_run_font(run, "PingFang SC", 9.5, bold=False)
            run.italic = True
            current_kind = "dialogue"
            continue
        if current_kind in {"speaker", "dialogue"}:
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(1.5)
            p.paragraph_format.first_line_indent = Cm(0)
            p.paragraph_format.space_after = Pt(4)
            set_run_font(p.add_run(clean_inline(line)), "PingFang SC", 10.5, bold=False)
            current_kind = "dialogue"
            continue
        if line.startswith("△"):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.35)
            p.paragraph_format.space_after = Pt(4)
            set_run_font(p.add_run(clean_inline(line)), "PingFang SC", 10.5, bold=False)
            current_kind = "action"
            continue
        if re.match(r"^(?:[-*]|\d+\.)\s+", line):
            text = re.sub(r"^(?:[-*]|\d+\.)\s+", "", clean_inline(line))
            p = doc.add_paragraph(text, style="List Bullet")
            p.paragraph_format.space_after = Pt(2)
            current_kind = "list"
            continue
        p = doc.add_paragraph(clean_inline(line))
        p.paragraph_format.space_after = Pt(3)
        current_kind = "body"


def add_novel_document(doc: Document, book: dict):
    add_cover(doc, book, "novel")
    text = book["novel"].read_text(encoding="utf-8")
    blocks = [block.strip() for block in re.split(r"\n\s*\n", text) if block.strip()]
    for block in blocks:
        block = clean_inline(block)
        if block.startswith("# "):
            continue
        if block.upper().startswith("ENGLISH TITLE"):
            continue
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.first_line_indent = Pt(23)
        p.paragraph_format.line_spacing = 1.5
        p.paragraph_format.space_after = Pt(6)
        if block.startswith("“") or block.startswith("\""):
            p.paragraph_format.first_line_indent = Cm(0)
            p.paragraph_format.left_indent = Cm(1.0)
        set_run_font(p.add_run(block), "Songti SC", 11.5)


def build():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    generated = []
    for book in BOOKS:
        folder = OUTPUT / book["folder"]
        folder.mkdir(parents=True, exist_ok=True)

        script_doc = Document()
        setup_document(script_doc, "script", f"{book['title']} 剧本", book["english"])
        add_script_document(script_doc, book)
        script_path = folder / f"{book['title']}-剧本.docx"
        script_doc.save(script_path)
        generated.append(script_path)

        novel_doc = Document()
        setup_document(novel_doc, "novel", f"{book['title']} 小说体", book["english"])
        add_novel_document(novel_doc, book)
        novel_path = folder / f"{book['title']}-小说体.docx"
        novel_doc.save(novel_path)
        generated.append(novel_path)

    for path in generated:
        print(path)


if __name__ == "__main__":
    build()
