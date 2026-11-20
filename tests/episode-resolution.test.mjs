import { test } from "node:test";
import assert from "node:assert/strict";

import {
  acceptShortEpisode,
  buildEpisodeResolutionPlan,
} from "../src/episode-resolution.js";

function arbitration(...episodes) {
  let cursor = 0;
  const groups = episodes.map((episode, index) => {
    const durations = Array.isArray(episode) ? episode : [episode];
    const shots = durations.map((duration) => ({ duration }));
    const duration = durations.reduce((sum, value) => sum + value, 0);
    const group = {
      no: index + 1,
      duration,
      status: duration < 75 ? "short" : duration > 105 ? "over" : "fit",
      firstShotIndex: cursor,
      lastShotIndex: cursor,
      shots,
    };
    cursor += 1;
    return group;
  });
  return {
    groups,
    issues: [],
    stats: {
      episodes: groups.length,
      totalDuration: groups.reduce((sum, group) => sum + group.duration, 0),
      inWindow: groups.filter((group) => group.status === "fit").length,
      short: groups.filter((group) => group.status === "short").length,
      over: 0,
    },
  };
}

test("短集处理：78 + 69 无法仅靠重新分界变成两个合格集", () => {
  const plan = buildEpisodeResolutionPlan(arbitration([38, 40], [34, 35]));
  assert.equal(plan.needsResolution.length, 1);
  const item = plan.needsResolution[0];
  assert.equal(item.duration, 69);
  assert.equal(item.deficitSeconds, 6);
  assert.equal(
    item.options.find((option) => option.type === "rebalance").available,
    false,
  );
  assert.equal(
    item.options.find((option) => option.type === "merge_neighbor").available,
    false,
  );
  assert.equal(item.recommended, "add_content");
});

test("短集处理：70 + 90 可以通过相邻重分配变成 80 + 80", () => {
  const plan = buildEpisodeResolutionPlan(arbitration([40, 30], [10, 80]));
  const item = plan.needsResolution[0];
  const rebalance = item.options.find((option) => option.type === "rebalance");
  assert.equal(rebalance.available, true);
  assert.deepEqual(rebalance.candidate, {
    leftDuration: 80,
    rightDuration: 80,
  });
  assert.equal(item.recommended, "rebalance");
});

test("短集处理：总时长不超过单集上限时优先建议合并", () => {
  const plan = buildEpisodeResolutionPlan(arbitration(70, 25));
  const item = plan.needsResolution[0];
  const merge = item.options.find((option) => option.type === "merge_neighbor");
  assert.equal(merge.available, true);
  assert.equal(merge.candidate.duration, 95);
  assert.equal(item.recommended, "merge_neighbor");
});

test("短集处理：接受短集会记录理由并从待处理清单移除", () => {
  const plan = buildEpisodeResolutionPlan(arbitration(78, 69));
  const accepted = acceptShortEpisode(plan, 2, "故意停在钩子上");
  assert.equal(accepted.groups[1].status, "accepted_short");
  assert.equal(accepted.groups[1].resolution.reason, "故意停在钩子上");
  assert.equal(accepted.needsResolution.length, 0);
});
