const clone = (value) => structuredClone(value);

function durationOf(group) {
  return (group.shots || []).reduce(
    (sum, shot) => sum + (Number(shot.duration) || 0),
    0,
  );
}

function outsideSeconds(duration, minSeconds, maxSeconds) {
  if (duration < minSeconds) return minSeconds - duration;
  if (duration > maxSeconds) return duration - maxSeconds;
  return 0;
}

function boundaryScore(leftDuration, rightDuration, settings) {
  const leftOutside = outsideSeconds(
    leftDuration,
    settings.minSeconds,
    settings.maxSeconds,
  );
  const rightOutside = outsideSeconds(
    rightDuration,
    settings.minSeconds,
    settings.maxSeconds,
  );
  return {
    invalid: Number(leftOutside > 0) + Number(rightOutside > 0),
    outside: leftOutside + rightOutside,
    deviation:
      Math.abs(leftDuration - settings.midSeconds) +
      Math.abs(rightDuration - settings.midSeconds),
  };
}

function betterBoundary(left, right) {
  if (!right) return true;
  if (left.invalid !== right.invalid) return left.invalid < right.invalid;
  if (left.outside !== right.outside) return left.outside < right.outside;
  return left.deviation < right.deviation;
}

function findPairRebalance(left, right, settings) {
  const shots = [...(left.shots || []), ...(right.shots || [])];
  const currentInvalid =
    Number(durationOf(left) < settings.minSeconds || durationOf(left) > settings.maxSeconds) +
    Number(durationOf(right) < settings.minSeconds || durationOf(right) > settings.maxSeconds);
  let best = null;
  for (let cut = 1; cut < shots.length; cut += 1) {
    const leftShots = shots.slice(0, cut);
    const rightShots = shots.slice(cut);
    const leftDuration = leftShots.reduce(
      (sum, shot) => sum + (Number(shot.duration) || 0),
      0,
    );
    const rightDuration = rightShots.reduce(
      (sum, shot) => sum + (Number(shot.duration) || 0),
      0,
    );
    const score = boundaryScore(leftDuration, rightDuration, settings);
    const candidate = {
      cut,
      leftDuration,
      rightDuration,
      ...score,
    };
    if (!best || betterBoundary(candidate, best)) best = candidate;
  }
  if (!best || best.invalid >= currentInvalid) return null;
  return {
    ...best,
    currentInvalid,
    shots: shots.slice(0, best.cut),
    rightShots: shots.slice(best.cut),
  };
}

/**
 * 不删内容、不硬补时长，只给每一集生成可执行的分集处理选项。
 */
