'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (data.success) {
                router.push('/admin');
            } else {
                setErrorMsg(data.message || 'Login failed.');
            }
        } catch (err) {
            setErrorMsg('Server communication failure.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async () => {
        setErrorMsg('');
        setSuccessMsg('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (data.success) {
                setSuccessMsg(data.message || 'Registration successful!');
            } else {
                setErrorMsg(data.message || 'Registration failed.');
            }
        } catch (err) {
            setErrorMsg('Server communication failure.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#121315] text-white flex justify-center items-center font-sans">
            <div className="bg-[#1c1d1f] p-10 rounded-lg w-full max-w-[380px] border border-[#2a2b2d] text-center shadow-2xl">
                <div className="text-[1.8rem] tracking-[2px] mb-[30px] text-[#d0aa69] font-serif font-bold uppercase">
                    NEXUS
                </div>
                
                <form onSubmit={handleLogin}>
                    <div className="mb-5 text-left">
                        <label className="block text-[0.75rem] uppercase tracking-[1px] mb-2 text-[#a0a0a0] font-bold">
                            Email
                        </label>
                        <input 
                            type="email" 
                            required 
                            autoComplete="off"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-3 bg-[#121315] border border-[#333] rounded text-white focus:border-[#d0aa69] outline-none transition-colors"
                        />
                    </div>
                    <div className="mb-5 text-left">
                        <label className="block text-[0.75rem] uppercase tracking-[1px] mb-2 text-[#a0a0a0] font-bold">
                            Password
                        </label>
                        <input 
                            type="password" 
                            required 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 bg-[#121315] border border-[#333] rounded text-white focus:border-[#d0aa69] outline-none transition-colors"
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="bg-[#d0aa69] text-[#121315] border-none p-3.5 w-full rounded cursor-pointer font-semibold uppercase tracking-[1px] mt-2 hover:bg-[#b89254] transition-colors disabled:opacity-50"
                    >
                        {isLoading ? 'Processing...' : 'Login'}
                    </button>
                    
                    <button 
                        type="button" 
                        onClick={handleRegister}
                        disabled={isLoading}
                        className="bg-transparent border border-[#d0aa69] text-[#d0aa69] p-3.5 w-full rounded cursor-pointer font-semibold uppercase tracking-[1px] mt-3 hover:bg-[#d0aa69]/10 transition-colors disabled:opacity-50"
                    >
                        Register
                    </button>

                    {errorMsg && (
                        <div className="text-[#e74c3c] text-[0.8rem] mt-[15px] block font-medium">
                            {errorMsg}
                        </div>
                    )}
                    {successMsg && (
                        <div className="text-green-500 text-[0.8rem] mt-[15px] block font-medium">
                            {successMsg}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
