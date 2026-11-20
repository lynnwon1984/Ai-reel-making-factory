/**
 * 状态链检查（启发式，零模型）
 *
 * 稳定链路的分镜稿里，每个 shot 都有一行「人物空间位置」，它是**开镜状态**；
 * 状态变化写在 Clip 的 visualAction 里。于是相邻两镜可以这样核对：
 *
 *   上一镜开镜状态 + 上一镜内的状态变化  ==  下一镜开镜状态
 *
 * 这里只做能确定判定的两件事：
 *   1. 姿势跳变（躺/坐/站/跪/蹲/卧/趴/弯腰）：前后不同，但两镜里都找不到过渡动作
 *   2. 朝向反转：前后都写了「面朝/面向/看着」的不同对象，但找不到转身动作
 *
 * 不做的事：语义改写、镜头语言、情绪。宁可漏报，不做误报——误报会让人不信任检查。
 */

const POSTURES = [
  "躺",
  "卧",
  "坐",
  "站",
  "跪",
  "蹲",
  "趴",
  "弯腰",
];

// 姿势之间允许「无过渡词也算合理」的组合：躺着可以低头、坐着可以前倾，这类不算跳变。
const COMPATIBLE = new Set([
  "躺>卧",
  "卧>躺",
  "站>弯腰",
  "弯腰>站",
  "蹲>站",
  "站>蹲",
]);

const TRANSITION =
  /(坐起|坐起|坐下|坐回|站起|起身|直起身|直起|站起来|躺下|躺倒|跪下|蹲下|弯腰|俯身|扶起|扶坐|挣扎着[^，。；]{0,6}起)/;
const TURN = /(转身|转头|回头|扭过头|侧过脸|转过来|转过去|面朝|改为面向)/;

function trim(value) {
  return String(value == null ? "" : value).trim();
}

/** 从分镜稿里拆出 shot：编号、人物表、开镜空间位置、本镜所有可见动作。 */
export function parseStateShots(markdown) {
  const shots = [];
  let current = null;
  let expectSpace = false;
  for (const raw of String(markdown || "").split("\n")) {
    const line = raw.trim();
    const head = line.match(/^【分镜(\d+)】/);
    if (head) {
      current = {
        no: Number(head[1]),
        label: `分镜${head[1]}`,
        cast: [],
        space: "",
        actions: [],
      };
      shots.push(current);
      expectSpace = false;
      continue;
    }
    if (!current) continue;
    const meta = line.match(/^\[shot\d+\s*\|(.+)\]$/);
    if (meta) {
      const cast = meta[1].match(/人物[：:]\s*([^|]+)/);
      if (cast) {
        current.cast = cast[1]
          .split(/[、,，]/)
          .map((item) => trim(item.replace(/[（(].*?[）)]/g, "")))
          .filter(Boolean);
      }
      continue;
    }
    if (/^人物空间位置[：:]?$/.test(line)) {
      expectSpace = true;
      continue;
    }
    if (expectSpace) {
      current.space = line;
      expectSpace = false;
      continue;
    }
    const camera = line.match(/^CAMERA:\s*[^.]*\.\s*(.*)$/);
    if (camera) current.actions.push(camera[1]);
  }
  return shots;
}

function charStates(space, cast) {
  const out = {};
  // 按小句切分：一个角色只从「以他为主语」的小句里取状态，
  // 避免「面朝右侧的亚瑟」这种宾语被误当成主语。
  const clauses = space
    .split(/[。；]/)
    .map(trim)
    .filter(Boolean);
  for (const clause of clauses) {
    let subject = "";
    let subjectAt = Number.POSITIVE_INFINITY;
    for (const name of cast) {
      let index = clause.indexOf(name);
      while (index >= 0) {
        const before = clause[index - 1] || "";
        // 名字前面是「的/向/朝/着/给/对/在」时，它是宾语或修饰语，不是主谓结构的主语。
        if (!/[的向朝着给对在]/.test(before)) {
          if (index < subjectAt) {
            subjectAt = index;
            subject = name;
          }
          break;
        }
        index = clause.indexOf(name, index + name.length);
      }
    }
    if (!subject || out[subject]) continue;
    let posture = "";
    for (const item of POSTURES) {
      if (clause.includes(item)) {
        posture = item;
        break;
      }
    }
    const facing = clause.match(/(?:面朝|面向|看着|看向|望向)([^，。；]+)/);
    out[subject] = {
      posture,
      facing: facing ? trim(facing[1]) : "",
      clause,
    };
  }
  return out;
}

function hasFor(name, text) {
  return text.includes(name);
}

// 「面朝亚瑟」与「面朝右侧的亚瑟」是同一朝向，比较前去掉方位修饰。
function sameFacing(a, b) {
  const norm = (value) =>
    trim(value)
      .replace(/画面|左侧|右侧|左边|右边|中部|上方|下方|的|方向|处|边/g, "")
      .replace(/\s+/g, "");
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return true;
  return left === right || left.includes(right) || right.includes(left);
}

/**
 * @param {string} markdown 分镜稿
 * @returns {Array<{level,where,rule,evidence}>} 与 qc 同结构的问题列表
 */
export function auditStateChain(markdown) {
  const shots = parseStateShots(markdown);
  const issues = [];

  for (let index = 1; index < shots.length; index += 1) {
    const prev = shots[index - 1];
    const cur = shots[index];
    const prevStates = charStates(prev.space, prev.cast);
    const curStates = charStates(cur.space, cur.cast);
    const bridge = prev.actions.join("；") + "；" + cur.actions.join("；");

    for (const name of Object.keys(curStates)) {
      const before = prevStates[name];
      const after = curStates[name];
      if (!before) continue;

      if (
        before.posture &&
        after.posture &&
        before.posture !== after.posture &&
        !COMPATIBLE.has(`${before.posture}>${after.posture}`) &&
        !TRANSITION.test(bridge) &&
        hasFor(name, prev.clause + after.clause)
      ) {
        issues.push({
          level: "中",
          where: cur.label,
          rule: "状态跳变",
          evidence: `${name}：上一镜开镜「${before.posture}」→ 本镜开镜「${after.posture}」，两镜内都找不到过渡动作`,
        });
      }

      if (
        before.facing &&
        after.facing &&
        !sameFacing(before.facing, after.facing) &&
        !TURN.test(bridge)
      ) {
        issues.push({
          level: "低",
          where: cur.label,
          rule: "朝向跳变",
          evidence: `${name}：上一镜「面朝${before.facing}」→ 本镜「面朝${after.facing}」，两镜内都找不到转身动作`,
        });
      }
    }
  }

  return issues;
}
