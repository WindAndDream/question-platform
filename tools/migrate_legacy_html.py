#!/usr/bin/env python3
"""Convert the legacy `var data = {...}` HTML format into question-bank schema v1.

Usage:
    python tools/migrate_legacy_html.py legacy.html output.json \
        --bank-id low-voltage --bank-name "低压电工题库"

The script does not download remote images. It preserves image paths as structured
image blocks, so the referenced files should be copied into the imported question
folder when portability is required.
"""

from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path
from typing import Any

DATA_PATTERN = re.compile(r"var\s+data\s*=\s*(\{.*?\});\s*\n\s*var\s+examhtml", re.S)
IMG_PATTERN = re.compile(r"<img[^>]+src=[\"']([^\"']+)[\"'][^>]*>", re.I)


def clean_text(value: str) -> str:
    value = value.replace("\\n", "\n").replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"</?p\s*>", "", value, flags=re.I)
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    return html.unescape(value).strip()


def convert_legacy_img_markers(value: str) -> str:
    # Legacy option example: img:tq/example.png;img
    return re.sub(r"img:([^;]+);img", r'<img src="/photo/\1">', value, flags=re.I)


def parse_content(value: str) -> str | list[dict[str, str]]:
    value = convert_legacy_img_markers(value)
    blocks: list[dict[str, str]] = []
    cursor = 0
    for match in IMG_PATTERN.finditer(value):
        text = clean_text(value[cursor : match.start()])
        if text:
            blocks.append({"type": "text", "text": text})
        blocks.append(
            {
                "type": "image",
                "src": match.group(1).lstrip("/"),
                "alt": "题目图片",
            }
        )
        cursor = match.end()
    tail = clean_text(value[cursor:])
    if tail:
        blocks.append({"type": "text", "text": tail})
    if not blocks:
        return clean_text(value)
    return blocks


def split_options(value: str) -> list[str]:
    options: list[str] = []
    for raw in value.split("~!!~"):
        cleaned = raw.strip()
        if cleaned[:1] in {"、", ".", ",", ":", "：", ";"}:
            cleaned = cleaned[1:].strip()
        if cleaned:
            options.append(cleaned)
    return options


def normalize_answer(answer: str) -> list[str]:
    answer = answer.strip().upper()
    if any(separator in answer for separator in [",", "，", " ", "、"]):
        return [part for part in re.split(r"[,，\s、]+", answer) if part]
    return list(answer)


def convert_question(raw: dict[str, Any]) -> dict[str, Any]:
    type_map = {"1": "single", "2": "multiple", "3": "judgement"}
    question_type = type_map.get(str(raw.get("TQ_TYPE")))
    if question_type is None:
        raise ValueError(f"Unsupported TQ_TYPE: {raw.get('TQ_TYPE')}")

    question: dict[str, Any] = {
        "id": str(raw["ID"]),
        "type": question_type,
        "stem": parse_content(str(raw.get("tq_name", ""))),
        "explanation": parse_content(str(raw.get("jiexi", ""))) or "暂无解析。",
        "source": "旧网页数据迁移",
    }

    if question_type == "judgement":
        question["answer"] = ["true" if raw.get("BZ_ANSWER") == "对" else "false"]
        return question

    option_values = split_options(str(raw.get("xx", "")))
    question["options"] = [
        {"id": chr(ord("A") + index), "content": parse_content(value)}
        for index, value in enumerate(option_values)
    ]
    question["answer"] = normalize_answer(str(raw.get("BZ_ANSWER", "")))
    return question


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--bank-id", required=True)
    parser.add_argument("--bank-name", required=True)
    parser.add_argument("--version", default="1.0.0")
    parser.add_argument("--category", default="电工作业")
    parser.add_argument("--assets-base", default=".")
    args = parser.parse_args()

    source = args.input.read_text(encoding="utf-8", errors="replace")
    match = DATA_PATTERN.search(source)
    if not match:
        raise SystemExit("Cannot find legacy `var data = {...}` block")

    payload = json.loads(match.group(1))
    questions = [convert_question(item) for item in payload.get("obj", [])]
    bank = {
        "schemaVersion": 1,
        "id": args.bank_id,
        "name": args.bank_name,
        "version": args.version,
        "category": args.category,
        "assetsBase": args.assets_base,
        "questions": questions,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(bank, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Converted {len(questions)} questions -> {args.output}")


if __name__ == "__main__":
    main()
