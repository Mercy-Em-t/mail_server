'use client';

import React, { useState } from 'react';
import { CustomForm } from '../types';

interface DynamicFormsProps {
    forms: CustomForm[];
    formKey?: string;
    lang?: string;
}

export default function DynamicForms({ forms, formKey, lang = 'en' }: DynamicFormsProps) {
    const [submitting, setSubmitting] = useState<{ [key: string]: boolean }>({});
    const [message, setMessage] = useState<{ [key: string]: { type: 'success' | 'error', text: string } }>({});

    if (!forms || forms.length === 0) return null;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, formId: string) => {
        e.preventDefault();
        setSubmitting(prev => ({ ...prev, [formId]: true }));
        setMessage(prev => ({ ...prev, [formId]: null as any }));

        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());

        try {
            // Using the Next.js Vercel API Route
            // Provide key if available for Multi-Tenant resolution
            const endpoint = `/api/submit-form/${formId}?lang=${lang}${formKey ? `&key=${formKey}` : ''}`;
            
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();

            if (res.ok && result.success) {
                setMessage(prev => ({ ...prev, [formId]: { type: 'success', text: result.message || 'Form submitted successfully!' } }));
                (e.target as HTMLFormElement).reset();
            } else {
                throw new Error(result.message || 'Submission failed');
            }
        } catch (error: any) {
            setMessage(prev => ({ ...prev, [formId]: { type: 'error', text: error.message } }));
        } finally {
            setSubmitting(prev => ({ ...prev, [formId]: false }));
        }
    };

    return (
        <section className="container" style={{ paddingBottom: '100px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                {forms.map(form => (
                    <div key={form.id} className="dynamic-form-wrapper" style={{ 
                        background: 'var(--bg-card)', 
                        padding: '40px', 
                        borderRadius: '4px', 
                        marginTop: '40px',
                        border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        <h2 style={{ fontFamily: 'var(--font-serif)', marginBottom: '20px', color: 'var(--text-light)' }}>
                            {form.title}
                        </h2>
                        
                        {message[form.id] && (
                            <div style={{
                                padding: '15px',
                                marginBottom: '20px',
                                borderRadius: '4px',
                                background: message[form.id].type === 'success' ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                                color: message[form.id].type === 'success' ? '#2ecc71' : '#e74c3c',
                                border: `1px solid ${message[form.id].type === 'success' ? '#2ecc71' : '#e74c3c'}`
                            }}>
                                {message[form.id].text}
                            </div>
                        )}

                        <form onSubmit={(e) => handleSubmit(e, form.id)}>
                            {form.fields.map((field, idx) => (
                                <div key={idx} style={{ marginBottom: '20px' }}>
                                    <label style={{ 
                                        display: 'block', 
                                        marginBottom: '8px', 
                                        fontSize: '0.85rem', 
                                        color: 'var(--text-muted)' 
                                    }}>
                                        {field.label}
                                    </label>
                                    
                                    {field.type === 'textarea' ? (
                                        <textarea
                                            name={field.label.replace(/\s+/g, '_').toLowerCase()}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                background: 'rgba(0,0,0,0.2)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'var(--text-light)',
                                                borderRadius: '4px',
                                                minHeight: '100px',
                                                fontFamily: 'var(--font-sans)'
                                            }}
                                        ></textarea>
                                    ) : (
                                        <input
                                            type={field.type}
                                            name={field.label.replace(/\s+/g, '_').toLowerCase()}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                background: 'rgba(0,0,0,0.2)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'var(--text-light)',
                                                borderRadius: '4px',
                                                fontFamily: 'var(--font-sans)'
                                            }}
                                        />
                                    )}
                                </div>
                            ))}
                            <button 
                                type="submit" 
                                className="btn btn-solid" 
                                style={{ width: '100%', justifyContent: 'center' }}
                                disabled={submitting[form.id]}
                            >
                                {submitting[form.id] ? 'Submitting...' : 'Submit Response'}
                            </button>
                        </form>
                    </div>
                ))}
            </div>
        </section>
    );
}
