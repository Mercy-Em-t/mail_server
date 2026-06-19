'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import react-quill-new to prevent SSR window/document errors and fix React 19 findDOMNode issue
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
import 'react-quill-new/dist/quill.snow.css';

export default function AdminDashboard() {
    const [userId] = useState('123e4567-e89b-12d3-a456-426614174000');
    const [lang, setLang] = useState('en');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);
    const initialLoadRef = useRef(false);
    
    // System Health State
    const [health, setHealth] = useState({ memory: '...', uptime: '...', loadAverage: '...' });

    // CMS Matrix State
    const [formData, setFormData] = useState<any>(null);

    // Media Vault State
    const [mediaList, setMediaList] = useState<string[]>([]);
    const [uploadingImage, setUploadingImage] = useState<{ [key: string]: boolean }>({});

    // Inbox State
    const [selectedFormId, setSelectedFormId] = useState<string>('');

    // Fetch initial data
    useEffect(() => {
        setLoading(true);
        fetch(`/api/data?user_id=${userId}&lang=${lang}&admin=true`)
            .then(res => res.json())
            .then(data => {
                const draftData = data.draft[lang] || {};
                
                // Ensure a form key exists
                if (draftData.brand && !draftData.brand.formKey) {
                    draftData.brand.formKey = 'key_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
                }
                
                setFormData(draftData);
                setLoading(false);
                setTimeout(() => { initialLoadRef.current = true; }, 1000);
            });
            
        // Start health polling
        const interval = setInterval(() => {
            fetch('/api/system/health')
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setHealth({ memory: data.memory, uptime: data.uptime, loadAverage: data.loadAverage });
                    }
                })
                .catch(() => {});
        }, 5000);

        fetchMedia();

        return () => clearInterval(interval);
    }, [lang, userId]);

    // Auto-Save Engine
    useEffect(() => {
        if (!formData || !initialLoadRef.current) return;
        const timer = setTimeout(() => {
            handleSave('draft', true);
        }, 2500);
        return () => clearTimeout(timer);
    }, [formData]);

    const fetchMedia = () => {
        fetch('/api/media')
            .then(res => res.json())
            .then(data => {
                if (data.success) setMediaList(data.media);
            });
    };

    const handleSave = async (mode: 'draft' | 'publish', isAutoSave = false) => {
        if (!isAutoSave) setSaving(true);
        try {
            const res = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode, lang, payload: formData })
            });
            const result = await res.json();
            if (result.success) {
                const now = new Date();
                setLastSaved(`Draft auto-saved at ${now.toLocaleTimeString()}`);
                if (!isAutoSave) alert(`Successfully saved to ${mode}!`);
            }
        } catch (error) {
            console.error(error);
        } finally {
            if (!isAutoSave) setSaving(false);
        }
    };

    const handleImageUpload = async (file: File, key: string, callback: (url: string) => void) => {
        setUploadingImage(prev => ({ ...prev, [key]: true }));
        const form = new FormData();
        form.append('image', file);
        try {
            const res = await fetch('/api/upload-image', { method: 'POST', body: form });
            const data = await res.json();
            if (data.success) {
                callback(data.imageUrl);
                fetchMedia();
            } else {
                alert('Image upload failed.');
            }
        } catch (err) {
            alert('Upload error.');
        } finally {
            setUploadingImage(prev => ({ ...prev, [key]: false }));
        }
    };

    const handleDeleteMedia = async (url: string) => {
        if (!confirm("Are you sure you want to archive this asset?")) return;
        try {
            const res = await fetch('/api/delete-media', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            if (data.success) fetchMedia();
        } catch (err) {
            alert('Failed to delete media.');
        }
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login';
        } catch (err) {
            console.error('Logout failed', err);
        }
    };

    const downloadCSV = () => {
        const responses = (formData.responses || {})[selectedFormId] || [];
        const form = (formData.forms || []).find((f: any) => f.id === selectedFormId);
        if (!form || responses.length === 0) return;

        let csv = 'Date,' + form.fields.map((f: any) => `"${f.label}"`).join(',') + '\n';
        responses.forEach((resp: any) => {
            csv += `"${new Date(resp.timestamp).toLocaleString()}",`;
            csv += form.fields.map((f: any) => `"${(resp.data[f.label] || '').replace(/"/g, '""')}"`).join(',');
            csv += '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', `${form.title.replace(/\s+/g, '_')}_Leads.csv`);
        a.click();
    };

    if (loading || !formData) {
        return <div className="min-h-screen bg-[#111] flex items-center justify-center text-[#d0aa69] font-bold text-xl tracking-widest uppercase animate-pulse">Initializing Control Room...</div>;
    }

    return (
        <div className="min-h-screen bg-[#111213] text-white flex">
            {/* Sidebar HUD */}
            <aside className="w-80 border-r border-[#2a2b2d] bg-[#161719] p-6 flex flex-col hidden md:flex">
                <div className="mb-10">
                    <h1 className="text-[#d0aa69] font-black text-2xl tracking-tighter uppercase mb-1"><i className="fa-solid fa-server mr-2"></i>Nexus</h1>
                    <p className="text-gray-500 text-xs font-bold tracking-widest uppercase">Global Control Room</p>
                </div>
                
                <div className="bg-[#111213] border border-[#2a2b2d] rounded-lg p-5 mb-8 shadow-inner">
                    <h3 className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-4 border-b border-[#2a2b2d] pb-2">System Vitals</h3>
                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500"><i className="fa-solid fa-microchip mr-2 text-[#d0aa69]"></i>Memory</span>
                            <span className="font-mono text-[#4ade80]">{health.memory}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500"><i className="fa-solid fa-clock mr-2 text-[#d0aa69]"></i>Uptime</span>
                            <span className="font-mono text-[#60a5fa]">{health.uptime}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500"><i className="fa-solid fa-bolt mr-2 text-[#d0aa69]"></i>Load</span>
                            <span className="font-mono text-[#facc15]">{health.loadAverage}</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1"></div>

                <div className="flex flex-col gap-3">
                    <div className="text-center text-xs text-gray-500 mb-2 italic">
                        {lastSaved || "System idle. Draft changes are monitored automatically."}
                    </div>
                    <button onClick={() => handleSave('draft')} disabled={saving} className="bg-[#1c1d1f] hover:bg-[#2a2b2d] border border-[#2a2b2d] text-white p-3 rounded font-bold text-sm tracking-widest uppercase transition-colors text-left"><i className="fa-solid fa-floppy-disk mr-2 text-gray-400"></i>Save Draft</button>
                    <button onClick={() => handleSave('publish')} disabled={saving} className="bg-[#d0aa69] hover:bg-white text-[#111] p-3 rounded font-black text-sm tracking-widest uppercase transition-colors shadow-lg shadow-[#d0aa69]/20 text-left"><i className="fa-solid fa-rocket mr-2"></i>Deploy Live</button>
                    <div className="flex justify-between items-center mt-4">
                        <a href="/" target="_blank" className="text-gray-500 hover:text-white text-xs font-bold tracking-widest uppercase transition-colors"><i className="fa-solid fa-external-link mr-1"></i> View Storefront</a>
                        <button onClick={handleLogout} className="text-red-400 hover:text-red-300 text-xs font-bold tracking-widest uppercase transition-colors"><i className="fa-solid fa-power-off mr-1"></i> Logout</button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 h-screen overflow-y-auto bg-[#111213] quill-dark-theme-wrapper">
                {/* Header */}
                <header className="sticky top-0 bg-[#111213]/95 backdrop-blur z-40 border-b border-[#2a2b2d] p-6 flex justify-between items-center">
                    <h2 className="text-xl font-bold tracking-widest uppercase text-white">Content Architecture</h2>
                    <div className="flex gap-2 bg-[#1c1d1f] rounded p-1 border border-[#2a2b2d]">
                        <button onClick={() => setLang('en')} className={`px-4 py-1.5 rounded text-xs font-bold tracking-widest uppercase transition-colors ${lang === 'en' ? 'bg-[#d0aa69] text-[#111]' : 'text-gray-400 hover:text-white'}`}>English</button>
                        <button onClick={() => setLang('es')} className={`px-4 py-1.5 rounded text-xs font-bold tracking-widest uppercase transition-colors ${lang === 'es' ? 'bg-[#d0aa69] text-[#111]' : 'text-gray-400 hover:text-white'}`}>Spanish</button>
                    </div>
                </header>

                <div className="p-8 max-w-5xl mx-auto flex flex-col gap-12 pb-32">
                    
                    {/* Brand Settings */}
                    <section className="bg-[#161719] border border-[#2a2b2d] rounded-xl overflow-hidden shadow-2xl">
                        <div className="bg-[#1c1d1f] border-b border-[#2a2b2d] p-4 flex items-center gap-3">
                            <i className="fa-solid fa-flag text-[#d0aa69]"></i>
                            <h3 className="font-bold tracking-widest uppercase text-sm">Brand Identity</h3>
                        </div>
                        <div className="p-6 grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs text-gray-500 font-bold tracking-widest uppercase mb-2">Company Name</label>
                                <input type="text" value={formData.brand?.name || ''} onChange={e => setFormData({...formData, brand: {...formData.brand, name: e.target.value}})} className="w-full bg-[#111] border border-[#2a2b2d] text-white p-3 rounded focus:border-[#d0aa69] outline-none transition-colors" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 font-bold tracking-widest uppercase mb-2">Icon (HTML/SVG)</label>
                                <input type="text" value={formData.brand?.icon || ''} onChange={e => setFormData({...formData, brand: {...formData.brand, icon: e.target.value}})} className="w-full bg-[#111] border border-[#2a2b2d] text-white p-3 rounded focus:border-[#d0aa69] outline-none font-mono text-sm" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs text-gray-500 font-bold tracking-widest uppercase mb-2">Notification Email (For Leads)</label>
                                <input type="email" value={formData.brand?.adminEmail || ''} onChange={e => setFormData({...formData, brand: {...formData.brand, adminEmail: e.target.value}})} placeholder="Where should we send your leads?" className="w-full bg-[#111] border border-[#2a2b2d] text-white p-3 rounded focus:border-[#d0aa69] outline-none transition-colors" />
                            </div>
                            <div className="md:col-span-2 bg-[#d0aa69]/10 p-4 rounded-lg border border-[#d0aa69]/30">
                                <label className="block text-xs text-[#d0aa69] font-bold tracking-widest uppercase mb-1">Public Form Key (For External Sites)</label>
                                <p className="text-xs text-gray-400 mb-3">Use this key to securely submit forms to your endpoint from other websites. Do NOT expose your true User ID.</p>
                                <div className="flex gap-3">
                                    <input type="text" readOnly value={formData.brand?.formKey || ''} className="w-full bg-[#111] border border-[#333] text-[#d0aa69] p-3 rounded font-mono text-sm outline-none" />
                                    <button type="button" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/submit-form/[form_id]?key=${formData.brand?.formKey || ''}`); alert('Endpoint Snippet Copied!'); }} className="bg-[#111] hover:bg-[#333] text-white px-6 rounded transition-colors font-semibold text-sm border border-[#333]">Copy URL</button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Hero Settings */}
                    <section className="bg-[#161719] border border-[#2a2b2d] rounded-xl overflow-hidden shadow-2xl">
                        <div className="bg-[#1c1d1f] border-b border-[#2a2b2d] p-4 flex items-center gap-3">
                            <i className="fa-solid fa-image text-[#d0aa69]"></i>
                            <h3 className="font-bold tracking-widest uppercase text-sm">Hero Banner</h3>
                        </div>
                        <div className="p-6 flex flex-col gap-6">
                            <div>
                                <label className="block text-xs text-gray-500 font-bold tracking-widest uppercase mb-2">Tagline</label>
                                <input type="text" value={formData.hero?.tagline || ''} onChange={e => setFormData({...formData, hero: {...formData.hero, tagline: e.target.value}})} className="w-full bg-[#111] border border-[#2a2b2d] text-white p-3 rounded focus:border-[#d0aa69] outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 font-bold tracking-widest uppercase mb-2">Headline</label>
                                <input type="text" value={formData.hero?.headline || ''} onChange={e => setFormData({...formData, hero: {...formData.hero, headline: e.target.value}})} className="w-full bg-[#111] border border-[#2a2b2d] text-white p-3 rounded focus:border-[#d0aa69] outline-none font-bold text-lg" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 font-bold tracking-widest uppercase mb-2">Subtext</label>
                                <ReactQuill theme="snow" value={formData.hero?.subtext || ''} onChange={val => setFormData({...formData, hero: {...formData.hero, subtext: val}})} className="bg-[#111] text-white border-[#2a2b2d]" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 font-bold tracking-widest uppercase mb-2">Background Image URL</label>
                                <div className="flex gap-4">
                                    <input type="text" value={formData.hero?.bgImage || ''} onChange={e => setFormData({...formData, hero: {...formData.hero, bgImage: e.target.value}})} className="flex-1 bg-[#111] border border-[#2a2b2d] text-blue-400 p-3 rounded focus:border-[#d0aa69] outline-none font-mono text-sm" />
                                    <div className="relative overflow-hidden inline-block">
                                        <button className="bg-[#1c1d1f] border border-[#2a2b2d] text-white px-4 py-3 rounded text-xs font-bold tracking-widest uppercase hover:bg-[#2a2b2d]">
                                            {uploadingImage['hero'] ? 'Uploading...' : 'Upload File'}
                                        </button>
                                        <input type="file" accept="image/*" onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                handleImageUpload(e.target.files[0], 'hero', (url) => setFormData({...formData, hero: {...formData.hero, bgImage: url}}));
                                            }
                                        }} className="absolute inset-0 opacity-0 cursor-pointer" />
                                    </div>
                                </div>
                                {/* Media Vault Gallery */}
                                <div className="mt-4 grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 bg-[#111] p-4 rounded border border-[#2a2b2d] h-48 overflow-y-auto">
                                    {mediaList.map((url, idx) => (
                                        <div key={idx} onClick={() => setFormData({...formData, hero: {...formData.hero, bgImage: url}})} className={`relative aspect-video rounded cursor-pointer overflow-hidden border-2 ${formData.hero?.bgImage === url ? 'border-[#d0aa69]' : 'border-transparent hover:border-gray-500'}`}>
                                            <img src={url} className="w-full h-full object-cover" />
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteMedia(url); }} className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] hover:bg-red-500"><i className="fa-solid fa-xmark"></i></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Services Builder */}
                    <section className="bg-[#161719] border border-[#2a2b2d] rounded-xl overflow-hidden shadow-2xl">
                        <div className="bg-[#1c1d1f] border-b border-[#2a2b2d] p-4 flex items-center gap-3">
                            <i className="fa-solid fa-list-check text-[#d0aa69]"></i>
                            <h3 className="font-bold tracking-widest uppercase text-sm">Services Array</h3>
                        </div>
                        <div className="p-6">
                            {(formData.servicesSection?.items || []).map((service: any, sIdx: number) => (
                                <div key={sIdx} className="bg-[#111] border border-[#2a2b2d] p-5 rounded-lg mb-6 relative">
                                    <button onClick={() => {
                                        const newServices = [...formData.servicesSection.items];
                                        newServices.splice(sIdx, 1);
                                        setFormData({...formData, servicesSection: {...formData.servicesSection, items: newServices}});
                                    }} className="absolute top-4 right-4 text-red-400 hover:text-red-300"><i className="fa-solid fa-trash"></i></button>
                                    
                                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-xs text-gray-500 font-bold tracking-widest uppercase mb-2">Icon (FA Class)</label>
                                            <input type="text" value={service.icon} onChange={e => {
                                                const newServices = [...formData.servicesSection.items];
                                                newServices[sIdx].icon = e.target.value;
                                                setFormData({...formData, servicesSection: {...formData.servicesSection, items: newServices}});
                                            }} className="w-full bg-[#1c1d1f] border border-[#2a2b2d] text-white p-2 rounded" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 font-bold tracking-widest uppercase mb-2">Title</label>
                                            <input type="text" value={service.title} onChange={e => {
                                                const newServices = [...formData.servicesSection.items];
                                                newServices[sIdx].title = e.target.value;
                                                setFormData({...formData, servicesSection: {...formData.servicesSection, items: newServices}});
                                            }} className="w-full bg-[#1c1d1f] border border-[#2a2b2d] text-white p-2 rounded" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 font-bold tracking-widest uppercase mb-2">Description</label>
                                        <ReactQuill theme="snow" value={service.desc} onChange={val => {
                                            const newServices = [...formData.servicesSection.items];
                                            newServices[sIdx].desc = val;
                                            setFormData({...formData, servicesSection: {...formData.servicesSection, items: newServices}});
                                        }} className="bg-[#1c1d1f] text-white border-[#2a2b2d]" />
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => {
                                const newServices = [...(formData.servicesSection?.items || [])];
                                newServices.push({ icon: 'fa-solid fa-star', title: 'New Service', desc: '' });
                                setFormData({...formData, servicesSection: {...formData.servicesSection, items: newServices}});
                            }} className="w-full bg-[#1c1d1f] border border-dashed border-[#2a2b2d] text-gray-400 p-4 rounded hover:bg-[#2a2b2d] hover:text-white transition-colors font-bold tracking-widest uppercase text-sm"><i className="fa-solid fa-plus mr-2"></i>Add Service</button>
                        </div>
                    </section>

                    {/* Stats Builder */}
                    <section className="bg-[#161719] border border-[#2a2b2d] rounded-xl overflow-hidden shadow-2xl">
                        <div className="bg-[#1c1d1f] border-b border-[#2a2b2d] p-4 flex items-center gap-3">
                            <i className="fa-solid fa-chart-line text-[#d0aa69]"></i>
                            <h3 className="font-bold tracking-widest uppercase text-sm">Stats Bar</h3>
                        </div>
                        <div className="p-6">
                            {(formData.stats || []).map((stat: any, stIdx: number) => (
                                <div key={stIdx} className="flex gap-4 items-center mb-4 bg-[#111] p-3 rounded border border-[#2a2b2d]">
                                    <input type="text" placeholder="Icon Class" value={stat.icon} onChange={e => {
                                        const newStats = [...formData.stats];
                                        newStats[stIdx].icon = e.target.value;
                                        setFormData({...formData, stats: newStats});
                                    }} className="w-1/4 bg-[#1c1d1f] border border-[#2a2b2d] text-white p-2 rounded text-sm" />
                                    <input type="text" placeholder="Value (e.g. 100+)" value={stat.value} onChange={e => {
                                        const newStats = [...formData.stats];
                                        newStats[stIdx].value = e.target.value;
                                        setFormData({...formData, stats: newStats});
                                    }} className="w-1/4 bg-[#1c1d1f] border border-[#2a2b2d] text-[#d0aa69] font-bold p-2 rounded text-sm" />
                                    <input type="text" placeholder="Label" value={stat.label} onChange={e => {
                                        const newStats = [...formData.stats];
                                        newStats[stIdx].label = e.target.value;
                                        setFormData({...formData, stats: newStats});
                                    }} className="w-2/4 bg-[#1c1d1f] border border-[#2a2b2d] text-white p-2 rounded text-sm" />
                                    <button onClick={() => {
                                        const newStats = [...formData.stats];
                                        newStats.splice(stIdx, 1);
                                        setFormData({...formData, stats: newStats});
                                    }} className="text-red-400 hover:text-red-300 px-2"><i className="fa-solid fa-trash"></i></button>
                                </div>
                            ))}
                            <button onClick={() => {
                                const newStats = [...(formData.stats || [])];
                                newStats.push({ icon: 'fa-solid fa-check', value: '', label: '' });
                                setFormData({...formData, stats: newStats});
                            }} className="text-xs font-bold tracking-widest text-[#d0aa69] uppercase hover:text-white mt-2"><i className="fa-solid fa-plus mr-1"></i> Add Stat</button>
                        </div>
                    </section>

                    {/* Projects Builder */}
                    <section className="bg-[#161719] border border-[#2a2b2d] rounded-xl overflow-hidden shadow-2xl">
                        <div className="bg-[#1c1d1f] border-b border-[#2a2b2d] p-4 flex items-center gap-3">
                            <i className="fa-solid fa-images text-[#d0aa69]"></i>
                            <h3 className="font-bold tracking-widest uppercase text-sm">Projects / Case Studies</h3>
                        </div>
                        <div className="p-6">
                            {(formData.projectsSection?.items || []).map((proj: any, pIdx: number) => (
                                <div key={pIdx} className="bg-[#111] border border-[#2a2b2d] p-5 rounded-lg mb-6 relative flex gap-6">
                                    <button onClick={() => {
                                        const newProj = [...formData.projectsSection.items];
                                        newProj.splice(pIdx, 1);
                                        setFormData({...formData, projectsSection: {...formData.projectsSection, items: newProj}});
                                    }} className="absolute top-4 right-4 text-red-400 hover:text-red-300"><i className="fa-solid fa-trash"></i></button>
                                    
                                    <div className="w-1/3">
                                        <div className="aspect-square bg-[#1c1d1f] rounded border border-[#2a2b2d] overflow-hidden mb-3 relative group">
                                            {proj.image ? <img src={proj.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-600"><i className="fa-solid fa-image text-3xl"></i></div>}
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <div className="relative overflow-hidden inline-block">
                                                    <button className="bg-[#d0aa69] text-[#111] px-4 py-2 rounded text-xs font-bold uppercase">{uploadingImage[`proj_${pIdx}`] ? 'Wait...' : 'Upload'}</button>
                                                    <input type="file" accept="image/*" onChange={(e) => {
                                                        if (e.target.files && e.target.files[0]) {
                                                            handleImageUpload(e.target.files[0], `proj_${pIdx}`, (url) => {
                                                                const newProj = [...formData.projectsSection.items];
                                                                newProj[pIdx].image = url;
                                                                setFormData({...formData, projectsSection: {...formData.projectsSection, items: newProj}});
                                                            });
                                                        }
                                                    }} className="absolute inset-0 opacity-0 cursor-pointer" />
                                                </div>
                                            </div>
                                        </div>
                                        <input type="text" placeholder="Image URL" value={proj.image} onChange={e => {
                                            const newProj = [...formData.projectsSection.items];
                                            newProj[pIdx].image = e.target.value;
                                            setFormData({...formData, projectsSection: {...formData.projectsSection, items: newProj}});
                                        }} className="w-full bg-[#1c1d1f] border border-[#2a2b2d] text-white p-2 rounded text-xs" />
                                    </div>

                                    <div className="w-2/3 flex flex-col gap-4 pt-8">
                                        <div>
                                            <label className="block text-xs text-gray-500 font-bold tracking-widest uppercase mb-2">Project Title</label>
                                            <input type="text" value={proj.title} onChange={e => {
                                                const newProj = [...formData.projectsSection.items];
                                                newProj[pIdx].title = e.target.value;
                                                setFormData({...formData, projectsSection: {...formData.projectsSection, items: newProj}});
                                            }} className="w-full bg-[#1c1d1f] border border-[#2a2b2d] text-white p-2 rounded" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 font-bold tracking-widest uppercase mb-2">Location / Subtitle</label>
                                            <input type="text" value={proj.location} onChange={e => {
                                                const newProj = [...formData.projectsSection.items];
                                                newProj[pIdx].location = e.target.value;
                                                setFormData({...formData, projectsSection: {...formData.projectsSection, items: newProj}});
                                            }} className="w-full bg-[#1c1d1f] border border-[#2a2b2d] text-white p-2 rounded" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => {
                                const newProj = [...(formData.projectsSection?.items || [])];
                                newProj.push({ image: '', title: 'New Project', location: 'City, Country' });
                                setFormData({...formData, projectsSection: {...formData.projectsSection, items: newProj}});
                            }} className="w-full bg-[#1c1d1f] border border-dashed border-[#2a2b2d] text-gray-400 p-4 rounded hover:bg-[#2a2b2d] hover:text-white transition-colors font-bold tracking-widest uppercase text-sm"><i className="fa-solid fa-plus mr-2"></i>Add Project</button>
                        </div>
                    </section>

                    {/* Forms Builder */}
                    <section className="bg-[#161719] border border-[#2a2b2d] rounded-xl overflow-hidden shadow-2xl">
                        <div className="bg-[#1c1d1f] border-b border-[#2a2b2d] p-4 flex items-center gap-3">
                            <i className="fa-solid fa-envelope-open-text text-[#d0aa69]"></i>
                            <h3 className="font-bold tracking-widest uppercase text-sm">Dynamic Forms</h3>
                        </div>
                        <div className="p-6">
                            {(formData.forms || []).map((form: any, fIdx: number) => (
                                <div key={fIdx} className="border border-[#2a2b2d] bg-[#111] rounded-lg p-5 mb-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <input type="text" value={form.title} onChange={e => {
                                            const newForms = [...formData.forms];
                                            newForms[fIdx].title = e.target.value;
                                            setFormData({...formData, forms: newForms});
                                        }} className="bg-transparent border-none text-xl font-bold text-[#d0aa69] outline-none w-full" />
                                        <button onClick={() => {
                                            const newForms = [...formData.forms];
                                            newForms.splice(fIdx, 1);
                                            setFormData({...formData, forms: newForms});
                                        }} className="text-red-400 hover:text-red-300 px-2"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                    <div className="pl-4 border-l-2 border-[#2a2b2d] flex flex-col gap-3">
                                        {form.fields.map((field: any, fieldIdx: number) => (
                                            <div key={fieldIdx} className="flex gap-4 items-center">
                                                <input type="text" value={field.label} onChange={e => {
                                                    const newForms = [...formData.forms];
                                                    newForms[fIdx].fields[fieldIdx].label = e.target.value;
                                                    setFormData({...formData, forms: newForms});
                                                }} className="bg-[#1c1d1f] border border-[#2a2b2d] text-white p-2 text-sm rounded flex-1 outline-none focus:border-[#d0aa69]" />
                                                <select value={field.type} onChange={e => {
                                                    const newForms = [...formData.forms];
                                                    newForms[fIdx].fields[fieldIdx].type = e.target.value;
                                                    setFormData({...formData, forms: newForms});
                                                }} className="bg-[#1c1d1f] border border-[#2a2b2d] text-white p-2 text-sm rounded outline-none focus:border-[#d0aa69] w-32">
                                                    <option value="text">Text</option>
                                                    <option value="email">Email</option>
                                                    <option value="textarea">Textarea</option>
                                                </select>
                                                <button onClick={() => {
                                                    const newForms = [...formData.forms];
                                                    newForms[fIdx].fields.splice(fieldIdx, 1);
                                                    setFormData({...formData, forms: newForms});
                                                }} className="text-red-400 hover:text-red-300 px-2"><i className="fa-solid fa-trash"></i></button>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => {
                                        const newForms = [...formData.forms];
                                        newForms[fIdx].fields.push({ name: `field_${Date.now()}`, label: 'New Field', type: 'text', required: false });
                                        setFormData({...formData, forms: newForms});
                                    }} className="mt-4 text-xs font-bold tracking-widest text-[#d0aa69] uppercase hover:text-white"><i className="fa-solid fa-plus mr-1"></i> Add Field</button>
                                </div>
                            ))}
                            <button onClick={() => {
                                const newForms = [...(formData.forms || [])];
                                newForms.push({ id: `form_${Date.now()}`, title: 'New Form', fields: [{ name: 'email', label: 'Email Address', type: 'email', required: true }] });
                                setFormData({...formData, forms: newForms});
                            }} className="w-full bg-[#1c1d1f] border border-dashed border-[#2a2b2d] text-gray-400 p-4 rounded hover:bg-[#2a2b2d] hover:text-white transition-colors font-bold tracking-widest uppercase text-sm"><i className="fa-solid fa-plus mr-2"></i>Create New Form Engine</button>
                        </div>
                    </section>

                    {/* Lead Responses Inbox */}
                    <section className="bg-[#161719] border border-[#2a2b2d] rounded-xl overflow-hidden shadow-2xl">
                        <div className="bg-[#1c1d1f] border-b border-[#2a2b2d] p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <i className="fa-solid fa-inbox text-[#d0aa69]"></i>
                                <h3 className="font-bold tracking-widest uppercase text-sm">Lead Responses Inbox</h3>
                            </div>
                            {selectedFormId && (formData.responses || {})[selectedFormId]?.length > 0 && (
                                <button onClick={downloadCSV} className="bg-[#27ae60] text-white px-3 py-1.5 rounded text-xs font-bold tracking-widest uppercase hover:bg-[#2ecc71] transition-colors"><i className="fa-solid fa-file-csv mr-2"></i>Download CSV</button>
                            )}
                        </div>
                        <div className="p-6">
                            <select value={selectedFormId} onChange={e => setSelectedFormId(e.target.value)} className="w-full bg-[#111] border border-[#2a2b2d] text-white p-3 rounded mb-6 outline-none focus:border-[#d0aa69]">
                                <option value="">-- Select Form --</option>
                                {(formData.forms || []).map((f: any) => (
                                    <option key={f.id} value={f.id}>{f.title}</option>
                                ))}
                            </select>

                            {selectedFormId ? (
                                <div className="overflow-x-auto">
                                    {(formData.responses || {})[selectedFormId]?.length > 0 ? (
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-[#1c1d1f] border-b border-[#2a2b2d]">
                                                <tr>
                                                    <th className="p-3 text-gray-400 font-bold uppercase tracking-widest text-xs">Date</th>
                                                    {(formData.forms.find((f: any) => f.id === selectedFormId)?.fields || []).map((f: any, idx: number) => (
                                                        <th key={idx} className="p-3 text-gray-400 font-bold uppercase tracking-widest text-xs">{f.label}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {formData.responses[selectedFormId].map((resp: any, idx: number) => (
                                                    <tr key={idx} className="border-b border-[#2a2b2d] hover:bg-[#1c1d1f]/50">
                                                        <td className="p-3 text-gray-300">{new Date(resp.timestamp).toLocaleString()}</td>
                                                        {(formData.forms.find((f: any) => f.id === selectedFormId)?.fields || []).map((f: any, fIdx: number) => (
                                                            <td key={fIdx} className="p-3 text-white">{resp.data[f.label] || '-'}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="text-gray-500 italic text-center py-8">No responses found for this form.</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-gray-500 italic text-center py-8">Select a form to view its leads.</p>
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
