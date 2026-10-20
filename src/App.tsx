import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';

import Settings from './pages/Settings';
import Step1Page from './pages/steps/Step1Page';
import Step2Page from './pages/steps/Step2Page';
import Step3Page from './pages/steps/Step3Page';
import Step4Page from './pages/steps/Step4Page';
import Step5Page from './pages/steps/Step5Page';
import Step6Page from './pages/steps/Step6Page';
import Step7Page from './pages/steps/Step7Page';
import Step8Page from './pages/steps/Step8Page';
import Step9Page from './pages/steps/Step9Page';
import Step10Page from './pages/steps/Step10Page';
import WorkspaceRedirect from './pages/WorkspaceRedirect';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/workspace/:id" element={<WorkspaceRedirect />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/project/:id/step1" element={<Step1Page />} />
          <Route path="/project/:id/step2" element={<Step2Page />} />
          <Route path="/project/:id/step3" element={<Step3Page />} />
          <Route path="/project/:id/step4" element={<Step4Page />} />
          <Route path="/project/:id/step5" element={<Step5Page />} />
          <Route path="/project/:id/step6" element={<Step6Page />} />
          <Route path="/project/:id/step7" element={<Step7Page />} />
          <Route path="/project/:id/step8" element={<Step8Page />} />
          <Route path="/project/:id/step9" element={<Step9Page />} />
          <Route path="/project/:id/step10" element={<Step10Page />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
