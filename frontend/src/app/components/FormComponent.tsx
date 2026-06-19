'use client';
import { useState } from 'react';

export default function FormComponent({ form, userId, lang }: { form: any, userId: string, lang: string }) {
    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setStatus('Submitting...');

        const formData = new FormData(e.currentTarget);
        const payload: Record<string, string> = {};
        formData.forEach((value, key) => { payload[key] = value as string; });

        try {
            const res = await fetch(`/api/submit-form/${form.id}?user_id=${userId}&lang=${lang}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setStatus('Message sent successfully!');
                (e.target as HTMLFormElement).reset();
            } else {
                setStatus(data.message || 'Error sending message.');
            }
        } catch (err) {
            setStatus('Network error. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#111213] border border-[#2a2b2d] p-8 rounded-lg mb-8">
            <h4 className="text-xl font-bold mb-6 text-white border-b border-[#2a2b2d] pb-4">{form.title}</h4>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {form.fields.map((field: any, idx: number) => {
                    if (field.type === 'textarea') {
                        return (
                            <div key={idx} className="flex flex-col gap-2">
                                <label className="text-sm text-gray-400 uppercase tracking-wider">{field.label}</label>
                                <textarea name={field.name} required={field.required} rows={4} className="bg-[#1c1d1f] border border-[#2a2b2d] p-3 text-white rounded focus:border-[#d0aa69] outline-none transition-colors" />
                            </div>
                        );
                    }
                    return (
                        <div key={idx} className="flex flex-col gap-2">
                            <label className="text-sm text-gray-400 uppercase tracking-wider">{field.label}</label>
                            <input type={field.type} name={field.name} required={field.required} className="bg-[#1c1d1f] border border-[#2a2b2d] p-3 text-white rounded focus:border-[#d0aa69] outline-none transition-colors" />
                        </div>
                    );
                })}
                <button type="submit" disabled={loading} className="mt-4 bg-[#d0aa69] text-[#111] font-bold uppercase tracking-widest py-4 rounded hover:bg-white transition-colors disabled:opacity-50">
                    {loading ? 'Transmitting...' : 'Submit Response'}
                </button>
                {status && <div className="mt-4 text-sm font-bold text-center text-[#d0aa69]">{status}</div>}
            </form>
        </div>
    );
}
