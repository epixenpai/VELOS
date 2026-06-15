import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { Upload, Video, Image as ImageIcon, Music, Type, Sparkles } from 'lucide-react';
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


  const addTextAsset = () => {
    const textAsset = {
      id: crypto.randomUUID(),
      name: 'Text Layer',
      type: 'text',
      properties: { text: 'Hello Velos', fill: '#FFFFFF', fontSize: 80 }
    };
    setAssets([textAsset, ...assets]);
  };


  const addShapeAsset = () => {
    const shapeAsset = {
      id: crypto.randomUUID(),
      name: 'Rectangle',
      type: 'shape',
      properties: { shapeType: 'rect', fill: '#2D6FFF', width: 300, height: 300 }
    };
    setAssets([shapeAsset, ...assets]);
  };

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
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'shape', icon: ImageIcon, label: 'Shapes' },
  ];

  return (
    <div className="h-full flex flex-col bg-velos-panel border-r border-velos-border w-[340px] shrink-0 z-10 shadow-[5px_0_20px_rgba(0,0,0,0.2)]">
      <div className="p-5 border-b border-velos-border">

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full bg-velos-primary hover:bg-blue-600 text-white py-2 rounded-md flex items-center justify-center gap-2 transition-colors disabled:opacity-50 mb-2"
        >
          <Upload size={18} />
          {isUploading ? 'Uploading...' : 'Import Media'}
        </button>
        <div className="flex gap-2">
           <button onClick={addTextAsset} className="flex-1 bg-velos-darker border border-velos-border hover:border-gray-500 hover:text-white transition-all text-xs py-2 rounded text-gray-400 font-medium tracking-wide">Add Text</button>
           <button onClick={addShapeAsset} className="flex-1 bg-velos-darker border border-velos-border hover:border-gray-500 hover:text-white transition-all text-xs py-2 rounded text-gray-400 font-medium tracking-wide">Add Shape</button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileUpload}
          accept="video/*,image/*,audio/*"
        />
      </div>

      <div className="flex border-b border-velos-border overflow-x-auto no-scrollbar bg-velos-darker/50">
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
        {activeTab === 'ai' ? (
           <div className="flex flex-col gap-6 mt-2">
              <div className="bg-velos-dark border border-velos-border p-4 rounded-lg">
                 <h4 className="text-sm font-bold text-gray-200 mb-2 flex items-center gap-2"><Sparkles size={14} className="text-velos-primary"/> AI Voiceover</h4>
                 <p className="text-[10px] text-gray-500 mb-3">Generate high-quality voiceover audio from text. (v2 Hook)</p>
                 <textarea className="w-full bg-black border border-gray-800 rounded p-2 text-xs text-gray-300 resize-none h-16 outline-none focus:border-velos-primary" placeholder="Enter script..."></textarea>
                 <button className="w-full bg-velos-darker border border-velos-border hover:bg-velos-primary hover:text-white transition-colors text-xs py-1.5 mt-2 rounded text-gray-400 font-medium">Generate Audio</button>
              </div>

              <div className="bg-velos-dark border border-velos-border p-4 rounded-lg">
                 <h4 className="text-sm font-bold text-gray-200 mb-2 flex items-center gap-2"><ImageIcon size={14} className="text-velos-secondary"/> AI Color Grade</h4>
                 <p className="text-[10px] text-gray-500 mb-3">Extract cinematic LUTs from a reference image. (v2 Hook)</p>
                 <div className="w-full h-16 border border-dashed border-gray-700 rounded flex items-center justify-center text-xs text-gray-600 hover:border-velos-primary cursor-pointer transition-colors">
                    Upload Reference Image
                 </div>
              </div>
           </div>
        ) : filteredAssets.length === 0 ? (

          <div className="text-center text-sm text-gray-500 mt-10">
            No {activeTab}s imported yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredAssets.map(asset => (
              <DraggableAsset key={asset.id} asset={asset}>
              <div
                className="bg-velos-darker border border-velos-border rounded-md aspect-square flex flex-col justify-end p-2 cursor-grab hover:border-velos-primary transition-colors overflow-hidden relative group"
              >
                {/* Visual placeholder based on type */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity">
                  {asset.type === 'video' && <Video size={32} />}
                </div>

                <div className="relative z-10 truncate text-[11px] font-medium text-gray-300 bg-velos-panel/90 backdrop-blur-sm p-1.5 rounded shadow-sm">
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