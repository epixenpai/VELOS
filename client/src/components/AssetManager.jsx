import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { Upload, Video, Image as ImageIcon, Music, Type } from 'lucide-react';
import { DraggableAsset } from './Timeline';

export default function AssetManager() {
  const { apiUrl } = useAppStore();
  const [assets, setAssets] = useState([]);
  const [activeTab, setActiveTab] = useState('video');
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const res = await fetch(`${apiUrl}/assets`);
      const data = await res.json();
      setAssets(data);
    } catch (err) {
      console.error("Failed to fetch assets:", err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${apiUrl}/assets/upload`, {
        method: 'POST',
        body: formData,
      });
      const newAsset = await res.json();
      setAssets([newAsset, ...assets]);
    } catch (err) {
      console.error("Failed to upload asset:", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const filteredAssets = assets.filter(a => a.type === activeTab);

  const tabs = [
    { id: 'video', icon: Video, label: 'Videos' },
    { id: 'audio', icon: Music, label: 'Audio' },
    { id: 'image', icon: ImageIcon, label: 'Images' },
    { id: 'font', icon: Type, label: 'Fonts' },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-800 w-80 shrink-0">
      <div className="p-4 border-b border-gray-800">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full bg-velos-primary hover:bg-blue-600 text-white py-2 rounded-md flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          <Upload size={18} />
          {isUploading ? 'Uploading...' : 'Import Media'}
        </button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileUpload}
          accept="video/*,image/*,audio/*"
        />
      </div>

      <div className="flex border-b border-gray-800 overflow-x-auto no-scrollbar">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 flex justify-center items-center gap-1 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-velos-primary text-velos-primary'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
              title={tab.label}
            >
              <Icon size={18} />
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {filteredAssets.length === 0 ? (
          <div className="text-center text-sm text-gray-500 mt-10">
            No {activeTab}s imported yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredAssets.map(asset => (
              <DraggableAsset key={asset.id} asset={asset}>
              <div
                className="bg-gray-800 rounded aspect-square flex flex-col justify-end p-2 cursor-grab hover:ring-2 ring-velos-primary overflow-hidden relative group"
              >
                {/* Visual placeholder based on type */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity">
                  {asset.type === 'video' && <Video size={32} />}
                </div>

                <div className="relative z-10 truncate text-xs font-medium text-gray-200 bg-gray-900/80 p-1 rounded">
                  {asset.name}
                </div>
              </div>
              </DraggableAsset>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}