export function buildEpisodeResolutionPlan(
  arbitration,
  {
    minSeconds = 75,
    midSeconds = 90,
    maxSeconds = 105,
  } = {},
) {
  const settings = { minSeconds, midSeconds, maxSeconds };
  const groups = (arbitration?.groups || []).map((group, index) => ({
    ...clone(group),
    index,
    duration: durationOf(group),
  }));
  const needsResolution = [];

  for (const group of groups) {
    if (group.duration >= minSeconds && group.duration <= maxSeconds) continue;
    if (group.duration > maxSeconds) continue;
    const deficitSeconds = minSeconds - group.duration;
    const neighbors = [
      group.index > 0 ? groups[group.index - 1] : null,
      group.index < groups.length - 1 ? groups[group.index + 1] : null,
    ].filter(Boolean);
    const rebalanceCandidates = neighbors
      .map((neighbor) =>
        group.index < neighbor.index
          ? findPairRebalance(group, neighbor, settings)
          : findPairRebalance(neighbor, group, settings),
      )
      .filter(Boolean)
      .sort((left, right) => betterBoundary(left, right) ? -1 : 1);
    const mergeCandidate = neighbors
      .map((neighbor) => ({
        neighbor,
        total: group.duration + durationOf(neighbor),
      }))
      .filter((candidate) => candidate.total <= maxSeconds)
      .sort((left, right) => left.total - right.total)[0];
    const rebalance = rebalanceCandidates[0] || null;
    const options = [
      {
        type: "rebalance",
        available: Boolean(rebalance),
        label: "与相邻集重新分配镜头边界",
        reason: rebalance
          ? `可重新切为 ${rebalance.leftDuration}s + ${rebalance.rightDuration}s`
          : `相邻内容总量不足以让两集都达到 ${minSeconds}s`,
        candidate: rebalance
          ? {
              leftDuration: rebalance.leftDuration,
              rightDuration: rebalance.rightDuration,
            }
          : null,
      },
      {
        type: "merge_neighbor",
        available: Boolean(mergeCandidate),
        label: "与相邻集合并",
        reason: mergeCandidate
          ? `合并后 ${mergeCandidate.total}s，仍在 ${minSeconds}–${maxSeconds}s 内`
          : "合并后会超过上限",
        candidate: mergeCandidate
          ? { neighbor: mergeCandidate.neighbor.no, duration: mergeCandidate.total }
          : null,
      },
      {
        type: "add_content",
        available: deficitSeconds > 0,
        label: "补回真实内容",
        reason: `至少需要补充 ${deficitSeconds}s 的剧本内容；不得用空镜或慢放硬凑`,
        deficitSeconds,
      },
      {
        type: "accept_short",
        available: true,
        label: "明确接受短集",
        reason: `当前 ${group.duration}s，距下限差 ${deficitSeconds}s；必须记录接受理由`,
        deficitSeconds,
      },
      {
        type: "return_upstream",
        available: true,
        label: "退回流程二或内容修改",
        reason: "由创作者调整场景/内容边界，再重新做分镜时长裁决",
      },
    ];
    const recommended = options.find((option) => option.type === "merge_neighbor" && option.available)
      || options.find((option) => option.type === "rebalance" && option.available)
      || options.find((option) => option.type === "add_content" && option.available)
      || options.find((option) => option.type === "accept_short");
    needsResolution.push({
      episode: group.no,
      groupIndex: group.index,
      duration: group.duration,
      deficitSeconds,
      neighbors: neighbors.map((neighbor) => ({
        episode: neighbor.no,
        duration: neighbor.duration,
      })),
      recommended: recommended?.type || null,
      options,
    });
  }

  return {
    settings,
    groups,
    needsResolution,
    stats: {
      episodes: groups.length,
      short: needsResolution.length,
      resolvableWithoutContent: needsResolution.filter((item) =>
        item.options.some(
          (option) =>
            ["rebalance", "merge_neighbor"].includes(option.type) && option.available,
        ),
      ).length,
      onlyByContentOrAcceptance: needsResolution.filter((item) =>
        item.options.every(
          (option) =>
            !["rebalance", "merge_neighbor"].includes(option.type) || !option.available,
        ),
      ).length,
    },
  };
}

export function acceptShortEpisode(plan, episodeNo, reason = "") {
  const next = clone(plan);
  const target = next.groups.find((group) => group.no === episodeNo);
  if (!target) throw new Error(`找不到提案第 ${episodeNo} 集`);
  const minSeconds = next.settings?.minSeconds || 75;
  const maxSeconds = next.settings?.maxSeconds || 105;
  if (target.duration >= minSeconds && target.duration <= maxSeconds) {
    throw new Error(`提案第 ${episodeNo} 集不在短集状态`);
  }
  target.status = "accepted_short";
  target.resolution = {
    type: "accept_short",
    reason: String(reason || "").trim(),
  };
  next.needsResolution = next.needsResolution.filter(
    (item) => item.episode !== episodeNo,
  );
  next.stats.short = next.needsResolution.length;
  next.stats.resolvableWithoutContent = next.needsResolution.filter((item) =>
    item.options.some(
      (option) =>
        ["rebalance", "merge_neighbor"].includes(option.type) &&
        option.available,
    ),
  ).length;
  next.stats.onlyByContentOrAcceptance =
    next.needsResolution.length - next.stats.resolvableWithoutContent;
  return next;
}
