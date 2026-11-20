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
        <b>功能说明：</b>流程分五个检查点：输入剧本 → 格式检查 → 执行格式整理 → 逻辑检查 → 执行逻辑修复。
        两大阶段仍是「格式标准化」和「修改逻辑」；每次先诊断、再确认、最后执行；
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
        估时是<b>纯规则、0 token</b>，不调用模型；默认按场景边界切，单场超长时按动作块自动多切。
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
        本流程只交付<b>分镜头剧本</b>，不接入任何制作平台接口。
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

/** 功能说明：默认收成两行，需要时再展开 */
function Note({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`note ${open ? "open" : ""}`}>
      <span className="note-ico">
        <Info size={17} weight="fill" />
      </span>
      <div className="note-body">{children}</div>
      <button className="btn ghost sm note-toggle" type="button" onClick={() => setOpen((v) => !v)}>
        {open ? "收起" : "展开说明"}
      </button>
    </div>
  );
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

        <Note>{page.note}</Note>

        <page.Flow />

        <div className="divider" />
        <div className="footer-note">
          Official Pipeline · {page.stage}
        </div>
      </main>
    </div>
  );
}
