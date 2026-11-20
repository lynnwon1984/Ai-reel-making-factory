import { test } from "node:test";
import assert from "node:assert/strict";

import { parseStoryboard } from "../src/storyboard.js";
import { buildDeliveryPackage, buildZip } from "../src/delivery-package.js";

const SAMPLE = `第1集：测试
【分镜01】
[shot01 | 时长：6秒 | 场景：办公室 内 日 | 人物：村长 | 道具：手机]
人物空间位置：
村长站在桌前。
Clip A | 时长：6秒 | 景别：CU
CAMERA: 固定机位 / CU. 村长抬头，说：“Run!”
EN: 村长: "Run!"

第2集：追出门
【分镜01】
[shot01 | 时长：5秒 | 场景：走廊 外 夜 | 人物：村长 | 道具：无]
人物空间位置：
村长冲向门口。
Clip A | 时长：5秒 | 景别：MS
CAMERA: 跟拍 / MS. 村长推门跑出。
`;

function fixture() {
  const parsed = parseStoryboard(SAMPLE);
  return buildDeliveryPackage({
    parsed,
    projectName: "演示剧",
    fullMarkdown: SAMPLE,
    generatedAt: new Date("2026-11-04T08:00:00+08:00"),
  });
}

test("交付包：只包含完整分镜、分集分镜、说明和清单", () => {
  const delivery = fixture();
  assert.equal(delivery.totals.episodes, 2);
  assert.equal(delivery.totals.shots, 2);
  assert.equal(delivery.totals.clips, 2);
  assert.equal(delivery.totals.duration, 11);
  assert.deepEqual(
    delivery.files.map((file) => file.path),
    [
      "演示剧-完整分镜.md",
      "演示剧-分集分镜/001集-测试.md",
      "演示剧-分集分镜/002集-追出门.md",
      "交付说明.txt",
      "manifest.json",
    ],
  );
});

test("交付包：逐集文件是标准分镜 Markdown，并保留原台词", () => {
  const delivery = fixture();
  const first = delivery.files.find((file) => file.path.includes("001集"));
  assert.match(first.content, /^第1集：测试/);
  assert.match(first.content, /【分镜01】/);
  assert.match(first.content, /EN: 村长: "Run!"/);
});

test("交付包：说明和 manifest 明确只交付分镜剧本，不接制作平台", () => {
  const delivery = fixture();
  const readme = delivery.files.find((file) => file.path === "交付说明.txt").content;
  const manifest = JSON.parse(
    delivery.files.find((file) => file.path === "manifest.json").content,
  );
  assert.match(readme, /只求交付分镜头剧本/);
  assert.doesNotMatch(readme, /EOS/);
  assert.equal(manifest.format, "ai-storyboard-script-delivery");
  assert.equal(manifest.version, 2);
});

test("交付包：ZIP 含本地头、中央目录和结束记录", () => {
  const delivery = fixture();
  assert.equal(delivery.zip[0], 0x50);
  assert.equal(delivery.zip[1], 0x4b);
  assert.equal(delivery.zip[2], 0x03);
  assert.equal(delivery.zip[3], 0x04);
  const binary = Buffer.from(delivery.zip);
  assert.notEqual(binary.indexOf(Buffer.from("演示剧-完整分镜.md", "utf8")), -1);
  assert.notEqual(binary.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])), -1);
  assert.notEqual(binary.indexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])), -1);
  const binaryText = new TextDecoder("latin1").decode(delivery.zip);
  assert.ok(binaryText.endsWith("\u0000\u0000"));
});

test("ZIP：空文件包仍是合法空档案", () => {
  const zip = buildZip([], new Date("2026-11-04T00:00:00Z"));
  assert.equal(zip.length, 22);
  assert.equal(zip[0], 0x50);
  assert.equal(zip[1], 0x4b);
  assert.equal(zip[2], 0x05);
  assert.equal(zip[3], 0x06);
});

