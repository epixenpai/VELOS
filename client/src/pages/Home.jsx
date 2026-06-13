import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { Plus, Trash2, Copy, Play } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { projects, setProjects, apiUrl } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [frameRate, setFrameRate] = useState(30);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${apiUrl}/projects`);
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const res = await fetch(`${apiUrl}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName, aspectRatio, frameRate })
      });
      const data = await res.json();

      setIsModalOpen(false);
      setNewProjectName('');

      // Navigate to the new project editor
      navigate(`/project/${data.id}`);
    } catch (err) {
      console.error("Failed to create project", err);
    }
  };

  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-velos-dark text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-velos-primary rounded-md flex items-center justify-center font-bold text-velos-primary transform rotate-45">
              <span className="-rotate-45">/</span>
            </div>
            <h1 className="text-3xl font-bold tracking-wider">VELOS</h1>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-velos-primary hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
          >
            <Plus size={20} />
            New Project
          </button>
        </header>

        <div className="mb-8">
          <input
            type="text"
            placeholder="Search projects..."
            className="w-full md:w-1/3 bg-gray-900 border border-gray-700 rounded-md px-4 py-2 focus:outline-none focus:border-velos-primary text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filteredProjects.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p>No projects found. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProjects.map(project => (
              <div
                key={project.id}
                onClick={() => navigate(`/project/${project.id}`)}
                className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden cursor-pointer hover:border-velos-primary transition-colors group relative"
              >
                <div className="aspect-video bg-gray-800 flex items-center justify-center">
                  {/* Placeholder for project thumbnail */}
                  <Play size={40} className="text-gray-600 group-hover:text-velos-primary transition-colors" />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg truncate mb-1">{project.name}</h3>
                  <p className="text-xs text-gray-500">
                    {project.aspectRatio} • {project.frameRate}fps
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Last modified: {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">Create New Project</h2>
            <form onSubmit={handleCreateProject}>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Project Name</label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-black border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-velos-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Aspect Ratio</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full bg-black border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-velos-primary"
                  >
                    <option value="16:9">16:9 (Landscape)</option>
                    <option value="9:16">9:16 (Portrait)</option>
                    <option value="1:1">1:1 (Square)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Frame Rate</label>
                  <select
                    value={frameRate}
                    onChange={(e) => setFrameRate(Number(e.target.value))}
                    className="w-full bg-black border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-velos-primary"
                  >
                    <option value={24}>24 fps</option>
                    <option value={30}>30 fps</option>
                    <option value={60}>60 fps</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-velos-primary hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}