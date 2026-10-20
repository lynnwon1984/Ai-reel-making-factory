import {
  Sparkle,
  FilmSlate,
  SquaresFour,
  FolderSimple,
  BookOpen,
} from "@phosphor-icons/react";

const FLOW = [
  { key: "clean", label: "剧本清洗", Icon: Sparkle },
  { key: "episode", label: "集数拆分与重组", Icon: FilmSlate },
  { key: "storyboard", label: "生成分镜", Icon: SquaresFour },
];

const WORKSPACE = [
  { key: "projects", label: "项目", Icon: FolderSimple },
  { key: "guide", label: "使用说明", Icon: BookOpen },
];

function Item({ label, Icon, active, badge, onClick }) {
  return (
    <button
      className={`nav-item${active ? " active" : ""}`}
      type="button"
      onClick={onClick}
    >
      <span className="nav-ico">
        <Icon size={17} weight={active ? "fill" : "regular"} />
      </span>
      {label}
      {badge ? <span className="nav-badge">{badge}</span> : null}
    </button>
  );
}

export function Sidebar({ active = "clean", onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">分</span>
        <span className="brand-name">分镜流水线</span>
      </div>

      <nav className="nav-group">
        <div className="nav-label">流程 / PIPELINE</div>
        {FLOW.map(({ key, ...rest }) => (
          <Item
            key={key}
            {...rest}
            active={key === active}
            onClick={() => onNavigate?.(key)}
          />
        ))}
      </nav>

      <nav className="nav-group">
        <div className="nav-label">工作台 / WORKSPACE</div>
        {WORKSPACE.map(({ key, ...rest }) => (
          <Item key={key} {...rest} />
        ))}
      </nav>
    </aside>
  );
}
