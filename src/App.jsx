import { useEffect, useState } from "react";
import { Info } from "@phosphor-icons/react";
import { Sidebar } from "./Sidebar.jsx";
import { CleanFlow } from "./CleanFlow.jsx";
import { SplitFlow } from "./SplitFlow.jsx";
import { StoryboardFlow } from "./StoryboardFlow.jsx";

const PAGES = {
  clean: {
    title: "剧本清洗",
    sub: "把原始剧本，洗成标准剧本。",
    stage: "Stage 01",
    note: (
      <>
        <b>功能说明：</b>第一步「整理」规范剧本格式（排版、人物名、群像、着装、场次合并、集数重排、道具名统一等）；
        第二步「修改逻辑」修复剧情逻辑硬伤，并把中文台词译为英文。每一步都会先给出确认清单，你确认后才执行；
        结果自动保存，<b>切到其他页面再回来不会丢进度</b>。
      </>
    ),
    Flow: CleanFlow,
  },
  episode: {
    title: "集数拆分与重组",
    sub: "把干净剧本，切成成片长度的集。",
    stage: "Stage 02",
    note: (
      <>
        <b>功能说明：</b>按成片时长（默认 75–105 秒）把干净剧本重新分成集，供下一步「生成分镜」使用。
        本页<b>只改结构，不改一个字</b> —— 场内的正文与台词原样搬运，只做重新分组与重新编号。
        估时是<b>纯规则、0 token</b>，不调用模型；切点只在场景边界，想挪哪一场点一下就行。
        集号、场次号、着装标注都会按新分集自动重算，<b>切到其他页面再回来不会丢进度</b>。
      </>
    ),
    Flow: SplitFlow,
  },
  storyboard: {
    title: "生成分镜",
    sub: "把每一集，转成分镜头剧本。",
    stage: "Stage 03",
    note: (
      <>
        <b>功能说明：</b>按「每批 N 集」把分集剧本转成分镜头剧本，跑完自动拼接，可预览、可下载。
        生成后会自动做一次<b>只读校验</b>（shot / Clip 时长、编号、加总）；
        另附一份<b>可选的机读层导出</b>，给下游制作工具用。
        提示词可随时替换，<b>切到其他页面再回来不会丢进度</b>。
      </>
    ),
    Flow: StoryboardFlow,
  },
};

function readHash() {
  const key = (window.location.hash || "").replace(/^#\/?/, "");
  return PAGES[key] ? key : "clean";
}

export function App() {
  const [active, setActive] = useState(readHash);

  useEffect(() => {
    const onHash = () => setActive(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (key) => {
    window.location.hash = `#/${key}`;
    setActive(PAGES[key] ? key : "clean");
  };

  const page = PAGES[active];

  return (
    <div className="app">
      <Sidebar active={active} onNavigate={go} />
      <main className="main">
        <header className="page-head">
          <div className="eyebrow">流程 / PIPELINE</div>
          <h1>{page.title}</h1>
          <p className="page-sub">{page.sub}</p>
        </header>

        <div className="note">
          <span className="note-ico">
            <Info size={17} weight="fill" />
          </span>
          <div>{page.note}</div>
        </div>

        <page.Flow />

        <div className="divider" />
        <div className="footer-note">
          Official Pipeline · {page.stage}
        </div>
      </main>
    </div>
  );
}
