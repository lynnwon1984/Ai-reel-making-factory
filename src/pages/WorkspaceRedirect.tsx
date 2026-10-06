import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function WorkspaceRedirect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      navigate(`/project/${id}/step1`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [id, navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <div className="text-gray-400 text-sm">跳转中...</div>
    </div>
  );
}
