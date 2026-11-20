#!/usr/bin/env python3
"""Deterministic checks for 20-minute adult screen scripts in this project format."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


SCENE_RE = re.compile(r"^## (S\d{2})\s+(.+)$", re.MULTILINE)
TIME_RE = re.compile(
    r"【时间码】\s*(\d+):(\d{2})\s*[–—-]\s*(\d+):(\d{2})"
)
ADULT_MARKERS = ("【亲密戏", "SEX_SCENE", "INTIMACY SCENE")
REQUIRED_ADULT_LABELS = {
    "意图": ("意图", "INTENT"),
    "进入状态": ("进入状态", "ENTRY STATE"),
    "同意节点": ("同意节点", "CONSENT"),
    "停止口令": ("停止口令", "SAFE WORD", "STOP WORD"),
    "保护措施": ("保护措施", "PROTECTION"),
    "镜头覆盖": ("镜头覆盖", "SHOT COVERAGE"),
}
PLACEHOLDERS = ("TODO", "[TODO", "角色名：", "<演员>", "<角色>")
CAMERA_TERMS = ("镜头", "景别", "特写", "推拉", "摇移", "剪辑", "蒙太奇")


def seconds(value: str) -> int:
    minute, second = value.split(":")
    return int(minute) * 60 + int(second)


def clock(value: int) -> str:
    return f"{value // 60}:{value % 60:02d}"


def parse_script(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    headings = list(SCENE_RE.finditer(text))
    scenes = []

    for index, heading in enumerate(headings):
        end = headings[index + 1].start() if index + 1 < len(headings) else len(text)
        body = text[heading.end() : end]
        time_match = TIME_RE.search(body)
        start = finish = None
        if time_match:
            start = seconds(f"{time_match.group(1)}:{time_match.group(2)}")
            finish = seconds(f"{time_match.group(3)}:{time_match.group(4)}")
        scenes.append(
            {
                "id": heading.group(1),
                "title": heading.group(2).strip(),
                "body": body,
                "start": start,
                "end": finish,
                "duration": None if start is None or finish is None else finish - start,
                "adult": any(marker in body for marker in ADULT_MARKERS),
            }
        )

    return {"path": path, "text": text, "scenes": scenes}


def add_issue(issues: list[dict], severity: str, code: str, scene: str, message: str):
    issues.append(
        {
            "severity": severity,
            "code": code,
            "scene": scene,
            "message": message,
        }
    )


def outside_camera_lines(body: str) -> list[str]:
    in_camera = False
    result = []
    for raw_line in body.splitlines():
        line = raw_line.strip()
        if line in {"【镜头】", "【镜头覆盖】"}:
            in_camera = True
            continue
        if line.startswith("【") and line.endswith("】"):
            in_camera = False
            continue
        if not in_camera and any(term in line for term in CAMERA_TERMS):
            result.append(line)
    return result


def validate(data: dict, target_minutes: float, intimacy_minutes: float) -> dict:
    issues: list[dict] = []
    full_text = data["text"]
    scenes = data["scenes"]
    if not scenes:
        add_issue(issues, "P0", "FORMAT_ERROR", "", "没有找到 `## Sxx` 场次")

    expected_scene = 1
    previous_end = 0
    total = 0
    intimacy_total = 0
    adult_scenes = 0

    for scene in scenes:
        sid = scene["id"]
        number = int(sid[1:])
        if number != expected_scene:
            add_issue(
                issues,
                "P0",
                "SCENE_SEQUENCE",
                sid,
                f"场次编号应为 S{expected_scene:02d}",
            )
        expected_scene += 1

        if scene["start"] is None or scene["duration"] is None:
            add_issue(issues, "P0", "TIMECODE_MISSING", sid, "缺少可解析的时间码")
            continue
        if scene["start"] != previous_end:
            code = "TIME_GAP" if scene["start"] > previous_end else "TIME_OVERLAP"
            add_issue(
                issues,
                "P0",
                code,
                sid,
                f"上一场结束 {clock(previous_end)}，本场开始 {clock(scene['start'])}",
            )
        if scene["duration"] <= 0:
            add_issue(issues, "P0", "TIMECODE_INVALID", sid, "场次时长不大于零")
        previous_end = scene["end"]
        total += max(0, scene["duration"])

        body = scene["body"]
        if "△" not in body:
            add_issue(issues, "P1", "ACTION_MISSING", sid, "没有可见的动作行")

        for placeholder in PLACEHOLDERS:
            if placeholder in body:
                add_issue(
                    issues,
                    "P0",
                    "PLACEHOLDER_LEFT",
                    sid,
                    f"残留模板占位：{placeholder}",
                )

        for line in outside_camera_lines(body):
            add_issue(
                issues,
                "P2",
                "CAMERA_OUTSIDE_BLOCK",
                sid,
                f"镜头语言出现在镜头区块外：{line[:40]}",
            )

        if scene["adult"]:
            adult_scenes += 1
            intimacy_total += max(0, scene["duration"])
            for label, aliases in REQUIRED_ADULT_LABELS.items():
                if not any(alias in body for alias in aliases):
                    add_issue(
                        issues,
                        "P1",
                        "INTIMACY_FIELD_MISSING",
                        sid,
                        f"成人场景缺少字段：{label}",
                    )

            stop_match = re.search(
                r"(?:停止口令|SAFE WORD|STOP WORD)\s*[:：]\s*([^\n]+)",
                body,
                re.IGNORECASE,
            )
            if stop_match:
                stop_word = re.sub(r"[“”\"'，。；：\s（(].*$", "", stop_match.group(1)).strip()
                if stop_word and full_text.count(stop_word) < 2:
                    add_issue(
                        issues,
                        "P1",
                        "STOP_WORD_UNUSED",
                        sid,
                        f"停止口令“{stop_word}”没有在剧本中被实际使用",
                    )

            if not any(
                word in body
                for word in (
                    "隔离套",
                    "安全套",
                    "保护措施",
                    "本场无插入",
                    "PROTECTION",
                )
            ):
                add_issue(
                    issues,
                    "P1",
                    "PROTECTION_MISSING",
                    sid,
                    "成人场景没有保护措施或明确的无插入说明",
                )

        seen = set()
        for line in body.splitlines():
            line = line.strip()
            if (
                len(line) >= 12
                and not line.startswith(("△", "【", "#", ">", "-"))
                and line in seen
            ):
                add_issue(
                    issues,
                    "P2",
                    "REPEATED_LINE",
                    sid,
                    f"同场重复长句：{line[:40]}",
                )
            seen.add(line)

    target_seconds = round(target_minutes * 60)
    tolerance = max(30, round(target_seconds * 0.10))
    if abs(total - target_seconds) > tolerance:
        add_issue(
            issues,
            "P1",
            "RUNTIME_OUT_OF_RANGE",
            "",
            f"总时长 {clock(total)}，目标 {clock(target_seconds)}，允许误差 ±{tolerance // 60} 分钟",
        )

    intimacy_target = round(intimacy_minutes * 60)
    intimacy_tolerance = max(30, round(intimacy_target * 0.10))
    if abs(intimacy_total - intimacy_target) > intimacy_tolerance:
        add_issue(
            issues,
            "P1",
            "INTIMACY_RUNTIME_OUT_OF_RANGE",
            "",
            f"成人场景 {clock(intimacy_total)}，目标 {clock(intimacy_target)}",
        )
    if intimacy_minutes > 0 and adult_scenes < 2:
        add_issue(
            issues,
            "P1",
            "INTIMACY_SEQUENCE_MISSING",
            "",
            f"只找到 {adult_scenes} 段成人场景；14 分钟规格应拆成两次升级",
        )

    return {
        "scenes": len(scenes),
        "adultScenes": adult_scenes,
        "totalSeconds": total,
        "intimacySeconds": intimacy_total,
        "issues": issues,
    }


def compare_versions(primary: dict, secondary: dict) -> list[dict]:
    issues: list[dict] = []
    left = primary["scenes"]
    right = secondary["scenes"]
    if len(left) != len(right):
        issues.append(
            {
                "severity": "P1",
                "code": "CROSS_LANGUAGE_SCENE_COUNT",
                "scene": "",
                "message": f"场次数不同：{len(left)} vs {len(right)}",
            }
        )
    for a, b in zip(left, right):
        if a["id"] != b["id"]:
            issues.append(
                {
                    "severity": "P1",
                    "code": "CROSS_LANGUAGE_SCENE_ID",
                    "scene": a["id"],
                    "message": f"场次编号不同：{a['id']} vs {b['id']}",
                }
            )
        if a["duration"] != b["duration"]:
            issues.append(
                {
                    "severity": "P1",
                    "code": "CROSS_LANGUAGE_DURATION",
                    "scene": a["id"],
                    "message": f"场次时长不同：{a['duration']}s vs {b['duration']}s",
                }
            )
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("script", type=Path)
    parser.add_argument("--target-minutes", type=float, default=20)
    parser.add_argument("--intimacy-minutes", type=float, default=14)
    parser.add_argument("--compare", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    if not args.script.exists():
        print(f"ERROR: file not found: {args.script}", file=sys.stderr)
        return 2

    primary = parse_script(args.script)
    report = validate(primary, args.target_minutes, args.intimacy_minutes)
    if args.compare:
        if not args.compare.exists():
            print(f"ERROR: compare file not found: {args.compare}", file=sys.stderr)
            return 2
        report["issues"].extend(compare_versions(primary, parse_script(args.compare)))
    report["file"] = str(args.script)
    report["status"] = (
        "REPAIR"
        if any(issue["severity"] in {"P0", "P1"} for issue in report["issues"])
        else "PASS"
    )

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"QC_FILE: {args.script}")
        print(f"STATUS: {report['status']}")
        print(
            f"SCENES: {report['scenes']} | ADULT_SCENES: {report['adultScenes']} | "
            f"RUNTIME: {clock(report['totalSeconds'])} | "
            f"INTIMACY: {clock(report['intimacySeconds'])}"
        )
        if report["issues"]:
            print("ISSUES:")
            for issue in report["issues"]:
                label = issue["scene"] or "GLOBAL"
                print(
                    f"- [{issue['severity']}] [{issue['code']}] {label}: "
                    f"{issue['message']}"
                )
        else:
            print("ISSUES: NONE")

    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
