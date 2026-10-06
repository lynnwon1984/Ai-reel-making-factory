import { NavLink, Outlet, useLocation } from 'react-router-dom';

const STEP_BUTTONS = [
  { num: '①', label: '审计', step: 1 },
  { num: '②', label: '分析', step: 2 },
  { num: '③', label: '分镜', step: 3 },
  { num: '④', label: 'Prompt', step: 4 },
  { num: '⑤', label: '质检', step: 5 },
];

export default function Layout() {
  const location = useLocation();

  // Extract projectId from URL like /project/:id/stepN
  const projectMatch = location.pathname.match(/^\/project\/([^/]+)\//);
  const projectId = projectMatch ? projectMatch[1] : null;

  // Determine current step from URL
  const stepMatch = location.pathname.match(/\/step(\d+)/);
  const currentStep = stepMatch ? parseInt(stepMatch[1], 10) : null;

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-950 text-white flex flex-col border-r border-gray-700/50">
        <div className="p-6 border-b border-gray-700/50">
          <h1 className="text-xl font-bold tracking-tight">分镜锻造</h1>
          <p className="text-xs text-gray-500 mt-1">AI Storyboard Forge</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span>🏠</span>
            <span>首页</span>
          </NavLink>

          {/* Step shortcut buttons */}
          {projectId ? (
            <>
              <div className="pt-2 pb-1 px-2">
                <div className="h-px bg-gray-800" />
              </div>
              {STEP_BUTTONS.map((btn) => {
                const isActiveStep = currentStep === btn.step;
                return (
                  <NavLink
                    key={btn.step}
                    to={`/project/${projectId}/step${btn.step}`}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                      isActiveStep
                        ? 'bg-blue-600/20 text-blue-400 font-semibold'
                        : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
                    }`}
                  >
                    <span className="text-xs w-4 text-center">{btn.num}</span>
                    <span>{btn.label}</span>
                  </NavLink>
                );
              })}
            </>
          ) : (
            <>
              <div className="pt-2 pb-1 px-2">
                <div className="h-px bg-gray-800" />
              </div>
              {STEP_BUTTONS.map((btn) => (
                <div
                  key={btn.step}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-gray-700 cursor-default"
                >
                  <span className="text-xs w-4 text-center">{btn.num}</span>
                  <span>{btn.label}</span>
                </div>
              ))}
            </>
          )}

          <div className="pt-2">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <span>⚙️</span>
              <span>设置</span>
            </NavLink>
          </div>
        </nav>
        <div className="p-4 border-t border-gray-700/50 text-xs text-gray-600">
          v0.2.0
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-900">
        <Outlet />
      </main>
    </div>
  );
}
